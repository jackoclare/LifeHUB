import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { WarrantiesView } from "./WarrantiesView";

export const metadata = { title: "Warranties & returns" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/warranties")} />
      <WarrantiesView />
    </>
  );
}
