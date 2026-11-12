import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Wish list" };

export default function Page() {
  return (
    <ComingSoon
      href="/wishlist"
      plans={["Image, retailer, link, priority and notes", "Current price vs your target price", "Price history where available", "Alerts when an item gets cheaper"]}
    />
  );
}
