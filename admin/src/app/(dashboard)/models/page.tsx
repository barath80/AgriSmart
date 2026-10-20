import type { Metadata } from "next";

import { activateModel, registerModel } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Badge, Card, ErrorPanel, formatDay, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { ModelRow } from "@/lib/types";

export const metadata: Metadata = { title: "Models" };

const HEADLINE_METRICS = ["test_accuracy", "test_macro_f1", "test_r2", "test_mape_pct", "p10_p90_coverage", "min_confidence"];

function MetricList({ metrics }: { metrics: Record<string, unknown> }) {
  const shown = HEADLINE_METRICS.filter((k) => typeof metrics[k] === "number");
  if (!shown.length) return <span className="text-ink-3">—</span>;
  return (
    <dl className="tabular grid grid-cols-[auto_auto] gap-x-3 text-xs">
      {shown.map((k) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k.replaceAll("_", " ")}</dt>
          <dd>{String(metrics[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ModelsPage() {
  const result = await load(api.get<ModelRow[]>("/admin/models"));
  const unregistered = result.data?.filter((m) => !m.registered) ?? [];

  return (
    <>
      <PageHeader
        title="Models"
        description="Versions are immutable. Activating a version makes it live on every API instance within a minute; rolling back is activating an older one."
      />
      {result.data ? (
        <Table head={["Model", "Version", "Status", "Metrics", "Dataset", "Trained", ""]} empty={!result.data.length}>
          {result.data.map((m) => (
            <tr key={`${m.name}/${m.version}`}>
              <Td className="font-medium capitalize">{m.name}</Td>
              <Td className="tabular">{m.version}</Td>
              <Td>
                {m.is_active ? <Badge tone="good">Live</Badge> : m.registered ? <Badge>Registered</Badge> : <Badge tone="info">On disk</Badge>}
              </Td>
              <Td><MetricList metrics={m.metrics} /></Td>
              <Td className="text-xs text-ink-2">{m.dataset_version ?? "—"}</Td>
              <Td className="text-ink-2">{m.trained_at ? formatDay(m.trained_at) : "—"}</Td>
              <Td>
                {m.registered && !m.is_active ? (
                  <ActionForm action={activateModel} submitLabel="Activate" submitClassName="h-8 px-3 text-xs">
                    <input type="hidden" name="name" value={m.name} />
                    <input type="hidden" name="version" value={m.version} />
                  </ActionForm>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      ) : (
        <ErrorPanel message={result.error} />
      )}

      <Card title="Register a trained version" className="mt-6 max-w-2xl">
        <p className="mb-4 text-sm text-ink-2">
          Train in <code>ml/notebooks</code>; the export lands in <code>ml/artifacts/&lt;model&gt;/&lt;version&gt;</code>.
          The backend validates and test-loads the artifact before accepting it.
          {unregistered.length ? ` On disk, not yet registered: ${unregistered.map((m) => m.version).join(", ")}.` : ""}
        </p>
        <ActionForm action={registerModel} submitLabel="Register" className="flex flex-wrap items-end gap-3">
          <Select label="Model" name="name" options={["crop", "yield", "disease", "pest", "subject"].map((v) => ({ value: v, label: v }))} />
          <Input label="Version" name="version" placeholder="crop_v2" required pattern="[a-z]+_v[0-9]+" />
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="activate" defaultChecked /> Activate now
          </label>
        </ActionForm>
      </Card>
    </>
  );
}
