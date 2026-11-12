import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { MealsView } from "./MealsView";

export const metadata = { title: "Meals" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/meals")} />
      <MealsView />
    </>
  );
}
