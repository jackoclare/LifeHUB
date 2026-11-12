import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Health" };

export default function Page() {
  return (
    <ComingSoon
      href="/health"
      plans={["Native iPhone companion app reading Apple Health (HealthKit)", "Steps, distance, active calories and workouts from your Apple Watch", "Food diary: photo, search, barcode or type it in", "AI meal estimates you check and correct before saving", "Calories, macros, water and optional weight"]}
    />
  );
}
