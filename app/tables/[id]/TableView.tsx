"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";
import { CashOutInput } from "./CashOutInput";

type GameTable = Tables<"game_tables">;
type Player = Tables<"players">;
type SummaryRow = Tables<"table_player_summary">;

function netOf(row: SummaryRow): number | null {
  return row.cash_out === null ? null : row.cash_out - (row.total_buyin ?? 0);
}

function NetText({ net }: { net: number | null }) {
  if (net === null) return <span className="text-emerald-100/50">—</span>;
  const cls = net > 0 ? "text-win" : net < 0 ? "text-loss" : "";
  return <span className={`font-semibold ${cls}`}>{formatSignedMoney(net)}</span>;
}

export function TableView({ tableId }: { tableId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [table, setTable] = useState<GameTable | null>(null);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SummaryRow | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [t, s, p] = await Promise.all([
      supabase.from("game_tables").select("*").eq("id", tableId).maybeSingle(),
      supabase
        .from("table_player_summary")
        .select("*")
        .eq("table_id", tableId)
        .order("joined_at", { ascending: true }),
      supabase.from("players").select("*").eq("is_archived", false).order("name"),
    ]);
    const err = t.error ?? s.error ?? p.error;
    if (err) {
      setLoadError(err.message);
    } else if (!t.data) {
      setLoadError("Table not found");
    } else {
      setLoadError(null);
      setTable(t.data);
      setRows(s.data ?? []);
      setRoster(p.data ?? []);
    }
    setLoaded(true);
  }, [supabase, tableId]);

  const scheduleLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(), 300);
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const channel = supabase
      .channel(`table-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_players" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "buyin_transactions" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_tables" }, scheduleLoad)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, tableId, load, scheduleLoad]);

  const isOpen = table?.status === "open";
  const buyIn = table?.buy_in_amount ?? 0;

  const seatedIds = new Set(rows.map((r) => r.player_id));
  const available = roster.filter((p) => !seatedIds.has(p.id));

  const pot = rows.reduce((sum, r) => sum + (r.total_buyin ?? 0), 0);
  const cashOutTotal = rows.reduce((sum, r) => sum + (r.cash_out ?? 0), 0);
  const allCashedOut = rows.length > 0 && rows.every((r) => r.cash_out !== null);
  const difference = cashOutTotal - pot;
  const mismatch = allCashedOut && difference !== 0;
  const pending = rows.filter((r) => r.cash_out === null).length;

  const ranked = [...rows].sort((a, b) => (netOf(b) ?? -Infinity) - (netOf(a) ?? -Infinity));

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await load();
    return true;
  }

  async function seat(playerId: string) {
    await run(() => supabase.rpc("seat_player", { p_table_id: tableId, p_player_id: playerId }));
  }

  async function addAndSeat(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (await run(() => supabase.rpc("add_and_seat_player", { p_table_id: tableId, p_name: newName }))) {
      setNewName("");
    }
  }

  async function changeBuyin(row: SummaryRow, direction: 1 | -1) {
    if (!row.table_player_id) return;
    const previous = rows;
    setRows((cur) =>
      cur.map((r) => {
        if (r.table_player_id !== row.table_player_id) return r;
        const total = (r.total_buyin ?? 0) + direction * buyIn;
        return {
          ...r,
          total_buyin: total,
          buyin_count: (r.buyin_count ?? 0) + direction,
          net: r.cash_out === null ? null : r.cash_out - total,
        };
      }),
    );
    const { error } = await supabase.rpc("change_buyin", {
      p_table_player_id: row.table_player_id,
      p_direction: direction,
    });
    if (error) {
      setRows(previous);
      toast.error(error.message);
      return;
    }
    await load();
  }

  async function saveCashOut(row: SummaryRow, amount: number | null) {
    if (!row.table_player_id) return;
    const id = row.table_player_id;
    await run(() => supabase.rpc("set_cash_out", { p_table_player_id: id, p_amount: amount }));
  }

  async function confirmRemove() {
    const target = removeTarget;
    setRemoveTarget(null);
    if (!target?.table_player_id) return;
    const id = target.table_player_id;
    await run(() => supabase.rpc("remove_table_player", { p_table_player_id: id }));
  }

  async function closeTable() {
    setConfirmClose(false);
    if (await run(() => supabase.rpc("close_table", { p_table_id: tableId }))) {
      toast.success("Table closed");
    }
  }

  async function reopenTable() {
    await run(() => supabase.rpc("reopen_table", { p_table_id: tableId }));
  }

  if (!loaded) return <p className="text-sm text-emerald-100/60">Loading…</p>;
  if (loadError || !table) {
    return <p role="alert" className="text-sm text-red-300">{loadError ?? "Table not found"}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{table.name}</h1>
          <p className="text-sm text-emerald-100/60">
            Buy-in {formatMoney(buyIn)} · {isOpen ? "Open" : "Closed"}
          </p>
        </div>
        {isOpen ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirmClose(true)}>
            Close table
          </button>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={() => void reopenTable()}>
            Reopen
          </button>
        )}
      </div>

      <section className="card space-y-2">
        <div className="flex justify-between text-sm">
          <span>Total pot</span>
          <span className="font-semibold text-gold">{formatMoney(pot)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total cash-out</span>
          <span className="font-semibold">{formatMoney(cashOutTotal)}</span>
        </div>
        {mismatch && (
          <p role="alert" className="rounded-lg border border-amber-500/60 bg-amber-950 p-2 text-sm text-amber-200">
            Mismatch: cash-outs are {formatMoney(Math.abs(difference))} {difference > 0 ? "more" : "less"} than
            the pot.
          </p>
        )}
        {!mismatch && pending > 0 && rows.length > 0 && (
          <p className="text-xs text-emerald-100/60">
            {pending} cash-out{pending === 1 ? "" : "s"} pending
          </p>
        )}
      </section>

      {isOpen && (
        <section className="space-y-2">
          <h2 className="font-semibold">Add players</h2>
          {available.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {available.map((p) => (
                <button key={p.id} type="button" className="chip" disabled={busy} onClick={() => void seat(p.id)}>
                  + {p.name}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={addAndSeat} className="flex gap-2">
            <input
              className="input"
              placeholder="Add new player"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn" disabled={busy || !newName.trim()}>
              Add
            </button>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Seated ({rows.length})</h2>
        {rows.length === 0 && <p className="text-sm text-emerald-100/60">No players yet.</p>}
        <ul className="space-y-2">
          {rows.map((r) => {
            const count = r.buyin_count ?? 0;
            const canRemove = isOpen && count === 1 && r.cash_out === null;
            return (
              <li key={r.table_player_id} className="card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.player_name}</span>
                  <span className="text-sm text-emerald-100/70">
                    {count} buy-in{count === 1 ? "" : "s"} · {formatMoney(r.total_buyin ?? 0)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOpen && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Remove a buy-in for ${r.player_name}`}
                        disabled={count <= 1}
                        onClick={() => void changeBuyin(r, -1)}
                      >
                        − Buy-in
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`Add a buy-in for ${r.player_name}`}
                        onClick={() => void changeBuyin(r, 1)}
                      >
                        + Buy-in
                      </button>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {isOpen ? (
                      <CashOutInput
                        key={`${r.table_player_id}-${r.cash_out}`}
                        value={r.cash_out}
                        label={`Cash-out for ${r.player_name}`}
                        onSave={(amount) => void saveCashOut(r, amount)}
                      />
                    ) : (
                      <span className="text-sm">Out: {r.cash_out === null ? "—" : formatMoney(r.cash_out)}</span>
                    )}
                    <NetText net={netOf(r)} />
                  </div>
                </div>
                {canRemove && (
                  <button type="button" className="btn btn-danger" onClick={() => setRemoveTarget(r)}>
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {rows.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Table leaderboard</h2>
          <ol className="card divide-y divide-felt-800 p-0">
            {ranked.map((r, i) => (
              <li key={r.table_player_id} className="flex min-h-11 items-center justify-between px-4 py-2 text-sm">
                <span>
                  {i + 1}. {r.player_name}
                </span>
                <NetText net={netOf(r)} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove player?"
        confirmLabel="Remove"
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      >
        <p>{removeTarget?.player_name} will be removed from this table.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmClose}
        title="Close table?"
        confirmLabel="Close table"
        onConfirm={() => void closeTable()}
        onCancel={() => setConfirmClose(false)}
      >
        <p>Results will be added to the leaderboard. You can reopen the table later.</p>
        {mismatch && (
          <p className="rounded-lg border border-amber-500/60 bg-amber-950 p-2 text-amber-200">
            Warning: cash-outs are {formatMoney(Math.abs(difference))} {difference > 0 ? "more" : "less"} than the
            pot.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
