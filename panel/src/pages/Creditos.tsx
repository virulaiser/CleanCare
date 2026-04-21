import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportExcelTable } from '../utils/excel';
import { printTable } from '../utils/print';
import AdminNav from '../components/AdminNav';
import {
  obtenerConfigEdificio, actualizarConfigEdificio,
  listarUsuariosEdificio, agregarCreditos, agregarCreditosMasivo,
  obtenerResumenCreditos, obtenerBilleteraUsuario, listarEdificios,
  ResumenCreditoItem, ConfigEdificio, Transaccion, Edificio, Usuario,
} from '../services/api';
import { colors } from '../constants/colors';
import NumericInput from '../components/NumericInput';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export default function Creditos() {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const edificioId = usuario?.edificio_id || 'edificio-central';
  const now = new Date();

  // Config — arrancan en 0 para no mostrar defaults falsos antes de cargar
  const [config, setConfig] = useState<ConfigEdificio | null>(null);
  const [creditosMensuales, setCreditosMensuales] = useState(0);
  const [costoLavado, setCostoLavado] = useState(0);
  const [costoSecado, setCostoSecado] = useState(0);
  const [duracionLavado, setDuracionLavado] = useState(0);
  const [duracionSecado, setDuracionSecado] = useState(0);
  const [maxCompraFichas, setMaxCompraFichas] = useState(0);
  const [precioFichaResidente, setPrecioFichaResidente] = useState(0);
  const [comisionCleancare, setComisionCleancare] = useState(0);
  const [litrosLavado, setLitrosLavado] = useState(0);
  const [litrosSecado, setLitrosSecado] = useState(0);
  const [kwhLavado, setKwhLavado] = useState(0);
  const [kwhSecado, setKwhSecado] = useState(0);
  const [facturacionDia, setFacturacionDia] = useState(31);
  const [emailAdminEdi, setEmailAdminEdi] = useState('');
  const [whatsappAdminEdi, setWhatsappAdminEdi] = useState('');
  const [canalPreferido, setCanalPreferido] = useState<'email' | 'whatsapp' | 'ninguno'>('ninguno');
  const [configMsg, setConfigMsg] = useState('');

  // Modal apto (lista usuarios del mismo apartamento)
  const [aptoModal, setAptoModal] = useState<{ apartamento: string; edificio_id: string } | null>(null);

  // Modal estado de cuenta
  const [cuentaUsuario, setCuentaUsuario] = useState<{ usuario_id: string; nombre: string; apartamento: string } | null>(null);
  const [cuentaSaldo, setCuentaSaldo] = useState(0);
  const [cuentaTx, setCuentaTx] = useState<Transaccion[]>([]);
  const [cuentaLoading, setCuentaLoading] = useState(false);

  // Usuarios
  const [usuarios, setUsuarios] = useState<{ usuario_id: string; nombre: string; apartamento: string; email: string; edificio_id: string; saldo: number }[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEdificio, setFiltroEdificio] = useState('');
  const [edificios, setEdificios] = useState<Edificio[]>([]);

  // Modal agregar créditos
  const [modalUsuario, setModalUsuario] = useState<string | null>(null);
  const [modalCantidad, setModalCantidad] = useState('');
  const [modalDesc, setModalDesc] = useState('');

  // Masivo
  const [masivoCantidad, setMasivoCantidad] = useState('');
  const [masivoDesc, setMasivoDesc] = useState('');
  const [masivoMsg, setMasivoMsg] = useState('');

  // Resumen
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [resumen, setResumen] = useState<ResumenCreditoItem[]>([]);
  const [totalConsumo, setTotalConsumo] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
  }, [navigate]);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchResumen(); }, [mes, anio]);

  async function fetchAll() {
    setLoading(true);
    setError('');
    try {
      const [configData, usuariosData, edificiosData] = await Promise.all([
        obtenerConfigEdificio(edificioId),
        listarUsuariosEdificio(),
        listarEdificios(),
      ]);
      setEdificios(edificiosData);
      setConfig(configData);
      setCreditosMensuales(configData.creditos_mensuales);
      setCostoLavado(configData.costo_lavado);
      setCostoSecado(configData.costo_secado);
      setDuracionLavado(configData.duracion_lavado ?? 0);
      setDuracionSecado(configData.duracion_secado ?? 0);
      setMaxCompraFichas(configData.max_compra_fichas ?? 10);
      setPrecioFichaResidente(configData.precio_ficha_residente ?? 120);
      setComisionCleancare(configData.comision_cleancare ?? 33);
      setLitrosLavado(configData.litros_por_lavado ?? 60);
      setLitrosSecado(configData.litros_por_secado ?? 0);
      setKwhLavado(configData.kwh_por_lavado ?? 1.2);
      setKwhSecado(configData.kwh_por_secado ?? 2.5);
      setFacturacionDia(configData.facturacion_dia ?? 31);
      setEmailAdminEdi(configData.email_admin_edificio ?? '');
      setWhatsappAdminEdi(configData.whatsapp_admin_edificio ?? '');
      setCanalPreferido(configData.canal_preferido ?? 'ninguno');
      setUsuarios(usuariosData);
      await fetchResumen();
    } catch {
      setError('Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchResumen() {
    try {
      const data = await obtenerResumenCreditos(edificioId, mes, anio);
      setResumen(data.resumen);
      setTotalConsumo(data.total_creditos_consumidos);
    } catch { /* ignore */ }
  }

  async function guardarConfig() {
    setConfigMsg('');
    try {
      const updated = await actualizarConfigEdificio({
        edificio_id: edificioId,
        creditos_mensuales: creditosMensuales,
        costo_lavado: costoLavado,
        costo_secado: costoSecado,
        duracion_lavado: duracionLavado,
        duracion_secado: duracionSecado,
        max_compra_fichas: maxCompraFichas,
        precio_ficha_residente: precioFichaResidente,
        comision_cleancare: comisionCleancare,
        litros_por_lavado: litrosLavado,
        litros_por_secado: litrosSecado,
        kwh_por_lavado: kwhLavado,
        kwh_por_secado: kwhSecado,
        facturacion_dia: facturacionDia,
        email_admin_edificio: emailAdminEdi,
        whatsapp_admin_edificio: whatsappAdminEdi,
        canal_preferido: canalPreferido,
      });
      setConfig(updated);
      setConfigMsg('Configuración guardada');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch {
      setConfigMsg('Error al guardar');
    }
  }

  async function handleAgregarCreditos() {
    if (!modalUsuario || !modalCantidad) return;
    try {
      await agregarCreditos(modalUsuario, Number(modalCantidad), modalDesc || 'Ajuste manual');
      setModalUsuario(null);
      setModalCantidad('');
      setModalDesc('');
      // Refresh
      const usuariosData = await listarUsuariosEdificio();
      setUsuarios(usuariosData);
    } catch {
      alert('Error al agregar créditos');
    }
  }

  async function handleMasivo() {
    if (!masivoCantidad) return;
    setMasivoMsg('');
    try {
      const result = await agregarCreditosMasivo(edificioId, Number(masivoCantidad), masivoDesc || 'Créditos masivos');
      setMasivoMsg(`Se asignaron ${masivoCantidad} créditos a ${result.total_usuarios} usuarios`);
      setMasivoCantidad('');
      setMasivoDesc('');
      const usuariosData = await listarUsuariosEdificio();
      setUsuarios(usuariosData);
      setTimeout(() => setMasivoMsg(''), 4000);
    } catch {
      setMasivoMsg('Error al asignar créditos');
    }
  }

  function exportarExcel() {
    if (resumen.length === 0) return;
    const totalAsignados   = resumen.reduce((s, r) => s + r.creditos_asignados, 0);
    const totalDevoluciones = resumen.reduce((s, r) => s + r.devoluciones, 0);
    const totalSaldo       = resumen.reduce((s, r) => s + r.saldo_actual, 0);

    exportExcelTable({
      filename: `creditos_${edificioId}_${meses[mes - 1]}_${anio}.xlsx`,
      sheetName: 'Créditos',
      title: 'Resumen de consumo de créditos',
      subtitle: `Edificio ${edificioId} · ${meses[mes - 1]} ${anio}`,
      columns: [
        { key: 'nombre',      label: 'Usuario',           width: 28 },
        { key: 'apartamento', label: 'Apartamento',       width: 14, align: 'center' },
        { key: 'usados',      label: 'Créditos usados',   width: 16, align: 'right', numFmt: '#,##0' },
        { key: 'asignados',   label: 'Créditos asignados', width: 18, align: 'right', numFmt: '#,##0' },
        { key: 'devoluciones', label: 'Devoluciones',     width: 14, align: 'right', numFmt: '#,##0' },
        { key: 'saldo',       label: 'Saldo actual',      width: 14, align: 'right', numFmt: '#,##0' },
      ],
      rows: resumen.map((r) => ({
        nombre: r.nombre,
        apartamento: r.apartamento,
        usados: r.creditos_usados,
        asignados: r.creditos_asignados,
        devoluciones: r.devoluciones,
        saldo: r.saldo_actual,
      })),
      totals: {
        nombre: 'TOTAL',
        apartamento: '',
        usados: totalConsumo,
        asignados: totalAsignados,
        devoluciones: totalDevoluciones,
        saldo: totalSaldo,
      },
    });
  }

  function imprimirResumen() {
    if (resumen.length === 0) return;
    const totalAsignados   = resumen.reduce((s, r) => s + r.creditos_asignados, 0);
    const totalDevoluciones = resumen.reduce((s, r) => s + r.devoluciones, 0);
    const totalSaldo       = resumen.reduce((s, r) => s + r.saldo_actual, 0);
    const ediNombre = edificios.find((e) => e.edificio_id === edificioId)?.nombre || edificioId;

    printTable({
      documentTitle: `creditos_${edificioId}_${meses[mes - 1]}_${anio}`,
      title: 'Resumen de consumo de créditos',
      subtitle: `${ediNombre} · ${meses[mes - 1]} ${anio}`,
      columns: [
        { key: 'nombre',       label: 'Usuario' },
        { key: 'apartamento',  label: 'Apto',          align: 'center' },
        { key: 'usados',       label: 'Usados',        align: 'right' },
        { key: 'asignados',    label: 'Asignados',     align: 'right' },
        { key: 'devoluciones', label: 'Devoluciones',  align: 'right' },
        { key: 'saldo',        label: 'Saldo actual',  align: 'right' },
      ],
      rows: resumen.map((r) => ({
        nombre: r.nombre,
        apartamento: r.apartamento,
        usados: r.creditos_usados,
        asignados: r.creditos_asignados,
        devoluciones: r.devoluciones,
        saldo: r.saldo_actual,
      })),
      totals: {
        nombre: 'TOTAL',
        apartamento: '',
        usados: totalConsumo,
        asignados: totalAsignados,
        devoluciones: totalDevoluciones,
        saldo: totalSaldo,
      },
    });
  }

  function imprimirUsuarios() {
    const q = busqueda.toLowerCase();
    const filtered = usuarios.filter((u) => {
      if (filtroEdificio && u.edificio_id !== filtroEdificio) return false;
      if (q && !u.nombre.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.apartamento || '').toLowerCase().includes(q) && !String(u.saldo).includes(q)) return false;
      return true;
    });
    if (filtered.length === 0) return;

    const totalSaldo = filtered.reduce((s, u) => s + u.saldo, 0);
    const ediNombre = filtroEdificio
      ? (edificios.find((e) => e.edificio_id === filtroEdificio)?.nombre || filtroEdificio)
      : 'Todos los edificios';

    printTable({
      documentTitle: `usuarios_saldos_${filtroEdificio || 'todos'}`,
      title: 'Usuarios y saldos',
      subtitle: `${ediNombre}${busqueda ? ` · Filtro: "${busqueda}"` : ''} · ${filtered.length} usuario${filtered.length !== 1 ? 's' : ''}`,
      columns: [
        { key: 'nombre',      label: 'Usuario' },
        { key: 'email',       label: 'Email' },
        { key: 'apartamento', label: 'Apto',     align: 'center' },
        { key: 'edificio',    label: 'Edificio' },
        { key: 'saldo',       label: 'Saldo',    align: 'right' },
      ],
      rows: filtered.map((u) => ({
        nombre: u.nombre,
        email: u.email,
        apartamento: u.apartamento || '-',
        edificio: edificios.find((e) => e.edificio_id === u.edificio_id)?.nombre || u.edificio_id,
        saldo: u.saldo,
      })),
      totals: {
        nombre: 'TOTAL',
        email: '',
        apartamento: '',
        edificio: '',
        saldo: totalSaldo,
      },
    });
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  return (
    <div style={styles.page}>
      <AdminNav active="/creditos" />

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Gestión de créditos</h2>

        {error && <div style={styles.error}>{error}</div>}

        {/* Config edificio */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Configuración del edificio</h3>
          {!config ? (
            <p style={{ color: colors.textSecondary, fontSize: 14 }}>Cargando configuración…</p>
          ) : (
            <>
              <div style={styles.configRow}>
                <label style={styles.configLabel}>
                  Créditos mensuales por apto
                  <NumericInput min={0} value={creditosMensuales} onChange={setCreditosMensuales} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Costo por lavado
                  <NumericInput min={1} value={costoLavado} onChange={setCostoLavado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Costo por secado
                  <NumericInput min={1} value={costoSecado} onChange={setCostoSecado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Duración lavado (min)
                  <NumericInput min={1} value={duracionLavado} onChange={setDuracionLavado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Duración secado (min)
                  <NumericInput min={1} value={duracionSecado} onChange={setDuracionSecado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Máx. fichas por compra
                  <NumericInput min={1} value={maxCompraFichas} onChange={setMaxCompraFichas} style={styles.input} />
                </label>
              </div>

              <h4 style={styles.sectionTitle}>Tarifas</h4>
              <div style={styles.configRow}>
                <label style={styles.configLabel}>
                  Precio ficha al residente ($)
                  <NumericInput min={0} value={precioFichaResidente} onChange={setPrecioFichaResidente} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Comisión a CleanCare por ficha vendida ($)
                  <NumericInput min={0} value={comisionCleancare} onChange={setComisionCleancare} style={styles.input} />
                </label>
              </div>

              <h4 style={styles.sectionTitle}>Consumo por ciclo</h4>
              <div style={styles.configRow}>
                <label style={styles.configLabel}>
                  Litros por lavado
                  <NumericInput min={0} value={litrosLavado} onChange={setLitrosLavado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Litros por secado
                  <NumericInput min={0} value={litrosSecado} onChange={setLitrosSecado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  kWh por lavado
                  <NumericInput min={0} value={kwhLavado} onChange={setKwhLavado} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  kWh por secado
                  <NumericInput min={0} value={kwhSecado} onChange={setKwhSecado} style={styles.input} />
                </label>
              </div>

              <h4 style={styles.sectionTitle}>Facturación y canales</h4>
              <div style={styles.configRow}>
                <label style={styles.configLabel}>
                  Día de facturación (1-31, 31 = último del mes)
                  <NumericInput min={1} value={facturacionDia} onChange={setFacturacionDia} style={styles.input} />
                </label>
                <label style={styles.configLabel}>
                  Canal preferido
                  <select value={canalPreferido} onChange={(e) => setCanalPreferido(e.target.value as 'email' | 'whatsapp' | 'ninguno')} style={styles.input}>
                    <option value="ninguno">Ninguno (solo guardar)</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
                <label style={styles.configLabel}>
                  Email admin del edificio
                  <input value={emailAdminEdi} onChange={(e) => setEmailAdminEdi(e.target.value)} style={styles.input} placeholder="admin@edificio.com" />
                </label>
                <label style={styles.configLabel}>
                  WhatsApp admin del edificio
                  <input value={whatsappAdminEdi} onChange={(e) => setWhatsappAdminEdi(e.target.value)} style={styles.input} placeholder="+598 99 123 456" />
                </label>
              </div>

              <div style={{ marginTop: 16 }}>
                <button onClick={guardarConfig} style={styles.saveBtn}>Guardar</button>
              </div>
              {configMsg && <p style={{ fontSize: 13, color: configMsg.includes('Error') ? colors.error : colors.success, marginTop: 8 }}>{configMsg}</p>}
            </>
          )}
        </div>

        {/* Usuarios + saldos */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>Usuarios y saldos</h3>
            <button
              onClick={imprimirUsuarios}
              disabled={usuarios.length === 0}
              style={{ ...styles.printBtn, opacity: usuarios.length === 0 ? 0.5 : 1 }}
            >
              Imprimir PDF
            </button>
          </div>

          {/* Buscador y filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, email o apto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ ...styles.input, flex: '1 1 250px' }}
            />
            <select
              value={filtroEdificio}
              onChange={(e) => setFiltroEdificio(e.target.value)}
              style={{ ...styles.input, minWidth: 160 }}
            >
              <option value="">Todos los edificios</option>
              {edificios.map((ed) => (
                <option key={ed.edificio_id} value={ed.edificio_id}>{ed.nombre}</option>
              ))}
            </select>
          </div>

          {/* Masivo */}
          <div style={styles.masivoRow}>
            <input type="text" inputMode="decimal" placeholder="Cantidad" value={masivoCantidad}
              onChange={(e) => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setMasivoCantidad(v); }}
              onFocus={(e) => e.target.select()} style={{ ...styles.input, width: 100 }} />
            <input type="text" placeholder="Descripción (opcional)" value={masivoDesc} onChange={(e) => setMasivoDesc(e.target.value)} style={{ ...styles.input, flex: 1 }} />
            <button onClick={handleMasivo} disabled={!masivoCantidad} style={{ ...styles.saveBtn, opacity: masivoCantidad ? 1 : 0.5 }}>Agregar a todos</button>
          </div>
          {masivoMsg && <p style={{ fontSize: 13, color: masivoMsg.includes('Error') ? colors.error : colors.success, marginBottom: 12 }}>{masivoMsg}</p>}

          {(() => {
            const q = busqueda.toLowerCase();
            const filtered = usuarios.filter((u) => {
              if (filtroEdificio && u.edificio_id !== filtroEdificio) return false;
              if (q && !u.nombre.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.apartamento || '').toLowerCase().includes(q) && !String(u.saldo).includes(q)) return false;
              return true;
            });
            return loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : filtered.length === 0 ? (
            <p style={styles.muted}>No hay usuarios que coincidan con el filtro.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Apto</th>
                  <th style={styles.th}>Edificio</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Saldo</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.usuario_id}>
                    <td style={styles.td}>
                      <button
                        onClick={() => u.apartamento && setAptoModal({ apartamento: u.apartamento, edificio_id: u.edificio_id })}
                        disabled={!u.apartamento}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
                          backgroundColor: colors.bgPage, fontWeight: 700, fontSize: 14,
                          color: colors.textPrimary, cursor: u.apartamento ? 'pointer' : 'default',
                          fontFamily: 'inherit',
                        }}
                        title="Ver usuarios del apto"
                      >
                        {u.apartamento || '-'}
                      </button>
                    </td>
                    <td style={{ ...styles.td, fontSize: 12, fontFamily: 'monospace' }}>{u.edificio_id}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: u.saldo <= 0 ? colors.error : colors.textPrimary }}>
                      {u.saldo}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModalUsuario(u.usuario_id)} style={styles.addBtn}>+ Créditos</button>
                      {' '}
                      <button onClick={async () => {
                        setCuentaUsuario({ usuario_id: u.usuario_id, nombre: u.nombre, apartamento: u.apartamento });
                        setCuentaLoading(true);
                        try {
                          const data = await obtenerBilleteraUsuario(u.usuario_id);
                          setCuentaSaldo(data.saldo);
                          setCuentaTx(data.transacciones);
                        } catch { setCuentaTx([]); setCuentaSaldo(0); }
                        setCuentaLoading(false);
                      }} style={{ ...styles.addBtn, borderColor: colors.success, color: colors.success }}>Ver cuenta</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
          })()}
        </div>

        {/* Resumen mensual de consumo */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>Resumen de consumo — {meses[mes - 1]} {anio}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={styles.select}>
                {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
              <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={styles.select}>
                {[2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={exportarExcel} disabled={resumen.length === 0} style={{ ...styles.exportBtn, opacity: resumen.length === 0 ? 0.5 : 1 }}>Exportar Excel</button>
              <button onClick={imprimirResumen} disabled={resumen.length === 0} style={{ ...styles.printBtn, opacity: resumen.length === 0 ? 0.5 : 1 }}>Imprimir PDF</button>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={styles.kpiMini}>
              <span style={{ fontSize: 12, color: colors.textSecondary }}>Total consumido</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: colors.textPrimary }}>{totalConsumo}</span>
            </div>
          </div>

          {resumen.length === 0 ? (
            <p style={styles.muted}>No hay consumo registrado en este período.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Apto</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Usados</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Asignados</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Devoluciones</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Saldo actual</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => {
                  const u = usuarios.find((x) => x.usuario_id === r.usuario_id);
                  const edificio_id = u?.edificio_id || edificioId;
                  return (
                  <tr key={r.usuario_id}>
                    <td style={styles.td}>
                      <button
                        onClick={() => r.apartamento && r.apartamento !== '-' && setAptoModal({ apartamento: r.apartamento, edificio_id })}
                        disabled={!r.apartamento || r.apartamento === '-'}
                        style={{
                          padding: '6px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
                          backgroundColor: colors.bgPage, fontWeight: 700, fontSize: 14,
                          color: colors.textPrimary, cursor: r.apartamento && r.apartamento !== '-' ? 'pointer' : 'default',
                          fontFamily: 'inherit',
                        }}
                      >
                        {r.apartamento}
                      </button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{r.creditos_usados}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{r.creditos_asignados}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{r.devoluciones}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: r.saldo_actual <= 0 ? colors.error : colors.textPrimary }}>{r.saldo_actual}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal Apto — lista usuarios del mismo apartamento */}
      {aptoModal && (() => {
        const usuariosDelApto = usuarios.filter((x) => x.apartamento === aptoModal.apartamento && x.edificio_id === aptoModal.edificio_id);
        const ediNombre = edificios.find((e) => e.edificio_id === aptoModal.edificio_id)?.nombre || aptoModal.edificio_id;
        return (
          <div style={styles.overlay} onClick={() => setAptoModal(null)}>
            <div style={{ ...styles.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: colors.textPrimary }}>
                Apto {aptoModal.apartamento}
              </h3>
              <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>
                {ediNombre} — {usuariosDelApto.length} usuario{usuariosDelApto.length !== 1 ? 's' : ''}
              </p>

              {usuariosDelApto.length === 0 ? (
                <p style={styles.muted}>Sin usuarios registrados en este apto.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {usuariosDelApto.map((user) => (
                    <div key={user.usuario_id} style={{
                      padding: 12, borderRadius: 10, backgroundColor: colors.bgPage,
                      border: `1px solid ${colors.border}`, textAlign: 'left',
                    }}>
                      <div style={{ fontWeight: 600, color: colors.textPrimary, fontSize: 14 }}>{user.nombre}</div>
                      <div style={{ fontSize: 12, color: colors.textSecondary, wordBreak: 'break-all', marginTop: 2 }}>{user.email}</div>
                      <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>Saldo: <strong style={{ color: user.saldo <= 0 ? colors.error : colors.success }}>{user.saldo}</strong></div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setAptoModal(null)} style={styles.saveBtn}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal agregar créditos a usuario */}
      {modalUsuario && (
        <div style={styles.overlay} onClick={() => setModalUsuario(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: colors.textPrimary }}>Agregar créditos</h3>
            <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>
              Usuario: <strong>{usuarios.find(u => u.usuario_id === modalUsuario)?.nombre}</strong>
            </p>
            <label style={styles.configLabel}>
              Cantidad
              <input type="text" inputMode="decimal" value={modalCantidad}
                onChange={(e) => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setModalCantidad(v); }}
                onFocus={(e) => e.target.select()} style={styles.input} placeholder="Ej: 10" autoFocus />
            </label>
            <label style={{ ...styles.configLabel, marginTop: 12 }}>
              Descripción (opcional)
              <input type="text" value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} style={styles.input} placeholder="Ej: Bonificación" />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalUsuario(null)} style={styles.navBtn}>Cancelar</button>
              <button onClick={handleAgregarCreditos} disabled={!modalCantidad} style={{ ...styles.saveBtn, opacity: modalCantidad ? 1 : 0.5 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Estado de Cuenta */}
      {cuentaUsuario && (
        <div style={styles.overlay} onClick={() => setCuentaUsuario(null)}>
          <div style={{ ...styles.modal, maxWidth: 560, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary, margin: 0 }}>Estado de cuenta</h3>
                <p style={{ fontSize: 14, color: colors.textSecondary, margin: '4px 0 0' }}>{cuentaUsuario.nombre} — Apto {cuentaUsuario.apartamento || '-'}</p>
              </div>
              <span style={{ fontSize: 28, fontWeight: 700, color: cuentaSaldo <= 0 ? colors.error : colors.primary }}>{cuentaSaldo} fichas</span>
            </div>

            {cuentaLoading ? (
              <p style={styles.muted}>Cargando...</p>
            ) : cuentaTx.length === 0 ? (
              <p style={styles.muted}>Sin movimientos registrados.</p>
            ) : (
              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Tipo</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Cantidad</th>
                      <th style={styles.th}>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentaTx.map((tx) => {
                      const tipoStyles: Record<string, { bg: string; color: string; label: string }> = {
                        asignacion_mensual: { bg: '#DCFCE7', color: '#16A34A', label: 'Asignación' },
                        ajuste_admin: { bg: '#DBEAFE', color: '#3B82F6', label: 'Ajuste' },
                        uso_maquina: { bg: '#FEF2F2', color: '#EF4444', label: 'Uso' },
                        devolucion: { bg: '#FEF3C7', color: '#D97706', label: 'Devolución' },
                      };
                      const st = tipoStyles[tx.tipo] || tipoStyles.ajuste_admin;
                      return (
                        <tr key={tx._id}>
                          <td style={{ ...styles.td, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {new Date(tx.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={styles.td}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: tx.cantidad >= 0 ? '#16A34A' : '#EF4444' }}>
                            {tx.cantidad >= 0 ? '+' : ''}{tx.cantidad}
                          </td>
                          <td style={{ ...styles.td, fontSize: 12, color: colors.textSecondary }}>{tx.descripcion}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setCuentaUsuario(null)} style={styles.navBtn}>Cerrar</button>
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
    borderBottom: `1px solid ${colors.border}`,
  },
  logo: { fontSize: 22, fontWeight: 700, color: colors.primary },
  navBtn: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 960, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, marginBottom: 24 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: colors.textPrimary, marginTop: 20, marginBottom: 12 },
  configRow: { display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' as const },
  configLabel: { display: 'flex', flexDirection: 'column' as const, fontSize: 13, color: colors.textSecondary, gap: 4 },
  input: {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white,
  },
  saveBtn: {
    padding: '8px 20px', borderRadius: 999, border: 'none',
    backgroundColor: colors.primary, color: colors.white, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  addBtn: {
    padding: '4px 12px', borderRadius: 999, border: `1px solid ${colors.primary}`,
    backgroundColor: 'transparent', color: colors.primary, fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  masivoRow: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const },
  select: {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white, cursor: 'pointer',
  },
  exportBtn: {
    padding: '8px 20px', borderRadius: 999, border: 'none',
    backgroundColor: colors.success, color: colors.white, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  printBtn: {
    padding: '8px 20px', borderRadius: 999, border: 'none',
    backgroundColor: '#DC2626', color: colors.white, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  kpiMini: {
    backgroundColor: colors.bgPage, borderRadius: 8, padding: '12px 20px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
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
  error: {
    backgroundColor: '#FEF2F2', color: colors.error, padding: '12px 16px',
    borderRadius: 8, fontSize: 14, marginBottom: 20,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
};
