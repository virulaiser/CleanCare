import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { confirmarResetPassword } from '../services/api';
import { colors } from '../constants/colors';

export default function ResetClave() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) { setError('Link inválido'); return; }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return; }
    if (password !== password2) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await confirmarResetPassword(token, password);
      setOk(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/logo.png" alt="CleanCare" style={{ display: 'block', margin: '0 auto 8px', height: 72 }} />
        {ok ? (
          <>
            <h2 style={{ ...styles.title, color: colors.success }}>✓ Contraseña actualizada</h2>
            <p style={styles.sub}>Ya podés iniciar sesión con la nueva contraseña.</p>
            <button onClick={() => navigate('/login')} style={styles.btn}>Ir al login</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={styles.title}>Elegí una nueva contraseña</h2>
            <p style={styles.sub}>Mínimo 6 caracteres.</p>

            {error && <div style={styles.error}>{error}</div>}

            <label style={styles.label}>Nueva contraseña</label>
            <input
              type="password" required autoFocus minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Repetir contraseña</label>
            <input
              type="password" required minLength={6}
              value={password2} onChange={(e) => setPassword2(e.target.value)}
              style={styles.input}
            />

            <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgPage, padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 40, width: '100%', maxWidth: 420, border: `1px solid ${colors.border}` },
  title: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 },
  label: { fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 },
  input: { width: '100%', padding: '12px 16px', borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, marginBottom: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: { padding: '14px 0', borderRadius: 999, backgroundColor: colors.primary, color: colors.white, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 },
  error: { backgroundColor: '#FEF2F2', color: colors.error, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
};
