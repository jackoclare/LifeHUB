export type Frequency = "weekly" | "fortnightly" | "four_weekly" | "monthly" | "quarterly" | "six_monthly" | "annually" | "one_off";

export type Bill = {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  category: string;
  amount: number;
  frequency: Frequency;
  next_due_date: string; // YYYY-MM-DD
  is_active: boolean;
  notes: string | null;
  account_ref: string | null;
  website: string | null;
  created_at: string;
};

export type BillPayment = {
  id: string;
  bill_id: string;
  due_date: string;
  amount: number;
  paid_at: string;
};

export type DbCalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  kind: "personal" | "reminder" | "travel" | "football";
  notes: string | null;
};

export type ShoppingList = { id: string; name: string; store: string | null; created_at: string };

export type ShoppingItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  category: string;
  est_price: number | null;
  checked: boolean;
  created_at: string;
};

export type WishlistItem = {
  id: string;
  name: string;
  retailer: string | null;
  url: string | null;
  image_url: string | null;
  current_price: number | null;
  target_price: number | null;
  priority: 1 | 2 | 3;
  notes: string | null;
  purchased: boolean;
  created_at: string;
};

export type WishlistPrice = { id: string; item_id: string; price: number; recorded_at: string };
