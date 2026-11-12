import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { DealsView } from "./DealsView";

export const metadata = { title: "Deals" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/deals")} />
      <DealsView />
    </>
  );
}
