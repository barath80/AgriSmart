import type { Metadata } from "next";

import { KnowledgeList } from "@/components/KnowledgeList";

export const metadata: Metadata = { title: "Diseases" };

export default function DiseasesPage() {
  return <KnowledgeList kind="diseases" title="Disease knowledge" />;
}
