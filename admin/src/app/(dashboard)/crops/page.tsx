import type { Metadata } from "next";

import { updateCrop } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { ErrorPanel, Input, PageHeader, Select, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { CropInfo } from "@/lib/types";

export const metadata: Metadata = { title: "Crops" };

const NAME_ORDER = ["ta", "hi", "te", "kn", "mr"];

export default async function CropsPage() {
  const result = await load(api.get<CropInfo[]>("/admin/crops"));
  if (!result.data) return <ErrorPanel message={result.error} />;
  return (
    <>
      <PageHeader title="Crops" description="Agronomic facts used by recommendations, calendars, yield checks and market look-ups. Changes apply within five minutes." />
      <div className="space-y-3">
        {result.data.map((crop) => (
          <details key={crop.slug} className="rounded-xl border border-line bg-surface-1">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span>
                <span className="font-medium">{crop.names.en}</span>
                <span className="ml-2 text-sm text-ink-2">{NAME_ORDER.map((l) => crop.names[l]).filter(Boolean).join(" · ")}</span>
              </span>
              <span className="text-xs text-ink-3">
                {crop.category} · {crop.seasons.join(", ")} · {crop.duration_days_min}–{crop.duration_days_max} days
              </span>
            </summary>
            <ActionForm action={updateCrop} submitLabel="Save" className="grid gap-3 border-t border-line p-5 md:grid-cols-3">
              <input type="hidden" name="slug" value={crop.slug} />
              <Input label="Agmarknet commodity" name="market_commodity" defaultValue={crop.market_commodity ?? ""} />
              <Select label="Water need" name="water_requirement" defaultValue={crop.water_requirement}
                      options={["low", "medium", "high"].map((v) => ({ value: v, label: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Min days" name="duration_days_min" type="number" defaultValue={crop.duration_days_min} />
                <Input label="Max days" name="duration_days_max" type="number" defaultValue={crop.duration_days_max} />
              </div>
              <Input label="Yield min (q/acre)" name="yield_min_q_per_acre" type="number" step="0.1" defaultValue={crop.yield_min_q_per_acre} />
              <Input label="Yield max (q/acre)" name="yield_max_q_per_acre" type="number" step="0.1" defaultValue={crop.yield_max_q_per_acre} />
              <div className="md:col-span-3">
                <TextArea label="Fertilizer guidance" name="fertilizer_guidance" defaultValue={crop.fertilizer_guidance} />
              </div>
            </ActionForm>
          </details>
        ))}
      </div>
    </>
  );
}
