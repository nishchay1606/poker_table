import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import type { TableListItem } from "@/lib/tables";

export function TableList({
  items,
  dateOf,
  empty,
}: {
  items: TableListItem[];
  dateOf: (t: TableListItem) => string;
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-emerald-100/60">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t.id}>
          <Link
            href={`/tables/${t.id}`}
            className="card flex min-h-11 items-center justify-between gap-3 hover:bg-felt-800"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="block text-xs text-emerald-100/60">
                {formatDate(dateOf(t))} · {t.playerCount} {t.playerCount === 1 ? "player" : "players"}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-xs text-emerald-100/60">Pot</span>
              <span className="font-semibold text-gold">{formatMoney(t.pot)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
