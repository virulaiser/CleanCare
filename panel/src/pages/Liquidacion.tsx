import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { obtenerResumen, listarMaquinas, listarEdificios, listarUsos, ResumenItem, Maquina, Edificio, Uso, Usuario } from '../services/api';
import { colors } from '../constants/colors';
import NumericInput from '../components/NumericInput';

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

interface Tarifas {
  // Agua — OSE
  precio_agua_m3: number;            // cargo variable agua (bloque 10-15 m³)
  precio_saneamiento_m3: number;     // 100% del cargo variable de agua
  litros_lavado: number;             // litros por ciclo de lavado
  // Electricidad — UTE
  precio_kwh: number;                // tarifa sin IVA
  iva_porcentaje: number;            // IVA sobre electricidad (22%)
  kwh_lavado: number;                // consumo por ciclo de lavado
  kwh_secado: number;                // consumo por ciclo de secado
  // Otros
  otros_gastos: number;
  otros_gastos_desc: string;
  // Ingresos
  valor_ficha_lavado: number;
  valor_ficha_secado: number;
}

// Valores oficiales — UTE Pliego Tarifario + OSE Decreto 340/025 (vigentes 01/01/2026)
// Fichas técnicas Speed Queen LWN311SP301NW22 (lavadora) + LES17AWF3022 (secador)
const TARIFAS_DEFAULT: Tarifas = {
  precio_agua_m3: 36.91,
  precio_saneamiento_m3: 36.91,
  litros_lavado: 110,
  precio_kwh: 8.452,
  iva_porcentaje: 22,
  kwh_lavado: 0.17,
  kwh_secado: 4.09,
  otros_gastos: 0,
  otros_gastos_desc: 'Mantenimiento',
  valor_ficha_lavado: 150,
  valor_ficha_secado: 100,
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
  const [usos, setUsos] = useState<Uso[]>([]);
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
      const [resumenData, maquinasData, usosData] = await Promise.all([
        obtenerResumen(edificioId, mes, anio),
        listarMaquinas(edificioId),
        listarUsos(),
      ]);
      setResumen(resumenData);
      setMaquinas(maquinasData);
      setUsos(usosData);
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

    // Fallas del edificio en el mes seleccionado
    const fallas = usos.filter((u) => {
      if (u.edificio_id !== edificioId) return false;
      if (u.estado !== 'averia') return false;
      const f = new Date(u.fecha_inicio || u.fecha);
      return f.getMonth() + 1 === mes && f.getFullYear() === anio;
    });

    const litrosTotal = usosLav * tarifas.litros_lavado;
    const m3Total = litrosTotal / 1000;
    const costoAgua = m3Total * tarifas.precio_agua_m3;
    const costoSaneamiento = m3Total * tarifas.precio_saneamiento_m3;

    const kwhTotal = usosLav * tarifas.kwh_lavado + usosSec * tarifas.kwh_secado;
    const costoElectricidadSinIva = kwhTotal * tarifas.precio_kwh;
    const ivaElectricidad = costoElectricidadSinIva * (tarifas.iva_porcentaje / 100);
    const costoElectricidad = costoElectricidadSinIva + ivaElectricidad;

    const costoOtros = Number(tarifas.otros_gastos) || 0;
    const totalGasto = costoAgua + costoSaneamiento + costoElectricidad + costoOtros;

    const ingresoLavado = usosLav * tarifas.valor_ficha_lavado;
    const ingresoSecado = usosSec * tarifas.valor_ficha_secado;
    const ingresoTotal = ingresoLavado + ingresoSecado;
    const utilidad = ingresoTotal - totalGasto;

    return {
      usosLav, minLav, usosSec, minSec,
      litrosTotal, m3Total, costoAgua, costoSaneamiento,
      kwhTotal, costoElectricidadSinIva, ivaElectricidad, costoElectricidad,
      costoOtros, totalGasto,
      ingresoLavado, ingresoSecado, ingresoTotal, utilidad,
      fallas,
    };
  }, [resumen, maquinas, tarifas, usos, edificioId, mes, anio]);

  function actualizarTarifa<K extends keyof Tarifas>(k: K, v: Tarifas[K]) {
    setTarifas((prev) => {
      const next = { ...prev, [k]: v };
      guardarTarifas(edificioId, next);
      return next;
    });
    setSavedMsg('✓ Guardado');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  function exportarPDF() {
    const edi = edificios.find((e) => e.edificio_id === edificioId);
    const edificioNombre = edi?.nombre || edificioId;
    const periodo = `${meses[mes - 1]} ${anio}`;

    // Etiqueta de tipo por máquina (Lavarropas/Secadora #N si hay varias del mismo tipo)
    const maquinasEdi = [...maquinas]
      .filter((m) => m.edificio_id === edificioId)
      .sort((a, b) => a.maquina_id.localeCompare(b.maquina_id));
    const tipoInfo: Record<string, { tipo: string; numero: number; totalMismoTipo: number }> = {};
    const counts: Record<string, number> = {};
    maquinasEdi.forEach((m) => {
      counts[m.tipo] = (counts[m.tipo] || 0) + 1;
      tipoInfo[m.maquina_id] = { tipo: m.tipo, numero: counts[m.tipo], totalMismoTipo: 0 };
    });
    Object.values(tipoInfo).forEach((i) => { i.totalMismoTipo = counts[i.tipo]; });
    const etiquetaMaquina = (id: string) => {
      const i = tipoInfo[id];
      if (!i) return id;
      const label = i.tipo === 'secadora' ? 'Secadora' : 'Lavarropas';
      return i.totalMismoTipo > 1 ? `${label} #${i.numero}` : label;
    };

    const fallasHtml = calculo.fallas.length === 0
      ? '<tr><td colspan="3" style="text-align:center;color:#94A3B8;padding:16px">Sin reportes de falla este mes</td></tr>'
      : calculo.fallas.map((f) => `
          <tr>
            <td>${new Date(f.fecha_inicio || f.fecha).toLocaleDateString('es-UY')}</td>
            <td>${etiquetaMaquina(f.maquina_id)}</td>
            <td>${f.residente_id || '—'}</td>
          </tr>
        `).join('');

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head><title>Liquidación ${edificioNombre} — ${periodo}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; color: #1E293B; padding: 32px; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3B82F6; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 700; color: #3B82F6; }
        .subtitle { color: #64748B; font-size: 13px; margin-top: 4px; }
        .meta { text-align: right; font-size: 13px; color: #64748B; }
        h1 { font-size: 22px; margin: 0 0 4px; color: #1E293B; }
        h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 24px 0 12px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .kpi { background: #F8FAFC; border: 1px solid #E5E7EB; padding: 12px; border-radius: 8px; text-align: center; }
        .kpi .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi .val { font-size: 22px; font-weight: 700; color: #1E293B; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
        th { text-align: left; padding: 8px 12px; background: #F1F5F9; color: #64748B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #E5E7EB; }
        td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
        tr:last-child td { border-bottom: none; }
        .total { background: #3B82F6; color: white; padding: 20px; border-radius: 12px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
        .total .tlabel { font-size: 13px; opacity: 0.85; }
        .total .tval { font-size: 32px; font-weight: 700; }
        .breakdown { font-size: 12px; opacity: 0.9; text-align: right; line-height: 1.6; }
        .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E5E7EB; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style></head>
      <body>
        <div class="header">
          <div>
            <div class="logo">CleanCare</div>
            <div class="subtitle">Liquidación mensual por edificio</div>
          </div>
          <div class="meta">
            Generado: ${new Date().toLocaleString('es-UY')}<br/>
            Periodo: <strong>${periodo}</strong>
          </div>
        </div>

        <h1>${edificioNombre}</h1>

        <h2>Resumen de uso</h2>
        <div class="kpis">
          <div class="kpi"><div class="label">Fichas gastadas</div><div class="val">${calculo.usosLav + calculo.usosSec}</div></div>
          <div class="kpi"><div class="label">Lavados</div><div class="val">${calculo.usosLav}</div></div>
          <div class="kpi"><div class="label">Secados</div><div class="val">${calculo.usosSec}</div></div>
          <div class="kpi"><div class="label">Reportes falla</div><div class="val">${calculo.fallas.length}</div></div>
        </div>

        <h2>Ingresos por fichas</h2>
        <table>
          <tr><th>Concepto</th><th>Cantidad</th><th>Valor unitario</th><th style="text-align:right">Ingreso</th></tr>
          <tr><td>🧺 Lavados</td><td>${calculo.usosLav} fichas</td><td>$ ${tarifas.valor_ficha_lavado.toFixed(2)}</td><td style="text-align:right"><strong>$ ${calculo.ingresoLavado.toFixed(2)}</strong></td></tr>
          <tr><td>🌀 Secados</td><td>${calculo.usosSec} fichas</td><td>$ ${tarifas.valor_ficha_secado.toFixed(2)}</td><td style="text-align:right"><strong>$ ${calculo.ingresoSecado.toFixed(2)}</strong></td></tr>
          <tr><td colspan="3" style="text-align:right"><strong>Total ingresos</strong></td><td style="text-align:right"><strong>$ ${calculo.ingresoTotal.toFixed(2)}</strong></td></tr>
        </table>

        <h2>Gastos</h2>
        <table>
          <tr><th>Recurso</th><th>Consumo</th><th>Tarifa</th><th style="text-align:right">Costo</th></tr>
          <tr><td>💧 Agua OSE</td><td>${Math.round(calculo.litrosTotal).toLocaleString()} L (${calculo.m3Total.toFixed(3)} m³)</td><td>$ ${tarifas.precio_agua_m3} / m³</td><td style="text-align:right"><strong>$ ${calculo.costoAgua.toFixed(2)}</strong></td></tr>
          <tr><td>🚰 Saneamiento</td><td>${calculo.m3Total.toFixed(3)} m³</td><td>$ ${tarifas.precio_saneamiento_m3} / m³</td><td style="text-align:right"><strong>$ ${calculo.costoSaneamiento.toFixed(2)}</strong></td></tr>
          <tr><td>⚡ Electricidad UTE</td><td>${calculo.kwhTotal.toFixed(2)} kWh</td><td>$ ${tarifas.precio_kwh} / kWh</td><td style="text-align:right"><strong>$ ${calculo.costoElectricidadSinIva.toFixed(2)}</strong></td></tr>
          <tr><td>&nbsp;&nbsp;&nbsp;IVA electricidad</td><td>—</td><td>${tarifas.iva_porcentaje}%</td><td style="text-align:right"><strong>$ ${calculo.ivaElectricidad.toFixed(2)}</strong></td></tr>
          ${calculo.costoOtros > 0 ? `<tr><td>🛠 ${tarifas.otros_gastos_desc}</td><td>—</td><td>—</td><td style="text-align:right"><strong>$ ${calculo.costoOtros.toFixed(2)}</strong></td></tr>` : ''}
          <tr><td colspan="3" style="text-align:right"><strong>Total gastos</strong></td><td style="text-align:right"><strong>$ ${calculo.totalGasto.toFixed(2)}</strong></td></tr>
        </table>

        <h2>Reportes de falla (${calculo.fallas.length})</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Máquina</th><th>Residente</th></tr></thead>
          <tbody>${fallasHtml}</tbody>
        </table>

        <div class="total" style="background:${calculo.utilidad >= 0 ? '#16A34A' : '#EF4444'}">
          <div>
            <div class="tlabel">Utilidad del periodo</div>
            <div class="tval">$ ${calculo.utilidad.toFixed(2)}</div>
          </div>
          <div class="breakdown">
            Ingresos: $ ${calculo.ingresoTotal.toFixed(2)}<br/>
            Gastos: $ ${calculo.totalGasto.toFixed(2)}<br/>
            ${calculo.utilidad >= 0 ? 'Ganancia' : 'Pérdida'}: $ ${Math.abs(calculo.utilidad).toFixed(2)}
          </div>
        </div>

        <div class="footer">
          <strong>Fuentes oficiales</strong><br/>
          UTE — Pliego Tarifario vigente desde 01/01/2026. Tarifa Residencial Simple: $8,452/kWh (tramo 101–600 kWh/mes). IVA 22% sobre energía eléctrica.<br/>
          OSE — Decreto Tarifario 340/025 vigente desde 01/01/2026. Cargo variable bloque 10–15 m³: $36,91/m³. Saneamiento = 100% del cargo variable de agua.
        </div>
        <script>setTimeout(function(){window.print();}, 400);</script>
      </body></html>
    `);
    w.document.close();
  }

  function exportarExcel() {
    const edi = edificios.find((e) => e.edificio_id === edificioId);

    const BRAND = { primary: '3B82F6', primaryDk: '1D4ED8', soft: 'EFF6FF', zebra: 'F8FAFC', border: 'E5E7EB', text: '0F172A', textSoft: '475569' };
    const borderAll = {
      top: { style: 'thin', color: { rgb: BRAND.border } },
      left: { style: 'thin', color: { rgb: BRAND.border } },
      right: { style: 'thin', color: { rgb: BRAND.border } },
      bottom: { style: 'thin', color: { rgb: BRAND.border } },
    };
    const S = {
      title:   { font: { sz: 18, bold: true, color: { rgb: BRAND.primaryDk } } },
      subtitle:{ font: { sz: 11, color: { rgb: BRAND.textSoft } } },
      section: {
        font: { sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: BRAND.primary } },
        alignment: { vertical: 'center' },
      },
      kvKey:   { font: { sz: 10, color: { rgb: BRAND.textSoft } }, border: borderAll },
      kvVal:   { font: { sz: 10, bold: true, color: { rgb: BRAND.text } }, alignment: { horizontal: 'right' }, border: borderAll },
      zebra:   { font: { sz: 10, color: { rgb: BRAND.text } }, fill: { patternType: 'solid', fgColor: { rgb: BRAND.zebra } }, border: borderAll },
      totalK:  { font: { sz: 11, bold: true, color: { rgb: BRAND.primaryDk } }, fill: { patternType: 'solid', fgColor: { rgb: BRAND.soft } }, border: borderAll },
      totalV:  { font: { sz: 12, bold: true, color: { rgb: BRAND.primaryDk } }, fill: { patternType: 'solid', fgColor: { rgb: BRAND.soft } }, alignment: { horizontal: 'right' }, border: borderAll },
      note:    { font: { sz: 9, italic: true, color: { rgb: BRAND.textSoft } } },
    };

    const ws: any = {};
    const enc = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
    let row = 0;

    // Título
    ws[enc(row, 0)] = { v: 'Liquidación CleanCare', s: S.title };
    row++;
    ws[enc(row, 0)] = { v: `${edi?.nombre || edificioId} · ${meses[mes - 1]} ${anio}`, s: S.subtitle };
    row++;
    ws[enc(row, 0)] = { v: `Generado: ${new Date().toLocaleString('es-UY')}`, s: S.note };
    row += 2;

    const section = (label: string) => {
      ws[enc(row, 0)] = { v: label, s: S.section };
      ws[enc(row, 1)] = { v: '', s: S.section };
      ws[enc(row, 2)] = { v: '', s: S.section };
      ws[enc(row, 3)] = { v: '', s: S.section };
      row++;
    };
    const kv = (k: string, v: any) => {
      ws[enc(row, 0)] = { v: k, s: S.kvKey };
      ws[enc(row, 1)] = { v, t: typeof v === 'number' ? 'n' : 's', s: S.kvVal };
      row++;
    };
    const kvMoney = (k: string, v: number) => {
      ws[enc(row, 0)] = { v: k, s: S.kvKey };
      ws[enc(row, 1)] = { v, t: 'n', s: { ...S.kvVal, numFmt: '"$" #,##0.00' } };
      row++;
    };
    const total = (k: string, v: number) => {
      ws[enc(row, 0)] = { v: k, s: S.totalK };
      ws[enc(row, 1)] = { v, t: 'n', s: { ...S.totalV, numFmt: '"$" #,##0.00' } };
      row++;
    };
    const blank = () => { row++; };

    section('Consumo');
    kv('Lavados (usos)', calculo.usosLav);
    kv('Secados (usos)', calculo.usosSec);
    blank();

    section('Agua OSE');
    kv('Litros por lavado', tarifas.litros_lavado);
    kv('Total litros', Math.round(calculo.litrosTotal));
    kv('Total m³', Number(calculo.m3Total.toFixed(3)));
    kv('Precio agua $/m³', tarifas.precio_agua_m3);
    kv('Precio saneamiento $/m³', tarifas.precio_saneamiento_m3);
    kvMoney('Costo agua', calculo.costoAgua);
    kvMoney('Costo saneamiento', calculo.costoSaneamiento);
    blank();

    section('Electricidad UTE');
    kv('kWh por lavado', tarifas.kwh_lavado);
    kv('kWh por secado', tarifas.kwh_secado);
    kv('Total kWh', Number(calculo.kwhTotal.toFixed(2)));
    kv('Precio kWh (sin IVA)', tarifas.precio_kwh);
    kvMoney('Subtotal electricidad (sin IVA)', calculo.costoElectricidadSinIva);
    kvMoney(`IVA ${tarifas.iva_porcentaje}%`, calculo.ivaElectricidad);
    kvMoney('Costo electricidad (con IVA)', calculo.costoElectricidad);
    blank();

    section('Otros gastos');
    kvMoney(tarifas.otros_gastos_desc || 'Otros', calculo.costoOtros);
    blank();

    total('TOTAL GASTOS', calculo.totalGasto);
    blank();

    section('Ingresos por fichas');
    kvMoney(`Fichas lavado (${calculo.usosLav} × $${tarifas.valor_ficha_lavado})`, calculo.ingresoLavado);
    kvMoney(`Fichas secado (${calculo.usosSec} × $${tarifas.valor_ficha_secado})`, calculo.ingresoSecado);
    total('TOTAL INGRESOS', calculo.ingresoTotal);
    blank();

    total('UTILIDAD', calculo.utilidad);
    blank();

    section('Fuentes oficiales');
    ws[enc(row, 0)] = { v: 'UTE', s: S.kvKey };
    ws[enc(row, 1)] = { v: 'Pliego 01/01/2026 — Residencial Simple $8,452/kWh + IVA 22%', s: S.kvVal };
    row++;
    ws[enc(row, 0)] = { v: 'OSE', s: S.kvKey };
    ws[enc(row, 1)] = { v: 'Decreto 340/025 01/01/2026 — bloque 10-15 m³ $36,91/m³ + saneamiento 100%', s: S.kvVal };
    row++;

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    ];
    ws['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 14 }];
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 3 } });

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
        <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        <nav style={styles.navLinks}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={styles.navBtn}>Usuarios</button>
          <button onClick={() => navigate('/dispositivos')} style={styles.navBtn}>Dispositivos</button>
          <button onClick={() => navigate('/liquidacion')} style={styles.navBtnActive}>Liquidación</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ ...styles.pageTitle, marginBottom: 0 }}>Liquidación mensual</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={styles.btnPrimary} onClick={exportarPDF} disabled={loading || !edificioId}>📄 Exportar PDF</button>
            <button style={styles.btnOutline} onClick={exportarExcel} disabled={loading || !edificioId}>📊 Excel</button>
          </div>
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
              <label style={styles.label}>Agua OSE — $/m³</label>
              <NumericInput style={styles.input} value={tarifas.precio_agua_m3}
                onChange={(n) => actualizarTarifa('precio_agua_m3', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Saneamiento — $/m³</label>
              <NumericInput style={styles.input} value={tarifas.precio_saneamiento_m3}
                onChange={(n) => actualizarTarifa('precio_saneamiento_m3', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Litros por lavado</label>
              <NumericInput style={styles.input} value={tarifas.litros_lavado}
                onChange={(n) => actualizarTarifa('litros_lavado', n)} />
            </div>
          </div>
          <div style={styles.resumenRow}>
            <span>Agua: <strong>{Math.round(calculo.litrosTotal).toLocaleString()} L</strong> ({calculo.m3Total.toFixed(3)} m³)</span>
            <span style={styles.costoPill}>$ {calculo.costoAgua.toFixed(2)}</span>
          </div>
          <div style={{ ...styles.resumenRow, marginTop: 8 }}>
            <span>Saneamiento: <strong>100%</strong> del cargo de agua</span>
            <span style={styles.costoPill}>$ {calculo.costoSaneamiento.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
            📋 OSE Decreto 340/025 — Cargo variable bloque 10–15 m³: $36,91/m³. Saneamiento = 100% del cargo de agua.
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚡ Electricidad</h3>
          <div style={styles.tarifaGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>UTE — $/kWh (sin IVA)</label>
              <NumericInput style={styles.input} value={tarifas.precio_kwh}
                onChange={(n) => actualizarTarifa('precio_kwh', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>IVA (%)</label>
              <NumericInput style={styles.input} value={tarifas.iva_porcentaje}
                onChange={(n) => actualizarTarifa('iva_porcentaje', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>kWh por lavado</label>
              <NumericInput style={styles.input} value={tarifas.kwh_lavado}
                onChange={(n) => actualizarTarifa('kwh_lavado', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>kWh por secado</label>
              <NumericInput style={styles.input} value={tarifas.kwh_secado}
                onChange={(n) => actualizarTarifa('kwh_secado', n)} />
            </div>
          </div>
          <div style={styles.resumenRow}>
            <span>Consumo: <strong>{calculo.kwhTotal.toFixed(2)} kWh</strong> × ${tarifas.precio_kwh}</span>
            <span style={styles.costoPill}>$ {calculo.costoElectricidadSinIva.toFixed(2)}</span>
          </div>
          <div style={{ ...styles.resumenRow, marginTop: 8 }}>
            <span>IVA {tarifas.iva_porcentaje}% sobre electricidad</span>
            <span style={styles.costoPill}>$ {calculo.ivaElectricidad.toFixed(2)}</span>
          </div>
          <div style={{ ...styles.resumenRow, marginTop: 8, backgroundColor: colors.bgBlueLight }}>
            <span><strong>Total electricidad (con IVA)</strong></span>
            <span style={{ ...styles.costoPill, backgroundColor: colors.primary, color: colors.white }}>$ {calculo.costoElectricidad.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
            📋 UTE Pliego Tarifario vigente 01/01/2026 — Residencial Simple tramo 101–600 kWh/mes: $8,452/kWh. IVA 22% sobre energía eléctrica.
          </p>
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
              <NumericInput style={styles.input} value={tarifas.otros_gastos}
                onChange={(n) => actualizarTarifa('otros_gastos', n)} />
            </div>
          </div>
        </div>

        {/* Ingresos por fichas */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>💰 Ingresos por fichas</h3>
          <div style={styles.tarifaGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Valor ficha lavado ($)</label>
              <NumericInput style={styles.input} value={tarifas.valor_ficha_lavado}
                onChange={(n) => actualizarTarifa('valor_ficha_lavado', n)} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Valor ficha secado ($)</label>
              <NumericInput style={styles.input} value={tarifas.valor_ficha_secado}
                onChange={(n) => actualizarTarifa('valor_ficha_secado', n)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
            <div style={styles.resumenRow}>
              <span>🧺 <strong>{calculo.usosLav}</strong> fichas × ${tarifas.valor_ficha_lavado.toFixed(2)}</span>
              <span style={styles.costoPill}>$ {calculo.ingresoLavado.toFixed(2)}</span>
            </div>
            <div style={styles.resumenRow}>
              <span>🌀 <strong>{calculo.usosSec}</strong> fichas × ${tarifas.valor_ficha_secado.toFixed(2)}</span>
              <span style={styles.costoPill}>$ {calculo.ingresoSecado.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ ...styles.resumenRow, marginTop: 12, backgroundColor: '#DCFCE7' }}>
            <span><strong>Total ingresos</strong> ({calculo.usosLav + calculo.usosSec} fichas)</span>
            <span style={{ ...styles.costoPill, backgroundColor: colors.success, color: colors.white }}>$ {calculo.ingresoTotal.toFixed(2)}</span>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>⚠️ Reportes de falla ({calculo.fallas.length})</h3>
          {calculo.fallas.length === 0 ? (
            <p style={styles.muted}>Sin reportes de falla en {meses[mes - 1]} {anio}.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${colors.border}` }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${colors.border}` }}>Máquina</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${colors.border}` }}>Residente</th>
                  </tr>
                </thead>
                <tbody>
                  {calculo.fallas.map((f) => {
                    const m = maquinas.find((x) => x.maquina_id === f.maquina_id);
                    const tipo = m?.tipo || 'lavarropas';
                    // Numero entre máquinas del mismo tipo+edificio
                    const mismasDelTipo = maquinas
                      .filter((x) => x.edificio_id === edificioId && x.tipo === tipo)
                      .sort((a, b) => a.maquina_id.localeCompare(b.maquina_id));
                    const numero = mismasDelTipo.findIndex((x) => x.maquina_id === f.maquina_id) + 1;
                    const label = tipo === 'secadora' ? 'Secadora' : 'Lavarropas';
                    const suffix = mismasDelTipo.length > 1 ? ` #${numero}` : '';
                    return (
                      <tr key={f._id}>
                        <td style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>{new Date(f.fecha_inicio || f.fecha).toLocaleDateString('es-UY')}</td>
                        <td style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                            backgroundColor: tipo === 'secadora' ? '#FEF3C7' : '#DBEAFE',
                            color: tipo === 'secadora' ? '#D97706' : '#3B82F6',
                          }}>{label}{suffix}</span>
                        </td>
                        <td style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>{f.residente_id || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ ...styles.card, backgroundColor: '#DCFCE7', marginBottom: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ingresos</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.success }}>$ {calculo.ingresoTotal.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{calculo.usosLav + calculo.usosSec} fichas vendidas</div>
          </div>
          <div style={{ ...styles.card, backgroundColor: '#FEF2F2', marginBottom: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Gastos</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.error }}>$ {calculo.totalGasto.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>Agua + electricidad + otros</div>
          </div>
          <div style={{ ...styles.card, backgroundColor: calculo.utilidad >= 0 ? colors.primary : colors.error, color: colors.white, marginBottom: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {calculo.utilidad >= 0 ? 'Utilidad' : 'Pérdida'}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>$ {calculo.utilidad.toFixed(2)}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Ingresos − Gastos</div>
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
  btnPrimary: {
    padding: '10px 24px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
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
