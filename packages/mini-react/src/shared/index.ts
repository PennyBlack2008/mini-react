export type PrimitiveChild = string | number | boolean | null | undefined;
export type VNodeType = string | symbol | ((props?: Record<string, unknown>) => unknown);

export interface VNode {
  type: VNodeType;
  props: Record<string, unknown> | null;
  children: PrimitiveChild[];
  key: string | number | null;
}

export const Fragment = Symbol("MiniReact.Fragment");

export function createElementInternal(type: VNodeType, props: Record<string, unknown> | null, children: PrimitiveChild[] = []): VNode {
  return {
    type,
    props,
    children,
    key: (props && typeof props.key === "string") || typeof props?.key === "number" ? (props.key as string | number) : null
  };
}

// TODO: split internal helpers for props normalization and keyed children handling.

declare global {
  namespace JSX {
    interface Element {
      type: VNodeType;
      props: Record<string, unknown> | null;
      children: PrimitiveChild[];
      key: string | number | null;
    }

    interface IntrinsicElements {
      [elemName: string]: Record<string, unknown>;
    }
  }
}
