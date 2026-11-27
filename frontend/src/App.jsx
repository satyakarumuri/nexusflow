import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow
} from '@xyflow/react';
import {
  Activity,
  BarChart3,
  Code2,
  Flame,
  Layers,
  Play,
  Plus,
  Rocket,
  Square,
  Trash2,
  Wifi,
  WifiOff,
  Workflow
} from 'lucide-react';

import { api } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';
import { nodeTypes } from './components/nodes';
import { edgeTypes } from './components/edges/GlowingEdge';
import { NodePalette } from './components/NodePalette';
import { GraphInspector } from './components/GraphInspector';
import { LiveDashboard } from './components/LiveDashboard';
import { AlertFeed } from './components/AlertFeed';
import { PIPELINE_PRESETS } from './data/presets';

function NexusFlowWorkspace() {
  const { screenToFlowPosition } = useReactFlow();

  const [rules, setRules] = useState([]);
  const [currentRuleId, setCurrentRuleId] = useState(null);
  const [ruleName, setRuleName] = useState('Turbine Overheat Protection');
  const [ruleRunning, setRuleRunning] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [viewMode, setViewMode] = useState('split'); // 'canvas' | 'dashboard' | 'split'
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [banner, setBanner] = useState(null);

  const [selectedDevice, setSelectedDevice] = useState('turbine-01');
  const [selectedMetric, setSelectedMetric] = useState('temperature');
  const [telemetryByDevice, setTelemetryByDevice] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [simRunning, setSimRunning] = useState(false);

  const edgeTimersRef = useRef(new Map());
  const nodeTimersRef = useRef(new Map());

  const showBanner = useCallback((type, text) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const loadRuleIntoCanvas = useCallback(
    (rule) => {
      setCurrentRuleId(rule.ruleId);
      setRuleName(rule.name);
      setRuleRunning(Boolean(rule.running));
      setNodes(rule.graph?.nodes || []);
      setEdges(
        (rule.graph?.edges || []).map((e) => ({
          ...e,
          type: e.type || 'glowing'
        }))
      );
    },
    [setEdges, setNodes]
  );

  // Initial data hydration
  useEffect(() => {
    async function bootstrap() {
      try {
        const [rulesRes, alertsRes, statsRes, simRes, recentRes] = await Promise.all([
          api.listRules(),
          api.getAlerts(50),
          api.getStats(),
          api.getSimulatorStatus(),
          api.getRecentTelemetry('turbine-01', 60)
        ]);

        const loadedRules = rulesRes.rules || [];
        setRules(loadedRules);
        if (loadedRules.length > 0) {
          loadRuleIntoCanvas(loadedRules[0]);
        } else {
          const starter = PIPELINE_PRESETS[0];
          setRuleName(starter.name);
          setNodes(starter.graph.nodes);
          setEdges(starter.graph.edges);
        }

        setAlerts(alertsRes.alerts || []);
        setStats(statsRes);
        setSimRunning(Boolean(simRes.running));
        if (recentRes.readings?.length) {
          setTelemetryByDevice((prev) => ({
            ...prev,
            'turbine-01': recentRes.readings
          }));
        }
      } catch (err) {
        showBanner('error', `Backend connection error: ${err.message}`);
      }
    }
    bootstrap();
  }, [loadRuleIntoCanvas, setEdges, setNodes, showBanner]);

  // Fetch recent telemetry when user switches dashboard device
  useEffect(() => {
    api
      .getRecentTelemetry(selectedDevice, 60)
      .then((res) => {
        if (res.readings?.length) {
          setTelemetryByDevice((prev) => ({
            ...prev,
            [selectedDevice]: res.readings
          }));
        }
      })
      .catch(() => {});
  }, [selectedDevice]);

  // WebSocket live stream handlers
  const handleTelemetry = useCallback((pt) => {
    setTelemetryByDevice((prev) => {
      const existing = prev[pt.deviceId] || [];
      const next = [...existing, pt];
      if (next.length > 80) next.shift();
      return { ...prev, [pt.deviceId]: next };
    });
  }, []);

  const handleEdgePulse = useCallback(
    (pulse) => {
      // Glow the wire
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === pulse.edgeId
            ? { ...edge, data: { ...edge.data, glowing: true, lastValue: pulse.value } }
            : edge
        )
      );

      if (edgeTimersRef.current.has(pulse.edgeId)) {
        clearTimeout(edgeTimersRef.current.get(pulse.edgeId));
      }
      edgeTimersRef.current.set(
        pulse.edgeId,
        setTimeout(() => {
          setEdges((eds) =>
            eds.map((edge) =>
              edge.id === pulse.edgeId
                ? { ...edge, data: { ...edge.data, glowing: false } }
                : edge
            )
          );
        }, 650)
      );

      // Pulse the connected nodes with latest reading badge
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === pulse.sourceNodeId || node.id === pulse.targetNodeId) {
            return {
              ...node,
              data: { ...node.data, pulsing: true, lastValue: pulse.value }
            };
          }
          return node;
        })
      );

      for (const nid of [pulse.sourceNodeId, pulse.targetNodeId]) {
        if (nodeTimersRef.current.has(nid)) {
          clearTimeout(nodeTimersRef.current.get(nid));
        }
        nodeTimersRef.current.set(
          nid,
          setTimeout(() => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === nid ? { ...node, data: { ...node.data, pulsing: false } } : node
              )
            );
          }, 550)
        );
      }
    },
    [setEdges, setNodes]
  );

  const handleAlert = useCallback((alert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 100));
  }, []);

  const handleStats = useCallback((nextStats) => {
    setStats(nextStats);
  }, []);

  const { connected } = useWebSocket({
    onTelemetry: handleTelemetry,
    onEdgePulse: handleEdgePulse,
    onAlert: handleAlert,
    onStats: handleStats
  });

  // Canvas drag & drop + connections
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'glowing'
          },
          eds
        )
      ),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/nexusflow-node');
      if (!raw) return;
      const item = JSON.parse(raw);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        position,
        data: { ...item.defaultData }
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  const handleAddNodeClick = useCallback(
    (item) => {
      const offset = (nodes.length % 6) * 32;
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        position: { x: 140 + offset, y: 120 + offset },
        data: { ...item.defaultData }
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes]
  );

  const handleLoadPreset = useCallback(
    (preset) => {
      setCurrentRuleId(null);
      setRuleName(preset.name);
      setRuleRunning(false);
      setNodes(preset.graph.nodes);
      setEdges(preset.graph.edges);
      showBanner('info', `Loaded "${preset.name}" template. Click Deploy RxJS to run it.`);
    },
    [setEdges, setNodes, showBanner]
  );

  const handleNewBlankRule = () => {
    setCurrentRuleId(null);
    setRuleName('New Telemetry Rule');
    setRuleRunning(false);
    setNodes([]);
    setEdges([]);
  };

  const handleDeployRule = async () => {
    try {
      const cleanNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...n.data, pulsing: undefined, lastValue: undefined }
      }));
      const cleanEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type || 'glowing'
      }));

      const res = await api.saveRule({
        ruleId: currentRuleId,
        name: ruleName,
        graph: { nodes: cleanNodes, edges: cleanEdges },
        active: true
      });

      setCurrentRuleId(res.rule.ruleId);
      setRuleRunning(true);
      const listRes = await api.listRules();
      setRules(listRes.rules || []);
      showBanner(
        'success',
        `Compiled & deployed "${res.rule.name}" (${res.executionPlan.topoOrder.length} RxJS stages)`
      );
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleStopRule = async () => {
    if (!currentRuleId) return;
    try {
      await api.stopRule(currentRuleId);
      setRuleRunning(false);
      const listRes = await api.listRules();
      setRules(listRes.rules || []);
      showBanner('info', `Stopped RxJS pipeline "${ruleName}".`);
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleDeleteRule = async () => {
    if (!currentRuleId) return;
    try {
      await api.deleteRule(currentRuleId);
      const listRes = await api.listRules();
      const remaining = listRes.rules || [];
      setRules(remaining);
      if (remaining.length > 0) {
        loadRuleIntoCanvas(remaining[0]);
      } else {
        handleNewBlankRule();
      }
      showBanner('info', 'Rule deleted.');
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleStartSim = async () => {
    try {
      await api.startSimulator(450);
      setSimRunning(true);
      showBanner('success', 'Hardware telemetry simulator streaming.');
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleStopSim = async () => {
    try {
      await api.stopSimulator();
      setSimRunning(false);
      showBanner('info', 'Hardware simulator paused.');
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleInjectSpike = async () => {
    try {
      if (!simRunning) {
        await api.startSimulator(450);
        setSimRunning(true);
      }
      await api.injectSpike({
        deviceId: selectedDevice,
        metric: selectedMetric === 'vibration' ? 'vibration' : 'temperature',
        value: selectedMetric === 'vibration' ? 6.4 : 92,
        durationMs: 8000
      });
      showBanner(
        'info',
        `Injected anomaly spike on ${selectedDevice}! Watch moving average & wires glow.`
      );
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const handleClearAlerts = async () => {
    try {
      await api.clearAlerts();
      setAlerts([]);
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <header
        style={{
          height: 56,
          flexShrink: 0,
          background: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Activity size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.02em' }}>NexusFlow</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Visual IoT Rule Engine</div>
            </div>
          </div>

          <div style={{ height: 24, width: 1, background: 'var(--border-subtle)' }} />

          <select
            value={currentRuleId || ''}
            onChange={(e) => {
              const found = rules.find((r) => r.ruleId === e.target.value);
              if (found) loadRuleIntoCanvas(found);
            }}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-strong)',
              borderRadius: 7,
              color: 'var(--text-primary)',
              padding: '5px 10px',
              fontSize: 12,
              maxWidth: 200
            }}
          >
            {!currentRuleId && <option value="">(Unsaved Draft)</option>}
            {rules.map((r) => (
              <option key={r.ruleId} value={r.ruleId}>
                {r.running ? '● ' : '○ '}
                {r.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Pipeline Name"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 7,
              color: 'var(--text-primary)',
              padding: '5px 10px',
              fontSize: 12,
              width: 190
            }}
          />

          <button type="button" className="nf-btn" onClick={handleNewBlankRule} title="New blank pipeline">
            <Plus size={13} /> New
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 2
            }}
          >
            <TabBtn
              active={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              icon={Layers}
              label="Split"
            />
            <TabBtn
              active={viewMode === 'canvas'}
              onClick={() => setViewMode('canvas')}
              icon={Workflow}
              label="Builder"
            />
            <TabBtn
              active={viewMode === 'dashboard'}
              onClick={() => setViewMode('dashboard')}
              icon={BarChart3}
              label="Telemetry"
            />
          </div>

          <button type="button" className="nf-btn" onClick={() => setInspectorOpen(true)}>
            <Code2 size={13} /> JSON
          </button>

          <button type="button" className="nf-btn nf-btn-primary" onClick={handleDeployRule}>
            <Rocket size={13} /> {ruleRunning ? 'Update & Deploy' : 'Deploy RxJS'}
          </button>

          {ruleRunning && (
            <button type="button" className="nf-btn nf-btn-danger" onClick={handleStopRule}>
              <Square size={12} /> Stop
            </button>
          )}

          {currentRuleId && (
            <button
              type="button"
              className="nf-btn"
              onClick={handleDeleteRule}
              title="Delete saved rule"
            >
              <Trash2 size={13} />
            </button>
          )}

          <div
            className="mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              padding: '4px 9px',
              borderRadius: 999,
              background: connected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)',
              border: `1px solid ${
                connected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
              }`,
              color: connected ? '#34d399' : '#fda4af'
            }}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Status Toast Banner */}
      {banner && (
        <div
          style={{
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: 500,
            background:
              banner.type === 'error'
                ? 'rgba(244, 63, 94, 0.18)'
                : banner.type === 'success'
                ? 'rgba(16, 185, 129, 0.18)'
                : 'rgba(34, 211, 238, 0.16)',
            borderBottom: '1px solid var(--border-subtle)',
            color:
              banner.type === 'error'
                ? '#fda4af'
                : banner.type === 'success'
                ? '#6ee7b7'
                : '#a5f3fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{banner.text}</span>
          {!simRunning && banner.type === 'success' && (
            <button type="button" className="nf-btn nf-btn-amber" onClick={handleStartSim} style={{ padding: '3px 9px' }}>
              <Play size={11} /> Start Simulator Now
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {viewMode !== 'dashboard' && (
          <NodePalette onAddNode={handleAddNodeClick} onLoadPreset={handleLoadPreset} />
        )}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {viewMode !== 'dashboard' && (
            <div style={{ flex: viewMode === 'split' ? 1.15 : 1, position: 'relative', minHeight: 260 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                fitView
                colorMode="dark"
              >
                <Background gap={18} size={1} color="#1a2438" />
                <Controls />
                <MiniMap nodeColor="#22d3ee" maskColor="rgba(9, 13, 22, 0.72)" />
              </ReactFlow>

              {/* Quick Floating Simulator Controls when in Builder-only view */}
              {viewMode === 'canvas' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    display: 'flex',
                    gap: 8,
                    zIndex: 10
                  }}
                >
                  {!simRunning ? (
                    <button type="button" className="nf-btn nf-btn-primary" onClick={handleStartSim}>
                      <Play size={13} /> Start Simulator
                    </button>
                  ) : (
                    <button type="button" className="nf-btn nf-btn-danger" onClick={handleStopSim}>
                      <Square size={13} /> Stop Simulator
                    </button>
                  )}
                  <button type="button" className="nf-btn nf-btn-amber" onClick={handleInjectSpike}>
                    <Flame size={13} /> Inject Spike
                  </button>
                </div>
              )}
            </div>
          )}

          {viewMode !== 'canvas' && (
            <div
              style={{
                flex: viewMode === 'split' ? 0.95 : 1,
                borderTop: viewMode === 'split' ? '1px solid var(--border-subtle)' : 'none',
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <LiveDashboard
                telemetryByDevice={telemetryByDevice}
                selectedDevice={selectedDevice}
                onSelectDevice={setSelectedDevice}
                selectedMetric={selectedMetric}
                onSelectMetric={setSelectedMetric}
                stats={stats}
                simRunning={simRunning}
                onStartSim={handleStartSim}
                onStopSim={handleStopSim}
                onInjectSpike={handleInjectSpike}
              />
            </div>
          )}
        </main>

        <AlertFeed alerts={alerts} onClear={handleClearAlerts} />
      </div>

      <GraphInspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        ruleName={ruleName}
        nodes={nodes}
        edges={edges}
      />
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        border: 'none',
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)'
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <NexusFlowWorkspace />
    </ReactFlowProvider>
  );
}
