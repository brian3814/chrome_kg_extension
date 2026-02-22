import { executeQuery, executeExec } from '../query-executor';
import { isFTS5Available } from '../migrations';
import type { DbNode } from '../../../shared/types';

export async function getAllNodes(): Promise<DbNode[]> {
  const { rows } = await executeQuery<DbNode>('SELECT * FROM nodes ORDER BY updated_at DESC;');
  return rows;
}

export async function getNodeById(id: string): Promise<DbNode | null> {
  const { rows } = await executeQuery<DbNode>('SELECT * FROM nodes WHERE id = ?;', [id]);
  return rows[0] ?? null;
}

export async function createNode(input: {
  label: string;
  type?: string;
  properties?: string;
  color?: string;
  size?: number;
  sourceUrl?: string;
}): Promise<DbNode> {
  const id = generateId();
  const { rows } = await executeQuery<DbNode>(
    `INSERT INTO nodes (id, label, type, properties, color, size, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *;`,
    [
      id,
      input.label,
      input.type ?? 'entity',
      input.properties ?? '{}',
      input.color ?? null,
      input.size ?? 1.0,
      input.sourceUrl ?? null,
    ]
  );
  return rows[0];
}

export async function updateNode(input: {
  id: string;
  label?: string;
  type?: string;
  properties?: string;
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  size?: number;
}): Promise<DbNode | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.label !== undefined) {
    sets.push('label = ?');
    params.push(input.label);
  }
  if (input.type !== undefined) {
    sets.push('type = ?');
    params.push(input.type);
  }
  if (input.properties !== undefined) {
    sets.push('properties = ?');
    params.push(input.properties);
  }
  if (input.x !== undefined) {
    sets.push('x = ?');
    params.push(input.x);
  }
  if (input.y !== undefined) {
    sets.push('y = ?');
    params.push(input.y);
  }
  if (input.z !== undefined) {
    sets.push('z = ?');
    params.push(input.z);
  }
  if (input.color !== undefined) {
    sets.push('color = ?');
    params.push(input.color);
  }
  if (input.size !== undefined) {
    sets.push('size = ?');
    params.push(input.size);
  }

  if (sets.length === 0) return getNodeById(input.id);

  sets.push("updated_at = datetime('now')");
  params.push(input.id);

  const { rows } = await executeQuery<DbNode>(
    `UPDATE nodes SET ${sets.join(', ')} WHERE id = ? RETURNING *;`,
    params
  );
  return rows[0] ?? null;
}

export async function deleteNode(id: string): Promise<boolean> {
  const { changes } = await executeExec('DELETE FROM nodes WHERE id = ?;', [id]);
  return changes > 0;
}

export async function searchNodes(queryText: string, limit = 50): Promise<DbNode[]> {
  if (isFTS5Available()) {
    // Use FTS5 for full-text search
    const { rows } = await executeQuery<DbNode>(
      `SELECT n.* FROM nodes n
       JOIN nodes_fts fts ON n.rowid = fts.rowid
       WHERE nodes_fts MATCH ?
       ORDER BY rank
       LIMIT ?;`,
      [queryText + '*', limit]
    );
    return rows;
  }

  // Fallback: LIKE-based search
  const pattern = `%${queryText}%`;
  const { rows } = await executeQuery<DbNode>(
    `SELECT * FROM nodes
     WHERE label LIKE ? OR type LIKE ? OR properties LIKE ?
     ORDER BY label
     LIMIT ?;`,
    [pattern, pattern, pattern, limit]
  );
  return rows;
}

export async function getNodesByType(type: string): Promise<DbNode[]> {
  const { rows } = await executeQuery<DbNode>(
    'SELECT * FROM nodes WHERE type = ? ORDER BY label;',
    [type]
  );
  return rows;
}

export async function getNodeTypes(): Promise<string[]> {
  const { rows } = await executeQuery<{ type: string }>(
    'SELECT DISTINCT type FROM nodes ORDER BY type;'
  );
  return rows.map((r) => r.type);
}

// N-hop neighborhood subgraph query
export async function getNeighborhood(
  nodeId: string,
  hops: number = 2
): Promise<{ nodeIds: string[] }> {
  const { rows } = await executeQuery<{ id: string }>(
    `WITH RECURSIVE neighborhood(id, depth) AS (
       SELECT ?, 0
       UNION
       SELECT CASE WHEN e.source_id = n.id THEN e.target_id ELSE e.source_id END, n.depth + 1
       FROM neighborhood n
       JOIN edges e ON e.source_id = n.id OR e.target_id = n.id
       WHERE n.depth < ?
     )
     SELECT DISTINCT id FROM neighborhood;`,
    [nodeId, hops]
  );
  return { nodeIds: rows.map((r) => r.id) };
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
