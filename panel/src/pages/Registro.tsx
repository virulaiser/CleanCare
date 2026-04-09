import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registro } from '../services/api';
import { colors } from '../constants/colors';

export default function Registro() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [apartamento, setApartamento] = useState('');
  const [edificio, setEdificio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!nombre || !email || !password || !edificio) {
      setError('Completá los campos obligatorios: nombre, email, contraseña y edificio');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Formato de email inválido');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await registro({
        nombre,
        email: email.trim().toLowerCase(),
        password,
        telefono: telefono || undefined,
        apartamento: apartamento || undefined,
        edificio_id: edificio,
        unidad: unidad || undefined,
      });
      setSuccess('¡Cuenta creada correctamente! Ya podés usar la app CleanCare.');
      setNombre(''); setEmail(''); setPassword(''); setTelefono('');
      setApartamento(''); setEdificio(''); setUnidad('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <span style={styles.logo} onClick={() => navigate('/')}>CleanCare</span>
          <div style={styles.navActions}>
            <button onClick={() => navigate('/usuarios')} style={styles.navBtnOutline}>Volver</button>
          </div>
        </div>
      </nav>

      <div style={styles.container}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <h1 style={styles.title}>Crear cuenta</h1>
          <p style={styles.subtitle}>Registrate para usar las máquinas de tu edificio</p>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Nombre completo *</label>
              <input style={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Email *</label>
              <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ej: juan@email.com" />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Contraseña *</label>
              <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Teléfono</label>
              <input style={styles.input} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 099123456" />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Apartamento</label>
              <input style={styles.input} value={apartamento} onChange={(e) => setApartamento(e.target.value)} placeholder="Ej: 3B" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>ID del edificio *</label>
              <input style={styles.input} value={edificio} onChange={(e) => setEdificio(e.target.value)} placeholder="Ej: edificio-central" />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Unidad (opcional)</label>
              <input style={styles.input} value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Ej: apto-302" />
            </div>
            <div style={styles.field} />
          </div>

          <button type="submit" style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>

          <p style={styles.loginLink}>
            ¿Ya tenés cuenta? <span onClick={() => navigate('/usuarios')} style={styles.link}>Ingresá</span>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: colors.bgPage,
  },
  nav: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottom: `1px solid ${colors.border}`,
  },
  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.primary,
    cursor: 'pointer',
  },
  navActions: {
    display: 'flex',
    gap: 12,
  },
  navBtnOutline: {
    padding: '8px 20px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent',
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '80px 20px 40px',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 640,
    border: `1px solid ${colors.border}`,
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
  row: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },
  field: {
    flex: '1 1 250px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    padding: '12px 16px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    fontFamily: 'inherit',
    backgroundColor: colors.white,
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
  success: {
    backgroundColor: '#DCFCE7',
    color: '#16A34A',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  loginLink: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  link: {
    color: colors.primary,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
