"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

type Row = Tables<"overall_leaderboard">;
type SortKey = "player_name" | "tables_played" | "total_buyin" | "total_cash_out" | "net" | "biggest_win";

const columns: { key: SortKey; label: string; money: boolean }[] = [
  { key: "player_name", label: "Player", money: false },
  { key: "tables_played", label: "Tables", money: false },
  { key: "total_buyin", label: "Buy-ins", money: true },
  { key: "total_cash_out", label: "Cash-outs", money: true },
  { key: "net", label: "Net", money: true },
  { key: "biggest_win", label: "Best win", money: true },
];

export function LeaderboardTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("net");
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("overall_leaderboard")
      .select("*")
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRows(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const dir = desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [rows, sortKey, desc]);

  function toggle(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(key !== "player_name");
    }
  }

  if (error) return <p role="alert" className="text-sm text-red-300">Could not load leaderboard: {error}</p>;
  if (!rows) return <p className="text-sm text-emerald-100/60">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-emerald-100/60">No closed tables yet.</p>;

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-felt-700 text-left text-emerald-100/70">
            {columns.map((c) => (
              <th key={c.key} className={`p-0 ${c.money || c.key === "tables_played" ? "text-right" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className="min-h-11 w-full px-3 font-medium hover:text-gold"
                  style={{ textAlign: c.key === "player_name" ? "left" : "right" }}
                >
                  {c.label}
                  {sortKey === c.key ? (desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.player_id} className="border-b border-felt-800 last:border-0">
              <td className="px-3 py-3 font-medium">{r.player_name}</td>
              <td className="px-3 py-3 text-right">{r.tables_played}</td>
              <td className="px-3 py-3 text-right">{formatMoney(r.total_buyin ?? 0)}</td>
              <td className="px-3 py-3 text-right">{formatMoney(r.total_cash_out ?? 0)}</td>
              <td
                className={`px-3 py-3 text-right font-semibold ${
                  (r.net ?? 0) > 0 ? "text-win" : (r.net ?? 0) < 0 ? "text-loss" : ""
                }`}
              >
                {formatSignedMoney(r.net ?? 0)}
              </td>
              <td className="px-3 py-3 text-right">{r.biggest_win === null ? "—" : formatMoney(r.biggest_win)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
