import { createApplication } from "@/app/applications/actions";
import { Select } from "@/components/ui/select";
import CompFields from "@/components/applications/comp-fields";
import Link from "next/link";

const CATEGORY_OPTS = [
  { value: "DREAM", label: "Dream — would drop everything" },
  { value: "STRONG", label: "Strong — genuinely interested" },
  { value: "BACKUP", label: "Backup — worth keeping open" },
  { value: "IGNORE_IF_BETTER", label: "Ignore if better offer comes" },
];

const NEW_STATUS_OPTS = [
  { value: "APPLIED", label: "Applied — it's out the door" },
  { value: "PENDING", label: "Pending — form parked half-done" },
];

const WORKMODE_OPTS = [
  { value: "", label: "Unknown yet" },
  { value: "REMOTE", label: "Remote" },
  { value: "ONSITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
];

export default function NewApplicationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-14 reveal">
      <Link href="/applications" className="label hover:text-ink transition-colors">
        ← back to applications
      </Link>
      <h1 className="display text-4xl mt-4 mb-10">New Application</h1>
      <form action={createApplication} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-2">Company</label>
            <input name="company" required className="field-input" placeholder="Acme Corp" />
          </div>
          <div>
            <label className="label block mb-2">Role</label>
            <input name="role" required className="field-input" placeholder="Senior Backend Engineer" />
          </div>
        </div>

        <div>
          <label className="label block mb-2">Description</label>
          <textarea
            name="description"
            rows={4}
            className="field-input"
            placeholder="Role responsibilities, tech stack, anything worth remembering…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-2">Category</label>
            <Select name="category" options={CATEGORY_OPTS} defaultValue="BACKUP" />
          </div>
          <div>
            <label className="label block mb-2">Work mode</label>
            <Select name="workMode" options={WORKMODE_OPTS} defaultValue="" placeholder="Unknown yet" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-2">City (if on-site/hybrid)</label>
            <input name="city" className="field-input" placeholder="Bengaluru" />
          </div>
          <div>
            <label className="label block mb-2">Status</label>
            <Select name="status" options={NEW_STATUS_OPTS} defaultValue="APPLIED" />
          </div>
        </div>

        <div>
          <label className="label block mb-2">Link — the posting, or where to resume the form</label>
          <input name="link" type="url" className="field-input" placeholder="https://…" />
        </div>

        <CompFields />

        <div>
          <label className="label block mb-2">Notes</label>
          <textarea name="notes" rows={3} className="field-input" placeholder="Referral, gut feeling, anything else" />
        </div>

        <button type="submit" className="btn btn-primary">
          Create Application
        </button>
      </form>
    </div>
  );
}
