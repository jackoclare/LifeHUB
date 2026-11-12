import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "TV guide" };

export default function Page() {
  return (
    <ComingSoon
      href="/tv"
      plans={["Now, next and what's on tonight", "Major UK channels plus Sky and Sky Sports", "Search by channel or programme", "Favourite channels"]}
    />
  );
}
