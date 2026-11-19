import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { ParcelsView } from "./ParcelsView";

export const metadata = { title: "Parcels" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/parcels")} />
      <ParcelsView />
    </>
  );
}
