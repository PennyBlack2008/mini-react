import { createElement } from "../src/runtime/jsx-runtime";

describe("jsx runtime", () => {
  test("normalizes nested children and filters non-renderable values", () => {
    const vnode = createElement("div", null, "a", ["b", null, ["c", undefined, "d", false], true]);

    expect(vnode.children).toEqual(["a", "b", "c", "d"]);
  });

  test("extracts key and removes it from props", () => {
    const vnode = createElement("div", { id: "app-root", key: "k-1" }, "node");

    expect(vnode.key).toBe("k-1");
    expect(vnode.props).toEqual({ id: "app-root" });
  });
});
