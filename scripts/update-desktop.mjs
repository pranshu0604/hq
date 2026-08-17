// Update the installed HQ.app by repacking ONLY the shell into its app.asar.
// electron-builder OOMs on this project because it auto-bundles the Next app's
// production deps (@aws-sdk/@libsql/next/prisma…) — 264MB — which the shell never
// uses. This repacks just electron/ (a few hundred KB) and re-signs. Fast + safe.
import { execSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const APP = "/Applications/HQ.app";
const STAGE = "/tmp/hqapp";

if (!existsSync(APP)) {
  console.error("HQ.app not installed — do a first-time electron-builder build, or ask the assistant.");
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(`${STAGE}/electron`, { recursive: true });
cpSync("electron", `${STAGE}/electron`, { recursive: true });
writeFileSync(`${STAGE}/package.json`, JSON.stringify({ name: "hq", version: "0.1.0", main: "electron/main.js", author: "Pranshu Pandey" }));

try {
  execSync(`pkill -f '${APP}/Contents/MacOS/HQ'`);
} catch {
  /* not running */
}
execSync(`node_modules/.bin/asar pack ${STAGE} '${APP}/Contents/Resources/app.asar'`, { stdio: "inherit" });
rmSync(`${APP}/Contents/Resources/app.asar.unpacked`, { recursive: true, force: true });
execSync(`codesign --force --deep --sign - '${APP}'`, { stdio: "inherit" });
console.log("✓ HQ.app updated (shell only). Relaunch from Spotlight.");
