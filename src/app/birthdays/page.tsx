import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { BirthdaysView } from "./BirthdaysView";

export const metadata = { title: "Birthdays" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/birthdays")} />
      <BirthdaysView />
    </>
  );
}
