import { Fiber, NoFlags, TextSymbol } from "../core/fiber";
import { type VNode, Fragment } from "../shared";

export type RenderInput =
  | VNode
  | Fiber
  | null
  | string
  | number
  | boolean
  | undefined;

type MiniNode = {
  kind: "text" | "element";
  type?: string;
  textContent: string;
  children: MiniNode[];
  parent?: MiniNode;
};

type MiniContainer = HTMLElement & {
  __miniNodes?: MiniNode[];
};

// 렌더 대상 컨테이너를 내부 노드 저장소를 가진 형태로 정규화한다.
function asMiniContainer(container: HTMLElement): MiniContainer {
  const miniContainer = container as MiniContainer;
  miniContainer.__miniNodes ||= [];
  return miniContainer;
}

// 컨테이너에 현재 렌더링된 가상 노드 목록을 읽는다.
function getContainerChildren(container: MiniContainer): MiniNode[] {
  return container.__miniNodes ?? [];
}

// 컨테이너의 가상 노드 목록을 갱신하고, 호환용 childNodes 동기화까지 수행한다.
function setContainerChildren(
  container: MiniContainer,
  children: MiniNode[],
): void {
  container.__miniNodes = children;
  // 실제 DOM 타입을 건드리지 않되, 기존 테스트에서 검증하던 childNodes도 동기화한다.
  (container as unknown as { childNodes?: MiniNode[] }).childNodes = children;
}

// 값이 이미 렌더러 Fiber 인지 판별한다(재귀/직렬화 경로에서 input이 Fiber인지 구분).
function isFiber(value: unknown): value is Fiber {
  return (
    !!value &&
    typeof value === "object" &&
    "return" in value &&
    "flags" in value &&
    "sibling" in value
  );
}

// TextSymbol 타입인지 확인해 HostText로 취급할지 판단한다.
function isTextLikeFiber(fiber: Fiber): boolean {
  return fiber.type === TextSymbol;
}

// 일반 host element(div, span...)인지 판별한다.
function isHostComponent(fiber: Fiber): boolean {
  return typeof fiber.type === "string";
}

// 렌더 입력의 primitive를 문자열로 안정적으로 변환한다.
function resolveValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value);
}

// public API/테스트에서 들어온 렌더 입력을 Fiber 트리 입력으로 변환한다.
function normalizeRenderInputToFiber(value: any): Fiber | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return createTextFiber(resolveValue(value));
  }

  if (isFiber(value)) {
    return value;
  }

  if (typeof value === "object") {
    const vNode = value as VNode;
    return createFiberFromVNode(vNode);
  }

  return createTextFiber(resolveValue(value));
}

// 텍스트 노드를 표현하는 최소 Fiber를 생성한다.
function createTextFiber(nodeValue: string): Fiber {
  return {
    type: TextSymbol,
    key: null,
    pendingProps: {
      nodeValue,
    },
    memoizedProps: null,
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    flags: NoFlags,
  };
}

// VNode를 Fiber 트리로 변환하고, children도 child/sibling 체인으로 펼쳐 붙인다.
function createFiberFromVNode(vNode: VNode): Fiber {
  const root: Fiber = {
    type: vNode.type,
    key:
      typeof vNode.key === "number" ? String(vNode.key) : (vNode.key ?? null),
    pendingProps: vNode.props,
    memoizedProps: null,
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    flags: NoFlags,
  };

  let prevSibling: Fiber | null = null;
  for (const child of flattenChildren(vNode.children)) {
    let next: Fiber;

    if (
      typeof child === "string" ||
      typeof child === "number" ||
      child === true ||
      child === false ||
      child == null
    ) {
      next = createTextFiber(resolveValue(child));
    } else {
      next = createFiberFromVNode(child as VNode);
    }

    next.return = root;

    if (prevSibling === null) {
      root.child = next;
    } else {
      prevSibling.sibling = next;
    }

    prevSibling = next;
  }

  return root;
}

// JSX/텍스트 children의 불필요한 값 제거 및 중첩 배열 평탄화.
function flattenChildren(children: unknown[]): unknown[] {
  const normalized: unknown[] = [];

  for (const child of children) {
    if (Array.isArray(child)) {
      normalized.push(...flattenChildren(child));
      continue;
    }

    if (child === null || child === undefined || typeof child === "boolean") {
      continue;
    }

    normalized.push(child);
  }

  return normalized;
}

