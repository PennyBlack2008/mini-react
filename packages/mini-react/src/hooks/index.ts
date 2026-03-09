import { type Fiber } from "../core/fiber";

type HookNode = {
  memoizedState: unknown;
  queue: Array<unknown>;
  next: HookNode | null;
};

type HookFiber = Fiber & { memoizedState?: HookNode | null };

type StateAction = unknown;

const rootUpdateSchedules = new WeakMap<Fiber, () => void>();

let currentlyRenderingFiber: Fiber | null = null;
let currentHook: HookNode | null = null;
let workInProgressHook: HookNode | null = null;

export function registerRootUpdateSchedule(
  rootFiber: Fiber,
  scheduleUpdate: () => void,
): void {
  rootUpdateSchedules.set(rootFiber, scheduleUpdate);
}

export function unregisterRootUpdateSchedule(rootFiber: Fiber): void {
  rootUpdateSchedules.delete(rootFiber);
}

function getRootFiber(fiber: Fiber): Fiber | null {
  let current: Fiber | null = fiber;

  while (current.return != null) {
    current = current.return;
  }

  return current.type === "ROOT" ? current : null;
}

function scheduleRootRerenderFromFiber(fiber: Fiber): void {
  const rootFiber = getRootFiber(fiber);
  if (rootFiber == null) {
    return;
  }

  const schedule = rootUpdateSchedules.get(rootFiber);
  if (schedule == null) {
    return;
  }

  schedule();
}

export function prepareHookContext(fiber: Fiber): void {
  currentlyRenderingFiber = fiber;
  const previousFiber = fiber.alternate as HookFiber | null;
  currentHook = previousFiber?.memoizedState ?? null;
  workInProgressHook = null;
}

export function finishHookContext(): void {
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;
}

function appendHook(fiber: Fiber, hook: HookNode): void {
  if (workInProgressHook == null) {
    (fiber as HookFiber).memoizedState = hook;
  } else {
    workInProgressHook.next = hook;
  }

  workInProgressHook = hook;
}

export function useState(initialValue: unknown): [unknown, (value: StateAction) => void] {
  if (currentlyRenderingFiber == null) {
    return [initialValue, () => {}];
  }

  const fiber = currentlyRenderingFiber;
  let hook: HookNode;
  const hookOwnerFiber = fiber;

  if (currentHook != null) {
    const baseValue = currentHook.memoizedState;
    let nextValue = baseValue;

    for (const queued of currentHook.queue) {
      if (typeof queued === "function") {
        nextValue = (queued as (prev: unknown) => unknown)(nextValue);
      } else {
        nextValue = queued;
      }
    }

    currentHook.queue = [];

    hook = {
      memoizedState: nextValue,
      queue: [],
      next: null,
    };

    currentHook = currentHook.next;
  } else {
    hook = {
      memoizedState: typeof initialValue === "function"
        ? (initialValue as () => unknown)()
        : initialValue,
      queue: [],
      next: null,
    };
  }

  appendHook(fiber, hook);

  const setState = (value: StateAction): void => {
    hook.queue.push(value);
    scheduleRootRerenderFromFiber(hookOwnerFiber);
  };

  return [hook.memoizedState, setState];
}
