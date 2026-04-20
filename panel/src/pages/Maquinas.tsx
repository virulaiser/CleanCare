import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarMaquinas, crearMaquina, eliminarMaquina, crearEdificio, listarEdificios, Maquina, Edificio, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export default function Maquinas() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const defaultEdificioId = usuario?.edificio_id || '';

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edificioId, setEdificioId] = useState(defaultEdificioId);

  // Batch creation modal
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [batchStep, setBatchStep] = useState<'config' | 'tipos'>('config');
  const [batchEdificio, setBatchEdificio] = useState(defaultEdificioId);
  const [batchCantidad, setBatchCantidad] = useState(1);
  const [batchTipos, setBatchTipos] = useState<Array<'lavarropas' | 'secadora' | null>>([]);
  const [popoverIdx, setPopoverIdx] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState('');

  // ID modal — muestra el maquina_id para vincular manualmente al firmware
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
  function getNextName(tipoMaq: 'lavarropas' | 'secadora', ediId: string, offset: number): string {
    const prefix = tipoMaq === 'secadora' ? 'SEC' : 'LAV';
    const existing = maquinas.filter(m => m.tipo === tipoMaq && m.edificio_id === ediId);
    return `${ediId}_${prefix}_${existing.length + offset}`;
  }

  function abrirModalCrear() {
    setBatchStep('config');
    setBatchEdificio(defaultEdificioId || (edificios[0]?.edificio_id ?? ''));
    setBatchCantidad(1);
    setBatchTipos([]);
    setPopoverIdx(null);
    setFormError('');
    setShowCrearModal(true);
  }

  function irAPasoTipos() {
    setFormError('');
    if (!batchEdificio) { setFormError('Seleccioná un edificio'); return; }
    if (batchCantidad < 1 || batchCantidad > 30) { setFormError('Cantidad entre 1 y 30'); return; }
    setBatchTipos(Array(batchCantidad).fill(null));
    setBatchStep('tipos');
  }

  function elegirTipo(idx: number, t: 'lavarropas' | 'secadora') {
    setBatchTipos((prev) => {
      const next = [...prev];
      next[idx] = t;
      return next;
    });
    setPopoverIdx(null);
  }

  async function confirmarCrearBatch() {
    setFormError('');
    if (batchTipos.some((t) => t === null)) {
      setFormError('Elegí un tipo para cada máquina');
      return;
    }
    setCreando(true);
    try {
      let lavCount = 0, secCount = 0;
      for (const t of batchTipos) {
        const offset = t === 'secadora' ? secCount++ : lavCount++;
        const nombre = getNextName(t!, batchEdificio, offset);
        await crearMaquina({ nombre, tipo: t!, edificio_id: batchEdificio });
      }
      setShowCrearModal(false);
      await fetchMaquinas();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error al crear máquinas');
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

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        <nav style={styles.navLinks}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtnActive}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/dispositivos')} style={styles.navBtn}>Dispositivos</button>
          <button onClick={() => navigate('/liquidacion')} style={styles.navBtn}>Liquidación</button>
          <button onClick={() => { localStorage.removeItem('cleancare_token'); localStorage.removeItem('cleancare_usuario'); navigate('/'); }} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Gestión de Máquinas</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={abrirModalCrear} style={styles.btnPrimary}>+ Agregar máquinas</button>
            <button onClick={() => setShowEdificioModal(true)} style={styles.btnOutline}>+ Agregar edificio</button>
          </div>
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
                      <button style={styles.btnSmall} onClick={() => setIdMaquina(m)}>Ver ID</button>
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

      {/* Modal Crear Máquinas (batch) */}
      {showCrearModal && (
        <div style={styles.modalOverlay} onClick={() => !creando && setShowCrearModal(false)}>
          <div style={{ ...styles.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            {batchStep === 'config' && (
              <>
                <h3 style={styles.modalTitle}>Agregar máquinas</h3>
                <p style={styles.modalTipo}>Elegí edificio y cantidad</p>
                {formError && <div style={styles.error}>{formError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 20 }}>
                  <div>
                    <label style={styles.label}>Edificio</label>
                    <select style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={batchEdificio} onChange={(e) => setBatchEdificio(e.target.value)}>
                      <option value="">Seleccioná edificio</option>
                      {edificios.map((ed) => (
                        <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre} ({ed.edificio_id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Cantidad de máquinas</label>
                    <input type="number" min={1} max={30} style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }} value={batchCantidad} onChange={(e) => setBatchCantidad(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} />
                  </div>
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.btnPrimary} onClick={irAPasoTipos}>Siguiente</button>
                  <button style={styles.btnOutline} onClick={() => setShowCrearModal(false)}>Cancelar</button>
                </div>
              </>
            )}
            {batchStep === 'tipos' && (
              <>
                <h3 style={styles.modalTitle}>Elegí el tipo de cada máquina</h3>
                <p style={styles.modalTipo}>Tocá cada ícono para seleccionar lavarropas o secadora</p>
                {formError && <div style={styles.error}>{formError}</div>}
                <div style={styles.iconGrid}>
                  {batchTipos.map((t, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setPopoverIdx(popoverIdx === idx ? null : idx)}
                        style={{
                          ...styles.iconBtn,
                          backgroundColor: t === 'secadora' ? '#FEF3C7' : t === 'lavarropas' ? colors.bgBlueLight : colors.bgPage,
                          borderColor: popoverIdx === idx ? colors.primary : colors.border,
                        }}
                      >
                        <span style={{ fontSize: 28 }}>{t === 'secadora' ? '🌀' : t === 'lavarropas' ? '🧺' : '❓'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }}>#{idx + 1}</span>
                        <span style={{ fontSize: 11, color: t === 'secadora' ? '#D97706' : t === 'lavarropas' ? colors.primary : colors.textSecondary }}>
                          {t === 'secadora' ? 'Secadora' : t === 'lavarropas' ? 'Lavarropas' : 'Elegir'}
                        </span>
                      </button>
                      {popoverIdx === idx && (
                        <div style={styles.popover}>
                          <button style={styles.popoverBtn} onClick={() => elegirTipo(idx, 'lavarropas')}>
                            <span style={{ fontSize: 20 }}>🧺</span> Lavarropas
                          </button>
                          <button style={styles.popoverBtn} onClick={() => elegirTipo(idx, 'secadora')}>
                            <span style={{ fontSize: 20 }}>🌀</span> Secadora
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <button type="button" style={styles.btnSmall} onClick={() => setBatchTipos(batchTipos.map(() => 'lavarropas'))}>Todas lavarropas</button>
                  <button type="button" style={styles.btnSmall} onClick={() => setBatchTipos(batchTipos.map(() => 'secadora'))}>Todas secadora</button>
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.btnOutline} onClick={() => setBatchStep('config')} disabled={creando}>Atrás</button>
                  <button style={{ ...styles.btnPrimary, opacity: creando ? 0.6 : 1 }} onClick={confirmarCrearBatch} disabled={creando}>
                    {creando ? 'Creando...' : `Crear ${batchCantidad} máquina${batchCantidad !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
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
  modalActions: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const },
  iconGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: 12, marginBottom: 20,
  },
  iconBtn: {
    width: '100%', display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: 4, padding: '12px 8px', borderRadius: 12, border: `2px solid ${colors.border}`,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  },
  popover: {
    position: 'absolute' as const, top: '100%', left: '50%', transform: 'translateX(-50%)',
    marginTop: 6, backgroundColor: colors.white, border: `1px solid ${colors.border}`,
    borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 10,
    minWidth: 150, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
  },
  popoverBtn: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
    border: 'none', backgroundColor: colors.white, color: colors.textPrimary,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    textAlign: 'left' as const,
  },
};
