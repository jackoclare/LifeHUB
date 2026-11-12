import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { FuelView } from "./FuelView";

export const metadata = { title: "Fuel" };

export default function FuelPage() {
  return (
    <>
      <PageHeader section={findSection("/fuel")} />
      <FuelView />
    </>
  );
}
