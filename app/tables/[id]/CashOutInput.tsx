"use client";

import { useState } from "react";

export function CashOutInput({
  value,
  onSave,
  label,
}: {
  value: number | null;
  onSave: (amount: number | null) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== value) onSave(next);
  }

  return (
    <input
      className="input w-28 text-right"
      inputMode="numeric"
      aria-label={label}
      placeholder="₹ out"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
