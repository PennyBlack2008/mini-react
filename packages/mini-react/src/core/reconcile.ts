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

type PendingProps = {
  children?: any[];
};

let nextUnitOfWork: Fiber | null = null;

function isRenderableHostProp(
  key: string,
  value: unknown,
): boolean {
  if (key === "children" || key === "key") {
    return false;
  }

  if (value == null) {
    return false;
  }

  if (key === "id" || key === "className" || key === "title") {
    return true;
  }

  return typeof value === "string" || typeof value === "number";
}

function applyHostProps(node: any, props: Record<string, unknown> | null): void {
  if (props == null) {
    return;
  }

  for (const [key, value] of Object.entries(props)) {
    if (!isRenderableHostProp(key, value)) {
      continue;
    }

    const normalized = String(value);

    if (key === "className") {
      if (typeof node.setAttribute === "function") {
        node.setAttribute("class", normalized);
      } else {
        node.className = normalized;
      }
      continue;
    }

    if (typeof node.setAttribute === "function") {
      node.setAttribute(key, normalized);
    } else {
      node[key] = normalized;
    }
  }
}

// VNode 하나를 fiber로 변환한다.
// type/key는 식별용, pendingProps는 다음 렌더 단계에서 비교할 입력으로 사용한다.
export function createFiberFromElement(element: any): Fiber {
  const rawChildren = Array.isArray(element.children) ? element.children : [];
  const root: Fiber = {
    type: element.type,
    key: element.key == null ? null : String(element.key),
    pendingProps: {
      ...(element.props ?? {}),
      children: rawChildren,
    },
    memoizedProps: null,
    stateNode: null,

    return: null,
    child: null,
    sibling: null,

    alternate: null,
    flags: Placement,
  };

  return root;
}

function sameType(oldFiber: Fiber | null, element: any) {
  if (!oldFiber || !element) {
    return false;
  }

  const nextKey =
    element && element.key == null ? null : String(element.key);
  return oldFiber.type === element.type && oldFiber.key === nextKey;
}

function isHostComponent(fiber: Fiber): boolean {
  return typeof fiber.type === "string" || fiber.type === TextSymbol;
}

function getNextChildrenFromElement(element: any): any[] {
  if (!element || !Array.isArray(element.children)) {
    return [];
  }

  return element.children;
}

function shouldNormalizeChildren(children: any[]): boolean {
  return children.some(
    (child) =>
      child === null ||
      child === undefined ||
      typeof child === "boolean" ||
      typeof child === "string" ||
      typeof child === "number" ||
      Array.isArray(child),
  );
}

function normalizeChildrenIfNeeded(rawChildren: any): any[] {
  const children = Array.isArray(rawChildren)
    ? rawChildren
    : rawChildren == null
      ? []
      : [rawChildren];
  return shouldNormalizeChildren(children)
    ? normalizeChildren(children)
    : children;
}

function updateHostComponent(fiber: Fiber): Fiber | null {
  const pending = fiber.pendingProps as PendingProps | null;
  const nextChildren = normalizeChildrenIfNeeded(pending?.children ?? []);
  const currentFirstChild = fiber.alternate?.child ?? null;

  // Host 노드의 경우 reconcileChildren을 통해 현재 children을 재구성한다.
  reconcileChildren(
    fiber,
    currentFirstChild,
    nextChildren,
  );

  return fiber.child;
}

