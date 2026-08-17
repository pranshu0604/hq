import { redirect } from "next/navigation";

// Todos merged into the one unified list. The Todo table is untouched — committed
// tasks now live under Inbox → Committed. Old links land there.
export default function TodosPage() {
  redirect("/inbox");
}
