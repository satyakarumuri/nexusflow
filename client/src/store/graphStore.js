import { create } from 'zustand';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.js';

const useGraphStore = create((set) => ({
  graphs: [],
  loading: false,
  error: null,

  fetchGraphs: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiGet('/api/graphs');
      set({ graphs: data.graphs || [], loading: false });
      return data.graphs || [];
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  saveGraph: async (graph) => {
    set({ loading: true, error: null });
    try {
      const payload = graph._id ? await apiPut(`/api/graphs/${graph._id}`, graph) : await apiPost('/api/graphs', graph);
      set({ loading: false });
      return payload.graph;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteGraph: async (graphId) => {
    set({ loading: true, error: null });
    try {
      await apiDelete(`/api/graphs/${graphId}`);
      set({ loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));

export default useGraphStore;
