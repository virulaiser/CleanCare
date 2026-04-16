import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarMisUsos, obtenerBilletera, listarMaquinas, Uso, Maquina, Usuario, Transaccion } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MiCuenta() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [usos, setUsos] = useState<Uso[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [maquinasDisp, setMaquinasDisp] = useState<(Maquina & { ocupada?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) {
      navigate('/usuarios');
    }
  }, [navigate]);

  useEffect(() => {
    fetchUsos();
  }, [mes, anio]);

  async function fetchUsos() {
    setLoading(true);
    setError('');
    const edificio = usuario?.edificio_id || '';
    const [data, billetera, maqData] = await Promise.all([
      listarMisUsos().catch(() => [] as Uso[]),
      obtenerBilletera().catch(() => ({ saldo: 0, transacciones: [] as Transaccion[] })),
      edificio ? listarMaquinas(edificio).catch(() => [] as Maquina[]) : Promise.resolve([] as Maquina[]),
    ]);
    setUsos(data || []);
    setSaldo(billetera.saldo ?? 0);
    setMaquinasDisp((maqData || []) as (Maquina & { ocupada?: boolean })[]);
    setLoading(false);
  }

  // Filtrar por mes/año seleccionado
  const usosMes = usos.filter((u) => {
    const f = new Date(u.fecha_inicio || u.fecha || '');
    return f.getMonth() + 1 === mes && f.getFullYear() === anio;
  });

  const totalUsos = usosMes.length;
  const totalMinutos = usosMes.reduce((sum, u) => sum + u.duracion_min, 0);
  const completados = usosMes.filter((u) => u.completado || u.estado === 'completado').length;

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <img src="/logo.png" alt="CleanCare" onClick={() => navigate('/')} style={{ height: 56, width: 'auto', objectFit: 'contain', cursor: 'pointer' }} />
          <div style={styles.navActions}>
            <span style={styles.userName}>{usuario?.nombre || usuario?.email}</span>
            <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
          </div>
        </div>
      </nav>

      <main style={styles.main}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Mi resumen</h2>
          <div style={styles.filters}>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={styles.select}>
              {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={styles.select}>
              {[2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Saldo */}
        <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '20px 24px' }}>
          <span style={{ fontSize: 15, color: colors.textSecondary }}>Tu saldo:</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: saldo !== null && saldo <= 0 ? '#EF4444' : colors.primary }}>
            {loading ? '...' : saldo ?? 0} fichas
          </span>
        </div>

        {/* Disponibilidad de máquinas */}
        {maquinasDisp.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Máquinas de tu edificio</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {maquinasDisp.map((m) => (
                <div key={m.maquina_id} style={{
                  padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                  backgroundColor: m.ocupada ? '#FEF2F2' : '#F0FDF4',
                  border: `1px solid ${m.ocupada ? '#FECACA' : '#BBF7D0'}`,
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: m.ocupada ? '#EF4444' : '#22C55E',
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{m.nombre}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    backgroundColor: m.ocupada ? '#FEE2E2' : '#DCFCE7',
                    color: m.ocupada ? '#DC2626' : '#16A34A',
                  }}>
                    {m.ocupada ? 'Ocupada' : 'Disponible'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Usos del mes</span>
            <span style={styles.kpiValue}>{loading ? '...' : totalUsos}</span>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Minutos totales</span>
            <span style={styles.kpiValue}>{loading ? '...' : totalMinutos}</span>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Completados</span>
            <span style={styles.kpiValue}>{loading ? '...' : completados}</span>
          </div>
        </div>

        {/* Historial */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Historial — {meses[mes - 1]} {anio}</h3>
          {loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : usosMes.length === 0 ? (
            <p style={styles.muted}>No hay usos registrados en este período.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Máquina</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Duración</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usosMes.map((uso) => {
                  const estado = uso.estado || (uso.completado ? 'completado' : 'cancelado');
                  const estadoStyles: Record<string, { bg: string; color: string; label: string }> = {
                    completado: { bg: '#DCFCE7', color: '#16A34A', label: 'Completado' },
                    cancelado:  { bg: '#FEF2F2', color: '#EF4444', label: 'Cancelado' },
                    averia:     { bg: '#FEF3C7', color: '#D97706', label: 'Avería' },
                    activo:     { bg: '#DBEAFE', color: '#3B82F6', label: 'En curso' },
                  };
                  const st = estadoStyles[estado] || estadoStyles.cancelado;
                  return (
                    <tr key={uso._id}>
                      <td style={styles.td}>{formatFecha(uso.fecha_inicio || uso.fecha || '')}</td>
                      <td style={styles.td}>{uso.maquina_id}</td>
                      <td style={styles.td}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          backgroundColor: uso.tipo === 'secadora' ? '#FEF3C7' : '#DBEAFE',
                          color: uso.tipo === 'secadora' ? '#D97706' : '#3B82F6',
                        }}>
                          {uso.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{uso.duracion_min} min</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                          fontSize: 12, fontWeight: 600,
                          backgroundColor: st.bg, color: st.color,
                        }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  nav: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${colors.border}`,
  },
  navInner: {
    maxWidth: 960, margin: '0 auto', padding: '14px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logo: { fontSize: 22, fontWeight: 700, color: colors.primary, cursor: 'pointer' },
  navActions: { display: 'flex', gap: 12, alignItems: 'center' },
  userName: { fontSize: 14, color: colors.textSecondary, fontWeight: 500 },
  navBtn: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent', color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  titleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24, flexWrap: 'wrap' as const, gap: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary },
  filters: { display: 'flex', gap: 8 },
  select: {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white, cursor: 'pointer',
  },
  kpiRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16, marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: '24px 20px',
    border: `1px solid ${colors.border}`, display: 'flex',
    flexDirection: 'column' as const, alignItems: 'center',
  },
  kpiLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  kpiValue: { fontSize: 32, fontWeight: 700, color: colors.textPrimary },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '10px 12px', fontSize: 13, fontWeight: 600,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
  },
  td: {
    padding: '12px', fontSize: 14, color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
  },
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '12px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 20,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
};
