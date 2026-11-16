import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { RentView } from "./RentView";

export const metadata = { title: "Homes to rent" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/rent")} />
      <RentView />
    </>
  );
}
