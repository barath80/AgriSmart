import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function Card({ title, children, className = "", action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface-1 p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "good" | "warning" | "critical" }) {
  const toneClass = tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`tabular mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

const BADGE_TONES = {
  good: "bg-good-surface text-good",
  warning: "bg-warning-surface text-warning",
  critical: "bg-critical-surface text-critical",
  info: "bg-info-surface text-info",
  neutral: "bg-surface-2 text-ink-2",
};

/** Status always pairs colour with a symbol and a word — never colour alone. */
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  const symbol = { good: "✓", warning: "!", critical: "✕", info: "i", neutral: "" }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {symbol ? <span aria-hidden>{symbol}</span> : null}
      {children}
    </span>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface-1">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-10 text-center text-sm text-ink-3">Nothing to show yet.</p> : null}
    </div>
  );
}

export const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
);

export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (target: number) => {
    const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    query.set("page", String(target));
    return `${basePath}?${query}`;
  };
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-ink-2" aria-label="Pagination">
      <span className="tabular">{total.toLocaleString("en-IN")} total · page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2" href={href(page - 1)}>Previous</Link> : null}
        {page < pages ? <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2" href={href(page + 1)}>Next</Link> : null}
      </div>
    </nav>
  );
}

/** Filters live in one row above the data, submitted as a plain GET form. */
export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form action={action} className="mb-4 flex flex-wrap items-end gap-3">
      {children}
      <button className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-contrast">Apply</button>
    </form>
  );
}

export function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      <input {...props} className={`h-9 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink ${props.className ?? ""}`} />
    </label>
  );
}

export function TextArea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      <textarea {...props} className="min-h-20 rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink" />
    </label>
  );
}

export function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      <select {...props} className="h-9 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-line bg-critical-surface p-4 text-sm text-critical">
      <strong>Could not load data.</strong> {message}
    </div>
  );
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—";

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const formatNumber = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined ? "—" : value.toLocaleString("en-IN", { maximumFractionDigits: digits });
