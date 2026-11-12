import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { HomeView } from "./HomeView";

export const metadata = { title: "Household" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/home")} />
      <HomeView />
    </>
  );
}
