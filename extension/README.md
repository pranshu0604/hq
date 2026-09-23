# HQ Autofill (Chrome)

Fills job-application forms from your **HQ Career Profile**, then logs the job to HQ's **Applied** list. HQ (Claude, in your running session) reads the scraped form + your profile and writes back the answers — the extension just scrapes and fills.

## Install (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right) on
3. **Load unpacked** → pick this `extension/` folder
4. Click the extension → **Open settings** and paste:
   - **HQ URL**: `https://hq-three-mauve.vercel.app` (pre-filled)
   - **API token**: your `HQ_API_TOKEN` (same value the Android widget uses)

Stored only in this browser's local storage. No secret ships in the code.

## Auto-apply on LinkedIn (v1)

1. Open your **LinkedIn Jobs** page (the list with a job open on the right).
2. Click the extension → **Auto-apply on LinkedIn**. A small panel appears bottom-right.
3. Leave **auto-submit off** (recommended) so it fills every Easy Apply step and stops at the final Submit for you to click. Tick it only once you trust the answers.
4. Hit **Start**. It walks the list, opens each Easy Apply job, fills from your profile (contact, +91 country code, yes/no screeners, salary, common freeform questions), and pauses at Submit. External "Apply" jobs are skipped and counted.
5. **Stop** anytime.

Notes: your résumé is already LinkedIn's default on Easy Apply, so no upload needed there. LinkedIn renames CSS often, so if a step misses fields the panel logs it — tell HQ and the selectors get patched. Applying too fast can trip LinkedIn's bot checks; the loop paces itself, but don't leave auto-submit ripping through hundreds.

## Use (single form)

1. Make sure your Claude/HQ session is **running the fill loop** (it polls `/api/ext/fill?status=pending`).
2. Fill in your **Career Profile** in HQ first (`/career`) — that's the source material.
3. Open a job application page, click the extension → **Fill this page**.
   - It scrapes the visible fields, sends them to HQ, waits for Claude to answer, then fills the form.
   - Review everything, upload your résumé manually (file inputs can't be auto-filled), and submit **on the site**.
4. Click **Save to Applied** → creates an Application in HQ (company, role, link, status = Applied).

## Notes / limits

- **File uploads** (résumé/CV) must be attached by hand — browsers forbid scripts from setting file inputs.
- Works on the **top-level** application page. Some ATS embed the form in an iframe on the same domain; if a page's fields aren't found, open the form in its own tab.
- Re-run **Fill this page** anytime; it re-scrapes fresh.
- If you see a `401`, your token is wrong — fix it in settings.
