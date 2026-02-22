/// <reference lib="webworker" />

import { initSQLite, resetDatabase, exec, query } from './sqlite-engine';
import { runMigrations } from './migrations';
import { executeQuery, executeExec } from './query-executor';
import * as nodeQueries from './queries/node-queries';
import * as edgeQueries from './queries/edge-queries';

export type WorkerRequest = {
  requestId: string;
  action: string;
  params?: unknown;
};

export type WorkerResponse = {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
};

let isInitialized = false;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { requestId, action, params } = event.data;

  try {
    let result: unknown;

    switch (action) {
      case 'init': {
        await initSQLite();
        await runMigrations();
        isInitialized = true;
        result = { ready: true };
        break;
      }

      case 'reset': {
        await resetDatabase();
        await runMigrations();
        isInitialized = true;
        result = { ready: true };
        break;
      }

      case 'exec': {
        ensureInit();
        const p = params as { sql: string; params?: unknown[] };
        const { changes } = await executeExec(p.sql, p.params);
        result = { changes };
        break;
      }

      case 'query': {
        ensureInit();
        const p = params as { sql: string; params?: unknown[] };
        const { rows } = await executeQuery(p.sql, p.params);
        result = { rows };
        break;
      }

      // Node operations
      case 'nodes.getAll': {
        ensureInit();
        result = await nodeQueries.getAllNodes();
        break;
      }

      case 'nodes.getById': {
        ensureInit();
        result = await nodeQueries.getNodeById(params as string);
        break;
      }

      case 'nodes.create': {
        ensureInit();
        result = await nodeQueries.createNode(params as any);
        break;
      }

      case 'nodes.update': {
        ensureInit();
        result = await nodeQueries.updateNode(params as any);
        break;
      }

      case 'nodes.delete': {
        ensureInit();
        result = await nodeQueries.deleteNode(params as string);
        break;
      }

      case 'nodes.search': {
        ensureInit();
        const p = params as { query: string; limit?: number };
        result = await nodeQueries.searchNodes(p.query, p.limit);
        break;
      }

      case 'nodes.getTypes': {
        ensureInit();
        result = await nodeQueries.getNodeTypes();
        break;
      }

      case 'nodes.getNeighborhood': {
        ensureInit();
        const p = params as { nodeId: string; hops?: number };
        result = await nodeQueries.getNeighborhood(p.nodeId, p.hops);
        break;
      }

      // Edge operations
      case 'edges.getAll': {
        ensureInit();
        result = await edgeQueries.getAllEdges();
        break;
      }

      case 'edges.getById': {
        ensureInit();
        result = await edgeQueries.getEdgeById(params as string);
        break;
      }

      case 'edges.getForNode': {
        ensureInit();
        result = await edgeQueries.getEdgesForNode(params as string);
        break;
      }

      case 'edges.create': {
        ensureInit();
        result = await edgeQueries.createEdge(params as any);
        break;
      }

      case 'edges.update': {
        ensureInit();
        result = await edgeQueries.updateEdge(params as any);
        break;
      }

      case 'edges.delete': {
        ensureInit();
        result = await edgeQueries.deleteEdge(params as string);
        break;
      }

      case 'edges.getBetween': {
        ensureInit();
        result = await edgeQueries.getEdgesBetween(params as string[]);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    respond(requestId, true, result);
  } catch (error: any) {
    console.error(`[DB Worker] Error handling ${action}:`, error);
    respond(requestId, false, undefined, error.message ?? String(error));
  }
};

function ensureInit(): void {
  if (!isInitialized) {
    throw new Error('Database not initialized. Call init first.');
  }
}

function respond(requestId: string, success: boolean, data?: unknown, error?: string): void {
  const response: WorkerResponse = { requestId, success, data, error };
  self.postMessage(response);
}

// Signal that the worker is loaded
self.postMessage({ requestId: '__init__', success: true, data: 'worker-loaded' });
