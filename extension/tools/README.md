# HQ extension — tools

## upload-cdp.js — auto-attach a resume to a job form

Browsers forbid scripts from setting `<input type=file>`, so the extension itself can't
attach your resume. This script does it from the terminal over the Chrome DevTools
Protocol (CDP) — the one supported way — by driving your running Comet browser.

### One-time setup (per browser session)
Comet must be running with the remote-debugging port. It only takes effect on a fresh launch:

1. **Quit Comet fully** (Cmd+Q — your tabs are restored on relaunch).
2. Run: `./comet-debug.sh`  (launches Comet with `--remote-debugging-port=9222 --restore-last-session`)

That's it until you next fully quit Comet.

### Attaching a file
```bash
node upload-cdp.js --file "~/Downloads/Pranshu Pandey - Backend Engineer.pdf" --url greenhouse
```
- `--file`      the resume/cover-letter to attach (required)
- `--url`       only act on the tab whose URL contains this (e.g. `greenhouse`, `lever`, the company)
- `--selector`  which inputs to consider (default `input[type=file]`)
- `--index`     which one, if a form has several file inputs (0 = first; resume is usually 0, cover letter 1)
- `--port`      debug port (default 9222)

The file input can be hidden behind a custom "Upload" button — CDP sets it anyway, and
frameworks (React etc.) see the change event. After it runs, review and submit the form yourself.

### Notes / limits
- Needs the debug-port launch above; without it you get a clear error telling you to run `comet-debug.sh`.
- Targets the top-level page; forms embedded in a cross-origin iframe aren't reached in this version.
- This does not submit — it only attaches. You stay in control of the submit.
