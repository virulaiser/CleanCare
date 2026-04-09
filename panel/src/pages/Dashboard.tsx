import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerResumen, listarUsos, ResumenItem, Uso, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const edificioId = usuario?.edificio_id || 'edificio-central';
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenItem[]>([]);
  const [usos, setUsos] = useState<Uso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [mes, anio]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [resumenData, usosData] = await Promise.all([
        obtenerResumen(edificioId, mes, anio),
        listarUsos(),
      ]);
      setResumen(resumenData);
      setUsos(usosData);
    } catch {
      setError('Error al cargar datos. Verificá que el backend esté corriendo.');
    } finally {
      setLoading(false);
    }
  }

  const totalUsos = resumen.reduce((sum, r) => sum + r.total_usos, 0);
  const totalMinutos = resumen.reduce((sum, r) => sum + r.minutos_totales, 0);

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  function exportarCSV() {
    if (resumen.length === 0) return;

    const header = 'Máquina,Usos,Minutos';
    const rows = resumen.map((r) => `${r._id},${r.total_usos},${r.minutos_totales}`);
    rows.push(`TOTAL,${totalUsos},${totalMinutos}`);
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cleancare_resumen_${meses[mes - 1]}_${anio}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/dashboard')} style={{ ...styles.logoutBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.logoutBtn}>Máquinas</button>
          <button onClick={handleLogout} style={styles.logoutBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={styles.titleRow}>
          <h2 style={styles.pageTitle}>Resumen de facturación</h2>
          <div style={styles.filters}>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              style={styles.select}
            >
              {meses.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              style={styles.select}
            >
              {[2025, 2026, 2027].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              onClick={exportarCSV}
              disabled={resumen.length === 0 || loading}
              style={{
                ...styles.exportBtn,
                opacity: resumen.length === 0 || loading ? 0.5 : 1,
              }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* KPI Cards */}
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Total usos</span>
            <span style={styles.kpiValue}>{loading ? '...' : totalUsos}</span>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Minutos totales</span>
            <span style={styles.kpiValue}>{loading ? '...' : totalMinutos}</span>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Máquinas activas</span>
            <span style={styles.kpiValue}>{loading ? '...' : resumen.length}</span>
          </div>
        </div>

        {/* Resumen por máquina */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Desglose por máquina — {meses[mes - 1]} {anio}</h3>
          {loading ? (
            <p style={styles.loadingText}>Cargando...</p>
          ) : resumen.length === 0 ? (
            <p style={styles.emptyText}>No hay usos registrados en este período.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Máquina</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Usos</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Minutos</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((item) => (
                  <tr key={item._id}>
                    <td style={styles.td}>{item._id}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{item.total_usos}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{item.minutos_totales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Últimos usos */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Últimos usos registrados</h3>
          {loading ? (
            <p style={styles.loadingText}>Cargando...</p>
          ) : usos.length === 0 ? (
            <p style={styles.emptyText}>No hay usos registrados.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Máquina</th>
                  <th style={styles.th}>Residente</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Duración</th>
                </tr>
              </thead>
              <tbody>
                {usos.slice(0, 20).map((uso) => (
                  <tr key={uso._id}>
                    <td style={styles.td}>
                      {new Date(uso.fecha).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={styles.td}>{uso.maquina_id}</td>
                    <td style={styles.td}>{uso.residente_id || '—'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{uso.duracion_min} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: colors.bgPage,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`,
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.primary,
  },
  logoutBtn: {
    padding: '8px 20px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 24px',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  filters: {
    display: 'flex',
    gap: 8,
  },
  select: {
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    fontFamily: 'inherit',
    backgroundColor: colors.white,
    cursor: 'pointer',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: '24px 20px',
    border: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: 700,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    border: `1px solid ${colors.border}`,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: colors.textSecondary,
    borderBottom: `2px solid ${colors.border}`,
  },
  td: {
    padding: '12px',
    fontSize: 14,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
  },
  error: {
    backgroundColor: '#FEF2F2',
    color: colors.error,
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  exportBtn: {
    padding: '8px 20px',
    borderRadius: 999,
    border: 'none',
    backgroundColor: colors.success,
    color: colors.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
