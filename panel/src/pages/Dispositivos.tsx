import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarDispositivos, crearDispositivo, eliminarDispositivo, listarEdificios, Dispositivo, Edificio } from '../services/api';
import { colors } from '../constants/colors';

export default function Dispositivos() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [edificioId, setEdificioId] = useState('');
  const [maquinaAsignada, setMaquinaAsignada] = useState('');
  const [tipoHw, setTipoHw] = useState<'esp32' | 'pico'>('esp32');
  const [ultimoCreado, setUltimoCreado] = useState<Dispositivo | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    fetch();
    listarEdificios().then(setEdificios).catch(() => {});
  }, []);

  async function fetch() {
    setLoading(true);
    try {
      const d = await listarDispositivos();
      setLista(d);
    } catch {}
    setLoading(false);
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!edificioId) { alert('Seleccioná un edificio'); return; }
    setCreando(true);
    try {
      const edi = edificios.find((x) => x.edificio_id === edificioId);
      const nuevo = await crearDispositivo({
        tipo_hw: tipoHw,
        edificio_id: edificioId,
        ubicacion: edi ? edi.nombre : edificioId,
        maquina_asignada: maquinaAsignada.trim() || null,
      });
      setUltimoCreado(nuevo);
      setEdificioId('');
      setMaquinaAsignada('');
      await fetch();
    } catch {
      alert('Error al crear dispositivo');
    }
    setCreando(false);
  }

  async function handleEliminar(d: Dispositivo) {
    if (!confirm(`¿Dar de baja ESP32 #${d.esp32_id}?`)) return;
    try {
      await eliminarDispositivo(d._id);
      await fetch();
    } catch { alert('Error al eliminar'); }
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  const copiarFirmware = (d: Dispositivo) => {
    const texto =
`// Copiar al firmware/ble_test/src/main.cpp
#define ESP32_ID            "${d.esp32_id}"
#define SERVICE_UUID        "${d.service_uuid}"
#define CONTROL_CHAR_UUID   "${d.control_uuid}"
#define STATUS_CHAR_UUID    "${d.status_uuid}"

// Copiar a app/src/constants/ble.ts
export const ESP32_ID     = '${d.esp32_id}';
export const SERVICE_UUID = '${d.service_uuid}';
export const CONTROL_UUID = '${d.control_uuid}';
export const STATUS_UUID  = '${d.status_uuid}';`;
    navigator.clipboard.writeText(texto);
    alert(`Código de ESP32 #${d.esp32_id} copiado al portapapeles`);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtn}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/tips')} style={styles.navBtn}>Tips</button>
          <button onClick={() => navigate('/dispositivos')} style={{ ...styles.navBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Dispositivos</button>
          <button onClick={() => navigate('/liquidacion')} style={styles.navBtn}>Liquidación</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Dispositivos (ESP32 / Pico)</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 24 }}>
          Cada placa tiene UUIDs únicas generadas acá. Copiá el código al firmware antes de flashear.
        </p>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Crear nuevo dispositivo</h3>
          <form onSubmit={handleCrear} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={styles.label}>Tipo de hardware</label>
              <select style={styles.input} value={tipoHw} onChange={(e) => setTipoHw(e.target.value as any)}>
                <option value="esp32">ESP32</option>
                <option value="pico">Raspberry Pico</option>
              </select>
            </div>
            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={styles.label}>Edificio</label>
              <select style={styles.input} value={edificioId} onChange={(e) => setEdificioId(e.target.value)} required>
                <option value="">Seleccioná edificio</option>
                {edificios.map((ed) => (
                  <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre} ({ed.edificio_id})</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={styles.label}>Máquina asignada</label>
              <input style={styles.input} placeholder="LAV-XXXXXX (opcional)" value={maquinaAsignada} onChange={(e) => setMaquinaAsignada(e.target.value)} />
            </div>
            <button type="submit" disabled={creando} style={{ ...styles.btnPrimary, opacity: creando ? 0.5 : 1 }}>
              {creando ? 'Creando...' : 'Crear con UUIDs nuevas'}
            </button>
          </form>
        </div>

        {ultimoCreado && (
          <div style={{ ...styles.card, backgroundColor: '#F0FDF4', borderColor: '#16A34A' }}>
            <h3 style={{ ...styles.cardTitle, color: '#16A34A' }}>✅ ESP32 #{ultimoCreado.esp32_id} creado — copiá el código</h3>
            <pre style={styles.codeBlock}>{`#define ESP32_ID            "${ultimoCreado.esp32_id}"
#define SERVICE_UUID        "${ultimoCreado.service_uuid}"
#define CONTROL_CHAR_UUID   "${ultimoCreado.control_uuid}"
#define STATUS_CHAR_UUID    "${ultimoCreado.status_uuid}"`}</pre>
            <button onClick={() => copiarFirmware(ultimoCreado)} style={styles.btnPrimary}>📋 Copiar al portapapeles</button>
          </div>
        )}

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Dispositivos registrados ({lista.length})</h3>
          {loading ? <p style={styles.muted}>Cargando...</p>
            : lista.length === 0 ? <p style={styles.muted}>Sin dispositivos. Creá el primero arriba.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lista.map((d) => (
                  <div key={d._id} style={styles.row}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 16, color: colors.textPrimary }}>#{d.esp32_id}</strong>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: '#DBEAFE', color: '#3B82F6', fontWeight: 600 }}>
                          {d.tipo_hw.toUpperCase()}
                        </span>
                        {d.maquina_asignada && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: '#F0FDF4', color: '#16A34A', fontWeight: 600 }}>
                            {d.maquina_asignada}
                          </span>
                        )}
                      </div>
                      {d.ubicacion && <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>📍 {d.ubicacion}</div>}
                      <div style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {d.service_uuid}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => copiarFirmware(d)} style={styles.btnSecondary}>📋 Copiar</button>
                      <button onClick={() => handleEliminar(d)} style={styles.btnDelete}>Eliminar</button>
                    </div>
                  </div>
                ))}
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
    flexWrap: 'wrap', gap: 12,
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
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '16px',
    borderRadius: 8, backgroundColor: colors.bgPage, flexWrap: 'wrap',
  },
  codeBlock: {
    backgroundColor: '#1E293B', color: '#E2E8F0', padding: 16, borderRadius: 8,
    fontSize: 12, fontFamily: 'monospace', overflowX: 'auto', marginBottom: 12,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
};
