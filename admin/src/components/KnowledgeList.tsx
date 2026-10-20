import { updateKnowledge, verifyKnowledge } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Badge, ErrorPanel, formatDay, Input, PageHeader, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { KnowledgeEntry } from "@/lib/types";

const FIELDS = {
  diseases: { text: ["cause", "pathogen_type"], list: ["symptoms", "favorable_conditions", "treatment", "prevention", "fertilizer_guidance", "safety_warnings"] },
  pests: { text: ["description"], list: ["damage", "affected_crops", "control_measures", "prevention", "safety_warnings"] },
} as const;

const label = (field: string) => field.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The model says *what* is in a photo; these entries say *what to do*. Every entry must be
 * reviewed by an agronomist — until then farmers see a caution with each answer.
 */
export async function KnowledgeList({ kind, title }: { kind: "diseases" | "pests"; title: string }) {
  const result = await load(api.get<KnowledgeEntry[]>(`/admin/knowledge/${kind}`));
  if (!result.data) return <ErrorPanel message={result.error} />;
  const entries = result.data;
  const verified = entries.filter((e) => e.verified_at).length;
  const { text, list } = FIELDS[kind];

  return (
    <>
      <PageHeader
        title={title}
        description={`${verified} of ${entries.length} entries expert-verified. Editing an entry clears its verification so changes are always re-reviewed.`}
      />
      <div className="space-y-3">
        {entries.map((entry) => {
          const healthy = entry.is_healthy ?? entry.is_beneficial;
          return (
            <details key={entry.slug} className="group rounded-xl border border-line bg-surface-1">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <span className="font-medium">{entry.names.en ?? entry.slug}</span>
                  <span className="ml-2 text-xs text-ink-3">{entry.slug}</span>
                </span>
                <span className="flex gap-2">
                  {healthy ? <Badge tone="info">{kind === "pests" ? "Beneficial" : "Healthy"}</Badge> : null}
                  {entry.verified_at ? (
                    <Badge tone="good">Verified by {entry.verified_by} · {formatDay(entry.verified_at)}</Badge>
                  ) : (
                    <Badge tone="warning">Needs expert review</Badge>
                  )}
                </span>
              </summary>
              <div className="grid gap-6 border-t border-line p-5 lg:grid-cols-[2fr_1fr]">
                <ActionForm action={updateKnowledge} submitLabel="Save changes" className="space-y-3">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="slug" value={entry.slug} />
                  <input type="hidden" name="list_fields" value={list.join(",")} />
                  {text.map((field) => (
                    <TextArea key={field} label={label(field)} name={`field:${field}`} defaultValue={String(entry[field] ?? "")} />
                  ))}
                  {list.map((field) => (
                    <TextArea key={field} label={`${label(field)} (one per line)`} name={`field:${field}`}
                              defaultValue={((entry[field] as string[] | undefined) ?? []).join("\n")} rows={4} />
                  ))}
                </ActionForm>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Expert verification</h3>
                  <p className="mb-3 text-xs text-ink-2">Confirm the cause, treatment and safety advice are correct for Indian conditions.</p>
                  <ActionForm action={verifyKnowledge} submitLabel="Mark verified" className="space-y-3">
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="slug" value={entry.slug} />
                    <Input label="Reviewer name and organisation" name="verified_by" required minLength={3} placeholder="Dr. … , KVK …" />
                  </ActionForm>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
