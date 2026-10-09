"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <div className="card mx-auto mt-6 max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Host sign in</h1>
      {sent ? (
        <p className="text-sm text-emerald-100/80">
          Check your inbox for a sign-in link sent to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}
      {sent && error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
