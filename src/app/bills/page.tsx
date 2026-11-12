import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Bills" };

export default function Page() {
  return (
    <ComingSoon
      href="/bills"
      plans={["Add and edit bills, provider and amount", "Weekly, monthly, annual or custom repeats", "Mark as paid and see overdue bills", "Monthly and annual totals with charts", "Spreadsheet-style view that works on a phone", "Every due date shown on your calendar"]}
    />
  );
}
