import { PageHeader } from "@/components/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { findSection } from "@/lib/nav";
import { ShoppingView } from "./ShoppingView";

export const metadata = { title: "Shopping list" };

export default function ShoppingPage() {
  return (
    <>
      <PageHeader section={findSection("/shopping")} />
      <RequireAuth reason="Sign in so your shopping lists sync between your phone and computer.">
        <ShoppingView />
      </RequireAuth>
    </>
  );
}