function updateRootComponent(fiber: Fiber): Fiber | null {
  const pending = fiber.pendingProps as PendingProps | null;
  const nextChildren = normalizeChildrenIfNeeded(pending?.children ?? []);
  const currentFirstChild = fiber.alternate?.child ?? null;

  reconcileChildren(fiber, currentFirstChild, nextChildren);
  return fiber.child;
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

function beginWork(fiber: Fiber): Fiber | null {
  // 현재 minimal reconciler의 begin 단계는 host component에 대해서만 렌더 준비를 수행한다.
  // function component는 다음 단계에서 본격 처리할 예정이므로 placeholder로 둔다.
  if (isHostComponent(fiber)) {
    updateHostComponent(fiber);
  } else if (fiber.type === "ROOT") {
    updateRootComponent(fiber);
  }

  (fiber as any).__beginWork = true;

  return fiber.child;
}

function completeWork(fiber: Fiber): void {
  const hasDocument = typeof document !== "undefined";

  if (typeof fiber.type === "string" && fiber.stateNode == null) {
    if (hasDocument) {
      fiber.stateNode = document.createElement(fiber.type);
      applyHostProps(fiber.stateNode, fiber.pendingProps as Record<string, unknown> | null);
      fiber.memoizedProps = fiber.pendingProps;
      (fiber as any).__completeWork = true;
      return;
    }

    const stateNode: {
      type: string;
      tagName: string;
      nodeName: string;
      childNodes: any[];
      appendChild(child: any): void;
      children: any[];
      [key: string]: any;
    } = {
      type: fiber.type,
      tagName: fiber.type.toUpperCase(),
      nodeName: fiber.type.toUpperCase(),
      childNodes: [],
      appendChild(child: any): void {
        this.childNodes.push(child);
      },
      children: [],
    };

    applyHostProps(stateNode, fiber.pendingProps as Record<string, unknown> | null);
    fiber.stateNode = stateNode;
  }

  if (fiber.type === TextSymbol && fiber.stateNode == null) {
    const nodeValue = fiber.pendingProps?.nodeValue ?? "";
    if (hasDocument) {
      fiber.stateNode = document.createTextNode(String(nodeValue));
      fiber.memoizedProps = fiber.pendingProps;
      (fiber as any).__completeWork = true;
      return;
    }

    fiber.stateNode = {
      nodeType: "text",
      textContent: String(nodeValue),
      nodeValue: String(nodeValue),
    };
  }

  // 최소 reconciler에서는 complete 단계에서 DOM 생성 후 memoizedProps 동기화를 수행한다.
  fiber.memoizedProps = fiber.pendingProps;
  (fiber as any).__completeWork = true;
}

export function performUnitOfWork(fiber: Fiber): Fiber | null {
  const next = beginWork(fiber);

  if (next != null) {
    return next;
  }

  completeWork(fiber);

  if (fiber.sibling != null) {
    return fiber.sibling;
  }

  let parent = fiber.return;
  while (parent != null) {
    completeWork(parent);

    if (parent.sibling != null) {
      return parent.sibling;
    }

    parent = parent.return;
  }

  return null;
}

export function performWorkLoop(rootFiber: Fiber): void {
  nextUnitOfWork = rootFiber;

  while (nextUnitOfWork != null) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
}

function getHostParent(fiber: Fiber): HTMLElement | null {
  let parent = fiber.return;

  while (parent != null) {
    if (parent.type === "ROOT") {
      const rootContainer = parent.stateNode;
      return rootContainer != null && "appendChild" in rootContainer
        ? (rootContainer as HTMLElement)
        : null;
    }

    if (typeof parent.type === "string" && parent.stateNode != null) {
      return parent.stateNode as HTMLElement;
    }

    parent = parent.return;
  }

  return null;
}

function removeChildNode(
  parent: HTMLElement,
  child: any,
): void {
  if (typeof (parent as any).removeChild === "function") {
    (parent as any).removeChild(child);
    return;
  }

  const list = (parent as any).childNodes;
  if (Array.isArray(list)) {
    (parent as any).childNodes = list.filter((node: any) => node !== child);
    if (
      "firstElementChild" in (parent as any)
      && typeof (parent as any).firstElementChild !== "undefined"
    ) {
      (parent as any).firstElementChild =
        (parent as any).childNodes.find((node: any) => node?.tagName != null) ??
        null;
    }
  }
}

function commitHostDeletion(fiber: Fiber): void {
  if (fiber.stateNode == null) {
    return;
  }

  const parent = getHostParent(fiber);
  if (parent == null) {
    return;
  }

  removeChildNode(parent, fiber.stateNode);
  fiber.stateNode = null;
}

function commitDeletion(fiber: Fiber): void {
  if (typeof fiber.type === "string" || fiber.type === TextSymbol) {
    commitHostDeletion(fiber);
    return;
  }

  let child = fiber.child;
  while (child != null) {
    commitDeletion(child);
    child = child.sibling;
  }
}

function commitUpdate(fiber: Fiber): void {
  if (fiber.stateNode == null) {
    return;
  }

  if (fiber.type === TextSymbol) {
    const nextValue = String(fiber.pendingProps?.nodeValue ?? "");

    if ("textContent" in (fiber.stateNode as any)) {
      fiber.stateNode.textContent = nextValue;
    }

    if ("nodeValue" in (fiber.stateNode as any)) {
      fiber.stateNode.nodeValue = nextValue;
    }

    return;
  }

  if (typeof fiber.type === "string") {
    applyHostProps(fiber.stateNode, fiber.pendingProps as Record<string, unknown> | null);
  }
}

export function commitWork(fiber: Fiber): void {
  if (fiber.deletions && fiber.deletions.length > 0) {
    for (const deletedFiber of fiber.deletions) {
      commitDeletion(deletedFiber);
    }

    fiber.deletions = [];
  }

  const isHostComponent =
    typeof fiber.type === "string" || fiber.type === TextSymbol;
  const shouldAppend =
    (fiber.flags & Placement) !== 0 && isHostComponent && fiber.stateNode != null;

  if (shouldAppend) {
    const parentDom = getHostParent(fiber);

    if (parentDom != null) {
      parentDom.appendChild(fiber.stateNode as Node);
    }

    fiber.flags &= ~Placement;
  }

  if ((fiber.flags & Update) !== 0) {
    commitUpdate(fiber);
    fiber.flags &= ~Update;
  }

  if (fiber.child != null) {
    commitWork(fiber.child);
  }

  if (fiber.sibling != null) {
    commitWork(fiber.sibling);
  }
}

export function commitRoot(rootFiber: Fiber): void {
  if (rootFiber.child == null && (rootFiber.deletions == null || rootFiber.deletions.length === 0)) {
    return;
  }

  commitWork(rootFiber);
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
      // 동일 fiber로 판단되면 교체/삽입이 아닌 갱신(Update)로 표기한다.
      newFiber = {
        ...oldFiber!,
        pendingProps: element.props,
        alternate: oldFiber,
        flags: Update,
        child: null,
        sibling: null,
      };

      // 최소 reconciler에서는 재사용되는 fiber라도 자식은 매 프레임 재조정한다.
      reconcileChildren(newFiber, oldFiber!.child, getNextChildrenFromElement(element));
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
