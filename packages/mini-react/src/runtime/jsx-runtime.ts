import { createElementInternal, type PrimitiveChild, type VNode, type VNodeType } from "../shared";

export { Fragment } from "../shared";

export function createElement(type: VNodeType, props: Record<string, unknown> | null, ...children: unknown[]): VNode {
  return createElementInternal(type, props ?? null, children);
}

export type { PrimitiveChild, VNode };

// TODO: add automatic JSX runtime helpers and ref handling.
