import { currentLanguage, speechLocale } from '@/i18n';

/** Indian digit grouping (1,23,456) regardless of UI language. */
export const rupees = (value: number) => Math.round(value).toLocaleString('en-IN');

export const decimal = (value: number, digits = 1) =>
  value.toLocaleString('en-IN', { maximumFractionDigits: digits });

/** "Thu, 2 Oct" in the farmer's own language. */
export function shortDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(speechLocale(currentLanguage()), { weekday: 'short', day: 'numeric', month: 'short' });
}

export const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** Parses user-typed numbers ("2,5" or "2.5"); NaN when empty or invalid. */
export const parseNumber = (value: string) => (value.trim() ? Number(value.replace(',', '.')) : Number.NaN);

export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
