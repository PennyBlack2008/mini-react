export type PrimitiveChild = string | number | boolean | null | undefined | VNode;
export type VNodeType = string | symbol | ((props?: Record<string, unknown>) => unknown);

export interface VNode {
  type: VNodeType;
  props: Record<string, unknown> | null;
  children: PrimitiveChild[];
  key: string | number | null;
}

export const Fragment = Symbol("MiniReact.Fragment");

export function createElementInternal(type: VNodeType, props: Record<string, unknown> | null, children: unknown[] = []): VNode {
  const normalizedProps = normalizeProps(props);
  const normalizedChildren = normalizeChildren(children);

  return {
    type,
    props: normalizedProps,
    children: normalizedChildren,
    key: (props && typeof props.key === "string") || typeof props?.key === "number" ? (props.key as string | number) : null
  };
}

function normalizeChildren(children: unknown[]): PrimitiveChild[] {
  const normalized: PrimitiveChild[] = [];

  for (const child of children) {
    if (Array.isArray(child)) {
      normalized.push(...normalizeChildren(child));
      continue;
    }

    if (child === null || child === undefined || typeof child === "boolean") {
      continue;
    }

    normalized.push(child as PrimitiveChild);
  }

  return normalized;
}

function normalizeProps(props: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props) {
    return null;
  }

  const { key, ...rest } = props;
  void key;
  return rest;
}

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
