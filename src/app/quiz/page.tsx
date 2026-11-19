import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { QuizView } from "./QuizView";

export const metadata = { title: "Daily quiz" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/quiz")} />
      <QuizView />
    </>
  );
}
