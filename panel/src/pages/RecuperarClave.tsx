import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { solicitarResetPassword } from '../services/api';
import { colors } from '../constants/colors';

export default function RecuperarClave() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const r = await solicitarResetPassword(email.trim().toLowerCase());
      setMensaje(r.message || 'Si el email está registrado, vas a recibir un correo.');
    } catch (err: any) {
      // El endpoint devuelve 200 genérico siempre, solo errores de red caen acá.
      setMensaje('No se pudo conectar al servidor. Probá de nuevo en unos segundos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <img src="/logo.png" alt="CleanCare" style={{ display: 'block', margin: '0 auto 8px', height: 72 }} />
        <h2 style={styles.title}>Recuperar contraseña</h2>
        <p style={styles.sub}>
          Ingresá el email con el que te registraste. Te vamos a mandar un link para elegir una nueva contraseña.
        </p>

        {mensaje ? (
          <div style={styles.success}>
            📧 {mensaje}
          </div>
        ) : (
          <>
            <label style={styles.label}>Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com" style={styles.input}
            />
            <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
          </>
        )}

        <button type="button" onClick={() => navigate(-1)} style={styles.link}>← Volver</button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgPage, padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 40, width: '100%', maxWidth: 420, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' },
  title: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 },
  label: { fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 },
  input: { width: '100%', padding: '12px 16px', borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, marginBottom: 20, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: { padding: '14px 0', borderRadius: 999, backgroundColor: colors.primary, color: colors.white, fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  link: { background: 'none', border: 'none', color: colors.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 16 },
  success: { backgroundColor: '#DCFCE7', color: colors.success, padding: '14px 16px', borderRadius: 8, fontSize: 14, marginBottom: 12, lineHeight: 1.5 },
};
