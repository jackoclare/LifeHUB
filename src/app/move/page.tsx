import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { MoveView } from "./MoveView";

export const metadata = { title: "Walk & run" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/move")} />
      <Suspense>
        <MoveView />
      </Suspense>
    </>
  );
}
