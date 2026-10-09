import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const linkClass = "inline-flex min-h-11 items-center px-2 text-sm hover:text-gold";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-felt-700 bg-felt-900">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 px-3">
        <Link href="/" className="inline-flex min-h-11 items-center pr-2 font-semibold text-gold">
          ♠ Poker Tracker
        </Link>
        {user && (
          <>
            <Link href="/players" className={linkClass}>
              Players
            </Link>
            <Link href="/history" className={linkClass}>
              History
            </Link>
          </>
        )}
        <Link href="/leaderboard" className={linkClass}>
          Leaderboard
        </Link>
        {user && (
          <form action={signOut} className="ml-auto">
            <button type="submit" className={linkClass}>
              Sign out
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
