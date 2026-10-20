import type { Metadata } from "next";

import { importPrices } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Card, ErrorPanel, FilterBar, formatDay, formatNumber, Input, PageHeader, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load, one } from "@/lib/load";
import type { PriceRow } from "@/lib/types";

export const metadata: Metadata = { title: "Market prices" };

export default async function MarketsPage(props: PageProps<"/markets">) {
  const params = await props.searchParams;
  const filters = { commodity: one(params.commodity), state: one(params.state) };
  const result = await load(api.get<PriceRow[]>("/admin/markets/prices", { ...filters, limit: 200 }));

  return (
    <>
      <PageHeader title="Market prices" description="Observed mandi prices (₹/quintal). These are recorded prices — the app never presents them as forecasts." />

      <Card title="Import a price file (no API key needed)" className="mb-6 max-w-3xl">
        <p className="mb-4 text-sm text-ink-2">
          Download a daily price report as CSV from agmarknet.gov.in (or the data.gov.in mandi price CSV) and upload it here.
          Re-uploading the same file never creates duplicates.
        </p>
        <ActionForm action={importPrices} submitLabel="Import" className="flex flex-wrap items-end gap-3">
          <Input label="CSV file" name="file" type="file" accept=".csv,text/csv" required className="pt-1.5" />
          <Input label="State (if the file has no State column)" name="state" placeholder="e.g. Maharashtra" />
        </ActionForm>
      </Card>

      <FilterBar action="/markets">
        <Input label="Commodity" name="commodity" defaultValue={filters.commodity} placeholder="e.g. Onion" />
        <Input label="State" name="state" defaultValue={filters.state} placeholder="e.g. Karnataka" />
      </FilterBar>
      {result.data ? (
        <Table head={["Date", "Commodity", "Market", "Min", "Modal", "Max", "Source"]} empty={!result.data.length}>
          {result.data.map((p) => (
            <tr key={`${p.market}-${p.commodity}-${p.variety}-${p.arrival_date}`}>
              <Td className="text-ink-2">{formatDay(p.arrival_date)}</Td>
              <Td><p className="font-medium">{p.commodity}</p><p className="text-xs text-ink-3">{p.variety}</p></Td>
              <Td><p>{p.market}</p><p className="text-xs text-ink-3">{p.district}, {p.state}</p></Td>
              <Td className="tabular">₹{formatNumber(p.min_price)}</Td>
              <Td className="tabular font-medium">₹{formatNumber(p.modal_price)}</Td>
              <Td className="tabular">₹{formatNumber(p.max_price)}</Td>
              <Td className="text-xs text-ink-2">{p.source}</Td>
            </tr>
          ))}
        </Table>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
