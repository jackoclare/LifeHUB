import { PageHeader } from "@/components/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { findSection } from "@/lib/nav";
import { BillsView } from "./BillsView";

export const metadata = { title: "Bills" };

export default function BillsPage() {
  return (
    <>
      <PageHeader section={findSection("/bills")} />
      <RequireAuth reason="Sign in to keep your bills private and synced between your iPhone and computer.">
        <BillsView />
      </RequireAuth>
    </>
  );
}
