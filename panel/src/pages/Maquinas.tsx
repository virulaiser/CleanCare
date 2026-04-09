import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { listarMaquinas, crearMaquina, eliminarMaquina, Maquina, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

function buildQRValue(m: Maquina): string {
  return `cleancare://maquina?id=${m.maquina_id}&ip=${m.ip_local}&edificio=${m.edificio_id}`;
}

export default function Maquinas() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const edificioId = usuario?.edificio_id || 'edificio-central';

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'lavarropas' | 'secadora'>('lavarropas');
  const [ipLocal, setIpLocal] = useState('');
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState('');

  // QR modal
  const [qrMaquina, setQrMaquina] = useState<Maquina | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetchMaquinas();
  }, []);

  async function fetchMaquinas() {
    setLoading(true);
    setError('');
    try {
      const data = await listarMaquinas(edificioId);
      setMaquinas(data);
    } catch {
      setError('Error al cargar máquinas.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!nombre || !ipLocal) {
      setFormError('Completá nombre e IP local');
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipLocal)) {
      setFormError('Formato de IP inválido (ej: 192.168.1.45)');
      return;
    }

    setCreando(true);
    try {
      await crearMaquina({ nombre, tipo, ip_local: ipLocal, edificio_id: edificioId });
      setNombre('');
      setIpLocal('');
      setTipo('lavarropas');
      await fetchMaquinas();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error al crear máquina');
    } finally {
      setCreando(false);
    }
  }

  async function handleEliminar(maquinaId: string) {
    if (!confirm(`¿Eliminar máquina ${maquinaId}?`)) return;
    try {
      await eliminarMaquina(maquinaId);
      await fetchMaquinas();
    } catch {
      alert('Error al eliminar la máquina');
    }
  }

  function handlePrint(maquina: Maquina) {
    const qrValue = buildQRValue(maquina);
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${maquina.nombre}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; text-align: center; padding: 40px; }
          h2 { color: #1E293B; margin-bottom: 4px; }
          .code { color: #3B82F6; font-size: 18px; font-weight: 600; margin-bottom: 4px; }
          .tipo { color: #94A3B8; font-size: 14px; margin-bottom: 24px; }
          .ip { color: #94A3B8; font-size: 12px; margin-top: 16px; }
          svg { margin: 0 auto; }
          .footer { margin-top: 24px; color: #94A3B8; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h2>${maquina.nombre}</h2>
        <div class="code">${maquina.maquina_id}</div>
        <div class="tipo">${maquina.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}</div>
        <div id="qr"></div>
        <div class="ip">IP: ${maquina.ip_local}</div>
        <div class="footer">Escaneá este código con la app CleanCare</div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
        <script>
          var qr = qrcode(0, 'M');
          qr.addData('${qrValue}');
          qr.make();
          document.getElementById('qr').innerHTML = qr.createSvgTag(8);
          setTimeout(function() { window.print(); }, 500);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={styles.navLinks}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtnActive}>Máquinas</button>
          <button onClick={() => { localStorage.removeItem('cleancare_token'); localStorage.removeItem('cleancare_usuario'); navigate('/'); }} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Gestión de Máquinas</h2>

        {/* Formulario crear */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Agregar nueva máquina</h3>
          {formError && <div style={styles.error}>{formError}</div>}
          <form onSubmit={handleCrear} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre</label>
              <input style={styles.input} placeholder="Ej: Lavarropas Piso 3" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tipo</label>
              <select style={styles.input} value={tipo} onChange={(e) => setTipo(e.target.value as 'lavarropas' | 'secadora')}>
                <option value="lavarropas">Lavarropas</option>
                <option value="secadora">Secadora</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>IP Local</label>
              <input style={styles.input} placeholder="Ej: 192.168.1.45" value={ipLocal} onChange={(e) => setIpLocal(e.target.value)} />
            </div>
            <button type="submit" style={{ ...styles.btnPrimary, opacity: creando ? 0.6 : 1 }} disabled={creando}>
              {creando ? 'Creando...' : 'Crear máquina'}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Máquinas activas — {edificioId}</h3>
          {error && <div style={styles.error}>{error}</div>}
          {loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : maquinas.length === 0 ? (
            <p style={styles.muted}>No hay máquinas registradas.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>IP</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>QR</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((m) => (
                  <tr key={m._id}>
                    <td style={styles.td}>{m.nombre}</td>
                    <td style={styles.tdCode}>{m.maquina_id}</td>
                    <td style={styles.td}>
                      <span style={m.tipo === 'secadora' ? styles.badgeSecadora : styles.badgeLavarropas}>
                        {m.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}
                      </span>
                    </td>
                    <td style={styles.td}>{m.ip_local}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button style={styles.btnSmall} onClick={() => setQrMaquina(m)}>Ver QR</button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button style={styles.btnPrint} onClick={() => handlePrint(m)}>Imprimir</button>
                      <button style={styles.btnDelete} onClick={() => handleEliminar(m.maquina_id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal QR */}
      {qrMaquina && (
        <div style={styles.modalOverlay} onClick={() => setQrMaquina(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{qrMaquina.nombre}</h3>
            <p style={styles.modalCode}>{qrMaquina.maquina_id}</p>
            <p style={styles.modalTipo}>{qrMaquina.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'} — IP: {qrMaquina.ip_local}</p>
            <div ref={qrRef} style={styles.qrContainer}>
              <QRCode value={buildQRValue(qrMaquina)} size={220} level="M" />
            </div>
            <p style={styles.qrHint}>Escaneá este QR con la app CleanCare</p>
            <div style={styles.modalActions}>
              <button style={styles.btnPrimary} onClick={() => handlePrint(qrMaquina)}>Imprimir QR</button>
              <button style={styles.btnOutline} onClick={() => setQrMaquina(null)}>Cerrar</button>
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
    padding: '16px 32px', backgroundColor: colors.white, borderBottom: `1px solid ${colors.border}`,
  },
  logo: { fontSize: 22, fontWeight: 700, color: colors.primary },
  navLinks: { display: 'flex', gap: 8 },
  navBtn: {
    padding: '8px 16px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  navBtnActive: {
    padding: '8px 16px', borderRadius: 999, border: 'none',
    backgroundColor: colors.primary, color: colors.white, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 24 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 },
  form: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, alignItems: 'flex-end' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, flex: '1 1 180px' },
  label: { fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 4 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
  },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnOutline: {
    padding: '10px 24px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSmall: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: colors.bgBlueLight,
    color: colors.primary, fontSize: 13, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnPrint: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#F0FDF4',
    color: '#16A34A', fontSize: 13, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', marginRight: 8,
  },
  btnDelete: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#FEF2F2',
    color: colors.error, fontSize: 13, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '10px 12px', fontSize: 13, fontWeight: 600,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
  },
  td: {
    padding: '12px', fontSize: 14, color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
  },
  tdCode: {
    padding: '12px', fontSize: 14, fontWeight: 600, color: colors.primary,
    borderBottom: `1px solid ${colors.border}`, fontFamily: 'monospace',
  },
  badgeLavarropas: {
    display: 'inline-block', backgroundColor: colors.bgBlueLight, color: colors.primary,
    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
  },
  badgeSecadora: {
    display: 'inline-block', backgroundColor: '#FEF3C7', color: '#D97706',
    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
  },
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '10px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 16,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },

  // Modal
  modalOverlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 40,
    maxWidth: 400, width: '90%', textAlign: 'center' as const,
  },
  modalTitle: { fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 },
  modalCode: { fontSize: 18, fontWeight: 600, color: colors.primary, fontFamily: 'monospace', marginBottom: 4 },
  modalTipo: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  qrContainer: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  qrHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'center' },
};
