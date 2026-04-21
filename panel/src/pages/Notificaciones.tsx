import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarNotificaciones, enviarNotificacionTest,
  Notificacion,
} from '../services/api';
import { colors } from '../constants/colors';
import AdminNav from '../components/AdminNav';
import { fmtFecha } from '../utils/format';

const TIPOS = ['', 'factura_mensual', 'cierre_ocupacion', 'apertura_ocupacion', 'nuevo_miembro_pendiente', 'miembro_aprobado', 'test'];
const TIPO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  factura_mensual:         { label: '💰 Factura', color: '#1D4ED8', bg: '#DBEAFE' },
  cierre_ocupacion:        { label: '🚪 Cierre', color: '#B91C1C', bg: '#FEE2E2' },
  apertura_ocupacion:      { label: '🏠 Apertura', color: '#16A34A', bg: '#DCFCE7' },
  nuevo_miembro_pendiente: { label: '⏳ Pendiente', color: '#D97706', bg: '#FEF3C7' },
  miembro_aprobado:        { label: '✓ Aprobado', color: '#16A34A', bg: '#DCFCE7' },
  test:                    { label: '🧪 Test', color: '#64748B', bg: '#F1F5F9' },
};

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  enviada:    { label: '✓ Enviada', color: '#16A34A', bg: '#DCFCE7' },
  pendiente:  { label: '⏳ Pendiente', color: '#D97706', bg: '#FEF3C7' },
  error:      { label: '✗ Error', color: '#B91C1C', bg: '#FEE2E2' },
  descartada: { label: 'Descartada', color: '#64748B', bg: '#F1F5F9' },
};

export default function Notificaciones() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Prueba CleanCare');
  const [testHtml, setTestHtml] = useState('<h1>Hola</h1><p>Este es un mail de prueba.</p>');
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const filter: any = {};
      if (tipo) filter.tipo = tipo;
      if (estado) filter.estado = estado;
      if (email) filter.email = email;
      const data = await listarNotificaciones(filter);
      setNotifs(data);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!testTo) { alert('Falta el email destinatario'); return; }
    setTestBusy(true);
    try {
      const r = await enviarNotificacionTest(testTo, testSubject, testHtml);
      alert(`✓ Registrada: ${r.notificacion.notificacion_id}\nEstado: ${r.notificacion.estado}${r.notificacion.error ? '\nError: ' + r.notificacion.error : ''}`);
      setTestOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Error al enviar');
    } finally {
      setTestBusy(false);
    }
  }

  const enviadas = notifs.filter(n => n.estado === 'enviada').length;
  const pendientes = notifs.filter(n => n.estado === 'pendiente').length;
  const errores = notifs.filter(n => n.estado === 'error').length;

  return (
    <div style={styles.page}>
      <AdminNav active="/notificaciones" />

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={styles.pageTitle}>Notificaciones</h2>
          <button onClick={() => setTestOpen(true)} style={styles.btnPrimary}>📨 Enviar prueba</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ ...styles.kpi, backgroundColor: '#DCFCE7' }}>
            <div style={styles.kpiLabel}>Enviadas</div>
            <div style={{ ...styles.kpiValue, color: colors.success }}>{enviadas}</div>
          </div>
          <div style={{ ...styles.kpi, backgroundColor: '#FEF3C7' }}>
            <div style={styles.kpiLabel}>Pendientes</div>
            <div style={{ ...styles.kpiValue, color: '#D97706' }}>{pendientes}</div>
          </div>
          <div style={{ ...styles.kpi, backgroundColor: '#FEE2E2' }}>
            <div style={styles.kpiLabel}>Errores</div>
            <div style={{ ...styles.kpiValue, color: colors.error }}>{errores}</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiLabel}>Total mostrados</div>
            <div style={styles.kpiValue}>{notifs.length}</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={styles.label}>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={styles.input}>
                <option value="">Todos</option>
                {TIPOS.filter(Boolean).map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]?.label || t}</option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Estado
              <select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.input}>
                <option value="">Todos</option>
                <option value="enviada">Enviada</option>
                <option value="pendiente">Pendiente</option>
                <option value="error">Error</option>
                <option value="descartada">Descartada</option>
              </select>
            </label>
            <label style={styles.label}>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="destinatario@..." style={styles.input} />
            </label>
            <button onClick={fetchData} style={styles.btnSecondary}>Filtrar</button>
          </div>
        </div>

        <div style={styles.card}>
          {loading ? (
            <p style={{ color: colors.textSecondary }}>Cargando...</p>
          ) : notifs.length === 0 ? (
            <p style={{ color: colors.textSecondary }}>Sin notificaciones para los filtros actuales.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Destinatario</th>
                    <th style={styles.th}>Asunto</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {notifs.map((n) => {
                    const tInfo = TIPO_LABEL[n.tipo] || { label: n.tipo, color: colors.textSecondary, bg: '#F1F5F9' };
                    const eInfo = ESTADO_LABEL[n.estado] || { label: n.estado, color: colors.textSecondary, bg: '#F1F5F9' };
                    return (
                      <tr key={n._id}>
                        <td style={{ ...styles.td, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtFecha(n.creada)}</td>
                        <td style={styles.td}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: tInfo.bg, color: tInfo.color }}>
                            {tInfo.label}
                          </span>
                        </td>
                        <td style={{ ...styles.td, fontSize: 12, wordBreak: 'break-all' }}>{n.destinatario_email || '—'}</td>
                        <td style={{ ...styles.td, fontSize: 13 }}>{n.subject}</td>
                        <td style={styles.td}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: eInfo.bg, color: eInfo.color }}>
                            {eInfo.label}
                          </span>
                          {n.error && <div style={{ fontSize: 10, color: colors.error, marginTop: 2 }}>{n.error}</div>}
                        </td>
                        <td style={{ ...styles.td, fontSize: 11, fontFamily: 'monospace', color: colors.textSecondary }}>
                          {n.proveedor || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {testOpen && (
        <div style={styles.overlay} onClick={() => setTestOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Enviar email de prueba</h3>
            <label style={styles.label}>
              Destinatario
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="test@email.com" style={styles.input} autoFocus />
            </label>
            <label style={styles.label}>
              Asunto
              <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.label}>
              HTML del cuerpo
              <textarea value={testHtml} onChange={(e) => setTestHtml(e.target.value)} style={{ ...styles.input, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setTestOpen(false)} style={styles.btnSecondary}>Cancelar</button>
              <button onClick={handleTest} disabled={testBusy} style={{ ...styles.btnPrimary, opacity: testBusy ? 0.5 : 1 }}>
                {testBusy ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, border: `1px solid ${colors.border}`, marginBottom: 16 },
  kpi: { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16 },
  kpiLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 28, fontWeight: 700, color: colors.textPrimary },
  label: { display: 'flex', flexDirection: 'column' as const, fontSize: 13, color: colors.textSecondary, gap: 4 },
  input: { padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white },
  btnPrimary: { padding: '8px 20px', borderRadius: 999, border: 'none', backgroundColor: colors.primary, color: colors.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`, backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: 13, fontWeight: 600, color: colors.textSecondary, borderBottom: `2px solid ${colors.border}` },
  td: { padding: 12, fontSize: 14, color: colors.textPrimary, borderBottom: `1px solid ${colors.border}` },
  overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: colors.white, borderRadius: 16, padding: 28, maxWidth: 500, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: 0 },
};
