import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Deals" };

export default function Page() {
  return (
    <ComingSoon
      href="/deals"
      plans={["Fashion, tech, home and food categories", "Only verified deals, with 'last checked' times", "Original price, sale price and % saving", "Matches against your wish list"]}
    />
  );
}
