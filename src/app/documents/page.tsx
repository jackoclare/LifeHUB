import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { DocumentsView } from "./DocumentsView";

export const metadata = { title: "Documents" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/documents")} />
      <DocumentsView />
    </>
  );
}
