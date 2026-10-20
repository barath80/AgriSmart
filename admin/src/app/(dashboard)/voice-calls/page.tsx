import type { Metadata } from "next";

import { Badge, ErrorPanel, FilterBar, formatDate, PageHeader, Pagination, Select, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load, one } from "@/lib/load";
import type { Page, VoiceSessionRow } from "@/lib/types";

export const metadata: Metadata = { title: "Voice calls" };

const duration = (seconds: number | null) =>
  seconds === null ? "In progress" : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;

export default async function VoiceCallsPage(props: PageProps<"/voice-calls">) {
  const params = await props.searchParams;
  const filters = { channel: one(params.channel) };
  const page = Number(one(params.page) ?? 1) || 1;
  const result = await load(api.get<Page<VoiceSessionRow>>("/admin/voice-sessions", { ...filters, page, page_size: 25 }));

  return (
    <>
      <PageHeader title="Voice sessions" description="App voice conversations and calls to the AgriSmart phone number." />
      <FilterBar action="/voice-calls">
        <Select label="Channel" name="channel" defaultValue={filters.channel ?? ""}
                options={[{ value: "", label: "All" }, { value: "phone", label: "Button phone" }, { value: "app", label: "App" }]} />
      </FilterBar>
      {result.data ? (
        <>
          <Table head={["Started", "Farmer", "Channel", "Language", "Provider", "Duration", "Turns", "Ended"]} empty={!result.data.items.length}>
            {result.data.items.map((s) => (
              <tr key={s.id}>
                <Td className="text-ink-2">{formatDate(s.started_at)}</Td>
                <Td>{s.farmer_name || "Unknown caller"}</Td>
                <Td>{s.channel === "phone" ? "Phone call" : "App"}</Td>
                <Td>{s.language.toUpperCase()}</Td>
                <Td>{s.provider}</Td>
                <Td className="tabular">{duration(s.duration_seconds)}</Td>
                <Td className="tabular">{s.turns}</Td>
                <Td>
                  {s.end_reason ? (
                    <Badge tone={s.end_reason === "time_limit" ? "warning" : "neutral"}>{s.end_reason.replaceAll("_", " ")}</Badge>
                  ) : "—"}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={25} total={result.data.total} basePath="/voice-calls" params={filters} />
        </>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
