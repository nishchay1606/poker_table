"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

type Player = Tables<"players">;

export function PlayersManager() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("players").select("*").order("name");
    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setPlayers(data);
    }
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.rpc("create_player", { p_name: newName });
    setAdding(false);
    if (error) return toast.error(error.message);
    setNewName("");
    await load();
  }

  async function saveRename(id: string) {
    const { error } = await supabase.rpc("rename_player", { p_player_id: id, p_name: editName });
    if (error) return toast.error(error.message);
    setEditingId(null);
    await load();
  }

  async function setArchived(id: string, archived: boolean) {
    const { error } = await supabase.rpc("set_player_archived", {
      p_player_id: id,
      p_archived: archived,
    });
    if (error) return toast.error(error.message);
    await load();
  }

  const visible = (players ?? []).filter(
    (p) =>
      (showArchived || !p.is_archived) && p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Players</h1>
      <form onSubmit={addPlayer} className="flex gap-2">
        <input
          className="input"
          placeholder="New player name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
          Add
        </button>
      </form>
      <input
        className="input"
        type="search"
        placeholder="Search players"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>
      {loadError && <p role="alert" className="text-sm text-red-300">{loadError}</p>}
      {!players && !loadError && <p className="text-sm text-emerald-100/60">Loading…</p>}
      {players && visible.length === 0 && <p className="text-sm text-emerald-100/60">No players found.</p>}
      <ul className="space-y-2">
        {visible.map((p) => (
          <li key={p.id} className="card flex items-center gap-2">
            {editingId === p.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveRename(p.id);
                }}
              >
                <input
                  className="input"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className={`flex-1 truncate ${p.is_archived ? "text-emerald-100/50 line-through" : ""}`}>
                  {p.name}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditingId(p.id);
                    setEditName(p.name);
                  }}
                >
                  Rename
                </button>
                <button type="button" className="btn" onClick={() => void setArchived(p.id, !p.is_archived)}>
                  {p.is_archived ? "Unarchive" : "Archive"}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
