import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { ExploreView } from "./ExploreView";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <>
      <PageHeader section={findSection("/explore")} />
      <ExploreView />
    </>
  );
}
