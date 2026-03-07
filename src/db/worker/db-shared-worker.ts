/// <reference lib="webworker" />

import { SYNC_CHANNEL, type SyncEvent } from '../../shared/sync-events';

/**
 * SharedWorker coordinator — spawns a single Dedicated Worker that holds SQLite.
 * The Dedicated Worker has access to OPFS (createSyncAccessHandle),
 * which is unavailable in SharedWorkers. This coordinator routes messages
 * between UI ports and the Dedicated Worker, and broadcasts sync events.
 */

type WorkerRequest = {
  requestId: string;
  action: string;
  params?: unknown;
};

type WorkerResponse = {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  syncEvent?: SyncEvent;
};

declare var self: SharedWorkerGlobalScope;

const syncChannel = new BroadcastChannel(SYNC_CHANNEL);

// Track which port sent each request so we can route responses back
const pendingRequests = new Map<string, MessagePort>();

let dedicatedWorker: Worker | null = null;
let workerReady = false;
let workerInitPromise: Promise<void> | null = null;

// Queue requests that arrive before the dedicated worker is ready
const earlyQueue: Array<{ port: MessagePort; request: WorkerRequest }> = [];

function spawnDedicatedWorker(): Promise<void> {
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = new Promise<void>((resolve, reject) => {
    try {
      const workerUrl = new URL('/db-worker.js', location.origin).href;
      dedicatedWorker = new Worker(workerUrl, { type: 'module' });

      dedicatedWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { requestId, success, data, error, syncEvent } = event.data;

        // Handle the dedicated worker's initial load signal
        if (requestId === '__init__') {
          return;
        }

        // Route response back to the originating port
        const originPort = pendingRequests.get(requestId);
        if (originPort) {
          pendingRequests.delete(requestId);
          originPort.postMessage({ requestId, success, data, error } as WorkerResponse);
        }

        // Broadcast sync event to all tabs
        if (syncEvent) {
          syncChannel.postMessage(syncEvent);
        }
      };

      dedicatedWorker.onerror = (event) => {
        console.error('[DB SharedWorker] Dedicated worker error:', event);

        // Reject all pending requests
        for (const [reqId, port] of pendingRequests) {
          port.postMessage({
            requestId: reqId,
            success: false,
            error: 'Dedicated DB worker crashed',
          } as WorkerResponse);
        }
        pendingRequests.clear();

        // Reset worker state so next request triggers respawn
        dedicatedWorker = null;
        workerReady = false;
        workerInitPromise = null;
      };

      // Send init to the dedicated worker and wait for its response
      const initRequestId = `__coordinator_init__${Date.now()}`;
      dedicatedWorker.postMessage({ requestId: initRequestId, action: 'init' } as WorkerRequest);

      // Listen for the init response
      const onInitResponse = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId === initRequestId) {
          dedicatedWorker!.removeEventListener('message', onInitResponse);
          if (event.data.success) {
            workerReady = true;
            // Flush any queued requests
            for (const { port, request } of earlyQueue) {
              forwardToDedicatedWorker(port, request);
            }
            earlyQueue.length = 0;
            resolve();
          } else {
            reject(new Error(event.data.error ?? 'Dedicated worker init failed'));
          }
        }
      };
      dedicatedWorker.addEventListener('message', onInitResponse);
    } catch (e) {
      workerInitPromise = null;
      reject(e);
    }
  });

  return workerInitPromise;
}

function forwardToDedicatedWorker(port: MessagePort, request: WorkerRequest): void {
  if (!dedicatedWorker) return;
  pendingRequests.set(request.requestId, port);
  dedicatedWorker.postMessage(request);
}

self.onconnect = (connectEvent: MessageEvent) => {
  const port = connectEvent.ports[0];

  port.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    // Intercept init — the coordinator handles initialization
    if (request.action === 'init') {
      try {
        await spawnDedicatedWorker();
        port.postMessage({
          requestId: request.requestId,
          success: true,
          data: { ready: true },
        } as WorkerResponse);
      } catch (e: any) {
        port.postMessage({
          requestId: request.requestId,
          success: false,
          error: e.message ?? String(e),
        } as WorkerResponse);
      }
      return;
    }

    // For all other actions, forward to dedicated worker
    if (workerReady && dedicatedWorker) {
      forwardToDedicatedWorker(port, request);
    } else {
      // Queue until worker is ready (shouldn't normally happen since
      // db-client always sends init first, but handles race conditions)
      earlyQueue.push({ port, request });
      // Ensure worker is spawning
      spawnDedicatedWorker().catch(() => {
        // Drain early queue with errors
        for (const { port: p, request: r } of earlyQueue) {
          p.postMessage({
            requestId: r.requestId,
            success: false,
            error: 'Failed to spawn dedicated DB worker',
          } as WorkerResponse);
        }
        earlyQueue.length = 0;
      });
    }
  };

  port.start();

  // Signal that this port is connected
  port.postMessage({ requestId: '__init__', success: true, data: 'worker-connected' });
};
