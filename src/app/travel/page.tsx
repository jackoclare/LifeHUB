import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { TravelView } from "./TravelView";

export const metadata = { title: "Travel" };

export default function TravelPage() {
  return (
    <>
      <PageHeader section={findSection("/travel")} subtitle="Pick a destination, check the weather and search flights, hotels and holidays." />
      <TravelView />
    </>
  );
}
