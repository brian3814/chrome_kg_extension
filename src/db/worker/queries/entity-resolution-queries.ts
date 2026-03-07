import { executeQuery, executeExec } from '../query-executor';
import type { DbNode, DbEntityAlias } from '../../../shared/types';

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Normalize a label for comparison: lowercase, trim, collapse whitespace */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Simple string similarity (Dice coefficient on bigrams) */
export function similarity(a: string, b: string): number {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const aBigrams = bigrams(na);
  const bBigrams = bigrams(nb);
  let intersection = 0;
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

export interface ResolvedEntity {
  nodeId: string;
  label: string;
  matchType: 'exact' | 'alias' | 'fuzzy';
  similarity: number;
}

/** Find existing nodes that match a given label */
export async function findMatches(
  label: string,
  fuzzyThreshold = 0.7
): Promise<ResolvedEntity[]> {
  const normalized = normalizeLabel(label);
  const matches: ResolvedEntity[] = [];

  // 1. Exact label match (case-insensitive)
  const { rows: exactRows } = await executeQuery<DbNode>(
    `SELECT * FROM nodes WHERE LOWER(TRIM(label)) = ?;`,
    [normalized]
  );
  for (const node of exactRows) {
    matches.push({
      nodeId: node.id,
      label: node.label,
      matchType: 'exact',
      similarity: 1,
    });
  }
  if (matches.length > 0) return matches;

  // 2. Alias match
  const { rows: aliasRows } = await executeQuery<DbEntityAlias & { node_label: string }>(
    `SELECT ea.*, n.label as node_label
     FROM entity_aliases ea
     JOIN nodes n ON n.id = ea.node_id
     WHERE ea.alias_lower = ?;`,
    [normalized]
  );
  for (const alias of aliasRows) {
    matches.push({
      nodeId: alias.node_id,
      label: alias.node_label,
      matchType: 'alias',
      similarity: 1,
    });
  }
  if (matches.length > 0) return matches;

  // 3. Fuzzy match — check all nodes (for small-to-medium graphs this is fine)
  const { rows: allNodes } = await executeQuery<DbNode>(
    'SELECT id, label FROM nodes;'
  );
  for (const node of allNodes) {
    const sim = similarity(label, node.label);
    if (sim >= fuzzyThreshold) {
      matches.push({
        nodeId: node.id,
        label: node.label,
        matchType: 'fuzzy',
        similarity: sim,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches;
}

/** Add an alias for a node */
export async function addAlias(nodeId: string, alias: string): Promise<DbEntityAlias> {
  const id = generateId();
  const aliasLower = normalizeLabel(alias);
  const { rows } = await executeQuery<DbEntityAlias>(
    `INSERT INTO entity_aliases (id, node_id, alias, alias_lower)
     VALUES (?, ?, ?, ?)
     RETURNING *;`,
    [id, nodeId, alias, aliasLower]
  );
  return rows[0];
}

/** Get all aliases for a node */
export async function getAliases(nodeId: string): Promise<DbEntityAlias[]> {
  const { rows } = await executeQuery<DbEntityAlias>(
    'SELECT * FROM entity_aliases WHERE node_id = ?;',
    [nodeId]
  );
  return rows;
}

/** Remove an alias */
export async function removeAlias(aliasId: string): Promise<boolean> {
  const { changes } = await executeExec(
    'DELETE FROM entity_aliases WHERE id = ?;',
    [aliasId]
  );
  return changes > 0;
}
