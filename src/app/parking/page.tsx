import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { ParkingView } from "./ParkingView";

export const metadata = { title: "Parking" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/parking")} />
      <ParkingView />
    </>
  );
}
