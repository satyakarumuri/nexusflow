import { useEffect, useState } from 'react';
import GraphCanvas from '../components/GraphCanvas.jsx';
import useGraphStore from '../store/graphStore.js';

export default function DashboardPage() {
  const { fetchGraphs, saveGraph, graphs, loading } = useGraphStore();
  const [currentGraph, setCurrentGraph] = useState({
    name: 'Turbine Overheat',
    nodes: [],
    edges: [],
    viewport: {},
    status: 'draft',
  });

  useEffect(() => {
    fetchGraphs().catch((error) => console.error(error));
  }, [fetchGraphs]);

  const handleSaveGraph = async () => {
    try {
      const saved = await saveGraph(currentGraph);
      setCurrentGraph(saved || currentGraph);
      alert('Graph saved');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#020817', color: '#e5e7eb' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>NexusFlow Dashboard</h1>
          <p style={{ margin: 6, color: '#94a3b8' }}>Factory telemetry and rule management</p>
        </div>
        <button type="button" onClick={handleSaveGraph} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
          {loading ? 'Saving...' : 'Save graph'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 20 }}>
        <GraphCanvas onGraphChange={(graph) => setCurrentGraph({ ...currentGraph, nodes: graph.nodes, edges: graph.edges })} />
        <aside style={{ background: '#111827', borderRadius: 12, border: '1px solid #1f2937', padding: 16 }}>
          <h3>Saved graphs</h3>
          {graphs.length === 0 ? <p>No graphs yet.</p> : graphs.map((graph) => <div key={graph._id} style={{ padding: 8, borderBottom: '1px solid #1f2937' }}>{graph.name}</div>)}
        </aside>
      </div>
    </div>
  );
}
