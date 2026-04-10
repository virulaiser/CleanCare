import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarTips, crearTip, eliminarTip, Tip, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export default function Tips() {
  const navigate = useNavigate();
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'lavarropas' | 'secadora' | 'ambos'>('ambos');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    fetchTips();
  }, []);

  async function fetchTips() {
    setLoading(true);
    try {
      const data = await listarTips();
      setTips(data);
    } catch {}
    setLoading(false);
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setCreando(true);
    try {
      await crearTip(texto.trim(), tipo);
      setTexto('');
      setTipo('ambos');
      await fetchTips();
    } catch {
      alert('Error al crear tip');
    }
    setCreando(false);
  }

  async function handleEliminar(id: string) {
    if (!confirm('¿Eliminar este consejo?')) return;
    try {
      await eliminarTip(id);
      await fetchTips();
    } catch {
      alert('Error al eliminar');
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  const tipoBadge = (t: string) => {
    if (t === 'lavarropas') return { bg: '#DBEAFE', color: '#3B82F6', label: 'Lavado' };
    if (t === 'secadora') return { bg: '#FEF3C7', color: '#D97706', label: 'Secado' };
    return { bg: '#F0FDF4', color: '#16A34A', label: 'Ambos' };
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtn}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/tips')} style={{ ...styles.navBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Tips</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Consejos para usuarios</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 24 }}>
          Estos consejos aparecen como popup en la app mientras la máquina funciona. Se muestra uno aleatorio por ciclo.
        </p>

        {/* Form */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Agregar consejo</h3>
          <form onSubmit={handleCrear} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={styles.label}>Texto del consejo</label>
              <input
                style={styles.input}
                placeholder="Ej: No colocar championes en la máquina"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={styles.label}>Aplica a</label>
              <select style={styles.input} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                <option value="ambos">Ambos</option>
                <option value="lavarropas">Solo lavado</option>
                <option value="secadora">Solo secado</option>
              </select>
            </div>
            <button type="submit" disabled={creando || !texto.trim()} style={{ ...styles.btnPrimary, opacity: creando || !texto.trim() ? 0.5 : 1 }}>
              {creando ? 'Agregando...' : 'Agregar'}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Consejos activos ({tips.length})</h3>
          {loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : tips.length === 0 ? (
            <p style={styles.muted}>No hay consejos. Agregá el primero.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tips.map((tip) => {
                const badge = tipoBadge(tip.tipo);
                return (
                  <div key={tip._id} style={styles.tipRow}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 600, backgroundColor: badge.bg, color: badge.color,
                      whiteSpace: 'nowrap', marginRight: 12,
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, color: colors.textPrimary }}>{tip.texto}</span>
                    <button onClick={() => handleEliminar(tip._id)} style={styles.btnDelete}>Eliminar</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', backgroundColor: colors.white, borderBottom: `1px solid ${colors.border}`,
  },
  logo: { fontSize: 22, fontWeight: 700, color: colors.primary },
  navBtn: {
    padding: '8px 16px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 500, color: colors.textSecondary },
  input: {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
  },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDelete: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#FEF2F2',
    color: colors.error, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  tipRow: {
    display: 'flex', alignItems: 'center', padding: '12px 16px',
    borderRadius: 8, backgroundColor: colors.bgPage,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
};
