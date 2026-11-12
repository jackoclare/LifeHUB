import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Shopping list" };

export default function Page() {
  return (
    <ComingSoon
      href="/shopping"
      plans={["Multiple lists (e.g. Tesco weekly, Aldi top-up)", "Big tick-off buttons for one-handed use in the shop", "Quantities, categories and estimated prices", "Running estimated total", "Frequently bought items for quick adding"]}
    />
  );
}
