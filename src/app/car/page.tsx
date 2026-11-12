import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { CarView } from "./CarView";

export const metadata = { title: "Car" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/car")} />
      <CarView />
    </>
  );
}
