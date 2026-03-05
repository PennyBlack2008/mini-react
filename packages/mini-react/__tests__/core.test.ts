import { createRoot } from "../src/core";

describe("createRoot", () => {
  test("returns render and unmount functions", () => {
    const root = createRoot(null);

    expect(typeof root.render).toBe("function");
    expect(typeof root.unmount).toBe("function");
  });

  test("is a no-op when container is null", () => {
    const root = createRoot(null);

    expect(() => root.render(null)).not.toThrow();
    expect(() => root.render("text")).not.toThrow();
    expect(() => root.render({ type: "div", props: null, children: [], key: null })).not.toThrow();
  });

  test("clears container text on unmount", async () => {
    const rootContainer = { textContent: "seed" } as unknown as HTMLElement;
    const root = createRoot(rootContainer);

    root.render("node");
    await Promise.resolve();

    expect(rootContainer.textContent).toContain("[mini-react placeholder]");
    root.unmount();

    expect(rootContainer.textContent).toBe("");
  });

  test("flushes only latest render value in the same tick", async () => {
    const rootContainer = { textContent: "" } as unknown as HTMLElement;
    const root = createRoot(rootContainer);

    root.render("first");
    root.render("second");
    root.render("third");

    await Promise.resolve();

    expect(rootContainer.textContent).toContain("third");
  });

  test("is idempotent for unmount and safe after unmount", () => {
    const rootContainer = { textContent: "seed" } as unknown as HTMLElement;
    const root = createRoot(rootContainer);

    root.unmount();
    root.unmount();
    expect(rootContainer.textContent).toBe("");

    expect(() => root.render("after-unmount")).not.toThrow();
    expect(rootContainer.textContent).toBe("");
  });
});
