import type { Metadata } from "next";
import Link from "next/link";

import { Badge, ErrorPanel, formatDate, PageHeader, Table, Td } from "@/components/ui";
import { api } from "@/lib/api";
import { load, one } from "@/lib/load";
import type { SupportThreadPage } from "@/lib/types";

export const metadata: Metadata = { title: "Support inbox" };

export default async function SupportInbox(props: PageProps<"/support">) {
  const params = await props.searchParams;
  const onlyAwaiting = one(params.filter) === "awaiting";
  const result = await load(api.get<SupportThreadPage>("/admin/support/threads", { only_awaiting: onlyAwaiting }));

  return (
    <>
      <PageHeader
        title="Support inbox"
        description="Messages farmers send from the app. Open a conversation to reply and to see that farmer's questions, photo diagnoses and calls."
        actions={
          <Link href={onlyAwaiting ? "/support" : "/support?filter=awaiting"} className="text-sm text-info hover:underline">
            {onlyAwaiting ? "Show all" : "Show only waiting for a reply"}
          </Link>
        }
      />
      {result.data ? (
        <>
          <p className="mb-3 text-sm text-ink-2">{result.data.awaiting} waiting for a reply</p>
          <Table head={["Farmer", "Language", "Last message", "When", "Status"]} empty={!result.data.items.length}>
            {result.data.items.map((t) => (
              <tr key={t.farmer_id}>
                <Td>
                  <Link href={`/support/${t.farmer_id}`} className="font-medium text-info hover:underline">{t.name || "Unnamed farmer"}</Link>
                  <p className="tabular text-xs text-ink-3">{t.phone}</p>
                </Td>
                <Td>{t.language.toUpperCase()}</Td>
                <Td className="max-w-md truncate text-ink-2">{t.last_sender === "admin" ? "You: " : ""}{t.last_message}</Td>
                <Td className="text-ink-2">{formatDate(t.last_at)}</Td>
                <Td><Badge tone={t.awaiting_reply ? "warning" : "good"}>{t.awaiting_reply ? "Needs reply" : "Answered"}</Badge></Td>
              </tr>
            ))}
          </Table>
        </>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
