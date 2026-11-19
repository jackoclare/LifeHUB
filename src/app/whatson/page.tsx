import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { WhatsOnView } from "./WhatsOnView";

export const metadata = { title: "What's on" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/whatson")} />
      <WhatsOnView />
    </>
  );
}
