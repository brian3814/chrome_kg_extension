import React, { useState } from 'react';
import { useGraphStore } from '../../../graph/store/graph-store';
import { useNodeTypeStore } from '../../../graph/store/node-type-store';
import { DEFAULT_NODE_TYPE } from '../../../shared/constants';
import { AddTypeModal } from './AddTypeModal';

type CreateTab = 'node' | 'edge';

export function CreatePanel() {
  const [tab, setTab] = useState<CreateTab>('node');

  return (
    <div className="p-4">
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('node')}
          className={`text-xs px-3 py-1.5 rounded ${
            tab === 'node'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          New Node
        </button>
        <button
          onClick={() => setTab('edge')}
          className={`text-xs px-3 py-1.5 rounded ${
            tab === 'edge'
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          New Edge
        </button>
      </div>

      {tab === 'node' ? <CreateNodeForm /> : <CreateEdgeForm />}
    </div>
  );
}

const ADD_NEW_TYPE_VALUE = '__add_new__';

function CreateNodeForm() {
  const createNode = useGraphStore((s) => s.createNode);
  const types = useNodeTypeStore((s) => s.types);
  const [label, setLabel] = useState('');
  const [type, setType] = useState(DEFAULT_NODE_TYPE);
  const [error, setError] = useState('');
  const [showAddType, setShowAddType] = useState(false);

  const handleTypeChange = (value: string) => {
    if (value === ADD_NEW_TYPE_VALUE) {
      setShowAddType(true);
    } else {
      setType(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    const result = await createNode({ label: label.trim(), type });
    if (result) {
      setLabel('');
      setType(DEFAULT_NODE_TYPE);
    } else {
      setError('Failed to create node');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter node label..."
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          >
            {types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.type}
              </option>
            ))}
            <option value={ADD_NEW_TYPE_VALUE}>+ Add new type...</option>
          </select>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white text-sm py-1.5 rounded hover:bg-indigo-500 transition-colors"
        >
          Create Node
        </button>
      </form>

      {showAddType && (
        <AddTypeModal
          onClose={() => setShowAddType(false)}
          onCreated={(newType) => setType(newType)}
        />
      )}
    </>
  );
}

function CreateEdgeForm() {
  const nodes = useGraphStore((s) => s.nodes);
  const createEdge = useGraphStore((s) => s.createEdge);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!sourceId || !targetId) {
      setError('Source and target nodes are required');
      return;
    }
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    const result = await createEdge({
      sourceId,
      targetId,
      label: label.trim(),
    });
    if (result) {
      setLabel('');
      setSourceId('');
      setTargetId('');
    } else {
      setError('Failed to create edge');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1">Source Node</label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        >
          <option value="">Select source...</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} ({n.type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1">Target Node</label>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        >
          <option value="">Select target...</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} ({n.type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-400 block mb-1">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., works_at, knows, located_in"
          className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 placeholder-zinc-600"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white text-sm py-1.5 rounded hover:bg-indigo-500 transition-colors"
      >
        Create Edge
      </button>
    </form>
  );
}