// Fiber를 최소 DOM 표현 노드(MiniNode)로 변환한다.
function toNode(fiber: Fiber): MiniNode {
  if (isTextLikeFiber(fiber)) {
    return {
      kind: "text",
      textContent: resolveValue(fiber.pendingProps?.nodeValue ?? ""),
      children: [],
    };
  }

  if (isHostComponent(fiber) && typeof fiber.type === "string") {
    return {
      kind: "element",
      type: fiber.type,
      textContent: "",
      children: [],
    };
  }

  if (fiber.type === Fragment || typeof fiber.type === "symbol") {
    return {
      kind: "element",
      textContent: "",
      children: [],
    };
  }

  return {
    kind: "element",
    type: String(fiber.type),
    textContent: "",
    children: [],
  };
}

// 한 형제 체인 시작점에서 자식 트리를 MiniNode 배열로 빌드한다.
function buildDomTree(fiber: Fiber | null, parent: Fiber | null): MiniNode[] {
  const nodes: MiniNode[] = [];
  let next: Fiber | null = fiber;

  while (next) {
    const node = toNode(next);

    node.parent = parent && parent.stateNode;

    if (next.child) {
      node.children = buildDomTree(next.child, next);
    }

    next.stateNode = node;
    nodes.push(node);
    next = next.sibling;
  }

  return nodes;
}

// MiniNode를 HTML-like 문자열로 직렬화한다.
function serializeNode(node: MiniNode): string {
  if (node.kind === "text") {
    return node.textContent;
  }

  const childrenText = node.children
    .map((child) => serializeNode(child))
    .join("");

  if (!node.type) {
    return childrenText;
  }

  return `<${node.type}>${childrenText}</${node.type}>`;
}

// 루트 노드 배열을 텍스트 형태로 통합한다.
function serializeDom(nodes: MiniNode[]): string {
  return nodes.map(serializeNode).join("");
}

// reconciler의 deletions 큐를 반영해 제거 대상 노드를 실제 트리에서 삭제한다.
function removeDeletedNodes(
  container: MiniContainer,
  root: Fiber | null,
): void {
  if (!root?.deletions) {
    return;
  }

  for (const deleted of root.deletions) {
    if (!deleted.stateNode) {
      continue;
    }

    if (deleted.stateNode.parent) {
      const parent = deleted.stateNode.parent as MiniNode;
      parent.children = parent.children.filter(
        (child) => child !== deleted.stateNode,
      );
      deleted.stateNode.parent = undefined;
    } else {
      setContainerChildren(
        container,
        getContainerChildren(container).filter(
          (child: MiniNode) => child !== deleted.stateNode,
        ),
      );
    }

    deleted.stateNode = null;
  }

  root.deletions = [];
}

// 현재 Fiber 트리를 기준으로 컨테이너 출력 상태(textContent / child cache)를 갱신한다.
function commitFiber(container: MiniContainer, rootFiber: Fiber | null): void {
  removeDeletedNodes(container, rootFiber);

  if (rootFiber == null) {
    setContainerChildren(container, []);
    container.textContent = "";
    return;
  }

  const startNode = rootFiber.type === "ROOT" ? rootFiber.child : rootFiber;
  const nextChildren = startNode ? buildDomTree(startNode, rootFiber) : [];

  // 최소 구현: 매번 자식 리스트를 다시 계산해 반영한다.
  // 삭제/삽입/업데이트 flag는 다음 커밋에서 세분화한다.
  setContainerChildren(container, nextChildren);

  for (const child of nextChildren) {
    child.parent = undefined;
  }

  container.textContent = serializeDom(nextChildren);
}

// 외부에서 들어온 입력(Fiber 또는 렌더 입력)을 커밋 가능한 Fiber로 정규화해 반영한다.
export function commitRoot(
  container: HTMLElement | null,
  elementOrFiber: RenderInput,
): void {
  if (!container) {
    return;
  }

  const miniContainer = asMiniContainer(container);

  if (isFiber(elementOrFiber)) {
    commitFiber(miniContainer, elementOrFiber);
    return;
  }

  const fiber = normalizeRenderInputToFiber(elementOrFiber);
  commitFiber(miniContainer, fiber);
}

// 최소 렌더 함수. React의 public render와 유사하게 컨테이너에 내용을 커밋한다.
export function render(
  element: RenderInput,
  container: HTMLElement | null,
): void {
  commitRoot(container, element);
}
