import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { AiChat } from "./AiChat";

export const metadata = { title: "AI" };

export default function AiPage() {
  return (
    <>
      <PageHeader section={findSection("/ai")} />
      <AiChat />
    </>
  );
}
