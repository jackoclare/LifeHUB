import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { NewsView } from "./NewsView";

export const metadata = { title: "News" };

export default function NewsPage() {
  return (
    <>
      <PageHeader section={findSection("/news")} />
      <NewsView />
    </>
  );
}
