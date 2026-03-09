/**
 * @jest-environment jsdom
 */
import {
  Deletion,
  NoFlags,
  Placement,
  TextSymbol,
  Update,
  type Fiber,
} from "../src/core/fiber";
import { performUnitOfWork, reconcileChildren } from "../src/core/reconcile";

function makeFiber(overrides: Partial<Fiber> = {}): Fiber {
  return {
    type: "div",
    key: null,
    pendingProps: null,
    memoizedProps: null,
    stateNode: null,

    return: null,
    child: null,
    sibling: null,
    alternate: null,

    flags: NoFlags,
    ...overrides,
  };
}

describe("reconcileChildren", () => {
  // null/undefined/boolean를 건너뛰고 문자열/숫자만 텍스트 노드로 감싸서
  // 정규화가 제대로 되는지 확인한다.
  test("normalizes null, undefined, boolean and wraps text as TextSymbol", () => {
    const root = makeFiber({ type: "root" });
    const oldFirst = makeFiber({
      type: "old",
      key: "1",
      pendingProps: { value: "old" },
    });
    root.child = oldFirst;

    reconcileChildren(root, oldFirst, [
      null,
      undefined,
      false,
      "hello",
      42,
      true,
      ["world"],
    ]);

    const firstChild = root.child;
    const secondChild = firstChild?.sibling;

    expect(root.deletions).toContain(oldFirst);
    expect(firstChild?.type).toBe(TextSymbol);
    expect(firstChild?.pendingProps?.nodeValue).toBe("hello");
    expect(secondChild?.pendingProps?.nodeValue).toBe("42");
    expect(secondChild?.sibling?.pendingProps?.nodeValue).toBe("world");
    expect(root.child?.flags).toBe(1);
  });

  // 기존 타입이 동일하면 reuse(Update) 경로로 들어가고,
  // 이때 oldFiber가 삭제 큐로 들어가지 않는지 확인한다.
  test("reuses old fiber with Update flag and does not delete it", () => {
    const root = makeFiber({ type: "root" });
    const oldFirst = makeFiber({
      type: "div",
      key: "k",
      pendingProps: { a: 1 },
      child: makeFiber({ type: "text", pendingProps: { nodeValue: "old" } }),
      sibling: makeFiber({
        type: "span",
        key: "s",
        pendingProps: { value: "keep" },
      }),
    });
    oldFirst.sibling!.return = oldFirst;
    root.child = oldFirst;

    const next = { type: "div", key: "k", props: { a: 2 }, children: [] };

    reconcileChildren(root, oldFirst, [next]);

    expect(root.deletions).toHaveLength(1);
    expect(root.deletions?.[0]?.type).toBe("span");
    expect(root.child).toBeDefined();
    expect(root.child?.type).toBe("div");
    expect(root.child?.flags).toBe(Update);
    expect(root.child?.alternate).toBe(oldFirst);
    expect(root.child?.child).toBeNull();
    expect(root.child?.sibling).toBeNull();
  });

  // 이전 트리에 있던 노드가 신규 트리에 없거나 타입이 바뀌면
  // 삭제 큐에 모으고 새 노드는 Placement로 생성되는지 확인한다.
  test("deletes old fibers that are replaced or removed", () => {
    const root = makeFiber({ type: "root" });
    const oldFirst = makeFiber({
      type: "div",
      key: "k1",
      sibling: makeFiber({
        type: "span",
        key: "k2",
      }),
    });
    oldFirst.sibling!.return = oldFirst;
    root.child = oldFirst;

    reconcileChildren(root, oldFirst, [
      { type: "p", key: "k3", props: {}, children: [] },
    ]);

    expect(root.deletions).toHaveLength(2);
    expect(root.deletions?.[0]?.type).toBe("div");
    expect(root.deletions?.[1]?.type).toBe("span");
    expect(root.child?.type).toBe("p");
    expect(root.child?.flags).toBe(Placement);
  });

  // Update 재사용 시 oldFiber의 기존 child/sibling 링크가 새로 생성되는 fiber에 남아
  // 다른 노드를 잘못 가리키는 이슈를 방지하는지 확인한다.
  test("does not carry old child/sibling links into reused fiber", () => {
    const root = makeFiber({ type: "root" });
    const oldSibling = makeFiber({
      type: "span",
      pendingProps: { value: "old-sib" },
    });
    const oldFirst = makeFiber({
      type: "div",
      sibling: oldSibling,
      child: makeFiber({
        type: "i",
        child: makeFiber({ type: "b" }),
        sibling: makeFiber({ type: "u" }),
      }),
    });
    oldSibling.return = oldFirst;
    oldFirst.child!.return = oldFirst;

    reconcileChildren(root, oldFirst, [
      { type: "div", props: {}, children: [] },
    ]);

    expect(root.child?.child).toBeNull();
    expect(root.child?.sibling).toBeNull();
    expect(root.child?.alternate).toBe(oldFirst);
    expect(root.deletions?.length).toBe(1);
    expect(root.deletions?.[0]?.type).toBe("span");
  });

  // 빈 children 렌더 시 기존 단일 oldFiber가 삭제 큐에 적재되고
  // Deletion 상수 값이 구현 스펙과 일치하는지 확인한다.
  test("keeps a standalone Deletion constant available for future delete phase", () => {
    const root = makeFiber({ type: "root" });
    const oldFirst = makeFiber({ type: "div" });
    root.child = oldFirst;

    reconcileChildren(root, oldFirst, []);

    expect(Deletion).toBe(4);
    expect(root.deletions).toEqual([oldFirst]);
    expect(root.child).toBeNull();
  });
});

