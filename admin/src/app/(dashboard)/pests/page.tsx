import type { Metadata } from "next";

import { KnowledgeList } from "@/components/KnowledgeList";

export const metadata: Metadata = { title: "Pests" };

export default function PestsPage() {
  return <KnowledgeList kind="pests" title="Pest knowledge" />;
}
