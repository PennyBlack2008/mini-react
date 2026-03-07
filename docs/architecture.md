# mini-react Architecture

## 1) 설계 개요

mini-react는 다음 두 계층으로 나뉜다.

- **패키지 레벨**: `packages/mini-react`가 공개 API를 제공하고, `apps/playground`가 소비자 애플리케이션 역할을 한다.
- **모듈 레벨**: 런타임, 렌더러, 상태 훅, 공유 타입/헬퍼로 분리되어 있고, 최상위 `src/index.ts`만 공개 API로 노출한다.

현재 구현은 학습 단계이므로 기능은 최소화된 TODO 상태이지만, 외부 의존도와 export 경로를 엄격히 제한해 운영 시 확장 비용을 줄이는 방향으로 설계한다.

## 2) 모듈 경계

- **Public Surface (허용 출구)**
  - `packages/mini-react/src/index.ts`
  - 현재 노출: `createElement`, `VNode`, `PrimitiveChild`, `render`, `createRoot`, `useState`
- **Core**
  - `packages/mini-react/src/core/index.ts`
  - 루트 관리 API 진입점(`createRoot`)과 렌더 라이프사이클 엔트리를 담당한다.
- **Runtime**
  - `packages/mini-react/src/runtime/jsx-runtime.ts`
  - JSX 진입부(`createElement`)와 `VNode` 타입 변환 책임.
- **Renderer**
  - `packages/mini-react/src/renderer-dom/index.ts`
  - DOM 바인딩 및 실제 렌더 출력을 담당. 현재는 placeholder 구현.
- **Hooks**
  - `packages/mini-react/src/hooks/index.ts`
  - Hook 호출 규약과 상태 갱신 규칙이 배치될 구간.
- **Shared**
  - `packages/mini-react/src/shared/index.ts`
  - `VNode` 타입, 내부 헬퍼(`createElementInternal`)를 보관.
- **Tests**
  - `packages/mini-react/__tests__` 계열은 모듈 내부 동작 검증 전용이며 절대 `src/index.ts` 바깥 공개 API를 강제 export하면 안 된다.

## 3) 데이터/제어 흐름

### 현재 단계의 흐름

1. 사용자 코드에서 `createElement(type, props, ...children)` 호출.
2. 내부적으로 `createElementInternal`이 `VNode`를 구성.
3. `render(vnodeOrNull, container)`가 전달된 `VNode`/문자열을 컨테이너에 반영.
4. `createRoot`는 향후 스케줄링/업데이트/언마운트 흐름의 엔트리로 확장 예정.

### 렌더링 체인(예정)

`App 코드 -> createElement -> VNode -> createRoot.render -> scheduler/commit -> renderer-dom patching -> DOM`

## 4) Invariants (불변식)

- `render` 입력은 `VNode | null` 또는 `null`에 안전해야 하며, `container === null`이면 부수효과 없이 종료되어야 한다.
- `VNode`는 항상 `type/props/children/key` 구조를 유지해야 한다.
- `packages/mini-react/src/index.ts`를 제외한 파일은 공개 API 계약을 직접 노출하지 않는다. (`src/**/internal.ts` 계열은 export 금지)
- public API는 semantic versioning 기준 하위 호환을 기본값으로 가정하고, breaking 변경은 PR 리뷰에서 명시적으로 합의해야 한다.

## 5) 확장 포인트

- `renderer-dom`과 `core`를 분리해 추가 renderer(WebGL/SSR/Native)와의 결합도를 낮춘다.
- `hooks`를 전역 dispatcher 구조로 바꿔 훅 상태/업데이트 큐를 병렬 렌더 가능성까지 고려.
- `shared` 계층에서 Props 정규화, keyed diff, 키 제약 규칙을 강화해 재조정 알고리즘 비용을 줄인다.
- 테스트 전략(아래 문서)와 PR 리뷰 기준을 연동해 구현 전 계약을 고정한다.

## 6) 변경 로그

- 2026-03-04: `docs/architecture.md`의 Placeholder를 실제 아키텍처 뼈대(설계 개요/경계/흐름/불변식/확장 포인트)로 대체.
- 2026-03-04: `packages/mini-react/src/index.ts`를 유일 공개 API 진입점으로 명시하고 `internal` 노출 규칙을 문서화.
- 2026-03-04: mini-react 운영 산출물을 위한 `check` 워크플로우(빌드/테스트/플레이그라운드)와 문서 정합성 계획을 연결.
- 2026-03-04: `packages/mini-react/src/core/index.ts`에 `createRoot(container)` 최소 계약(render/unmount)을 구현하고 `core` 단위 테스트 추가.
- 2026-03-04: `createRoot`에 최소 렌더 스케줄링(동일 tick 배칭)과 `unmount` 멱등성 규약을 추가해 동시 render/unmount 안전성을 강화.
- 2026-03-04: `renderer-dom.render` 기본 계약(null 컨테이너/null 렌더/primitive+VNode placeholder) 단위 테스트를 추가해 DOM 출력 규약을 고정.
- 2026-03-04: `createRoot`를 공개 진입점(`index.ts`) 기준으로 통합 스모크 테스트하고, `createElement` 연계 렌더 경로를 검증.
- 2026-03-04: `core`에서 렌더 스케줄링/호출만 담당하고 `renderer-dom`에서 실제 DOM 커밋(`commitRoot`)을 수행하도록 계층 분리를 반영.
- 2026-03-04: `shared.createElementInternal`에 children 정규화(중첩 배열 펼침, null/undefined/boolean 제거) 적용.
- 2026-03-04: `shared.createElementInternal`가 key props를 제외한 props만 보유하도록 정규화 규칙을 도입.
- 2026-03-04: `runtime.createElement` 입력 타입을 unknown[]로 확장해 정규화 파이프라인이 중첩 children를 수용하도록 조정.
- 2026-03-05: `packages/mini-react/src/core/fiber.ts`에 최소 Fiber 모델(`Fiber`, `NoFlags`, `Placement`, `Update`, `Deletion`)을 도입.
- 2026-03-05: `packages/mini-react/src/core/reconcile.ts`에 children normalize 정책을 반영해 `null/undefined/boolean` 스킵과 `string|number` 텍스트 노드 래핑 규약을 고정.
- 2026-03-05: `reconcileChildren` Update 경로에서 `child/sibling` 링크를 초기화하고, 재사용 oldFiber가 `deletions`로 오염되지 않음을 테스트로 보강.
- 2026-03-06: `packages/mini-react/src/core/index.ts`를 HostRoot 모델 기반으로 바꾸고, `createRoot.flush`에서 reconcile 파이프라인을 연결.
- 2026-03-06: `createRoot.flush`에서 동일 tick 배칭 후 `rootFiber.child`를 계산해 다음 commit 단계로 넘길 계약을 고정.
- 2026-03-06: commit 경유를 위한 임시 어댑터를 둬 현재 renderer는 reconciliation을 계산하고 기존 placeholder 계약은 유지하도록 전환점 마련.
- 2026-03-06: `packages/mini-react/src/renderer-dom/index.ts`를 Fiber commit 엔트리로 확장해 HostText/HostComponent 문자열 렌더링을 지원.
- 2026-03-06: `renderer-dom`에서 삭제 큐를 수용하는 제거 루틴을 추가하고, 다음 커밋에서 stateNode 기반 실제 노드 교체/제거로 확장 가능한 구조로 고정.
- 2026-03-06: `packages/mini-react/__tests__/renderer-dom.test.ts`와 `core.test.ts`를 placeholder 문자열 계약에서 Fiber 기반 출력 계약으로 갱신.
