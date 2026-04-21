import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUsuario } from '../services/api';
import { colors } from '../constants/colors';

export default function Usuarios() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cleancare_token');
    const usuario = localStorage.getItem('cleancare_usuario');
    if (token && usuario) {
      const u = JSON.parse(usuario);
      if (u.rol !== 'admin') {
        navigate('/mi-cuenta');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, usuario } = await loginUsuario(email, password);
      localStorage.setItem('cleancare_token', token);
      localStorage.setItem('cleancare_usuario', JSON.stringify(usuario));
      navigate('/mi-cuenta');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <img src="/logo.png" alt="CleanCare" onClick={() => navigate('/')} style={{ height: 56, width: 'auto', objectFit: 'contain', cursor: 'pointer' }} />
          <button onClick={() => navigate('/')} style={styles.navBtn}>Volver</button>
        </div>
      </nav>

      <div style={styles.container}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <img src="/logo.png" alt="CleanCare" style={{ display: 'block', margin: '0 auto 8px', height: 72, width: 'auto', objectFit: 'contain' }} />
          <p style={styles.subtitle}>Ingresá a tu cuenta de residente</p>

          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
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

          <p style={{ ...styles.registerLink, marginBottom: 8 }}>
            <span onClick={() => navigate('/recuperar-clave')} style={styles.link}>¿Olvidaste tu contraseña?</span>
          </p>
          <p style={styles.registerLink}>
            ¿No tenés cuenta?{' '}
            <span onClick={() => navigate('/registro')} style={styles.link}>Registrate</span>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  nav: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${colors.border}`,
  },
  navInner: {
    maxWidth: 1200, margin: '0 auto', padding: '14px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logo: { fontSize: 24, fontWeight: 700, color: colors.primary, cursor: 'pointer' },
  navBtn: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent', color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  container: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    padding: '80px 20px 40px',
  },
  card: {
    backgroundColor: colors.white, borderRadius: 16, padding: 40,
    width: '100%', maxWidth: 420, border: `1px solid ${colors.border}`,
    display: 'flex', flexDirection: 'column' as const,
  },
  title: { fontSize: 28, fontWeight: 700, color: colors.primary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    border: `1px solid ${colors.border}`, fontSize: 14, marginBottom: 20,
    fontFamily: 'inherit',
  },
  button: {
    width: '100%', padding: '14px 0', borderRadius: 999,
    backgroundColor: colors.primary, color: colors.white, fontSize: 16,
    fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
  },
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '10px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 20, textAlign: 'center',
  },
  registerLink: {
    fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 20,
  },
  link: { color: colors.primary, fontWeight: 600, cursor: 'pointer' },
};
