import {
  Deletion,
  NoFlags,
  Placement,
  TextSymbol,
  Update,
  type Fiber,
} from "../src/core/fiber";
import {
  commitRoot,
  performWorkLoop,
  performUnitOfWork,
  reconcileChildren,
} from "../src/core/reconcile";

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

    expect(hostFiber.stateNode).toBeDefined();
    expect((hostFiber.stateNode as { tagName: string }).tagName).toBe("SECTION");
  });

  test("applies mount-time host props to created host stateNode", () => {
    const hostFiber = makeFiber({
      type: "div",
      pendingProps: {
        id: "root",
        className: "hero",
        title: "greeting",
        "data-index": 7,
        "aria-label": "app",
      },
    });

    performUnitOfWork(hostFiber);

    expect((hostFiber.stateNode as Record<string, unknown>).id).toBe("root");
    expect((hostFiber.stateNode as Record<string, unknown>).className).toBe("hero");
    expect((hostFiber.stateNode as Record<string, unknown>).title).toBe("greeting");
    expect((hostFiber.stateNode as Record<string, unknown>)["data-index"]).toBe("7");
    expect((hostFiber.stateNode as Record<string, unknown>)["aria-label"]).toBe("app");
  });

  test("does not apply internal props such as children and key to host stateNode", () => {
    const hostFiber = makeFiber({
      type: "div",
      pendingProps: {
        children: "should-ignore",
        key: "ignored",
        id: "id",
      },
    });

    performWorkLoop(hostFiber);

    const stateNode = hostFiber.stateNode as Record<string, unknown>;
    expect(stateNode).toBeDefined();
    expect(stateNode.id).toBe("id");

    if (typeof (stateNode as { getAttribute?: (name: string) => string | null })
      .getAttribute === "function") {
      expect((stateNode as { getAttribute: (name: string) => string | null }).getAttribute("children")).toBeNull();
      expect((stateNode as { getAttribute: (name: string) => string | null }).getAttribute("key")).toBeNull();
      expect((stateNode as { getAttribute: (name: string) => string | null }).getAttribute("id")).toBe("id");
    } else {
      expect(stateNode.children).not.toBe("should-ignore");
      expect(stateNode.key).toBeUndefined();
    }
  });

  test("safely ignores null/undefined host props", () => {
    const hostFiber = makeFiber({
      type: "section",
      pendingProps: {
        id: null,
        title: undefined,
        className: "valid",
        disabled: undefined,
        "data-value": 0,
      },
    });

    expect(() => performUnitOfWork(hostFiber)).not.toThrow();

    expect((hostFiber.stateNode as Record<string, unknown>).className).toBe("valid");
    expect((hostFiber.stateNode as Record<string, unknown>)["data-value"]).toBe("0");
    expect((hostFiber.stateNode as Record<string, unknown>).id).toBeUndefined();
    expect((hostFiber.stateNode as Record<string, unknown>).title).toBeUndefined();
    expect((hostFiber.stateNode as Record<string, unknown>).disabled).toBeUndefined();
  });

  test("creates text node for text fiber", () => {
    const textFiber = makeFiber({
      type: TextSymbol,
      pendingProps: {
        nodeValue: "hello",
      },
    });

    performUnitOfWork(textFiber);

    expect(textFiber.stateNode).toBeDefined();
    expect((textFiber.stateNode as { textContent: string }).textContent).toBe("hello");
  });

  test("does not recreate DOM when fiber already has stateNode", () => {
    const existing = { tagName: "DIV", textContent: "", childNodes: [] };
    const hostFiber = makeFiber({
      type: "div",
      pendingProps: {
        children: [],
      },
      stateNode: existing,
    });

    performUnitOfWork(hostFiber);

    expect(hostFiber.stateNode).toBe(existing);
    expect((hostFiber.stateNode as { tagName: string }).tagName).toBe("DIV");
  });
});

