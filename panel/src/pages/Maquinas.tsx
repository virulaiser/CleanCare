import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { listarMaquinas, crearMaquina, eliminarMaquina, crearEdificio, listarEdificios, Maquina, Edificio, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

function buildQRValue(m: Maquina): string {
  return `cleancare://maquina?id=${m.maquina_id}&edificio=${m.edificio_id}`;
}

export default function Maquinas() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const defaultEdificioId = usuario?.edificio_id || '';

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edificioId, setEdificioId] = useState(defaultEdificioId);

  // Form state
  const [formEdificio, setFormEdificio] = useState(defaultEdificioId);
  const [tipo, setTipo] = useState<'lavarropas' | 'secadora' | 'ambos'>('lavarropas');
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState('');

  // QR modal (includes print)
  const [qrMaquina, setQrMaquina] = useState<Maquina | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // ID modal
  const [idMaquina, setIdMaquina] = useState<Maquina | null>(null);

  // Edificio modal
  const [showEdificioModal, setShowEdificioModal] = useState(false);
  const [ediNombre, setEdiNombre] = useState('');
  const [ediDireccion, setEdiDireccion] = useState('');
  const [ediAdminNombre, setEdiAdminNombre] = useState('');
  const [ediAdminTel, setEdiAdminTel] = useState('');
  const [ediCreando, setEdiCreando] = useState(false);
  const [ediMsg, setEdiMsg] = useState('');
  const [edificios, setEdificios] = useState<Edificio[]>([]);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    listarEdificios().then(setEdificios).catch(() => {});
  }, []);

  useEffect(() => {
    if (edificioId) fetchMaquinas();
  }, [edificioId]);

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

  // Generate auto-name: edificio_TIPO_N (next number)
  function getNextName(tipoMaq: 'lavarropas' | 'secadora', ediId: string): string {
    const prefix = tipoMaq === 'secadora' ? 'SEC' : 'LAV';
    const existing = maquinas.filter(m => m.tipo === tipoMaq && m.edificio_id === ediId);
    return `${ediId}_${prefix}_${existing.length}`;
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formEdificio) { setFormError('Seleccioná un edificio'); return; }
    setCreando(true);
    try {
      if (tipo === 'ambos') {
        const nameLav = getNextName('lavarropas', formEdificio);
        const nameSec = getNextName('secadora', formEdificio);
        await crearMaquina({ nombre: nameLav, tipo: 'lavarropas', edificio_id: formEdificio });
        await crearMaquina({ nombre: nameSec, tipo: 'secadora', edificio_id: formEdificio });
      } else {
        const name = getNextName(tipo, formEdificio);
        await crearMaquina({ nombre: name, tipo, edificio_id: formEdificio });
      }
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
          svg { margin: 0 auto; }
          .footer { margin-top: 24px; color: #94A3B8; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px; }
        </style>
      </head>
      <body>
        <h2>${maquina.nombre}</h2>
        <div class="tipo">${maquina.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}</div>
        <div id="qr"></div>
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
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/tips')} style={styles.navBtn}>Tips</button>
          <button onClick={() => { localStorage.removeItem('cleancare_token'); localStorage.removeItem('cleancare_usuario'); navigate('/'); }} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Gestión de Máquinas</h2>
          <button onClick={() => setShowEdificioModal(true)} style={styles.btnOutline}>+ Agregar edificio</button>
        </div>

        {/* Formulario crear */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Agregar nueva máquina</h3>
          {formError && <div style={styles.error}>{formError}</div>}
          <form onSubmit={handleCrear} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Edificio</label>
              <select style={styles.input} value={formEdificio} onChange={(e) => setFormEdificio(e.target.value)}>
                <option value="">Seleccioná edificio</option>
                {edificios.map((ed) => (
                  <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre} ({ed.edificio_id})</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tipo</label>
              <select style={styles.input} value={tipo} onChange={(e) => setTipo(e.target.value as 'lavarropas' | 'secadora' | 'ambos')}>
                <option value="lavarropas">Lavarropas</option>
                <option value="secadora">Secadora</option>
                <option value="ambos">Ambos (lavarropas + secadora)</option>
              </select>
            </div>
            <button type="submit" style={{ ...styles.btnPrimary, opacity: creando ? 0.6 : 1 }} disabled={creando}>
              {creando ? 'Creando...' : 'Crear máquina'}
            </button>
          </form>
          <p style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
            Nombre auto: {formEdificio || '???'}_{tipo === 'ambos' ? 'LAV/SEC' : (tipo === 'secadora' ? 'SEC' : 'LAV')}_N
          </p>
        </div>

        {/* Lista */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>Máquinas activas</h3>
            <select style={styles.input} value={edificioId} onChange={(e) => setEdificioId(e.target.value)}>
              {edificios.map((ed) => (
                <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre}</option>
              ))}
            </select>
          </div>
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
                  <th style={styles.th}>Tipo</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((m) => (
                  <tr key={m._id}>
                    <td style={{ ...styles.td, cursor: 'pointer' }} onClick={() => setIdMaquina(m)}>{m.nombre}</td>
                    <td style={styles.td}>
                      <span style={m.tipo === 'secadora' ? styles.badgeSecadora : styles.badgeLavarropas}>
                        {m.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button style={styles.btnSmall} onClick={() => setQrMaquina(m)}>QR</button>
                      {' '}
                      <button style={styles.btnDelete} onClick={() => handleEliminar(m.maquina_id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal QR + Imprimir */}
      {qrMaquina && (
        <div style={styles.modalOverlay} onClick={() => setQrMaquina(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{qrMaquina.nombre}</h3>
            <p style={styles.modalTipo}>{qrMaquina.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}</p>
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

      {/* Modal ID */}
      {idMaquina && (
        <div style={styles.modalOverlay} onClick={() => setIdMaquina(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{idMaquina.nombre}</h3>
            <p style={{ fontSize: 36, fontWeight: 700, color: colors.primary, fontFamily: 'monospace', margin: '16px 0' }}>{idMaquina.maquina_id}</p>
            <p style={styles.modalTipo}>{idMaquina.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'} — {idMaquina.edificio_id}</p>
            <div style={styles.modalActions}>
              <button style={styles.btnOutline} onClick={() => setIdMaquina(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Edificio */}
      {showEdificioModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEdificioModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Agregar edificio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, textAlign: 'left' }}>
              <div>
                <label style={styles.label}>Nombre del edificio *</label>
                <input style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} placeholder="Ej: Torre Norte" value={ediNombre} onChange={(e) => setEdiNombre(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={styles.label}>Dirección (opcional)</label>
                <input style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} placeholder="Ej: Av. Rivera 1234" value={ediDireccion} onChange={(e) => setEdiDireccion(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Administrador — Nombre</label>
                <input style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} placeholder="Ej: Carlos Gómez" value={ediAdminNombre} onChange={(e) => setEdiAdminNombre(e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Administrador — Teléfono</label>
                <input style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} placeholder="Ej: 099123456" value={ediAdminTel} onChange={(e) => setEdiAdminTel(e.target.value)} />
              </div>
            </div>
            {ediMsg && <p style={{ fontSize: 13, color: ediMsg.includes('Error') ? colors.error : colors.success, marginBottom: 12 }}>{ediMsg}</p>}

            {/* Lista de edificios existentes */}
            {edificios.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Edificios existentes:</p>
                {edificios.map((ed) => (
                  <div key={ed.edificio_id} style={{ padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: colors.textPrimary }}>{ed.nombre}</span>
                      <span style={{ fontFamily: 'monospace', color: colors.primary, fontSize: 12 }}>{ed.edificio_id}</span>
                    </div>
                    {(ed.admin_nombre || ed.admin_telefono) && (
                      <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Admin: {ed.admin_nombre || '—'} {ed.admin_telefono ? `/ ${ed.admin_telefono}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                style={{ ...styles.btnPrimary, opacity: ediCreando || !ediNombre ? 0.5 : 1 }}
                disabled={ediCreando || !ediNombre}
                onClick={async () => {
                  setEdiCreando(true);
                  setEdiMsg('');
                  try {
                    await crearEdificio({
                      nombre: ediNombre,
                      direccion: ediDireccion || undefined,
                      admin_nombre: ediAdminNombre || undefined,
                      admin_telefono: ediAdminTel || undefined,
                    });
                    setEdiNombre('');
                    setEdiDireccion('');
                    setEdiAdminNombre('');
                    setEdiAdminTel('');
                    const updated = await listarEdificios();
                    setEdificios(updated);
                    setShowEdificioModal(false);
                  } catch {
                    setEdiMsg('Error al crear edificio');
                  } finally {
                    setEdiCreando(false);
                  }
                }}
              >
                {ediCreando ? 'Creando...' : 'Crear edificio'}
              </button>
              <button style={styles.btnOutline} onClick={() => { setShowEdificioModal(false); setEdiMsg(''); }}>Cerrar</button>
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
