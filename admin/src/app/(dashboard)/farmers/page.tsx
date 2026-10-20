import type { Metadata } from "next";
import Link from "next/link";

import { setFarmerActive } from "@/app/actions/admin";
import { Badge, ErrorPanel, FilterBar, formatDate, formatNumber, Input, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { load, one } from "@/lib/load";
import type { FarmerRow, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Farmers" };

const LANGUAGE_OPTIONS = [{ value: "", label: "All languages" }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.name }))];

export default async function FarmersPage(props: PageProps<"/farmers">) {
  const params = await props.searchParams;
  const filters = { search: one(params.search), state: one(params.state), language: one(params.language) };
  const page = Number(one(params.page) ?? 1) || 1;
  const result = await load(api.get<Page<FarmerRow>>("/admin/farmers", { ...filters, page, page_size: 25 }));

  return (
    <>
      <PageHeader title="Farmers" description="Everyone registered through the app or by calling the AgriSmart number." />
      <FilterBar action="/farmers">
        <Input label="Name or phone" name="search" defaultValue={filters.search} placeholder="Search…" />
        <Input label="State" name="state" defaultValue={filters.state} placeholder="e.g. Tamil Nadu" />
        <Select label="Language" name="language" defaultValue={filters.language ?? ""} options={LANGUAGE_OPTIONS} />
      </FilterBar>
      {result.data ? (
        <>
          <Table head={["Farmer", "Location", "Language", "Channel", "Farms", "Last sign-in", "Status"]} empty={!result.data.items.length}>
            {result.data.items.map((f) => (
              <tr key={f.id}>
                <Td><Link href={`/support/${f.id}`} className="font-medium text-info hover:underline">{f.name || "Unnamed farmer"}</Link><p className="tabular text-xs text-ink-3">{f.phone}</p></Td>
                <Td>{[f.district, f.state].filter(Boolean).join(", ") || "—"}</Td>
                <Td>{f.preferred_language.toUpperCase()}</Td>
                <Td>{f.primary_channel === "phone" ? "Button phone" : "App"}</Td>
                <Td className="tabular">{f.farms} · {formatNumber(f.total_acres, 1)} ac</Td>
                <Td className="text-ink-2">{formatDate(f.last_login_at)}</Td>
                <Td>
                  <form action={setFarmerActive} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="active" value={String(!f.is_active)} />
                    <Badge tone={f.is_active ? "good" : "critical"}>{f.is_active ? "Active" : "Disabled"}</Badge>
                    <button className="text-xs text-info hover:underline">{f.is_active ? "Disable" : "Enable"}</button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={25} total={result.data.total} basePath="/farmers" params={filters} />
        </>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
