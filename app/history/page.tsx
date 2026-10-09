import { TableList } from "@/components/TableList";
import { loadTableList } from "@/lib/tables";

export default async function HistoryPage() {
  const { items, error } = await loadTableList("closed");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">History</h1>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <TableList
        items={items}
        dateOf={(t) => t.closed_at ?? t.created_at}
        empty="No closed tables yet."
      />
    </div>
  );
}
