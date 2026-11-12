import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { AlertsView } from "./AlertsView";

export const metadata = { title: "Alerts" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/alerts")} />
      <AlertsView />
    </>
  );
}