describe("performUnitOfWork", () => {
  test("calls reconcileChildren in beginWork for host component", () => {
    const hostRoot = makeFiber({
      type: "div",
      pendingProps: {
        children: ["hello", { type: "span", props: { id: "child" }, children: [] }],
      },
    });

    const next = performUnitOfWork(hostRoot);

    expect(next).toBe(hostRoot.child);
    expect(next?.type).toBe(TextSymbol);
    expect(next?.pendingProps?.nodeValue).toBe("hello");
    expect(hostRoot.child?.sibling?.type).toBe("span");
  });

  test("passes fiber.alternate.child as currentFirstChild when reconciling host component", () => {
    const oldChild = makeFiber({
      type: "span",
      key: "same-key",
      pendingProps: { id: "old" },
    });
    const hostRoot = makeFiber({
      type: "div",
      pendingProps: {
        children: [{ type: "span", key: "same-key", props: { id: "new" }, children: [] }],
      },
      alternate: makeFiber({ type: "div", child: oldChild }),
    });

    const next = performUnitOfWork(hostRoot);

    expect(next).toBe(hostRoot.child);
    expect(hostRoot.child?.alternate).toBe(oldChild);
    expect(hostRoot.child?.flags).toBe(Update);
  });

  test("works safely when host component has no children", () => {
    const oldChild = makeFiber({
      type: "span",
      pendingProps: { id: "to-delete" },
    });
    const hostRoot = makeFiber({
      type: "div",
      pendingProps: {
        children: [],
      },
      alternate: makeFiber({ type: "div", child: oldChild }),
    });

    const next = performUnitOfWork(hostRoot);

    expect(next).toBeNull();
    expect(hostRoot.child).toBeNull();
    expect(hostRoot.deletions).toEqual([oldChild]);
  });

  test("returns child when beginWork creates a child", () => {
    const root = makeFiber({
      type: "root",
      pendingProps: {
        children: [
          {
            type: "div",
            props: { id: "child" },
            children: [],
          },
        ],
      },
    });

    const next = performUnitOfWork(root);

    expect(next).toBe(root.child);
    expect(next?.type).toBe("div");
    expect((root as any).__beginWork).toBe(true);
    expect((root as any).__completeWork).toBeUndefined();
  });

  test("moves to sibling when current fiber has no child but has sibling", () => {
    const current = makeFiber({
      type: "current",
      pendingProps: {
        children: [],
      },
      sibling: makeFiber({
        type: "sibling",
        pendingProps: {
          children: [],
        },
      }),
    });

    const next = performUnitOfWork(current);

    expect(next).toBe(current.sibling);
    expect(next?.type).toBe("sibling");
    expect((current as any).__completeWork).toBe(true);
    expect((current.sibling as any).__beginWork).toBeUndefined();
  });

  test("walks up return chain when no child/sibling and finds next sibling", () => {
    const returnSibling = makeFiber({
      type: "returnSibling",
      pendingProps: {
        children: [],
      },
    });

    const returnFiber = makeFiber({
      type: "parent",
      pendingProps: {
        children: [],
      },
      sibling: null,
    });

    const grandReturn = makeFiber({
      type: "grand",
      pendingProps: {
        children: [],
      },
      child: returnFiber,
      sibling: returnSibling,
    });

    const leaf = makeFiber({
      type: "leaf",
      pendingProps: {
        children: [],
      },
      return: returnFiber,
    });
    returnFiber.return = grandReturn;
    returnFiber.child = leaf;

    const next = performUnitOfWork(leaf);

    expect(next).toBe(grandReturn.sibling);
    expect(next).toBe(returnSibling);
    expect((leaf as any).__completeWork).toBe(true);
    expect((returnFiber as any).__completeWork).toBe(true);
    expect((grandReturn as any).__completeWork).toBe(true);
    expect((grandReturn.sibling as any).__beginWork).toBeUndefined();
  });
});

describe("completeWork", () => {
  test("creates host element DOM when completing a host fiber", () => {
    const hostFiber = makeFiber({
      type: "section",
      pendingProps: {
        children: [],
      },
    });

    performUnitOfWork(hostFiber);

    expect(hostFiber.stateNode).toBeInstanceOf(HTMLElement);
    expect((hostFiber.stateNode as HTMLElement).tagName).toBe("SECTION");
  });

  test("creates text node for text fiber", () => {
    const textFiber = makeFiber({
      type: TextSymbol,
      pendingProps: {
        nodeValue: "hello",
      },
    });

    performUnitOfWork(textFiber);

    expect(textFiber.stateNode).toBeInstanceOf(Text);
    expect((textFiber.stateNode as Text).textContent).toBe("hello");
  });

  test("does not recreate DOM when fiber already has stateNode", () => {
    const existing = document.createElement("div");
    const hostFiber = makeFiber({
      type: "div",
      pendingProps: {
        children: [],
      },
      stateNode: existing,
    });

    performUnitOfWork(hostFiber);

    expect(hostFiber.stateNode).toBe(existing);
    expect((hostFiber.stateNode as Element).tagName).toBe("DIV");
  });
});
