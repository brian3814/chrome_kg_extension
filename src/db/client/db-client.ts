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
};

const DB_REQUEST_TIMEOUT_MS = 10_000;

let worker: Worker | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

let initPromise: Promise<void> | null = null;

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function initDbClient(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      // Use a direct URL to avoid Vite's blob: URL wrapping,
      // which is blocked by Chrome extension CSP.
      const workerUrl = new URL('/db-worker.js', location.origin).href;
      worker = new Worker(workerUrl, { type: 'module' });

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { requestId, success, data, error } = event.data;

        // Handle the initial worker-loaded signal
        if (requestId === '__init__') {
          return;
        }

        const pending = pendingRequests.get(requestId);
        if (!pending) return;

        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);

        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error ?? 'Unknown DB error'));
        }
      };

      worker.onerror = (event) => {
        console.error('[DB Client] Worker error:', event);
        reject(new Error('DB Worker failed to load'));
      };

      // Send init command
      sendRequest('init').then(() => {
        console.log('[DB Client] Database initialized');
        resolve();
      }).catch(reject);
    } catch (e) {
      reject(e);
    }
  });

  return initPromise;
}

function sendRequest(action: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('DB Worker not initialized'));
      return;
    }

    const requestId = generateRequestId();

    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`DB request timed out: ${action}`));
    }, DB_REQUEST_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timer });

    const request: WorkerRequest = { requestId, action, params };
    worker.postMessage(request);
  });
}

// Generic query/exec
export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = (await sendRequest('query', { sql, params })) as { rows: T[] };
  return result.rows;
}

export async function dbExec(sql: string, params?: unknown[]): Promise<number> {
  const result = (await sendRequest('exec', { sql, params })) as { changes: number };
  return result.changes;
}

// Typed node operations
export const nodes = {
  getAll: () => sendRequest('nodes.getAll') as Promise<any[]>,
  getById: (id: string) => sendRequest('nodes.getById', id) as Promise<any>,
  create: (input: any) => sendRequest('nodes.create', input) as Promise<any>,
  update: (input: any) => sendRequest('nodes.update', input) as Promise<any>,
  delete: (id: string) => sendRequest('nodes.delete', id) as Promise<boolean>,
  search: (query: string, limit?: number) =>
    sendRequest('nodes.search', { query, limit }) as Promise<any[]>,
  getTypes: () => sendRequest('nodes.getTypes') as Promise<string[]>,
  getNeighborhood: (nodeId: string, hops?: number) =>
    sendRequest('nodes.getNeighborhood', { nodeId, hops }) as Promise<{ nodeIds: string[] }>,
};

// Typed edge operations
export const edges = {
  getAll: () => sendRequest('edges.getAll') as Promise<any[]>,
  getById: (id: string) => sendRequest('edges.getById', id) as Promise<any>,
  getForNode: (nodeId: string) => sendRequest('edges.getForNode', nodeId) as Promise<any[]>,
  create: (input: any) => sendRequest('edges.create', input) as Promise<any>,
  update: (input: any) => sendRequest('edges.update', input) as Promise<any>,
  delete: (id: string) => sendRequest('edges.delete', id) as Promise<boolean>,
  getBetween: (nodeIds: string[]) => sendRequest('edges.getBetween', nodeIds) as Promise<any[]>,
};

// Query engine operations
export const graph = {
  query: (graphQuery: unknown) => sendRequest('query.execute', graphQuery),
  mutate: (mutation: unknown) => sendRequest('mutation.execute', mutation),
};

export function isDbReady(): boolean {
  return initPromise !== null;
}
