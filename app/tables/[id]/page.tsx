import { TableView } from "./TableView";

export default async function TablePage({ params }: PageProps<"/tables/[id]">) {
  const { id } = await params;
  return <TableView tableId={id} />;
}
