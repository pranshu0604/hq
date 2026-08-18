import { redirect } from "next/navigation";

// Weekly review merged into Life state — the same aggregation, now with the
// compress prompts + projects-at-risk folded in. Old links land there.
export default function ReviewPage() {
  redirect("/state");
}
