import XLSX from 'xlsx-js-style';

const BRAND = {
  primaryDk: '1D4ED8',
  primary:   '3B82F6',
  white:     'FFFFFF',
  zebra:     'F8FAFC',
  border:    'E5E7EB',
  text:      '0F172A',
  textSoft:  '475569',
  bgSoft:    'EFF6FF',
};

const BORDER_ALL = {
  top:    { style: 'thin', color: { rgb: BRAND.border } },
  left:   { style: 'thin', color: { rgb: BRAND.border } },
  right:  { style: 'thin', color: { rgb: BRAND.border } },
  bottom: { style: 'thin', color: { rgb: BRAND.border } },
};

export interface ExcelColumn {
  key: string;
  label: string;
  width?: number; // ancho en caracteres
  numFmt?: string; // ej '#,##0' o '$#,##0.00'
  align?: 'left' | 'center' | 'right';
}

export interface ExcelTableOpts {
  filename: string;       // ej 'creditos_abril_2026.xlsx'
  sheetName?: string;     // ej 'Créditos'
  title: string;          // título grande arriba
  subtitle?: string;      // ej 'Torre Norte · Abril 2026'
  columns: ExcelColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, any>; // fila de totales
}

export function exportExcelTable(opts: ExcelTableOpts) {
  const { filename, sheetName = 'Datos', title, subtitle, columns, rows, totals } = opts;

  const ws: XLSX.WorkSheet = {};
  const colCount = columns.length;
  const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

  // Fila 0: Título
  ws[cellRef(0, 0)] = {
    v: title,
    s: {
      font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: BRAND.primaryDk } },
      alignment: { vertical: 'center', horizontal: 'left' },
    },
  };
  // Fila 1: Subtitle
  if (subtitle) {
    ws[cellRef(1, 0)] = {
      v: subtitle,
      s: {
        font: { name: 'Calibri', sz: 11, color: { rgb: BRAND.textSoft } },
        alignment: { vertical: 'center' },
      },
    };
  }
  // Fila 2: fecha generación
  ws[cellRef(2, 0)] = {
    v: `Generado: ${new Date().toLocaleString('es-UY')}`,
    s: { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: BRAND.textSoft } } },
  };

  // Fila 4: headers
  const headerRow = 4;
  columns.forEach((c, i) => {
    ws[cellRef(headerRow, i)] = {
      v: c.label,
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: BRAND.white } },
        fill: { patternType: 'solid', fgColor: { rgb: BRAND.primary } },
        alignment: { vertical: 'center', horizontal: c.align || 'left', wrapText: true },
        border: BORDER_ALL,
      },
    };
  });

  // Filas de datos
  const dataStart = headerRow + 1;
  rows.forEach((row, ri) => {
    const zebra = ri % 2 === 1;
    columns.forEach((c, ci) => {
      const raw = row[c.key];
      const value = raw == null || raw === '' ? '' : raw;
      const cellStyle: any = {
        font: { name: 'Calibri', sz: 10, color: { rgb: BRAND.text } },
        alignment: { vertical: 'center', horizontal: c.align || 'left' },
        border: BORDER_ALL,
      };
      if (zebra) {
        cellStyle.fill = { patternType: 'solid', fgColor: { rgb: BRAND.zebra } };
      }
      const cell: XLSX.CellObject = {
        v: value,
        t: typeof value === 'number' ? 'n' : 's',
        s: cellStyle,
      } as XLSX.CellObject;
      if (c.numFmt && typeof value === 'number') (cell as any).z = c.numFmt;
      ws[cellRef(dataStart + ri, ci)] = cell;
    });
  });

  // Fila total
  let lastRow = dataStart + rows.length - 1;
  if (totals) {
    const totalRowIdx = dataStart + rows.length;
    columns.forEach((c, ci) => {
      const raw = totals[c.key];
      const value = raw == null ? '' : raw;
      const cell: XLSX.CellObject = {
        v: value,
        t: typeof value === 'number' ? 'n' : 's',
        s: {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: BRAND.primaryDk } },
          fill: { patternType: 'solid', fgColor: { rgb: BRAND.bgSoft } },
          alignment: { vertical: 'center', horizontal: c.align || 'left' },
          border: {
            top:    { style: 'medium', color: { rgb: BRAND.primary } },
            bottom: { style: 'medium', color: { rgb: BRAND.primary } },
            left:   { style: 'thin', color: { rgb: BRAND.border } },
            right:  { style: 'thin', color: { rgb: BRAND.border } },
          },
        },
      } as XLSX.CellObject;
      if (c.numFmt && typeof value === 'number') (cell as any).z = c.numFmt;
      ws[cellRef(totalRowIdx, ci)] = cell;
    });
    lastRow = totalRowIdx;
  }

  // Merge título y subtítulo a todo el ancho
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
  ];
  if (subtitle) ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });
  ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } });

  // Anchos de columna
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }));

  // Altos de fila (título un poco más alto)
  ws['!rows'] = [
    { hpt: 26 },
    { hpt: 18 },
    { hpt: 14 },
    { hpt: 8 }, // espaciador
    { hpt: 22 }, // header
  ];

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: colCount - 1 },
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
