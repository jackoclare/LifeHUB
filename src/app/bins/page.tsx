import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { BinsView } from "./BinsView";

export const metadata = { title: "Bin day" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/bins")} />
      <BinsView />
    </>
  );
}
