import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { HealthView } from "./HealthView";

export const metadata = { title: "Health" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/health")} />
      <HealthView />
    </>
  );
}
