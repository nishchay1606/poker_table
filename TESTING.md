# Manual test script

The database-level behaviour (RPC rules, RLS, anon access, leaderboard) is automated: `npm run test:db`. The steps below cover the browser UI. Start with a fresh database and sign in as the host.

1. **Roster**: open Players. Add A, B, C. Try adding "a" — rejected with `Player "a" already exists`.
2. **Create table**: Dashboard → New table, keep ₹500. Tap chips A and B → each shows 1 buy-in, ₹500.
3. **Add and seat**: type `D` in "Add new player" → D is seated; D appears in the Players page.
4. **Buy-ins**: A `+ Buy-in` twice → ₹1,500. `− Buy-in` → ₹1,000. B (₹500): `− Buy-in` is disabled. Remove only shows for players with exactly 1 buy-in and no cash-out.
5. **Cash-outs**: A 2000, B 0, D 0 (Enter or blur saves). Pot ₹2,000, total cash-out ₹2,000, no mismatch warning, A net +₹1,000 (green), B/D red.
6. **Mismatch**: set D to 100 → warning "cash-outs are ₹100 more than the pot". Set D back to 0.
7. **Close blocked**: clear B's cash-out, click Close table → confirm → error toast "Missing cash-out for: B". Re-enter B 0.
8. **Close**: Close table → confirm. Table is read-only with a Reopen button. Leaderboard (also open in a private window without signing in) shows A net +₹1,000. Start a second table with results but don't close it: its results are not on the leaderboard.
9. **History**: /history lists the closed table with date, players, pot; click opens it.
10. **Persistence**: refresh each page; data persists. Reopen works and removes the table's results from the leaderboard.
11. **Realtime**: open the same open table in two tabs; a buy-in in one appears in the other within a second or so.

## RLS check (anon key)

Replace `<URL>` and `<ANON_KEY>`:

```
curl -i -X POST "<URL>/rest/v1/players" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" -d '{"name":"Hacker"}'
```

Expected: 401/403 (`new row violates row-level security policy`).

```
curl -i -X POST "<URL>/rest/v1/rpc/seat_player" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"p_table_id":"00000000-0000-0000-0000-000000000000","p_player_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: 401/403 `permission denied for function seat_player`.

Reads: `curl "<URL>/rest/v1/players?select=*" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"` returns `[]`, while `/rest/v1/overall_leaderboard?select=*` returns the public results.
