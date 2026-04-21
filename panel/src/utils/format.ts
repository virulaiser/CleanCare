export function fmtMoney(n: number | null | undefined, decimales = 2): string {
  const v = Number(n) || 0;
  return `$ ${v.toLocaleString('es-UY', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`;
}

export function fmtNumero(n: number | null | undefined, decimales = 0): string {
  const v = Number(n) || 0;
  return v.toLocaleString('es-UY', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function fmtFecha(d: string | Date): string {
  return new Date(d).toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtFechaCorta(d: string | Date): string {
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function fmtSoloFecha(d: string | Date): string {
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
