import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type TableListItem = Tables<"game_tables"> & { playerCount: number; pot: number };

export async function loadTableList(
  status: "open" | "closed",
): Promise<{ items: TableListItem[]; error: string | null }> {
  const supabase = await createClient();
  const { data: tables, error } = await supabase
    .from("game_tables")
    .select("*")
    .eq("status", status)
    .order(status === "open" ? "created_at" : "closed_at", { ascending: false });
  if (error) return { items: [], error: error.message };
  if (tables.length === 0) return { items: [], error: null };

  const { data: rows, error: summaryError } = await supabase
    .from("table_player_summary")
    .select("table_id, total_buyin")
    .in(
      "table_id",
      tables.map((t) => t.id),
    );
  if (summaryError) return { items: [], error: summaryError.message };

  const stats = new Map<string, { playerCount: number; pot: number }>();
  for (const r of rows) {
    if (!r.table_id) continue;
    const s = stats.get(r.table_id) ?? { playerCount: 0, pot: 0 };
    s.playerCount += 1;
    s.pot += r.total_buyin ?? 0;
    stats.set(r.table_id, s);
  }
  return {
    items: tables.map((t) => ({ ...t, ...(stats.get(t.id) ?? { playerCount: 0, pot: 0 }) })),
    error: null,
  };
}
