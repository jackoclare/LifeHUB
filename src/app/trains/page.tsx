import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { TrainsView } from "./TrainsView";

export const metadata = { title: "Trains" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/trains")} />
      <TrainsView />
    </>
  );
}
