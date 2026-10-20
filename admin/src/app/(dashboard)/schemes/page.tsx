import type { Metadata } from "next";

import { saveScheme, syncSchemes } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Badge, Card, ErrorPanel, formatDay, Input, PageHeader, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { Scheme } from "@/lib/types";

export const metadata: Metadata = { title: "Schemes" };

const SOURCE_LABELS: Record<string, string> = { myscheme: "myScheme (live)", admin: "Entered by admin" };

const ruleValue = (scheme: Scheme | undefined, type: string) => {
  const value = scheme?.rules.find((r) => r.rule_type === type)?.value;
  return Array.isArray(value) ? value.join(", ") : value === undefined ? "" : String(value);
};

function SchemeForm({ scheme }: { scheme?: Scheme }) {
  return (
    <ActionForm action={saveScheme} submitLabel={scheme ? "Save scheme" : "Create scheme"} className="space-y-4">
      {scheme ? <input type="hidden" name="id" value={scheme.id} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Code (a-z, 0-9, _)" name="code" defaultValue={scheme?.code} required pattern="[a-z0-9_]{3,64}" />
        <Input label="Name" name="name" defaultValue={scheme?.name} required />
        <Input label="Official URL" name="official_url" type="url" defaultValue={scheme?.official_url} required />
        <Input label="State (blank = central)" name="state" defaultValue={scheme?.state ?? ""} />
        <Input label="District (optional)" name="district" defaultValue={scheme?.district ?? ""} />
        <Input label="Information verified on" name="last_verified_on" type="date" required
               defaultValue={scheme?.last_verified_on ?? new Date().toISOString().slice(0, 10)} />
      </div>
      <TextArea label="Summary" name="summary" defaultValue={scheme?.summary} required />
      <TextArea label="Benefits" name="benefits" defaultValue={scheme?.benefits} required />
      <TextArea label="Who can apply (as published)" name="eligibility_text" defaultValue={scheme?.eligibility_text} required />
      <TextArea label="How to apply" name="application_process" defaultValue={scheme?.application_process} required />
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-xs font-medium text-ink-2">Eligibility rules (checked automatically — leave blank if not applicable)</legend>
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Min land (acres)" name="rule:min_land_acres" type="number" step="0.01" defaultValue={ruleValue(scheme, "min_land_acres")} />
          <Input label="Max land (acres)" name="rule:max_land_acres" type="number" step="0.01" defaultValue={ruleValue(scheme, "max_land_acres")} />
          <Input label="Min age" name="rule:min_age" type="number" defaultValue={ruleValue(scheme, "min_age")} />
          <Input label="Max age" name="rule:max_age" type="number" defaultValue={ruleValue(scheme, "max_age")} />
          <Input label="Only these states (comma separated)" name="rule:states_any" defaultValue={ruleValue(scheme, "states_any")} />
          <Input label="Only these crops (slugs, comma separated)" name="rule:crops_any" defaultValue={ruleValue(scheme, "crops_any")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="rule:requires_irrigation" defaultChecked={Boolean(ruleValue(scheme, "requires_irrigation"))} />
            Requires irrigation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={scheme?.is_active ?? true} /> Active
          </label>
        </div>
      </fieldset>
    </ActionForm>
  );
}

export default async function SchemesPage() {
  const result = await load(api.get<Scheme[]>("/admin/schemes"));
  return (
    <>
      <PageHeader title="Government schemes" description="Enter only information from official sources. Eligibility is decided by the rules below, never by AI." />
      <Card title="Live sync from myScheme" className="mb-6">
        <p className="mb-3 text-sm text-ink-2">
          Pulls the national scheme catalogue (agriculture category) now; the worker also does this on a schedule.
          Schemes that are new since the last sync are announced to farmers in their state. Needs{" "}
          <code>SCHEME_PROVIDER=myscheme</code> and a myScheme API key from API Setu.
        </p>
        <ActionForm action={syncSchemes} submitLabel="Sync now"><span /></ActionForm>
      </Card>
      {result.data ? (
        <div className="space-y-3">
          {result.data.map((scheme) => (
            <details key={scheme.id} className="rounded-xl border border-line bg-surface-1">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="font-medium">{scheme.name}</span>
                <span className="flex gap-2">
                  <Badge>{scheme.state ?? "Central"}</Badge>
                  <Badge tone="neutral">{SOURCE_LABELS[scheme.source] ?? scheme.source}</Badge>
                  <Badge tone={scheme.is_active ? "good" : "neutral"}>{scheme.is_active ? "Active" : "Inactive"}</Badge>
                  <Badge tone="info">Verified {formatDay(scheme.last_verified_on)}</Badge>
                </span>
              </summary>
              <div className="border-t border-line p-5"><SchemeForm scheme={scheme} /></div>
            </details>
          ))}
        </div>
      ) : (
        <ErrorPanel message={result.error} />
      )}
      <Card title="Add a scheme" className="mt-6"><SchemeForm /></Card>
    </>
  );
}
