import { connection } from "next/server";
import { formatDate } from "@/lib/format";
import { NewTableForm } from "./NewTableForm";

export default async function NewTablePage() {
  await connection();
  return <NewTableForm defaultName={`Game – ${formatDate(new Date().toISOString())}`} />;
}
