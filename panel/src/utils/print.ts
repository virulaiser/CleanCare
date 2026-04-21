export interface PrintColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: Record<string, any>) => string;
}

export interface PrintTableOpts {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, any>;
  documentTitle?: string;
}

function escape(value: any): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCell(col: PrintColumn, row: Record<string, any>): string {
  const raw = row[col.key];
  const text = col.format ? col.format(raw, row) : raw == null ? '' : String(raw);
  return escape(text);
}

export function printTable(opts: PrintTableOpts) {
  const { title, subtitle, columns, rows, totals, documentTitle } = opts;
  const now = new Date().toLocaleString('es-UY');

  const thead = `<tr>${columns
    .map((c) => `<th class="align-${c.align || 'left'}">${escape(c.label)}</th>`)
    .join('')}</tr>`;

  const tbody = rows
    .map(
      (row, i) =>
        `<tr class="${i % 2 === 1 ? 'zebra' : ''}">${columns
          .map((c) => `<td class="align-${c.align || 'left'}">${renderCell(c, row)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  const tfoot = totals
    ? `<tr class="totals">${columns
        .map((c) => `<td class="align-${c.align || 'left'}">${renderCell(c, totals)}</td>`)
        .join('')}</tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escape(documentTitle || title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0F172A;
    margin: 0;
    padding: 24px;
    background: #fff;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 3px solid #3B82F6;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .brand { font-size: 22px; font-weight: 700; color: #1D4ED8; }
  .brand small { display: block; font-size: 11px; color: #64748B; font-weight: 500; margin-top: 2px; letter-spacing: 0.5px; }
  .meta { text-align: right; font-size: 11px; color: #64748B; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #0F172A; }
  .subtitle { font-size: 13px; color: #475569; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    background: #3B82F6; color: #fff;
    padding: 10px 8px; text-align: left;
    font-weight: 600; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 8px; border-bottom: 1px solid #E5E7EB;
    vertical-align: middle;
  }
  tr.zebra td { background: #F8FAFC; }
  tr.totals td {
    background: #EFF6FF; color: #1D4ED8;
    font-weight: 700; font-size: 12px;
    border-top: 2px solid #3B82F6;
    border-bottom: 2px solid #3B82F6;
  }
  .align-left { text-align: left; }
  .align-center { text-align: center; }
  .align-right { text-align: right; }
  footer {
    margin-top: 24px; padding-top: 10px;
    border-top: 1px solid #E5E7EB;
    font-size: 10px; color: #94A3B8;
    display: flex; justify-content: space-between;
  }
  @media print {
    body { padding: 0; }
    button { display: none; }
  }
</style>
</head>
<body>
  <header>
    <div class="brand">CleanCare<small>Gestión de lavandería</small></div>
    <div class="meta">Generado: ${escape(now)}</div>
  </header>
  <h1>${escape(title)}</h1>
  ${subtitle ? `<div class="subtitle">${escape(subtitle)}</div>` : ''}
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}${tfoot}</tbody>
  </table>
  <footer>
    <span>${escape(title)}</span>
    <span>CleanCare · cleancare.com</span>
  </footer>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('El navegador bloqueó la ventana de impresión. Habilitá los popups para este sitio.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
