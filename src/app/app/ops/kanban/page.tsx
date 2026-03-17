import { redirect } from "next/navigation";

export default function KanbanIndex() {
  redirect("/app/ops/kanban/activities");
}
