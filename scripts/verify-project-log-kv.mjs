import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_JS_MODULES } from "./lib/build-app-page.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  const worker = await readFile(path.join(projectRoot, "src/worker.js"), "utf8");
  const jsModules = await Promise.all(
    APP_JS_MODULES.map((relativePath) => readFile(path.join(projectRoot, relativePath), "utf8"))
  );
  const appJs = jsModules.join("\n");

  const checks = [
    {
      label: "worker has GET/PUT project log API",
      ok:
        worker.includes("/api/project-logs") &&
        worker.includes("handleGetProjectLogs") &&
        worker.includes("handlePutProjectLogs"),
    },
    {
      label: "app has KV-backed project log helpers",
      ok:
        appJs.includes("loadProjectLogsFromKV") &&
        appJs.includes("saveProjectLogsToKV"),
    },
    {
      label: "app no longer persists main log list to autoscript_tcp_v9",
      ok: !appJs.includes("localStorage.setItem('autoscript_tcp_v9'"),
    },
  ];

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error("[verify-project-log-kv] failed checks:");
    for (const check of failed) {
      console.error(`- ${check.label}`);
    }
    process.exit(1);
  }

  console.log("[verify-project-log-kv] all checks passed");
}

main().catch((error) => {
  console.error("[verify-project-log-kv] unexpected error");
  console.error(error);
  process.exit(1);
});
