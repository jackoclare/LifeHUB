import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";
import { WeatherView } from "./WeatherView";

export const metadata = { title: "Weather" };

export default function WeatherPage() {
  return (
    <>
      <PageHeader section={findSection("/weather")} />
      <WeatherView />
    </>
  );
}
