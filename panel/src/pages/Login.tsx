import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { colors } from '../constants/colors';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token, usuario } = await login(email, password);
      if (!['admin', 'admin_edificio'].includes(usuario.rol)) {
        setError('Acceso solo para administradores');
        return;
      }
      localStorage.setItem('cleancare_token', token);
      localStorage.setItem('cleancare_usuario', JSON.stringify(usuario));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <img src="/logo.png" alt="CleanCare" style={{ display: 'block', margin: '0 auto 8px', height: 72, width: 'auto', objectFit: 'contain' }} />
        <p style={styles.subtitle}>Panel de Administración</p>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@cleancare.uy"
          required
          style={styles.input}
        />

        <label style={styles.label}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          style={styles.input}
        />

        <button type="submit" style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <button type="button" onClick={() => navigate('/')} style={styles.backButton}>
          ← Volver al inicio
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgPage,
    padding: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    border: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    marginBottom: 20,
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 16,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 8,
  },
  backButton: {
    width: '100%',
    padding: '10px 0',
    borderRadius: 999,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 12,
  },
  error: {
    backgroundColor: '#FEF2F2',
    color: colors.error,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
};
