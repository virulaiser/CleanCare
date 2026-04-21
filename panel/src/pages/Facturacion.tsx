import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarFacturas, generarFacturas, listarEdificios,
  Factura, Edificio, Usuario,
} from '../services/api';
import { colors } from '../constants/colors';
import AdminNav from '../components/AdminNav';
import SubTabs, { DASHBOARD_TABS } from '../components/SubTabs';

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
  const [showHelp, setShowHelp] = useState(false);

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
      <AdminNav active="/facturacion" />

      <main style={styles.main}>
        <SubTabs items={DASHBOARD_TABS} active="/facturacion" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Facturación</h2>
          <button
            onClick={() => setShowHelp(true)}
            style={styles.helpBtn}
            title="¿Qué es esto?"
          >
            ? ¿Qué es esto?
          </button>
        </div>
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

      {showHelp && (
        <div style={styles.overlay} onClick={() => setShowHelp(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>¿Cómo funciona la facturación?</h3>
            <p style={styles.modalIntro}>
              Cada mes el sistema cierra el período y genera PDFs automáticamente. Se suben al storage y quedan disponibles para descargar acá.
            </p>

            <div style={styles.helpSection}>
              <div style={styles.helpRow}>
                <span style={styles.helpEmoji}>💰</span>
                <div>
                  <strong style={styles.helpLabel}>Ingreso admin</strong>
                  <p style={styles.helpText}>
                    Factura de comisión CleanCare. Muestra fichas vendidas, precio al residente y el total que el admin del edificio le debe pagar a CleanCare. <em>1 por edificio por mes.</em>
                  </p>
                </div>
              </div>
              <div style={styles.helpRow}>
                <span style={styles.helpEmoji}>📊</span>
                <div>
                  <strong style={styles.helpLabel}>Consumo</strong>
                  <p style={styles.helpText}>
                    Resumen operativo del edificio: lavados y secados completados, estimación de litros de agua y kWh según la configuración del edificio. <em>1 por edificio por mes.</em>
                  </p>
                </div>
              </div>
              <div style={styles.helpRow}>
                <span style={styles.helpEmoji}>🏠</span>
                <div>
                  <strong style={styles.helpLabel}>Apto</strong>
                  <p style={styles.helpText}>
                    Resumen individual de cada apartamento: saldo al cierre y todos los movimientos del mes (asignaciones, compras, usos, devoluciones). <em>1 por apto por mes.</em> Es el único que ven los residentes en la app.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.helpHint}>
              <strong>💡 Generación automática:</strong> se disparan el día configurado en "Créditos → Configuración del edificio → Día de facturación". El botón <em>Generar ahora</em> fuerza la corrida manualmente (sobrescribe PDFs del mes actual).
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowHelp(false)} style={styles.btnPrimary}>Entendido</button>
            </div>
          </div>
        </div>
      )}
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
  helpBtn: {
    padding: '6px 14px', borderRadius: 999, border: `1px solid ${colors.primary}`,
    backgroundColor: colors.bgBlueLight, color: colors.primary,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  overlay: {
    position: 'fixed' as const, inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 28,
    maxWidth: 560, width: '100%', maxHeight: '85vh',
    overflowY: 'auto' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    fontSize: 20, fontWeight: 700, color: colors.textPrimary,
    marginBottom: 6, marginTop: 0,
  },
  modalIntro: {
    fontSize: 14, color: colors.textSecondary, marginTop: 0, marginBottom: 20, lineHeight: 1.5,
  },
  helpSection: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  helpRow: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: 14, borderRadius: 10,
    backgroundColor: colors.bgPage, border: `1px solid ${colors.border}`,
  },
  helpEmoji: { fontSize: 26, lineHeight: 1 },
  helpLabel: {
    fontSize: 14, fontWeight: 700, color: colors.textPrimary,
    display: 'block', marginBottom: 4,
  },
  helpText: {
    fontSize: 13, color: colors.textSecondary, margin: 0, lineHeight: 1.5,
  },
  helpHint: {
    marginTop: 16, padding: 14, borderRadius: 10,
    backgroundColor: colors.bgBlueLight, color: colors.textPrimary,
    fontSize: 13, lineHeight: 1.5,
  },
};
