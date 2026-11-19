import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { HabitsView } from "./HabitsView";

export const metadata = { title: "Habits" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/habits")} />
      <HabitsView />
    </>
  );
}
