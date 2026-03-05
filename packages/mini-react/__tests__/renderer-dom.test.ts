import { render } from "../src/renderer-dom";

describe("renderer-dom", () => {
  test("is a no-op when container is null", () => {
    const container = null;

    expect(() => render(null, container)).not.toThrow();
    expect(() => render({ type: "div", props: null, children: [], key: null }, container)).not.toThrow();
  });

  test("clears container text on null vnode", () => {
    const container = { textContent: "seed" } as unknown as HTMLElement;

    render(null, container);

    expect(container.textContent).toBe("");
  });

  test("renders primitive as placeholder string", () => {
    const container = { textContent: "" } as unknown as HTMLElement;

    render("hello", container);

    expect(container.textContent).toBe("[mini-react placeholder] hello");
  });

  test("renders vnode as placeholder marker", () => {
    const container = { textContent: "" } as unknown as HTMLElement;
    const vnode = { type: "div", props: null, children: [], key: null };

    render(vnode as unknown as Parameters<typeof render>[0], container);

    expect(container.textContent).toBe("[mini-react placeholder] rendered VNode");
  });
});
