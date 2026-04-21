import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarFacturas, generarFacturas, listarEdificios,
  Factura, Edificio, Usuario,
} from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Facturacion() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const esSuper = usuario?.rol === 'admin';
  const now = new Date();

  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [edificioId, setEdificioId] = useState(esSuper ? '' : (usuario?.edificio_id || ''));
  const [mes, setMes] = useState<number | ''>('');
  const [anio, setAnio] = useState<number | ''>(now.getFullYear());
  const [tipo, setTipo] = useState<string>('');
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    if (esSuper) {
      listarEdificios().then(setEdificios).catch(() => {});
    }
    fetchFacturas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchFacturas() {
    setLoading(true);
    try {
      const filter: any = {};
      if (edificioId) filter.edificioId = edificioId;
      if (mes) filter.mes = mes;
      if (anio) filter.anio = anio;
      if (tipo) filter.tipo = tipo;
      const data = await listarFacturas(filter);
      setFacturas(data);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerar() {
    const ediId = edificioId || usuario?.edificio_id;
    if (!ediId) { setMsg('Seleccioná un edificio'); return; }
    const m = mes || now.getMonth() + 1;
    const y = anio || now.getFullYear();
    if (!window.confirm(`Generar facturas para ${MESES[m - 1]} ${y}? Sobrescribe las existentes.`)) return;
    setGenerando(true);
    setMsg('');
    try {
      const r = await generarFacturas(ediId, Number(m), Number(y));
      setMsg(`Generadas: 1 ingreso + 1 consumo + ${r.resumen?.aptos?.length || 0} aptos.`);
      await fetchFacturas();
    } catch (err: any) {
      setMsg(err?.response?.data?.error || 'Error al generar');
    } finally {
      setGenerando(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  const tipoLabel: Record<string, string> = {
    ingreso: '💰 Ingreso admin',
    consumo_resumen: '📊 Consumo',
    resumen_apto: '🏠 Apto',
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/dispositivos')} style={styles.navBtn}>Dispositivos</button>
          <button onClick={() => navigate('/facturacion')} style={{ ...styles.navBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Facturación</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Facturación</h2>
        {msg && <p style={{ fontSize: 13, marginBottom: 12, color: msg.includes('Error') ? colors.error : colors.success }}>{msg}</p>}

        <div style={styles.card}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {esSuper && (
              <label style={styles.label}>
                Edificio
                <select value={edificioId} onChange={(e) => setEdificioId(e.target.value)} style={styles.input}>
                  <option value="">Todos</option>
                  {edificios.map((e) => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
                </select>
              </label>
            )}
            <label style={styles.label}>
              Mes
              <select value={mes} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : '')} style={styles.input}>
                <option value="">Todos</option>
                {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label style={styles.label}>
              Año
              <input type="number" value={anio} onChange={(e) => setAnio(e.target.value ? Number(e.target.value) : '')} style={{ ...styles.input, width: 100 }} />
            </label>
            <label style={styles.label}>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={styles.input}>
                <option value="">Todos</option>
                <option value="ingreso">Ingreso admin</option>
                <option value="consumo_resumen">Consumo</option>
                <option value="resumen_apto">Apto</option>
              </select>
            </label>
            <button onClick={fetchFacturas} style={styles.btnSecondary}>Filtrar</button>
            <button onClick={handleGenerar} disabled={generando} style={{ ...styles.btnPrimary, opacity: generando ? 0.5 : 1 }}>
              {generando ? 'Generando...' : 'Generar ahora'}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          {loading ? (
            <p style={{ color: colors.textSecondary }}>Cargando...</p>
          ) : facturas.length === 0 ? (
            <p style={{ color: colors.textSecondary }}>Sin facturas para los filtros actuales.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Período</th>
                  <th style={styles.th}>Edificio</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Apto</th>
                  <th style={styles.th}>Generada</th>
                  <th style={styles.th}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f._id}>
                    <td style={styles.td}>{MESES[f.mes - 1]} {f.anio}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>{f.edificio_id}</td>
                    <td style={styles.td}>{tipoLabel[f.tipo] || f.tipo}</td>
                    <td style={styles.td}>{f.apartamento || '—'}</td>
                    <td style={{ ...styles.td, fontSize: 12, color: colors.textSecondary }}>
                      {new Date(f.generada).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={styles.td}>
                      <a href={f.pdf_url} target="_blank" rel="noopener noreferrer" style={styles.link}>Abrir</a>
                    </td>
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
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`, flexWrap: 'wrap', gap: 12,
  },
  navBtn: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 16 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 20,
    border: `1px solid ${colors.border}`, marginBottom: 16,
  },
  label: { display: 'flex', flexDirection: 'column' as const, fontSize: 13, color: colors.textSecondary, gap: 4 },
  input: {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
  },
  btnPrimary: {
    padding: '8px 20px', borderRadius: 999, border: 'none',
    backgroundColor: colors.primary, color: colors.white, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '10px 12px', fontSize: 13, fontWeight: 600,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
  },
  td: { padding: 12, fontSize: 14, color: colors.textPrimary, borderBottom: `1px solid ${colors.border}` },
  link: { color: colors.primary, textDecoration: 'none', fontWeight: 600 },
};
