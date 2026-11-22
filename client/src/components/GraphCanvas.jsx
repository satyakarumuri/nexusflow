import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
  {
    id: 'sensor',
    type: 'input',
    position: { x: 80, y: 120 },
    data: { label: 'Turbine Sensor' },
  },
  {
    id: 'avg',
    type: 'default',
    position: { x: 320, y: 120 },
    data: { label: 'Moving Average' },
  },
  {
    id: 'alert',
    type: 'output',
    position: { x: 560, y: 120 },
    data: { label: 'SMS Alert' },
  },
];

const initialEdges = [
  {
    id: 'e1',
    source: 'sensor',
    target: 'avg',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e2',
    source: 'avg',
    target: 'alert',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export default function GraphCanvas({ onGraphChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  const nodeOptions = useMemo(
    () => [
      { id: 'sensorSource', label: 'Sensor Source', position: { x: 60, y: 60 } },
      { id: 'movingAverage', label: 'Moving Average', position: { x: 60, y: 160 } },
      { id: 'threshold', label: 'Threshold', position: { x: 60, y: 260 } },
      { id: 'smsAlert', label: 'SMS Alert', position: { x: 60, y: 360 } },
    ],
    [],
  );

  const onConnect = useCallback(
    (connection) => {
      setEdges((current) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, current));
    },
    [setEdges],
  );

  const handleAddNode = (option) => {
    const nextNode = {
      id: `${option.id}-${Date.now()}`,
      type: option.id === 'sensorSource' ? 'input' : option.id === 'smsAlert' ? 'output' : 'default',
      position: option.position,
      data: { label: option.label },
    };
    setNodes((current) => current.concat(nextNode));
  };

  const handleGraphState = useCallback(() => {
    onGraphChange?.({ nodes, edges });
  }, [nodes, edges, onGraphChange]);

  return (
    <div style={{ height: 560, width: '100%', border: '1px solid #1f2937', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8, background: '#111827', borderBottom: '1px solid #1f2937' }}>
        {nodeOptions.map((option) => (
          <button key={option.id} type="button" onClick={() => handleAddNode(option)} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
            {option.label}
          </button>
        ))}
        <button type="button" onClick={handleGraphState} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
          Save state
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNode(node)}
        fitView
        snapToGrid
        connectOnClick={false}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>

      {selectedNode && (
        <div style={{ padding: 12, background: '#0f172a', color: '#e5e7eb' }}>
          <strong>Selected:</strong> {selectedNode.data.label}
        </div>
      )}
    </div>
  );
}
