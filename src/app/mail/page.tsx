import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { MailView } from "./MailView";

export const metadata = { title: "Email" };

export default function Page() {
  return (
    <>
      <PageHeader section={findSection("/mail")} />
      <MailView />
    </>
  );
}
