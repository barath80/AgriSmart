import type { Metadata } from "next";
import { randomUUID } from "node:crypto";

import { sendNotification } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Badge, Card, ErrorPanel, formatDate, Input, PageHeader, Select, Table, Td, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { load } from "@/lib/load";
import type { NotificationRow } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

const CATEGORIES = ["weather", "scheme", "calendar", "market", "disease", "emergency"];

export default async function NotificationsPage() {
  const result = await load(api.get<NotificationRow[]>("/admin/notifications"));
  return (
    <>
      <PageHeader title="Notifications"
                  description="Send targeted alerts. App users get a push notification; button-phone users get an SMS. Farmers who turned a category off are skipped, except emergencies." />

      <Card title="New notification" className="mb-6">
        <ActionForm action={sendNotification} submitLabel="Send" className="space-y-4">
          {/* A fresh key per page render makes double submits harmless. */}
          <input type="hidden" name="idempotency_key" value={`admin-${randomUUID()}`} />
          <div className="grid gap-3 md:grid-cols-4">
            <Select label="Category" name="category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <Input label="States (comma separated, blank = all)" name="states" />
            <Input label="Districts" name="districts" />
            <Input label="Growing crops (slugs)" name="crops" placeholder="rice, cotton" />
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 text-xs font-medium text-ink-2">Only farmers using these languages (none ticked = all)</legend>
            {LANGUAGES.map((l) => (
              <label key={l.code} className="flex items-center gap-1.5"><input type="checkbox" name="languages" value={l.code} /> {l.name}</label>
            ))}
          </fieldset>
          <div className="grid gap-4 lg:grid-cols-2">
            {LANGUAGES.map((l) => (
              <fieldset key={l.code} className="space-y-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-medium text-ink-2">{l.name}{l.code === "en" ? " (required — fallback)" : ""}</legend>
                <Input label="Title" name={`title:${l.code}`} required={l.code === "en"} maxLength={120} />
                <TextArea label="Message" name={`body:${l.code}`} required={l.code === "en"} maxLength={1000} rows={2} />
              </fieldset>
            ))}
          </div>
        </ActionForm>
      </Card>

      {result.data ? (
        <Table head={["Sent", "Category", "Title", "Target", "Recipients", "Delivered", "Failed", "Pending"]} empty={!result.data.length}>
          {result.data.map((n) => (
            <tr key={n.id}>
              <Td className="text-ink-2">{formatDate(n.created_at)}</Td>
              <Td><Badge tone={n.category === "emergency" ? "critical" : "neutral"}>{n.category}</Badge></Td>
              <Td>{n.title.en}</Td>
              <Td className="text-xs text-ink-2">
                {[n.target.states?.join(", "), n.target.districts?.join(", "), n.target.crops?.join(", ")].filter(Boolean).join(" · ") || "Everyone"}
              </Td>
              <Td className="tabular">{n.recipients}</Td>
              <Td className="tabular">{n.sent}</Td>
              <Td className="tabular">{n.failed ? <Badge tone="critical">{n.failed}</Badge> : 0}</Td>
              <Td className="tabular">{n.pending}</Td>
            </tr>
          ))}
        </Table>
      ) : (
        <ErrorPanel message={result.error} />
      )}
    </>
  );
}
