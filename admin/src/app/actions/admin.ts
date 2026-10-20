"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { api, describeError } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import type { ActionState } from "@/lib/types";

/** Run an API mutation; turn backend errors into a message for the form. */
async function attempt(path: string, run: () => Promise<unknown>, success: string): Promise<ActionState> {
  try {
    await run();
  } catch (error) {
    unstable_rethrow(error); // let redirects (expired session) through
    return { ok: false, message: describeError(error) };
  }
  revalidatePath(path);
  return { ok: true, message: success };
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const list = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

// --- Models -------------------------------------------------------------------------------

export async function registerModel(_: ActionState, form: FormData): Promise<ActionState> {
  const body = { name: text(form, "name"), version: text(form, "version"), activate: form.get("activate") === "on" };
  return attempt("/models", () => api.post("/admin/models", body), `${body.version} registered.`);
}

export async function activateModel(_: ActionState, form: FormData): Promise<ActionState> {
  const name = text(form, "name");
  const version = text(form, "version");
  return attempt("/models", () => api.post(`/admin/models/${name}/${version}/activate`), `${version} is now live.`);
}

// --- Farmers ------------------------------------------------------------------------------

export async function setFarmerActive(form: FormData): Promise<void> {
  const active = form.get("active") === "true";
  try {
    await api.patch(`/admin/farmers/${text(form, "id")}/status`, { active });
  } catch (error) {
    unstable_rethrow(error);
  }
  revalidatePath("/farmers");
}

// --- Support desk -------------------------------------------------------------------------

export async function replyToFarmer(_: ActionState, form: FormData): Promise<ActionState> {
  const farmerId = text(form, "farmer_id");
  const body = text(form, "body");
  if (!body) return { ok: false, message: "Write a reply first." };
  return attempt(`/support/${farmerId}`, () => api.post(`/admin/support/threads/${farmerId}/reply`, { body }), "Reply sent. The farmer sees it in the app.");
}

// --- Knowledge ----------------------------------------------------------------------------

export async function verifyKnowledge(_: ActionState, form: FormData): Promise<ActionState> {
  const kind = text(form, "kind");
  const slug = text(form, "slug");
  return attempt(`/${kind}`, () => api.post(`/admin/knowledge/${kind}/${slug}/verify`, { verified_by: text(form, "verified_by") }),
    "Marked as expert-verified.");
}

export async function updateKnowledge(_: ActionState, form: FormData): Promise<ActionState> {
  const kind = text(form, "kind");
  const slug = text(form, "slug");
  const listFields = new Set(String(form.get("list_fields") ?? "").split(","));
  const fields: Record<string, string | string[]> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("field:")) continue;
    const name = key.slice(6);
    fields[name] = listFields.has(name)
      ? String(value).split("\n").map((line) => line.trim()).filter(Boolean)
      : String(value).trim();
  }
  return attempt(`/${kind}`, () => api.put(`/admin/knowledge/${kind}/${slug}`, { fields }),
    "Saved. The entry needs expert verification again.");
}

// --- Crops --------------------------------------------------------------------------------

export async function updateCrop(_: ActionState, form: FormData): Promise<ActionState> {
  const slug = text(form, "slug");
  const number = (key: string) => (text(form, key) ? Number(text(form, key)) : undefined);
  const body = {
    market_commodity: text(form, "market_commodity") || null,
    fertilizer_guidance: text(form, "fertilizer_guidance"),
    duration_days_min: number("duration_days_min"),
    duration_days_max: number("duration_days_max"),
    yield_min_q_per_acre: number("yield_min_q_per_acre"),
    yield_max_q_per_acre: number("yield_max_q_per_acre"),
    water_requirement: text(form, "water_requirement") || undefined,
  };
  return attempt("/crops", () => api.put(`/admin/crops/${slug}`, body), `${slug} saved.`);
}

// --- Schemes ------------------------------------------------------------------------------

function schemeBody(form: FormData) {
  const rules: { rule_type: string; value: unknown }[] = [];
  const numeric = ["max_land_acres", "min_land_acres", "min_age", "max_age"];
  for (const rule of numeric) {
    const value = text(form, `rule:${rule}`);
    if (value) rules.push({ rule_type: rule, value: Number(value) });
  }
  for (const rule of ["states_any", "crops_any"]) {
    const value = list(text(form, `rule:${rule}`));
    if (value.length) rules.push({ rule_type: rule, value });
  }
  if (text(form, "rule:requires_irrigation")) rules.push({ rule_type: "requires_irrigation", value: true });
  return {
    code: text(form, "code"),
    name: text(form, "name"),
    state: text(form, "state") || null,
    district: text(form, "district") || null,
    summary: text(form, "summary"),
    benefits: text(form, "benefits"),
    eligibility_text: text(form, "eligibility_text"),
    application_process: text(form, "application_process"),
    official_url: text(form, "official_url"),
    source: text(form, "source") || "admin",
    last_verified_on: text(form, "last_verified_on"),
    is_active: form.get("is_active") === "on",
    rules,
  };
}

export async function saveScheme(_: ActionState, form: FormData): Promise<ActionState> {
  const id = text(form, "id");
  const body = schemeBody(form);
  return attempt("/schemes", () => (id ? api.put(`/admin/schemes/${id}`, body) : api.post("/admin/schemes", body)),
    id ? "Scheme updated." : "Scheme created.");
}

// --- Notifications ------------------------------------------------------------------------

export async function sendNotification(_: ActionState, form: FormData): Promise<ActionState> {
  const title: Record<string, string> = {};
  const body: Record<string, string> = {};
  for (const { code: language } of LANGUAGES) {
    if (text(form, `title:${language}`)) title[language] = text(form, `title:${language}`);
    if (text(form, `body:${language}`)) body[language] = text(form, `body:${language}`);
  }
  const payload = {
    // One key per form render: a double-click or retry never sends twice.
    idempotency_key: text(form, "idempotency_key"),
    category: text(form, "category"),
    title,
    body,
    target: {
      states: list(text(form, "states")),
      districts: list(text(form, "districts")),
      crops: list(text(form, "crops")),
      languages: form.getAll("languages").map(String),
    },
  };
  try {
    const result = await api.post<{ recipients: number }>("/admin/notifications", payload);
    revalidatePath("/notifications");
    return { ok: true, message: `Queued for ${result.recipients} farmer(s).` };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: describeError(error) };
  }
}

// --- Market prices ------------------------------------------------------------------------

export async function syncSchemes(): Promise<ActionState> {
  try {
    const r = await api.post<{ source: string; synced: number; new: number; retired: number; announced: number }>(
      "/admin/schemes/sync",
    );
    revalidatePath("/schemes");
    return {
      ok: true,
      message: `Synced ${r.synced} schemes from ${r.source}: ${r.new} new, ${r.retired} retired, ${r.announced} announced to farmers.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: describeError(error) };
  }
}

export async function importPrices(_: ActionState, form: FormData): Promise<ActionState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a CSV file." };
  const upload = new FormData();
  upload.append("file", file, file.name);
  if (text(form, "state")) upload.append("state", text(form, "state"));
  try {
    const result = await api.post<{ imported: number; skipped_rows: number[] }>("/admin/markets/import", upload);
    revalidatePath("/markets");
    const skipped = result.skipped_rows.length ? ` ${result.skipped_rows.length} unreadable row(s) skipped.` : "";
    return { ok: true, message: `Imported ${result.imported} price row(s).${skipped}` };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: describeError(error) };
  }
}
