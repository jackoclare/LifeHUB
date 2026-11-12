import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Travel" };

export default function Page() {
  return (
    <ComingSoon
      href="/travel"
      plans={["Interactive map — Spain, France, Italy, Greece, Portugal first", "Ten cheapest real options per search", "Flexible dates and trip lengths", "Saved destinations and price alerts", "Booked trips added to your calendar"]}
    />
  );
}
