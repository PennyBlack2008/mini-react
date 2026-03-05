/**
 * 간단한 children reconciliation (인덱스 기반 diff)
 *
 * 이 구현은 학습 목적의 mini React 구현으로,
 * React 실제 reconciler의 복잡한 최적화 기능들을 의도적으로 생략하였다.
 *
 * 생략된 주요 기능들:
 *
 * 1. key 기반 reconciliation
 *    - 실제 React는 children을 `key`를 기준으로 매칭하여
 *      컴포넌트의 identity를 유지한다.
 *    - 현재 구현은 key를 사용하지 않고 **인덱스 기준으로만 비교**한다.
 *
 *      예:
 *        old: [A, B, C]
 *        new: [A, C, B]
 *
 *      실제 React:
 *        - A, B, C fiber를 재사용
 *        - DOM 노드 이동(move) 발생
 *
 *      현재 구현:
 *        - A만 재사용
 *        - B, C 삭제
 *        - 새로운 C, B 생성
 *
 * 2. DOM 이동(move) 최적화
 *    - 실제 React는 children 순서가 바뀌었을 때
 *      DOM 노드를 재사용하면서 위치만 이동시킨다.
 *    - 현재 구현은 reorder를 감지하지 못하고
 *      delete + create 방식으로 처리한다.
 *
 * 3. 복잡한 children 구조 처리
 *    실제 React는 다음과 같은 경우를 처리한다:
 *      - duplicate key
 *      - fragment
 *      - sparse children (holes)
 *      - portal
 *    하지만 이 구현에서는 지원하지 않는다.
 *
 * 4. 성능 최적화
 *    실제 React는 children을 key map으로 변환한 뒤
 *    두 번의 패스를 통해 효율적인 O(n) reconciliation을 수행한다.
 *
 * 이 구현의 목표는 React reconciliation의 핵심 아이디어를 이해하는 것이다:
 *
 *    sameType → 기존 fiber 재사용 (Update)
 *    다른 타입 → 새 fiber 생성 (Placement) + 기존 fiber 삭제 (Deletion)
 *
 * 전체 React reconciler의 복잡성을 재현하는 것이 아니라,
 * 핵심 동작 원리를 학습하는 데 목적이 있다.
 */

import { Fiber, Placement, TextSymbol, Update } from "./fiber";

// VNode 하나를 fiber로 변환한다.
// type/key는 식별용, pendingProps는 다음 렌더 단계에서 비교할 입력으로 사용한다.
export function createFiberFromElement(element: any): Fiber {
  return {
    type: element.type,
    key: element.key == null ? null : String(element.key),
    pendingProps: element.props,
    memoizedProps: null,
    stateNode: null,

    return: null,
    child: null,
    sibling: null,

    alternate: null,
    flags: Placement,
  };
}

function sameType(oldFiber: Fiber | null, element: any) {
  return oldFiber && element && oldFiber.type === element.type;
}

// reconcile 진입 전에 children를 렌더 패스가 다루기 쉬운 형태로 정규화한다.
// - null/undefined/boolean: 화면에 안 보이므로 제거
// - string/number: 텍스트로 감싸서 TextSymbol 노드로 통일
// - 배열: 평탄화해서 인덱스 기반 병행 순회가 가능하도록 정리
function normalizeChildren(children: any[]): any[] {
  const normalizedChildren: any[] = [];

  for (const child of children) {
    if (Array.isArray(child)) {
      normalizedChildren.push(...normalizeChildren(child));
      continue;
    }

    if (child === null || child === undefined || typeof child === "boolean") {
      continue;
    }

    if (typeof child === "string" || typeof child === "number") {
      normalizedChildren.push({
        type: TextSymbol,
        key: null,
        props: {
          nodeValue: String(child),
        },
        children: [],
      });
      continue;
    }

    normalizedChildren.push(child);
  }

  return normalizedChildren;
}

export function reconcileChildren(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: any[],
): void {
  const normalizedChildren = normalizeChildren(newChildren);
  returnFiber.child = null;

  let oldFiber = currentFirstChild;
  let previousSibling: Fiber | null = null;

  // 핵심: 이전 트리의 oldFiber와 새 children을 같은 인덱스 기준으로 순회하며
  // type이 같으면 reuse(Update), 다르면 교체(Placement+deletion)한다.
  for (let i = 0; i < normalizedChildren.length; i++) {
    const element = normalizedChildren[i];

    let newFiber: Fiber | null = null;

    if (sameType(oldFiber, element)) {
      // 재사용 시 이전 상태와 링크를 분리 정리한다.
      // child/sibling를 null로 리셋하지 않으면 이전 하위 트리 링크가 새 트리에 섞일 수 있다.
      newFiber = {
        ...oldFiber!,
        pendingProps: element.props,
        alternate: oldFiber,
        flags: Update,
        child: null,
        sibling: null,
      };
    } else {
      // 타입이 바뀌면 새로 생성하고 기존 노드는 삭제 큐에 둔다.
      newFiber = createFiberFromElement(element);

      if (oldFiber) {
        returnFiber.deletions ||= [];
        returnFiber.deletions.push(oldFiber);
      }
    }

    newFiber.return = returnFiber;

    if (previousSibling === null) {
      returnFiber.child = newFiber;
    } else {
      previousSibling.sibling = newFiber;
    }

    previousSibling = newFiber;

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
  }

  // 새 children을 다 소모한 뒤 남은 oldFiber는 모두 삭제해야 하므로 큐에 모은다.
  while (oldFiber) {
    returnFiber.deletions ||= [];
    returnFiber.deletions.push(oldFiber);
    oldFiber = oldFiber.sibling;
  }
}
