/** BCP-47 locale map used by Intl APIs */
export const INTL_LOCALE_MAP: Record<string, string> = {
  es: 'es-ES',
  eu: 'eu-ES',
  en: 'en-GB',
};

/**
 * Format points for display.
 * Provide an explicit BCP-47 locale when available; falls back to 'es-ES'.
 * In Client Components prefer next-intl's useFormatter().number().
 */
export function formatPuntos(puntos: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(puntos);
}

/**
 * Format a date as a localized string.
 * Provide an explicit BCP-47 locale when available; falls back to 'es-ES'.
 * In Client Components prefer next-intl's useFormatter().dateTime().
 */
export function formatFecha(date: Date | string, locale = 'es-ES'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format relative time (e.g., "hace 2 minutos").
 * @deprecated Use next-intl useFormatter().relativeTime() in components instead.
 */
export function formatRelativo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (diff < 60_000) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

/**
 * Ordinal position label (1º, 2º, ...).
 */
export function formatPosicion(pos: number): string {
  return `${pos}º`;
}

/**
 * Truncate a string to maxLength with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}