describe("commitRoot / commitWork", () => {
  function createMockElement(tagName: string): HTMLElement {
    const node: any = {
      tagName: tagName.toUpperCase(),
      textContent: "",
      childNodes: [],
      firstElementChild: null,
      appendChild(child: any): void {
        this.childNodes.push(child);
        if (typeof child.textContent === "string") {
          this.textContent += child.textContent;
        }

        this.firstElementChild = this.childNodes.find((item: any) => item.tagName != null) ?? null;
      },
      removeChild(child: any): void {
        this.childNodes = this.childNodes.filter((item: any) => item !== child);
        this.firstElementChild = this.childNodes.find((item: any) => item.tagName != null) ?? null;
      },
    };

    return node as HTMLElement;
  }

  test("places a placement fiber into the root container", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: null,
      flags: NoFlags,
    });
    const div = makeFiber({
      type: "div",
      stateNode: createMockElement("div"),
      return: root,
      flags: Placement,
    });

    root.child = div;

    commitRoot(root);

    expect(container.firstElementChild).toBe(div.stateNode);
  });

  test("attaches nested placement fiber to the nearest host parent", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: null,
      flags: NoFlags,
    });

    const wrapper = makeFiber({
      type: "section",
      stateNode: createMockElement("section"),
      return: root,
      flags: Placement,
    });

    const button = makeFiber({
      type: "button",
      stateNode: createMockElement("button"),
      return: wrapper,
      flags: Placement,
    });

    const text = makeFiber({
      type: TextSymbol,
      stateNode: { textContent: "ok", nodeValue: "ok" } as Text,
      return: button,
      flags: Placement,
    });

    root.child = wrapper;
    wrapper.child = button;
    button.child = text;

    commitRoot(root);

    expect(container.firstElementChild).toBe(wrapper.stateNode);
    expect(wrapper.stateNode?.firstElementChild).toBe(button.stateNode);
    expect(button.stateNode?.textContent).toBe("ok");
  });

  test("walks through non-host fibers to find a host parent", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: null,
      flags: NoFlags,
    });
    const functionComponent = makeFiber({
      type: () => null,
      return: root,
      flags: NoFlags,
    });
    const title = makeFiber({
      type: "h1",
      stateNode: createMockElement("h1"),
      return: functionComponent,
      flags: Placement,
    });

    root.child = functionComponent;
    functionComponent.child = title;

    commitRoot(root);

    expect(container.firstElementChild).toBe(title.stateNode);
  });

  test("updates text node content when Update flag is set", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: {
        children: [
          {
            type: TextSymbol,
            key: "text",
            props: {
              nodeValue: "hello",
            },
            children: [],
          },
        ],
      },
    });

    performWorkLoop(root);
    commitRoot(root);

    expect(root.child?.stateNode).toMatchObject({ textContent: "hello", nodeValue: "hello" });

    root.alternate = {
      ...root,
      child: root.child,
      sibling: null,
      return: null,
      alternate: null,
      deletions: undefined,
      flags: NoFlags,
    };
    root.pendingProps = {
      children: [
        {
          type: TextSymbol,
          key: "text",
          props: {
            nodeValue: "world",
          },
          children: [],
        },
      ],
    };

    performWorkLoop(root);
    commitRoot(root);

    expect(root.child?.stateNode).toMatchObject({ textContent: "world", nodeValue: "world" });
  });

  test("updates host props when Update flag is set", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: {
        children: [
          {
            type: "div",
            key: "box",
            props: {
              id: "before",
            },
            children: [],
          },
        ],
      },
    });

    performWorkLoop(root);
    commitRoot(root);

    expect((root.child?.stateNode as any)?.id).toBe("before");

    root.alternate = {
      ...root,
      child: root.child,
      sibling: null,
      return: null,
      alternate: null,
      deletions: undefined,
      flags: NoFlags,
    };
    root.pendingProps = {
      children: [
        {
          type: "div",
          key: "box",
          props: {
            id: "after",
          },
          children: [],
        },
      ],
    };

    performWorkLoop(root);
    commitRoot(root);

    expect((root.child?.stateNode as any)?.id).toBe("after");
  });

  test("removes deleted host node from the container", () => {
    const container = createMockElement("div");
    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: {
        children: [
          {
            type: "div",
            key: "remove-me",
            props: {
              id: "removable",
            },
            children: [],
          },
        ],
      },
    });

    performWorkLoop(root);
    commitRoot(root);

    expect(container.childNodes).toHaveLength(1);

    root.alternate = {
      ...root,
      child: root.child,
      sibling: null,
      return: null,
      alternate: null,
      deletions: undefined,
      flags: NoFlags,
    };
    root.pendingProps = {
      children: [],
    };

    performWorkLoop(root);
    commitRoot(root);

    expect(container.childNodes).toHaveLength(0);
    expect(container.firstElementChild).toBeNull();
  });

  test("removes host subtree when deleting non-host fiber", () => {
    const container = createMockElement("div");
    const Component = () => null;

    const hostChild = makeFiber({
      type: "span",
      pendingProps: {
        id: "inner",
      },
      stateNode: createMockElement("span"),
      return: null,
      flags: Placement,
    });

    const functionFiber = makeFiber({
      type: Component,
      child: hostChild,
      return: null,
      flags: NoFlags,
    });
    hostChild.return = functionFiber;

    const root = makeFiber({
      type: "ROOT",
      stateNode: container,
      pendingProps: null,
      child: functionFiber,
    });

    root.child = functionFiber;
    functionFiber.return = root;
    commitRoot(root);

    expect(container.childNodes).toHaveLength(1);

    root.alternate = {
      ...root,
      child: root.child,
      sibling: null,
      return: null,
      alternate: null,
      deletions: undefined,
      flags: NoFlags,
    };
    root.pendingProps = {
      children: [],
    };

    performWorkLoop(root);
    commitRoot(root);

    expect(container.childNodes).toHaveLength(0);
  });
});
