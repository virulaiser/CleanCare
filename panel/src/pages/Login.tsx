import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../constants/colors';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // TODO: autenticación real con JWT
    if (email === 'admin@cleancare.uy' && password === 'admin') {
      localStorage.setItem('cleancare_token', 'temp-token');
      navigate('/dashboard');
    } else {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>CleanCare</h1>
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

        <button type="submit" style={styles.button}>
          Ingresar
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
