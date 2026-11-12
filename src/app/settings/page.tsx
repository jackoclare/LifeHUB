import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader section={findSection("/settings")} />
      <SettingsView />
    </>
  );
}
