# mini-react 테스트 전략

## 테스트 피라미드

- **Unit (90%)**: 순수 함수/변환 규칙 중심 (`shared`, `runtime`, `hooks`, `core` 초안 함수).
- **Integration (8%)**: 패키지 진입점(`index.ts`)과 렌더 호출의 결합, 빌드/테스트/플레이그라운드 연동.
- **E2E/Playground (2%)**: 실제 브라우저 번들 빌드/실행 동작 확인.

> 목표: 현재는 구현이 단편적이라도, 동작 규약을 먼저 고정하고 이후 구현 채워넣기 시 해당 규약을 역추적 가능하게 한다.

## 테스트 범위 기준

### 단위 테스트

- `shared.createElementInternal`
  - 이유: 모든 렌더 파이프라인의 단일 진입 데이터 구조이므로 VNode 정합성 깨짐이 전체 오동작으로 직결됨.
- `runtime.createElement`
  - 이유: JSX transform 체인의 첫 단계로 타입/props/children 계약을 고정.
- `renderer-dom.render`
  - 이유: 컨테이너 null 처리, null 렌더링 시 클리어 동작, placeholder 출력 규칙을 검증해야 한다.
- `hooks.useState`
  - 이유: Hook API가 실제 렌더링 시점 동작으로 확장될 때 상태 변경 규약 회귀를 선제 탐지.

### 통합 테스트

- `packages/mini-react/src/index.ts` 재수출 계약 검증
  - 이유: Public API 경계가 실제 소비자 빌드에서 깨지는 문제를 방지.
- `playground` 실행 경로
  - 이유: `mini-react` import alias, Vite/JSX 설정이 실제 소비 환경과 맞는지 확인.

### Playground/Build 검증

- 최소 검증은 `vite build` 성공으로 대체한다. 구현이 placeholder 상태에서는 런타임 동작보다 번들링 정합성이 우선이다.

## 실행 명령어 (최소 검증)

- 빌드: `pnpm run check:build`
- 테스트: `pnpm run check:test`
- 플레이그라운드: `pnpm run check:playground`
- 전체 패스(선택): `pnpm run check`

## 테스트 템플릿 규칙

- 테스트는 `packages/mini-react/__tests__`에 배치하고 공통 유틸은 테스트 전용으로 분리한다.
- 스냅샷 테스트는 VDOM 문자열/속성 렌더링 문자열이 아니라 계약 기반(assertion) 테스트를 우선한다.
- `internal` 구현 변경이 있을 경우, 최소 1개 public API 회귀 테스트를 추가해 파급 범위를 확인한다.

## 현재 상태에서 테스트 미작성 사유

- 구현이 최소 뼈대 단계이고 일부 기능이 TODO여서 정해진 런타임 행위가 자주 변경된다.
- 이 단계의 핵심 목표는 계약 문서/검증 경로 고정이며, 동작 테스트는 기능이 구현된 직후 단계적 추가가 효율적이다.
