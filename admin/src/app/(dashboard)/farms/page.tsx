import type { Metadata } from "next";

import { ErrorPanel, FilterBar, formatNumber, Input, PageHeader, Pagination, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load, one } from "@/lib/load";
import type { FarmRow, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Farms" };

export default async function FarmsPage(props: PageProps<"/farms">) {
  const params = await props.searchParams;
  const filters = { state: one(params.state) };
  const page = Number(one(params.page) ?? 1) || 1;
  const result = await load(api.get<Page<FarmRow>>("/admin/farms", { ...filters, page, page_size: 25 }));

  return (
    <>
      <PageHeader title="Farms" description="Fields registered by farmers, with their water source and current crops." />
      <FilterBar action="/farms">
        <Input label="State" name="state" defaultValue={filters.state} placeholder="e.g. Karnataka" />
      </FilterBar>
      {result.data ? (
        <>
          <Table head={["Farmer", "Farm", "Area", "Soil", "Water", "Location", "Growing now"]} empty={!result.data.items.length}>
            {result.data.items.map((farm) => (
              <tr key={farm.id}>
                <Td className="font-medium">{farm.farmer_name || "—"}</Td>
                <Td>{farm.name || "—"}</Td>
                <Td className="tabular">{formatNumber(farm.area_acres, 2)} ac</Td>
                <Td className="capitalize">{farm.soil_type ?? "—"}</Td>
                <Td className="capitalize">{farm.irrigation}</Td>
                <Td>{[farm.district, farm.state].filter(Boolean).join(", ") || "—"}</Td>
                <Td>{farm.active_crops.length ? farm.active_crops.join(", ").replaceAll("_", " ") : "—"}</Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={25} total={result.data.total} basePath="/farms" params={filters} />
        </>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
