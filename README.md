# Poker Home Game Tracker

Track buy-ins, cash-outs and results for home poker games. Next.js (App Router) + Supabase (Postgres, Auth, Realtime). All money is whole rupees (₹) stored as integers.

## Setup

1. `npm install`
2. Create a project at <https://supabase.com>.
3. Apply the schema: paste `supabase/migrations/0001_init.sql` into the SQL editor and run it, or with the CLI: `supabase link --project-ref <ref> && supabase db push`.
4. Copy `.env.local.example` to `.env.local` and fill in the project URL and anon key (Project Settings → API).
5. Auth setup (Authentication in the dashboard):
   - **Users → Add user**: create your host user (email). Use "Auto confirm".
   - **Sign In / Providers → Email**: disable "Allow new users to sign up" (and enable magic link / OTP email).
   - **URL Configuration**: set Site URL to your app URL (e.g. `http://localhost:3000` locally, your Vercel URL in production) and add redirect URLs `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.
6. `npm run dev` and open <http://localhost:3000>. Sign in with the host email via the magic link.

Without env vars the app shows a "Supabase not configured" message; the build passes without `.env.local`.

### Regenerate types

`types/database.ts` is hand-written in the `supabase gen types typescript` format. Regenerate it with:

```
npx supabase gen types typescript --project-id <id> > types/database.ts
```

### Database tests

`npm run test:db` runs the migration on an in-process Postgres (PGlite + citext) behind a small Supabase role/auth shim, then asserts RPC behaviour, RLS and anon access. No Supabase project or Docker needed.

### Deploy to Vercel

Import the repo in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, deploy, then add the production URL and `/auth/callback` to Supabase's Auth URL configuration.

## Decisions

- Single-host auth: magic link with `shouldCreateUser: false`; create the host user in the dashboard and disable signups.
- `overall_leaderboard` is public (readable by anon, owner-rights view, closed tables only); `table_player_summary` is authenticated-only.
- `buyin_count` is the sum of the signs of buy-in transactions (+1 per buy-in, −1 per reversal).
- `biggest_win` is null when a player has never won a table.
- Closing a table with zero players is rejected; closing with missing cash-outs is rejected. A pot/cash-out mismatch is not blocked, only warned about in the UI. The mismatch warning appears once every seated player has a cash-out; until then the summary shows "N cash-outs pending" to avoid noise while entering values.
- Adding an archived player's name via add-and-seat unarchives that player.
- Buy-in amount is fixed after table creation.
- All mutations go through RPC functions (`.rpc(...)`); the app never calls `.insert/.update/.delete`.
- `types/database.ts` is hand-written pending regeneration against the real project.
- Next.js 16 uses `proxy.ts` (formerly middleware) for session refresh and auth redirects.
