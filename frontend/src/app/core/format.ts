const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

export function money(v: number | null | undefined): string {
  return v === null || v === undefined ? 'N/D' : mxn.format(v);
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? 'N/D' : `${num.format(v)}%`;
}

export function compactMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'N/D';
  if (v >= 1000) return `$${num.format(v / 1000)}k`;
  return mxn.format(v);
}

/** Paleta visual de la tarjeta segun su clase (para el "plastico" en la UI). */
export function cardTheme(cardClass: string): { bg: string; chip: string; label: string } {
  switch (cardClass) {
    case 'Platino':
      return { bg: 'from-slate-300 via-slate-500 to-slate-800', chip: 'from-slate-100 to-slate-400', label: 'text-slate-900' };
    case 'Oro':
      return { bg: 'from-amber-300 via-amber-500 to-orange-700', chip: 'from-yellow-100 to-amber-400', label: 'text-amber-950' };
    case 'Básica':
      return { bg: 'from-emerald-400 via-teal-500 to-cyan-700', chip: 'from-emerald-100 to-teal-300', label: 'text-emerald-950' };
    case 'Todas':
      return { bg: 'from-zinc-700 via-zinc-900 to-black', chip: 'from-zinc-300 to-zinc-500', label: 'text-zinc-100' };
    default:
      return { bg: 'from-indigo-500 via-violet-600 to-fuchsia-700', chip: 'from-indigo-100 to-violet-300', label: 'text-indigo-950' };
  }
}

export const BENEFIT_ICON: Record<string, string> = {
  'Meses sin intereses': 'calendar',
  Puntos: 'star',
  Descuentos: 'tag',
  Preventas: 'ticket',
  'Transferencia de Saldo': 'swap',
  Seguros: 'shield',
  Anualidad: 'gift',
};

export const FEE_TYPE_LABEL: Record<string, string> = {
  obligatoria: 'Obligatoria',
  por_evento: 'Por evento',
  penalizacion: 'Penalización',
  otro: 'Otro',
};
