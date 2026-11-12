import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Fuel" };

export default function Page() {
  return (
    <ComingSoon
      href="/fuel"
      plans={["UK map of petrol stations", "Unleaded, diesel and premium prices", "Cheapest and nearest, by postcode or town", "Last-updated time on every price"]}
    />
  );
}
