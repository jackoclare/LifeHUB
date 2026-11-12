import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { SportView } from "./SportView";

export const metadata = { title: "Sport" };

export default function SportPage() {
  return (
    <>
      <PageHeader section={findSection("/sport")} />
      <SportView />
    </>
  );
}
