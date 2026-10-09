"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";

export function NewTableForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const [buyIn, setBuyIn] = useState("500");
  const [busy, setBusy] = useState(false);

  const buyInValue = /^\d+$/.test(buyIn) ? Number(buyIn) : 0;
  const valid = name.trim().length > 0 && buyInValue > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_table", {
      p_name: name.trim(),
      p_buy_in_amount: buyInValue,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    router.push(`/tables/${data}`);
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New table</h1>
      <label className="block space-y-1 text-sm">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Buy-in amount (₹)</span>
        <input
          className="input"
          inputMode="numeric"
          value={buyIn}
          onChange={(e) => setBuyIn(e.target.value.replace(/\D/g, ""))}
          required
        />
      </label>
      <button type="submit" className="btn btn-primary w-full" disabled={!valid || busy}>
        {busy ? "Creating…" : "Create table"}
      </button>
    </form>
  );
}
