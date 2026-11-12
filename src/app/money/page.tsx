import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { MoneyView } from "./MoneyView";

export const metadata = { title: "Money" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/money")} />
      <MoneyView />
    </>
  );
}
