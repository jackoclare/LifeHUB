import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Explore" };

export default function Page() {
  return (
    <ComingSoon
      href="/explore"
      plans={["Restaurants, pubs, cafes and attractions", "Days out, activities and events", "Opening hours, price filters and directions", "Saved places"]}
    />
  );
}
