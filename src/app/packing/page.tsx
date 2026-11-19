import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { PackingView } from "./PackingView";

export const metadata = { title: "Packing lists" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/packing")} />
      <PackingView />
    </>
  );
}
