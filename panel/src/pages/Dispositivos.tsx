import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarDispositivos, crearDispositivo, eliminarDispositivo,
  listarEdificios, listarMaquinas, eliminarMaquina,
  Dispositivo, Edificio, Maquina,
} from '../services/api';
import { colors } from '../constants/colors';
import AdminNav from '../components/AdminNav';

export default function Dispositivos() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal crear dispositivo + máquinas (multi-step)
  const [showCrear, setShowCrear] = useState(false);
  const [step, setStep] = useState<'config' | 'tipos'>('config');
  const [batchEdificio, setBatchEdificio] = useState('');
  const [batchTipoHw, setBatchTipoHw] = useState<'esp32' | 'pico'>('esp32');
  const [batchUbicacion, setBatchUbicacion] = useState('');
  const [batchCantidad, setBatchCantidad] = useState(1);
  const [batchTipos, setBatchTipos] = useState<Array<'lavarropas' | 'secadora' | null>>([]);
  const [popoverIdx, setPopoverIdx] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal resultado (firmware + maquinas asociadas)
  const [resultado, setResultado] = useState<{ dispositivo: Dispositivo; maquinas: Maquina[] } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    fetch();
    listarEdificios().then((eds) => {
      setEdificios(eds);
      if (eds[0]) setBatchEdificio(eds[0].edificio_id);
    }).catch(() => {});
  }, []);

  async function fetch() {
    setLoading(true);
    try {
      const [dispos, edis] = await Promise.all([
        listarDispositivos(),
        listarEdificios().then((eds) => Promise.all(eds.map((e) => listarMaquinas(e.edificio_id)))),
      ]);
      setLista(dispos);
      setMaquinas(edis.flat());
    } catch {}
    setLoading(false);
  }

  function abrirModalCrear() {
    setStep('config');
    setBatchEdificio(edificios[0]?.edificio_id || '');
    setBatchTipoHw('esp32');
    setBatchUbicacion('');
    setBatchCantidad(1);
    setBatchTipos([]);
    setPopoverIdx(null);
    setFormError('');
    setShowCrear(true);
  }

  function irAPasoTipos() {
    setFormError('');
    if (!batchEdificio) { setFormError('Seleccioná un edificio'); return; }
    if (batchCantidad < 1 || batchCantidad > 8) { setFormError('Cantidad entre 1 y 8'); return; }
    setBatchTipos(Array(batchCantidad).fill(null));
    setStep('tipos');
  }

  function elegirTipo(idx: number, t: 'lavarropas' | 'secadora') {
    setBatchTipos((prev) => {
      const next = [...prev];
      next[idx] = t;
      return next;
    });
    setPopoverIdx(null);
  }

  async function confirmarCrear() {
    setFormError('');
    if (batchTipos.some((t) => t === null)) {
      setFormError('Elegí el tipo de cada máquina');
      return;
    }
    setCreando(true);
    try {
      const res = await crearDispositivo({
        tipo_hw: batchTipoHw,
        edificio_id: batchEdificio,
        ubicacion: batchUbicacion || edificios.find((e) => e.edificio_id === batchEdificio)?.nombre || batchEdificio,
        maquinas: batchTipos.map((t) => ({ tipo: t as 'lavarropas' | 'secadora' })),
      });
      setResultado(res);
      setShowCrear(false);
      await fetch();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error al crear dispositivo');
    }
    setCreando(false);
  }

  async function handleEliminarDispo(d: Dispositivo) {
    if (!confirm(`¿Dar de baja dispositivo #${d.esp32_id} y sus ${d.maquinas?.length || 0} máquinas?`)) return;
    try {
      await eliminarDispositivo(d._id);
      for (const mid of d.maquinas || []) {
        await eliminarMaquina(mid).catch(() => {});
      }
      await fetch();
    } catch { alert('Error al eliminar'); }
  }

  async function handleEliminarMaquina(m: Maquina) {
    if (!confirm(`¿Eliminar máquina ${m.nombre}?`)) return;
    try {
      await eliminarMaquina(m.maquina_id);
      await fetch();
    } catch { alert('Error al eliminar máquina'); }
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  function firmwareCode(d: Dispositivo): string {
    return `// --- firmware/ble_test/src/main.cpp ---
#define ESP32_ID          "${d.esp32_id}"
#define SERVICE_UUID      "${d.service_uuid}"
#define CONTROL_CHAR_UUID "${d.control_uuid}"
#define STATUS_CHAR_UUID  "${d.status_uuid}"

// --- app/src/constants/ble.ts ---
export const ESP32_ID     = '${d.esp32_id}';
export const SERVICE_UUID = '${d.service_uuid}';
export const CONTROL_UUID = '${d.control_uuid}';
export const STATUS_UUID  = '${d.status_uuid}';`;
  }

  function copiarFirmware(d: Dispositivo) {
    navigator.clipboard.writeText(firmwareCode(d));
    alert(`Código del dispositivo #${d.esp32_id} copiado`);
  }

  return (
    <div style={styles.page}>
      <AdminNav active="/dispositivos" />

      <main style={styles.main}>
        {/* Subtabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${colors.border}` }}>
          <button style={{ padding: '10px 20px', border: 'none', borderBottom: `3px solid ${colors.primary}`, backgroundColor: 'transparent', color: colors.primary, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Dispositivos
          </button>
          <button onClick={() => navigate('/tips')} style={{ padding: '10px 20px', border: 'none', borderBottom: '3px solid transparent', backgroundColor: 'transparent', color: colors.textSecondary, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            Tips
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ ...styles.pageTitle, marginBottom: 4 }}>Dispositivos y máquinas</h2>
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: 0 }}>
              Cada micro (ESP32/Pico) controla una o más máquinas. Al crearlo se generan las UUIDs BLE del firmware y los IDs de las máquinas.
            </p>
          </div>
          <button onClick={abrirModalCrear} style={styles.btnPrimary}>+ Nuevo dispositivo</button>
        </div>

        {loading ? <p style={styles.muted}>Cargando...</p>
          : lista.length === 0 ? (
            <div style={styles.card}><p style={styles.muted}>Sin dispositivos. Creá el primero con el botón de arriba.</p></div>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {lista.map((d) => {
                const sus = maquinas.filter((m) => d.maquinas?.includes(m.maquina_id) || m.dispositivo_id === d.esp32_id);
                return (
                  <div key={d._id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 18, color: colors.textPrimary }}>#{d.esp32_id}</strong>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#3B82F6', fontWeight: 600 }}>{d.tipo_hw.toUpperCase()}</span>
                          {d.ubicacion && <span style={{ fontSize: 13, color: colors.textSecondary }}>📍 {d.ubicacion}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {d.service_uuid}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => copiarFirmware(d)} style={styles.btnSecondary}>📋 Copiar código</button>
                        <button onClick={() => setResultado({ dispositivo: d, maquinas: sus })} style={styles.btnSecondary}>Ver detalles</button>
                        <button onClick={() => handleEliminarDispo(d)} style={styles.btnDelete}>Eliminar</button>
                      </div>
                    </div>

                    {sus.length === 0 ? (
                      <p style={{ ...styles.muted, fontSize: 12 }}>Sin máquinas asociadas</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
                        {sus.map((m) => (
                          <div key={m._id} style={styles.maquinaBox}>
                            <div style={{ fontSize: 20 }}>{m.tipo === 'secadora' ? '🌀' : '🧺'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
                              <div style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace' }}>{m.maquina_id}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleEliminarMaquina(m)} style={{ ...styles.iconBtn, color: colors.error }} title="Eliminar">×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </main>

      {/* Modal Crear */}
      {showCrear && (
        <div style={styles.overlay} onClick={() => !creando && setShowCrear(false)}>
          <div style={{ ...styles.modal, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            {step === 'config' && (
              <>
                <h3 style={styles.modalTitle}>Nuevo dispositivo</h3>
                <p style={styles.modalSubtitle}>Configuración del micro</p>
                {formError && <div style={styles.error}>{formError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 16 }}>
                  <div>
                    <label style={styles.label}>Tipo de hardware</label>
                    <select style={styles.input} value={batchTipoHw} onChange={(e) => setBatchTipoHw(e.target.value as any)}>
                      <option value="esp32">ESP32</option>
                      <option value="pico">Raspberry Pico</option>
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Edificio</label>
                    <select style={styles.input} value={batchEdificio} onChange={(e) => setBatchEdificio(e.target.value)}>
                      <option value="">Seleccioná edificio</option>
                      {edificios.map((ed) => (
                        <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre} ({ed.edificio_id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Ubicación (opcional)</label>
                    <input style={styles.input} placeholder="Ej: Piso 1 — Lavandería" value={batchUbicacion} onChange={(e) => setBatchUbicacion(e.target.value)} />
                  </div>
                  <div>
                    <label style={styles.label}>¿Cuántas máquinas controla? (1–8)</label>
                    <input type="number" min={1} max={8} style={styles.input} value={batchCantidad}
                      onChange={(e) => setBatchCantidad(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))} />
                  </div>
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.btnOutline} onClick={() => setShowCrear(false)}>Cancelar</button>
                  <button style={styles.btnPrimary} onClick={irAPasoTipos}>Siguiente</button>
                </div>
              </>
            )}
            {step === 'tipos' && (
              <>
                <h3 style={styles.modalTitle}>Tipo de cada máquina</h3>
                <p style={styles.modalSubtitle}>Tocá cada ícono y elegí lavarropas o secadora</p>
                {formError && <div style={styles.error}>{formError}</div>}
                <div style={styles.iconGrid}>
                  {batchTipos.map((t, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setPopoverIdx(popoverIdx === idx ? null : idx)}
                        style={{
                          ...styles.bigIconBtn,
                          backgroundColor: t === 'secadora' ? '#FEF3C7' : t === 'lavarropas' ? colors.bgBlueLight : colors.bgPage,
                          borderColor: popoverIdx === idx ? colors.primary : colors.border,
                        }}
                      >
                        <span style={{ fontSize: 32 }}>{t === 'secadora' ? '🌀' : t === 'lavarropas' ? '🧺' : '❓'}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }}>Máquina #{idx + 1}</span>
                        <span style={{ fontSize: 11, color: t === 'secadora' ? '#D97706' : t === 'lavarropas' ? colors.primary : colors.textSecondary }}>
                          {t === 'secadora' ? 'Secadora' : t === 'lavarropas' ? 'Lavarropas' : 'Elegir'}
                        </span>
                      </button>
                      {popoverIdx === idx && (
                        <div style={styles.popover}>
                          <button style={styles.popoverBtn} onClick={() => elegirTipo(idx, 'lavarropas')}>🧺 Lavarropas</button>
                          <button style={styles.popoverBtn} onClick={() => elegirTipo(idx, 'secadora')}>🌀 Secadora</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
                  <button type="button" style={styles.btnSmall} onClick={() => setBatchTipos(batchTipos.map(() => 'lavarropas'))}>Todas lavarropas</button>
                  <button type="button" style={styles.btnSmall} onClick={() => setBatchTipos(batchTipos.map(() => 'secadora'))}>Todas secadora</button>
                </div>
                <div style={styles.modalActions}>
                  <button style={styles.btnOutline} onClick={() => setStep('config')} disabled={creando}>Atrás</button>
                  <button style={{ ...styles.btnPrimary, opacity: creando ? 0.6 : 1 }} onClick={confirmarCrear} disabled={creando}>
                    {creando ? 'Generando...' : 'Generar dispositivo y máquinas'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Resultado (firmware + maquinas asociadas) */}
      {resultado && (
        <div style={styles.overlay} onClick={() => setResultado(null)}>
          <div style={{ ...styles.modal, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Dispositivo #{resultado.dispositivo.esp32_id}</h3>
            <p style={styles.modalSubtitle}>UUIDs generadas y máquinas asociadas</p>

            <div style={{ textAlign: 'left', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Código para el firmware y la app</div>
              <pre style={styles.codeBlock}>{firmwareCode(resultado.dispositivo)}</pre>
              <button onClick={() => copiarFirmware(resultado.dispositivo)} style={styles.btnSecondary}>📋 Copiar al portapapeles</button>
            </div>

            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Máquinas asociadas ({resultado.maquinas.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                {resultado.maquinas.map((m) => (
                  <div key={m.maquina_id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, textAlign: 'center', backgroundColor: colors.white }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{m.tipo === 'secadora' ? '🌀' : '🧺'}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary, marginBottom: 2 }}>{m.nombre}</div>
                    <div style={{ fontSize: 10, color: colors.textSecondary, fontFamily: 'monospace' }}>{m.maquina_id}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.btnPrimary} onClick={() => setResultado(null)}>Listo</button>
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
    flexWrap: 'wrap', gap: 12,
  },
  navBtn: {
    padding: '8px 16px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 20,
    border: `1px solid ${colors.border}`,
  },
  label: { fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 4, display: 'block' },
  input: {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
    width: '100%', boxSizing: 'border-box',
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
  btnSecondary: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#EFF6FF',
    color: '#3B82F6', fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDelete: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#FEF2F2',
    color: colors.error, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSmall: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: colors.bgBlueLight,
    color: colors.primary, fontSize: 13, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  iconBtn: {
    width: 32, height: 32, padding: 0, borderRadius: 6, border: 'none',
    backgroundColor: colors.bgPage, fontSize: 14, cursor: 'pointer',
    color: colors.textSecondary,
  },
  maquinaBox: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    borderRadius: 8, backgroundColor: colors.bgPage, border: `1px solid ${colors.border}`,
  },
  codeBlock: {
    backgroundColor: '#1E293B', color: '#E2E8F0', padding: 16, borderRadius: 8,
    fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', marginBottom: 12,
    whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: 20,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 28,
    width: '100%', maxHeight: '90vh', overflowY: 'auto' as const,
    textAlign: 'center' as const,
  },
  modalTitle: { fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' as const, marginTop: 16 },
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '10px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 12,
  },
  iconGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 12, marginBottom: 12,
  },
  bigIconBtn: {
    width: '100%', display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: 6, padding: '14px 8px', borderRadius: 12, border: `2px solid ${colors.border}`,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  },
  popover: {
    position: 'absolute' as const, top: '100%', left: '50%', transform: 'translateX(-50%)',
    marginTop: 6, backgroundColor: colors.white, border: `1px solid ${colors.border}`,
    borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 10,
    minWidth: 150, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
  },
  popoverBtn: {
    padding: '10px 14px', border: 'none', backgroundColor: colors.white,
    color: colors.textPrimary, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left' as const,
  },
};
