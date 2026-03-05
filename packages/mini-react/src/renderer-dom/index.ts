import type { VNode } from "../shared";

export type RenderInput = VNode | null | string | number | boolean | undefined;

export function commitRoot(container: HTMLElement | null, element: RenderInput): void {
  // TODO: convert virtual nodes to DOM and handle updates.
  if (!container) {
    return;
  }

  if (element == null) {
    container.textContent = "";
    return;
  }

  container.textContent = `[mini-react placeholder] ${typeof element === "object" ? "rendered VNode" : String(element)}`;
}

export function render(element: RenderInput, container: HTMLElement | null): void {
  commitRoot(container, element);
}
