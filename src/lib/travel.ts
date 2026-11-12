export type Destination = { code: string; city: string; country: string; flag: string; lat: number; lon: number; region: "Spain" | "Portugal" | "France" | "Italy" | "Greece" | "Worldwide" };

/** Popular destinations (main airport). */
export const DESTINATIONS: Destination[] = [
  { code: "AGP", city: "Málaga", country: "Spain", flag: "🇪🇸", lat: 36.72, lon: -4.42, region: "Spain" },
  { code: "ALC", city: "Alicante / Benidorm", country: "Spain", flag: "🇪🇸", lat: 38.35, lon: -0.48, region: "Spain" },
  { code: "BCN", city: "Barcelona", country: "Spain", flag: "🇪🇸", lat: 41.39, lon: 2.17, region: "Spain" },
  { code: "MAD", city: "Madrid", country: "Spain", flag: "🇪🇸", lat: 40.42, lon: -3.7, region: "Spain" },
  { code: "PMI", city: "Majorca", country: "Spain", flag: "🇪🇸", lat: 39.57, lon: 2.65, region: "Spain" },
  { code: "IBZ", city: "Ibiza", country: "Spain", flag: "🇪🇸", lat: 38.91, lon: 1.43, region: "Spain" },
  { code: "TFS", city: "Tenerife", country: "Spain", flag: "🇪🇸", lat: 28.29, lon: -16.63, region: "Spain" },
  { code: "ACE", city: "Lanzarote", country: "Spain", flag: "🇪🇸", lat: 28.96, lon: -13.55, region: "Spain" },
  { code: "FAO", city: "Faro (Algarve)", country: "Portugal", flag: "🇵🇹", lat: 37.02, lon: -7.93, region: "Portugal" },
  { code: "LIS", city: "Lisbon", country: "Portugal", flag: "🇵🇹", lat: 38.72, lon: -9.14, region: "Portugal" },
  { code: "OPO", city: "Porto", country: "Portugal", flag: "🇵🇹", lat: 41.15, lon: -8.61, region: "Portugal" },
  { code: "FNC", city: "Madeira", country: "Portugal", flag: "🇵🇹", lat: 32.65, lon: -16.91, region: "Portugal" },
  { code: "CDG", city: "Paris", country: "France", flag: "🇫🇷", lat: 48.86, lon: 2.35, region: "France" },
  { code: "NCE", city: "Nice", country: "France", flag: "🇫🇷", lat: 43.7, lon: 7.27, region: "France" },
  { code: "BOD", city: "Bordeaux", country: "France", flag: "🇫🇷", lat: 44.84, lon: -0.58, region: "France" },
  { code: "FCO", city: "Rome", country: "Italy", flag: "🇮🇹", lat: 41.9, lon: 12.5, region: "Italy" },
  { code: "VCE", city: "Venice", country: "Italy", flag: "🇮🇹", lat: 45.44, lon: 12.33, region: "Italy" },
  { code: "MXP", city: "Milan / Lakes", country: "Italy", flag: "🇮🇹", lat: 45.46, lon: 9.19, region: "Italy" },
  { code: "NAP", city: "Naples / Amalfi", country: "Italy", flag: "🇮🇹", lat: 40.85, lon: 14.27, region: "Italy" },
  { code: "PSA", city: "Pisa / Tuscany", country: "Italy", flag: "🇮🇹", lat: 43.72, lon: 10.4, region: "Italy" },
  { code: "ATH", city: "Athens", country: "Greece", flag: "🇬🇷", lat: 37.98, lon: 23.73, region: "Greece" },
  { code: "CFU", city: "Corfu", country: "Greece", flag: "🇬🇷", lat: 39.62, lon: 19.92, region: "Greece" },
  { code: "HER", city: "Crete (Heraklion)", country: "Greece", flag: "🇬🇷", lat: 35.34, lon: 25.13, region: "Greece" },
  { code: "RHO", city: "Rhodes", country: "Greece", flag: "🇬🇷", lat: 36.43, lon: 28.22, region: "Greece" },
  { code: "ZTH", city: "Zante", country: "Greece", flag: "🇬🇷", lat: 37.78, lon: 20.9, region: "Greece" },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", flag: "🇳🇱", lat: 52.37, lon: 4.9, region: "Worldwide" },
  { code: "DBV", city: "Dubrovnik", country: "Croatia", flag: "🇭🇷", lat: 42.65, lon: 18.09, region: "Worldwide" },
  { code: "AYT", city: "Antalya", country: "Türkiye", flag: "🇹🇷", lat: 36.9, lon: 30.71, region: "Worldwide" },
  { code: "DXB", city: "Dubai", country: "UAE", flag: "🇦🇪", lat: 25.2, lon: 55.27, region: "Worldwide" },
  { code: "JFK", city: "New York", country: "USA", flag: "🇺🇸", lat: 40.71, lon: -74.01, region: "Worldwide" },
  { code: "MCO", city: "Orlando", country: "USA", flag: "🇺🇸", lat: 28.54, lon: -81.38, region: "Worldwide" },
];

export const UK_AIRPORTS = [
  { code: "BHX", name: "Birmingham" },
  { code: "EMA", name: "East Midlands" },
  { code: "MAN", name: "Manchester" },
  { code: "BRS", name: "Bristol" },
  { code: "LHR", name: "London Heathrow" },
  { code: "LGW", name: "London Gatwick" },
  { code: "STN", name: "London Stansted" },
  { code: "LTN", name: "London Luton" },
  { code: "LPL", name: "Liverpool" },
  { code: "LBA", name: "Leeds Bradford" },
  { code: "NCL", name: "Newcastle" },
  { code: "EDI", name: "Edinburgh" },
  { code: "GLA", name: "Glasgow" },
];

const yymmdd = (iso: string) => iso.slice(2).replaceAll("-", "");

/** Deep links to real search pages — prices come from those sites, never from us. */
export function searchLinks(from: string, d: Destination, out: string, back: string | null, adults: number) {
  const fromName = UK_AIRPORTS.find((a) => a.code === from)?.name ?? from;
  const city = d.city.split(" (")[0].split(" / ")[0];
  return {
    skyscanner: `https://www.skyscanner.net/transport/flights/${from.toLowerCase()}/${d.code.toLowerCase()}/${yymmdd(out)}/${back ? `${yymmdd(back)}/` : ""}?adultsv2=${adults}&cabinclass=economy&rtn=${back ? 1 : 0}`,
    google: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${d.code} on ${out}${back ? ` returning ${back}` : " one way"} for ${adults} adults`)}`,
    hotels: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${city}, ${d.country}`)}&checkin=${out}&checkout=${back ?? out}&group_adults=${adults}&no_rooms=1`,
    holidays: `https://www.google.com/search?q=${encodeURIComponent(`package holidays to ${city} from ${fromName} ${new Date(out).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`)}`,
  };
}
