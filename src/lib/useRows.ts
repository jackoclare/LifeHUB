"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

type Order = { column: string; ascending?: boolean };

/**
 * Loads rows from a table for the signed-in user (RLS does the filtering)
 * and gives back a reload function to call after any change.
 */
export function useRows<T>(table: string, order: Order[] = [], enabled = true) {
  const { user } = useAuth();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orderKey = JSON.stringify(order);

  const reload = useCallback(async () => {
    if (!user || !enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    let q = createClient().from(table).select("*");
    for (const o of JSON.parse(orderKey) as Order[]) q = q.order(o.column, { ascending: o.ascending ?? true });
    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data ?? []) as T[]);
    }
    setLoading(false);
  }, [user, table, orderKey, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, setRows, loading, error, reload };
}

/** Runs a Supabase write and returns an error message (or null). */
export async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await fn();
  return error ? error.message : null;
}
