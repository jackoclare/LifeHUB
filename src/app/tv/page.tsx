import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { TvView } from "./TvView";

export const metadata = { title: "TV guide" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/tv")} />
      <TvView />
    </>
  );
}
