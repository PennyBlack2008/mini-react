import { render } from "../src/renderer-dom";

type TestContainer = {
  textContent: string;
  childNodes?: unknown[];
};

describe("renderer-dom", () => {
  test("is a no-op when container is null", () => {
    const container = null;

    expect(() => render(null, container)).not.toThrow();
    expect(() => render({ type: "div", props: null, children: [], key: null }, container)).not.toThrow();
  });

  test("clears container text on null vnode", () => {
    const container = { textContent: "seed", childNodes: ["a"] } as unknown as TestContainer;

    render(null, container as unknown as HTMLElement);

    expect(container.textContent).toBe("");
    expect(container.childNodes).toEqual([]);
  });

  test("renders primitive as HostText", () => {
    const container = { textContent: "" } as unknown as TestContainer;

    render("hello", container as unknown as HTMLElement);

    expect(container.textContent).toBe("hello");
  });

  test("renders vnode as minimal host tree", () => {
    const container = { textContent: "" } as unknown as TestContainer;
    const vnode = { type: "div", props: null, children: [], key: null };

    render(vnode as unknown as Parameters<typeof render>[0], container as unknown as HTMLElement);

    expect(container.textContent).toBe("<div></div>");
  });

  test("renders nested vnode and text as html-like output", () => {
    const container = { textContent: "", childNodes: [] } as unknown as TestContainer;

    render(
      {
        type: "div",
        props: null,
        children: ["hello", { type: "span", props: null, children: ["world"], key: null }],
      } as Parameters<typeof render>[0],
      container as unknown as HTMLElement,
    );

    expect(container.textContent).toBe("<div>hello<span>world</span></div>");
    expect(container.childNodes?.length).toBeGreaterThan(0);
  });

  test("smoke: public render renders a single div", () => {
    const container = { textContent: "" } as unknown as TestContainer;
    const vnode = { type: "div", props: null, children: [], key: null };

    render(vnode as Parameters<typeof render>[0], container as unknown as HTMLElement);

    expect(container.textContent).toBe("<div></div>");
  });

  test("smoke: public render renders nested elements", () => {
    const container = { textContent: "" } as unknown as TestContainer;

    render(
      {
        type: "div",
        props: null,
        children: [
          {
            type: "section",
            props: null,
            children: [
              {
                type: "span",
                props: null,
                children: ["world"],
                key: null,
              },
            ],
            key: null,
          },
        ],
        key: null,
      } as Parameters<typeof render>[0],
      container as unknown as HTMLElement,
    );

    expect(container.textContent).toBe("<div><section><span>world</span></section></div>");
  });

  test("smoke: public render renders text child", () => {
    const container = { textContent: "" } as unknown as TestContainer;

    render("hello world", container as unknown as HTMLElement);

    expect(container.textContent).toBe("hello world");
  });

  test("updates child list and removes old nodes by replacement", () => {
    const container = { textContent: "", childNodes: [] } as unknown as TestContainer;

    render(
      {
        type: "div",
        props: null,
        children: ["first", "second"],
      } as Parameters<typeof render>[0],
      container as unknown as HTMLElement,
    );

    expect(container.textContent).toBe("<div>firstsecond</div>");

    render(
      {
        type: "div",
        props: null,
        children: ["only"],
      } as Parameters<typeof render>[0],
      container as unknown as HTMLElement,
    );

    expect(container.textContent).toBe("<div>only</div>");
  });
});
