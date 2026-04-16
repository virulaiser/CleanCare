import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { obtenerResumen, listarMaquinas, listarEdificios, ResumenItem, Maquina, Edificio, Usuario } from '../services/api';
import { colors } from '../constants/colors';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

interface Tarifas {
  precio_agua_m3: number;
  litros_lavado: number;
  litros_secado: number;
  precio_kwh: number;
  kwh_lavado: number;
  kwh_secado: number;
  otros_gastos: number;
  otros_gastos_desc: string;
}

const TARIFAS_DEFAULT: Tarifas = {
  precio_agua_m3: 45,
  litros_lavado: 55,
  litros_secado: 0,
  precio_kwh: 8.5,
  kwh_lavado: 1.2,
  kwh_secado: 3,
  otros_gastos: 0,
  otros_gastos_desc: 'Mantenimiento',
};

function tarifasKey(edificioId: string) {
  return `cleancare_tarifas_${edificioId}`;
}

function cargarTarifas(edificioId: string): Tarifas {
  try {
    const raw = localStorage.getItem(tarifasKey(edificioId));
    if (raw) return { ...TARIFAS_DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return TARIFAS_DEFAULT;
}

function guardarTarifas(edificioId: string, t: Tarifas) {
  localStorage.setItem(tarifasKey(edificioId), JSON.stringify(t));
}

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Liquidacion() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const now = new Date();

  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [edificioId, setEdificioId] = useState(usuario?.edificio_id || '');
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenItem[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    listarEdificios().then((eds) => {
      setEdificios(eds);
      if (!edificioId && eds[0]) setEdificioId(eds[0].edificio_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (edificioId) {
      setTarifas(cargarTarifas(edificioId));
      fetchData();
    }
  }, [edificioId, mes, anio]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [resumenData, maquinasData] = await Promise.all([
        obtenerResumen(edificioId, mes, anio),
        listarMaquinas(edificioId),
      ]);
      setResumen(resumenData);
      setMaquinas(maquinasData);
    } catch {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  const calculo = useMemo(() => {
    const tipoPorMaquina: Record<string, string> = {};
    maquinas.forEach((m) => { tipoPorMaquina[m.maquina_id] = m.tipo; });

    let usosLav = 0, minLav = 0, usosSec = 0, minSec = 0;
    resumen.forEach((r) => {
      const tipo = tipoPorMaquina[r._id];
      if (tipo === 'secadora') { usosSec += r.total_usos; minSec += r.minutos_totales; }
      else { usosLav += r.total_usos; minLav += r.minutos_totales; }
    });

    const litrosTotal = usosLav * tarifas.litros_lavado + usosSec * tarifas.litros_secado;
    const m3Total = litrosTotal / 1000;
    const costoAgua = m3Total * tarifas.precio_agua_m3;

    const kwhTotal = usosLav * tarifas.kwh_lavado + usosSec * tarifas.kwh_secado;
    const costoElectricidad = kwhTotal * tarifas.precio_kwh;

    const costoOtros = Number(tarifas.otros_gastos) || 0;
    const totalGeneral = costoAgua + costoElectricidad + costoOtros;

    return {
      usosLav, minLav, usosSec, minSec,
      litrosTotal, m3Total, costoAgua,
      kwhTotal, costoElectricidad,
      costoOtros, totalGeneral,
    };
  }, [resumen, maquinas, tarifas]);

  function actualizarTarifa<K extends keyof Tarifas>(k: K, v: Tarifas[K]) {
    setTarifas((prev) => {
      const next = { ...prev, [k]: v };
      guardarTarifas(edificioId, next);
      return next;
    });
    setSavedMsg('✓ Guardado');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  function exportarExcel() {
    const edi = edificios.find((e) => e.edificio_id === edificioId);
    const rows = [
      ['Liquidación CleanCare'],
      ['Edificio', edi?.nombre || edificioId],
      ['Periodo', `${meses[mes - 1]} ${anio}`],
      [],
      ['Consumo'],
      ['Lavados', calculo.usosLav, 'usos'],
      ['Secados', calculo.usosSec, 'usos'],
      [],
      ['Agua'],
      ['Litros por lavado', tarifas.litros_lavado],
      ['Litros por secado', tarifas.litros_secado],
      ['Total litros', Math.round(calculo.litrosTotal)],
      ['Total m³', calculo.m3Total.toFixed(3)],
      ['Precio m³', tarifas.precio_agua_m3],
      ['Costo agua', `$ ${calculo.costoAgua.toFixed(2)}`],
      [],
      ['Electricidad'],
      ['kWh por lavado', tarifas.kwh_lavado],
      ['kWh por secado', tarifas.kwh_secado],
      ['Total kWh', calculo.kwhTotal.toFixed(2)],
      ['Precio kWh', tarifas.precio_kwh],
      ['Costo electricidad', `$ ${calculo.costoElectricidad.toFixed(2)}`],
      [],
      ['Otros'],
      [tarifas.otros_gastos_desc, `$ ${calculo.costoOtros.toFixed(2)}`],
      [],
      ['TOTAL', `$ ${calculo.totalGeneral.toFixed(2)}`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidación');
    XLSX.writeFile(wb, `liquidacion_${edificioId}_${meses[mes - 1]}_${anio}.xlsx`);
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={styles.navLinks}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtn}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/tips')} style={styles.navBtn}>Tips</button>
          <button onClick={() => navigate('/dispositivos')} style={styles.navBtn}>Dispositivos</button>
          <button onClick={() => navigate('/liquidacion')} style={styles.navBtnActive}>Liquidación</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Liquidación mensual</h2>
          <button style={styles.btnOutline} onClick={exportarExcel} disabled={loading || !edificioId}>📄 Exportar Excel</button>
        </div>

        <div style={styles.card}>
          <div style={styles.filtros}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Edificio</label>
              <select style={styles.input} value={edificioId} onChange={(e) => setEdificioId(e.target.value)}>
                <option value="">Seleccioná edificio</option>
                {edificios.map((ed) => (
                  <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mes</label>
              <select style={styles.input} value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
                {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Año</label>
              <input type="number" style={styles.input} value={anio} onChange={(e) => setAnio(parseInt(e.target.value) || now.getFullYear())} />
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.kpiGrid}>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>Lavados</span>
            <span style={styles.kpiValue}>{calculo.usosLav}</span>
            <span style={styles.kpiSub}>{calculo.minLav} min</span>
          </div>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>Secados</span>
            <span style={styles.kpiValue}>{calculo.usosSec}</span>
            <span style={styles.kpiSub}>{calculo.minSec} min</span>
          </div>
          <div style={styles.kpi}>
            <span style={styles.kpiLabel}>Total usos</span>
            <span style={styles.kpiValue}>{calculo.usosLav + calculo.usosSec}</span>
            <span style={styles.kpiSub}>{meses[mes - 1]} {anio}</span>
          </div>
        </div>

        {/* Tarifas */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={styles.cardTitle}>💧 Agua</h3>
            {savedMsg && <span style={{ fontSize: 12, color: colors.success }}>{savedMsg}</span>}
          </div>
          <div style={styles.tarifaGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Precio por m³ ($)</label>
              <input type="number" step="0.01" style={styles.input} value={tarifas.precio_agua_m3}
                onChange={(e) => actualizarTarifa('precio_agua_m3', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Litros por lavado</label>
              <input type="number" style={styles.input} value={tarifas.litros_lavado}
                onChange={(e) => actualizarTarifa('litros_lavado', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Litros por secado</label>
              <input type="number" style={styles.input} value={tarifas.litros_secado}
                onChange={(e) => actualizarTarifa('litros_secado', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div style={styles.resumenRow}>
            <span>Total consumo: <strong>{Math.round(calculo.litrosTotal).toLocaleString()} L</strong> ({calculo.m3Total.toFixed(2)} m³)</span>
            <span style={styles.costoPill}>$ {calculo.costoAgua.toFixed(2)}</span>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚡ Electricidad</h3>
          <div style={styles.tarifaGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Precio por kWh ($)</label>
              <input type="number" step="0.01" style={styles.input} value={tarifas.precio_kwh}
                onChange={(e) => actualizarTarifa('precio_kwh', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>kWh por lavado</label>
              <input type="number" step="0.1" style={styles.input} value={tarifas.kwh_lavado}
                onChange={(e) => actualizarTarifa('kwh_lavado', parseFloat(e.target.value) || 0)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>kWh por secado</label>
              <input type="number" step="0.1" style={styles.input} value={tarifas.kwh_secado}
                onChange={(e) => actualizarTarifa('kwh_secado', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div style={styles.resumenRow}>
            <span>Total consumo: <strong>{calculo.kwhTotal.toFixed(1)} kWh</strong></span>
            <span style={styles.costoPill}>$ {calculo.costoElectricidad.toFixed(2)}</span>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🛠 Otros gastos</h3>
          <div style={styles.tarifaGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Concepto</label>
              <input type="text" style={styles.input} value={tarifas.otros_gastos_desc}
                onChange={(e) => actualizarTarifa('otros_gastos_desc', e.target.value)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Monto ($)</label>
              <input type="number" step="0.01" style={styles.input} value={tarifas.otros_gastos}
                onChange={(e) => actualizarTarifa('otros_gastos', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        <div style={{ ...styles.card, backgroundColor: colors.primary, color: colors.white }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Total a liquidar</div>
              <div style={{ fontSize: 36, fontWeight: 700 }}>$ {calculo.totalGeneral.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, textAlign: 'right' }}>
              Agua: $ {calculo.costoAgua.toFixed(2)}<br />
              Electricidad: $ {calculo.costoElectricidad.toFixed(2)}<br />
              Otros: $ {calculo.costoOtros.toFixed(2)}
            </div>
          </div>
        </div>

        {loading && <p style={styles.muted}>Cargando...</p>}
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
  navLinks: { display: 'flex', gap: 8, flexWrap: 'wrap' },
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
  filtros: { display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  formGroup: { display: 'flex', flexDirection: 'column' as const, flex: '1 1 180px' },
  label: { fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 4 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
  },
  btnOutline: {
    padding: '10px 24px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  kpi: {
    backgroundColor: colors.white, borderRadius: 12, padding: 20,
    border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' as const, gap: 4,
  },
  kpiLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: 500 },
  kpiValue: { fontSize: 28, fontWeight: 700, color: colors.textPrimary },
  kpiSub: { fontSize: 12, color: colors.textSecondary },
  tarifaGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  resumenRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', backgroundColor: colors.bgPage, borderRadius: 8,
    fontSize: 14, color: colors.textPrimary, flexWrap: 'wrap' as const, gap: 8,
  },
  costoPill: {
    padding: '6px 14px', backgroundColor: colors.bgBlueLight, color: colors.primary,
    fontSize: 14, fontWeight: 700, borderRadius: 999,
  },
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '10px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 16,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
};
