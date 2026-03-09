export type Fiber = {
  type: any;
  key: string | null;

  pendingProps: any;
  // 마지막 커밋/비교가 끝난 뒤 반영된 값. 지금은 최소구현이라 null로 시작해 단계적으로 채운다.
  memoizedProps: any;
  // 함수 컴포넌트 훅의 최소 상태 저장용.
  memoizedState?: unknown;

  stateNode: any;

  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;

  // 이전 렌더에서 동일 위치에 있던 fiber 참조. reuse/update 시 비교/교차 업데이트에 사용한다.
  alternate: Fiber | null;

  flags: number;

  deletions?: Fiber[];
};

// 현재는 3개 플래그만 사용한다. 값은 비트마스크(OR 결합)로 누적될 수 있다.
export const NoFlags = 0;
export const Placement = 1 << 0;
export const Update = 1 << 1;
export const Deletion = 1 << 2;

// TextNode를 VNode/type 기반 트리에 통합할 때 사용하는 최소 텍스트 심벌 타입.
export const TextSymbol = Symbol("MiniReact.Text");
