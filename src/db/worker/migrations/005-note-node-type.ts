export const version = 5;
export const description = 'Add note node type to ontology';

export const up = `
INSERT OR IGNORE INTO ontology_node_types (type, description, color) VALUES
    ('note', 'A user-written note or thought', '#0EA5E9')
`;
