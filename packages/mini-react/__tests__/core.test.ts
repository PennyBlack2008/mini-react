import { createRoot, createElement, type VNode } from "../src/index";

describe("createRoot", () => {
  const makeContainer = (initialText = ""): HTMLElement => {
    return { textContent: initialText } as unknown as HTMLElement;
  };

  test("returns render and unmount functions", () => {
    const root = createRoot(null);

    expect(typeof root.render).toBe("function");
    expect(typeof root.unmount).toBe("function");
  });

  test("is a no-op when container is null", () => {
    const root = createRoot(null);

    expect(() => root.render(null)).not.toThrow();
    expect(() => root.render("text")).not.toThrow();
    expect(() => root.render({ type: "div", props: null, children: [], key: null } as VNode)).not.toThrow();
  });

  test("clears container text on unmount", async () => {
    const rootContainer = makeContainer("seed");
    const root = createRoot(rootContainer);

    root.render("node");
    await Promise.resolve();

    expect(rootContainer.textContent).toBe("node");
    root.unmount();

    expect(rootContainer.textContent).toBe("");
  });

  test("flushes only latest render value in the same tick", async () => {
    const rootContainer = makeContainer("");
    const root = createRoot(rootContainer);

    root.render("first");
    root.render("second");
    root.render("third");

    await Promise.resolve();

    expect(rootContainer.textContent).toContain("third");
  });

  test("is idempotent for unmount and safe after unmount", () => {
    const rootContainer = makeContainer("seed");
    const root = createRoot(rootContainer);

    root.unmount();
    root.unmount();
    expect(rootContainer.textContent).toBe("");

    expect(() => root.render("after-unmount")).not.toThrow();
    expect(rootContainer.textContent).toBe("");
  });

  test("smoke: createRoot from index renders via renderer-dom contract", async () => {
    const rootContainer = makeContainer("");
    const root = createRoot(rootContainer);
    const app = createElement("div", null, "hello");

    root.render(app);
    await Promise.resolve();

    expect(rootContainer.textContent).toBe("<div>hello</div>");
  });

  test("smoke: createRoot null path through public API does not throw", () => {
    const root = createRoot(null);
    const vnode = createElement("span", null, "public-root");

    expect(() => root.render(vnode)).not.toThrow();
  });
});
