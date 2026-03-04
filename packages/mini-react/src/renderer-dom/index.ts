import type { VNode } from "../shared";

export function render(element: VNode | null, container: HTMLElement | null): void {
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
