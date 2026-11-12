import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { MapHub } from "./MapHub";

export const metadata = { title: "Map" };

export default function MapPage() {
  return (
    <>
      <PageHeader section={findSection("/map")} />
      <MapHub />
    </>
  );
}
