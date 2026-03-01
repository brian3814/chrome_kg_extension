/// <reference lib="webworker" />

import { initSQLite, resetDatabase } from './sqlite-engine';
import { runMigrations } from './migrations';
import { executeQuery, executeExec } from './query-executor';
import * as nodeQueries from './queries/node-queries';
import * as edgeQueries from './queries/edge-queries';
import * as nodeTypeQueries from './queries/node-type-queries';
import { executeGraphQuery, executeGraphMutation } from './query-engine';
import { SYNC_CHANNEL, type SyncEvent } from '../../shared/sync-events';

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

declare var self: SharedWorkerGlobalScope;

let isInitialized = false;
const ports: MessagePort[] = [];
const syncChannel = new BroadcastChannel(SYNC_CHANNEL);

function broadcast(event: SyncEvent): void {
  syncChannel.postMessage(event);
}

function respond(port: MessagePort, requestId: string, success: boolean, data?: unknown, error?: string): void {
  const response: WorkerResponse = { requestId, success, data, error };
  port.postMessage(response);
}

function ensureInit(): void {
  if (!isInitialized) {
    throw new Error('Database not initialized. Call init first.');
  }
}

// Mutation actions that need Web Locks + sync broadcasting
const MUTATION_ACTIONS = new Set([
  'nodes.create', 'nodes.update', 'nodes.delete',
  'edges.create', 'edges.update', 'edges.delete',
  'nodeTypes.create', 'nodeTypes.delete',
  'mutation.execute', 'exec', 'reset',
]);

async function handleAction(action: string, params: unknown): Promise<{ result: unknown; syncEvent?: SyncEvent }> {
  switch (action) {
    case 'init': {
      if (!isInitialized) {
        await initSQLite();
        await runMigrations();
        isInitialized = true;
      }
      return { result: { ready: true } };
    }

    case 'reset': {
      await resetDatabase();
      await runMigrations();
      isInitialized = true;
      return { result: { ready: true }, syncEvent: { type: 'reset' } };
    }

    case 'exec': {
      ensureInit();
      const p = params as { sql: string; params?: unknown[] };
      const { changes } = await executeExec(p.sql, p.params);
      return { result: { changes } };
    }

    case 'query': {
      ensureInit();
      const p = params as { sql: string; params?: unknown[] };
      const { rows } = await executeQuery(p.sql, p.params);
      return { result: { rows } };
    }

    // Node operations
    case 'nodes.getAll': {
      ensureInit();
      return { result: await nodeQueries.getAllNodes() };
    }

    case 'nodes.getById': {
      ensureInit();
      return { result: await nodeQueries.getNodeById(params as string) };
    }

    case 'nodes.create': {
      ensureInit();
      const node = await nodeQueries.createNode(params as any);
      return { result: node, syncEvent: { type: 'node_created', node } };
    }

    case 'nodes.update': {
      ensureInit();
      const node = await nodeQueries.updateNode(params as any);
      return { result: node, syncEvent: node ? { type: 'node_updated', node } : undefined };
    }

    case 'nodes.delete': {
      ensureInit();
      const success = await nodeQueries.deleteNode(params as string);
      return {
        result: success,
        syncEvent: success ? { type: 'node_deleted', id: params as string } : undefined,
      };
    }

    case 'nodes.search': {
      ensureInit();
      const p = params as { query: string; limit?: number };
      return { result: await nodeQueries.searchNodes(p.query, p.limit) };
    }

    case 'nodes.getTypes': {
      ensureInit();
      return { result: await nodeQueries.getNodeTypes() };
    }

    case 'nodes.getNeighborhood': {
      ensureInit();
      const p = params as { nodeId: string; hops?: number };
      return { result: await nodeQueries.getNeighborhood(p.nodeId, p.hops) };
    }

    // Edge operations
    case 'edges.getAll': {
      ensureInit();
      return { result: await edgeQueries.getAllEdges() };
    }

    case 'edges.getById': {
      ensureInit();
      return { result: await edgeQueries.getEdgeById(params as string) };
    }

    case 'edges.getForNode': {
      ensureInit();
      return { result: await edgeQueries.getEdgesForNode(params as string) };
    }

    case 'edges.create': {
      ensureInit();
      const edge = await edgeQueries.createEdge(params as any);
      return { result: edge, syncEvent: { type: 'edge_created', edge } };
    }

    case 'edges.update': {
      ensureInit();
      const edge = await edgeQueries.updateEdge(params as any);
      return { result: edge, syncEvent: edge ? { type: 'edge_updated', edge } : undefined };
    }

    case 'edges.delete': {
      ensureInit();
      const success = await edgeQueries.deleteEdge(params as string);
      return {
        result: success,
        syncEvent: success ? { type: 'edge_deleted', id: params as string } : undefined,
      };
    }

    case 'edges.getBetween': {
      ensureInit();
      return { result: await edgeQueries.getEdgesBetween(params as string[]) };
    }

    // Node type operations
    case 'nodeTypes.getAll': {
      ensureInit();
      return { result: await nodeTypeQueries.getAllNodeTypes() };
    }

    case 'nodeTypes.create': {
      ensureInit();
      const nodeType = await nodeTypeQueries.createNodeType(params as any);
      return { result: nodeType, syncEvent: { type: 'node_type_created', nodeType } };
    }

    case 'nodeTypes.delete': {
      ensureInit();
      const success = await nodeTypeQueries.deleteNodeType(params as string);
      return {
        result: success,
        syncEvent: success ? { type: 'node_type_deleted', nodeTypeId: params as string } : undefined,
      };
    }

    // Query engine operations
    case 'query.execute': {
      ensureInit();
      return { result: await executeGraphQuery(params) };
    }

    case 'mutation.execute': {
      ensureInit();
      return { result: await executeGraphMutation(params) };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

self.onconnect = (connectEvent: MessageEvent) => {
  const port = connectEvent.ports[0];
  ports.push(port);

  port.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { requestId, action, params } = event.data;

    try {
      let outcome: { result: unknown; syncEvent?: SyncEvent };

      if (MUTATION_ACTIONS.has(action)) {
        // Wrap mutations in a Web Lock for cross-tab safety
        outcome = await navigator.locks.request('kg_extension_db_write', () =>
          handleAction(action, params)
        );
      } else {
        outcome = await handleAction(action, params);
      }

      respond(port, requestId, true, outcome.result);

      if (outcome.syncEvent) {
        broadcast(outcome.syncEvent);
      }
    } catch (error: any) {
      console.error(`[DB SharedWorker] Error handling ${action}:`, error);
      respond(port, requestId, false, undefined, error.message ?? String(error));
    }
  };

  port.start();

  // Signal that this port is connected
  port.postMessage({ requestId: '__init__', success: true, data: 'worker-connected' });
};
