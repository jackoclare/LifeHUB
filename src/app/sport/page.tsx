import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Sport" };

export default function Page() {
  return (
    <ComingSoon
      href="/sport"
      plans={["Live scores, fixtures, results and tables", "Premier League down to National League, plus Europe's top leagues", "Favourite teams — Aston Villa and England matches on your calendar", "Team pages and match stats where available"]}
    />
  );
}
