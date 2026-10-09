import { LeaderboardTable } from "./LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <LeaderboardTable />
    </div>
  );
}
