// Many calls within `ms` become one call at the end of that window (the first call opens it). Unlike a
// debounce, a steady stream of calls still runs `fn` every `ms`.
export function coalesce(fn: () => void, ms: number): { call(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call() {
      timer ??= setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
