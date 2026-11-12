import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { CalendarView } from "./CalendarView";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader section={findSection("/calendar")} />
      <CalendarView />
    </>
  );
}
