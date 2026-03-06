import { commitRoot } from "../renderer-dom";

export interface Root {
  render(element: unknown): void;
  unmount(): void;
}

export function createRoot(container: HTMLElement | null): Root {
  const state = {
    container,
    mounted: container != null,
    // 현재 mini-react는 단일 마이크로태스크 배칭만 수행한다.
    // 실제 React 스케줄러(우선순위 Lane/작업 큐/중단 재개/스타일별 선점/flushSync)는
    // 여기 createRoot 내부가 아니라 core/scheduler 계층(예: src/reconciler/scheduler.ts)
    // 에서 관리되어야 한다.
    // 즉, 지금은 "요청이 들어오면 다음 tick에 한 번만 commit"으로 친화한 버전이다.
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
      // React는 여기서 render phase를 scheduler에 위임한다.
      // 지금은 최소 구현이므로 queueMicrotask로 즉시 1회 flush만 약속한다.
      // 진짜 React라면:
      // - 렌더 우선순위 판정 (Sync/Lane)
      // - 중간 중단 가능 경로(suspense/중단/중간재개)
      // - 여러 Root 간 우선순위 스케줄 경쟁
      // - paint 이전 deadline 기반 flush 제어
      // 등이 추가되어야 한다.
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
