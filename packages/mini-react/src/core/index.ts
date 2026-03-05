import { commitRoot } from "../renderer-dom";

export interface Root {
  render(element: unknown): void;
  unmount(): void;
}

export function createRoot(container: HTMLElement | null): Root {
  const state = {
    container,
    mounted: container != null,
    scheduled: false,
    pending: null as unknown
  };

  const flush = (): void => {
    state.scheduled = false;
    if (!state.mounted || state.container == null) {
      return;
    }
    commitRoot(state.container, state.pending as never);
  };

  return {
    render(element: unknown): void {
      state.pending = element;

      if (state.scheduled || state.container == null) {
        return;
      }

      state.scheduled = true;
      queueMicrotask(flush);
    },
    unmount(): void {
      if (!state.mounted) {
        return;
      }

      if (state.container) {
        state.container.textContent = "";
      }

      state.mounted = false;
    }
  };
}
