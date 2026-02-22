export const version = 2;
export const description = 'FTS5 index on nodes for full-text search (optional)';
export const optional = true; // FTS5 may not be available in the wa-sqlite build

export const up = `
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    label,
    type,
    properties,
    content='nodes',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(rowid, label, type, properties)
    VALUES (new.rowid, new.label, new.type, new.properties);
END;

CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, label, type, properties)
    VALUES ('delete', old.rowid, old.label, old.type, old.properties);
END;

CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, label, type, properties)
    VALUES ('delete', old.rowid, old.label, old.type, old.properties);
    INSERT INTO nodes_fts(rowid, label, type, properties)
    VALUES (new.rowid, new.label, new.type, new.properties);
END;
`;
