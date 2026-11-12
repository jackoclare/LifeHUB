"use client";

import { Sunrise, Sunset } from "lucide-react";
import { PlacePicker, WeatherSummary, WeekForecast } from "@/components/weather/WeatherWidgets";
import { usePlace, useWeather } from "@/lib/weather";

export function WeatherView() {
  const { place } = usePlace();
  const { data } = useWeather(place);
  const today = data?.daily[0];
  const t = (iso?: string) => (iso ? iso.slice(11, 16) : "--:--");

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="card p-5">
        <WeatherSummary />
        {today && (
          <div className="mt-4 flex gap-4 border-t border-line pt-3 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Sunrise size={16} className="text-[#fbbf24]" /> {t(today.sunrise)}
            </span>
            <span className="flex items-center gap-1.5">
              <Sunset size={16} className="text-[#f97316]" /> {t(today.sunset)}
            </span>
          </div>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Next 7 days</h2>
        {place ? <WeekForecast /> : <PlacePicker />}
      </section>
      <p className="text-xs text-faint lg:col-span-2">Forecast data from Open-Meteo (open-meteo.com), updated every 15 minutes.</p>
    </div>
  );
}
