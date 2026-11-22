import { useState } from 'react';
import useAuthStore from '../store/authStore.js';

export default function LoginPage() {
  const { login, register, loading, error } = useAuthStore();
  const [email, setEmail] = useState('admin@nexusflow.local');
  const [password, setPassword] = useState('Password123');

  const handleSubmit = async (mode) => {
    try {
      if (mode === 'register') {
        await register(email, password);
      } else {
        await login(email, password);
      }
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#020817', color: 'white' }}>
      <div style={{ width: 420, background: '#111827', border: '1px solid #374151', borderRadius: 16, padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>NexusFlow</h1>
        <p>Visual IoT telemetry & rule engine</p>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, marginTop: 6 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, marginTop: 6 }} />
        </label>
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => handleSubmit('login')} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Working...' : 'Login'}
          </button>
          <button type="button" onClick={() => handleSubmit('register')} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}>
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
