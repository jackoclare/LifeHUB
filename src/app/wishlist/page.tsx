import { PageHeader } from "@/components/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { findSection } from "@/lib/nav";
import { WishlistView } from "./WishlistView";

export const metadata = { title: "Wish list" };

export default function WishlistPage() {
  return (
    <>
      <PageHeader section={findSection("/wishlist")} />
      <RequireAuth reason="Sign in to save your wish list.">
        <WishlistView />
      </RequireAuth>
    </>
  );
}
