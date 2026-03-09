import { NoFlags, type Fiber } from "../src/core/fiber";
import { performWorkLoop } from "../src/core/reconcile";
import { createElement, createRoot, useState } from "../src/index";

function makeContainer(initialText = ""): HTMLElement {
  return { textContent: initialText } as unknown as HTMLElement;
}

describe("useState", () => {
  test("renders initial state on first mount", async () => {
    const rootContainer = makeContainer();
    const root = createRoot(rootContainer);

    const App = () => {
      const [count] = useState(0);
      return createElement("span", null, String(count));
    };

    root.render(createElement(App, null));
    await Promise.resolve();

    expect(rootContainer.textContent).toBe("<span>0</span>");
  });

  test("re-renders root when setState is called", async () => {
    const rootContainer = makeContainer();
    const root = createRoot(rootContainer);
    let setCount: (value: unknown) => void = () => {};

    const App = () => {
      const [count, setState] = useState(0);
      setCount = setState;

      return createElement("span", null, String(count));
    };

    root.render(createElement(App, null));
    await Promise.resolve();

    setCount(2);
    await Promise.resolve();

    expect(rootContainer.textContent).toBe("<span>2</span>");
  });

  test("preserves multiple hooks by call order", async () => {
    const rootContainer = makeContainer();
    const root = createRoot(rootContainer);

    let setFirst: (value: unknown) => void = () => {};
    let setSecond: (value: unknown) => void = () => {};

    const App = () => {
      const [first, setA] = useState("first");
      const [second, setB] = useState("second");

      setFirst = setA;
      setSecond = setB;

      return createElement("span", null, `${first}/${second}`);
    };

    root.render(createElement(App, null));
    await Promise.resolve();
    expect(rootContainer.textContent).toBe("<span>first/second</span>");

    setSecond("new-second");
    await Promise.resolve();
    expect(rootContainer.textContent).toBe("<span>first/new-second</span>");

    setFirst("new-first");
    await Promise.resolve();
    expect(rootContainer.textContent).toBe("<span>new-first/new-second</span>");
  });

  test("reuses previous fiber hook state through alternate on next render", () => {
    let setCount: (value: unknown) => void = () => {};

    const App = () => {
      const [count, setState] = useState(1);
      setCount = setState;

      return createElement("span", null, String(count));
    };

    const rootFiber: Fiber = {
      type: "ROOT",
      key: null,
      pendingProps: { children: [createElement(App, null)] },
      memoizedProps: null,
      stateNode: null,
      return: null,
      child: null,
      sibling: null,
      alternate: null,
      flags: NoFlags,
    };

    performWorkLoop(rootFiber);
    const initialFunctionFiber = rootFiber.child;

    expect((initialFunctionFiber as { memoizedState?: { memoizedState: unknown } } | null)?.memoizedState?.memoizedState).toBe(1);

    rootFiber.alternate = {
      ...rootFiber,
      child: rootFiber.child,
      alternate: null,
      sibling: null,
      return: null,
      flags: NoFlags,
      deletions: undefined,
    };

    setCount(3);
    performWorkLoop(rootFiber);

    const nextFunctionFiber = rootFiber.child;
    const previousFunctionFiber = rootFiber.alternate?.child ?? null;

    expect(nextFunctionFiber?.alternate).toBe(previousFunctionFiber);
    expect((nextFunctionFiber as { memoizedState?: { memoizedState: unknown } } | null)?.memoizedState?.memoizedState).toBe(3);
    expect((previousFunctionFiber as { memoizedState?: { memoizedState: unknown } } | null)?.memoizedState?.memoizedState).toBe(1);
  });
});
