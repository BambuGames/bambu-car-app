// One sync at a time. Requests that arrive while a sync runs are merged into a single extra run,
// so a burst of local changes costs at most one more round trip.
export type SyncScheduler = {
  request(): void;
  idle(): Promise<void>;
  // Called after every run, failed ones too: a run may have pulled rows or changed upload states.
  subscribe(listener: () => void): () => void;
};

export function createSyncScheduler(run: () => Promise<void>): SyncScheduler {
  let running: Promise<void> | null = null;
  let again = false;
  const listeners = new Set<() => void>();

  const loop = async () => {
    do {
      again = false;
      try {
        await run();
      } catch {
        // A failed sync (offline, server down) is retried by the next request.
      }
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          // A screen that fails to reload must not stop syncing.
        }
      }
    } while (again);
    running = null;
  };

  return {
    request() {
      if (running) again = true;
      else running = loop();
    },
    idle: () => running ?? Promise.resolve(),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
