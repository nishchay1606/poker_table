import Link from "next/link";
import { TableList } from "@/components/TableList";
import { loadTableList } from "@/lib/tables";

export default async function Home() {
  const { items, error } = await loadTableList("open");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Open tables</h1>
        <Link href="/tables/new" className="btn btn-primary">
          New table
        </Link>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <TableList items={items} dateOf={(t) => t.created_at} empty="No open tables. Start a new one." />
      <div className="flex flex-wrap gap-2">
        <Link href="/players" className="btn">Players</Link>
        <Link href="/leaderboard" className="btn">Leaderboard</Link>
        <Link href="/history" className="btn">History</Link>
      </div>
    </div>
  );
}
