import { create } from 'zustand';
import { apiPost, getAuthToken, saveAuthToken } from '../lib/api.js';

const useAuthStore = create((set) => ({
  token: getAuthToken(),
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await apiPost('/api/auth/login', { email, password });
      saveAuthToken(result.token);
      set({ token: result.token, user: result.user, loading: false });
      return result;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await apiPost('/api/auth/register', { email, password });
      saveAuthToken(result.token);
      set({ token: result.token, user: result.user, loading: false });
      return result;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));

export default useAuthStore;
