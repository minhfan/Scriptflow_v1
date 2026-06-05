import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_CSS_MODULES,
  APP_JS_MODULES,
  APP_PUBLIC_ASSET_DIR,
  APP_SOURCE_ASSET_DIR,
} from "./lib/build-app-page.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeText(value) {
  return String(value).replace(/\r\n/g, "\n");
}

const sourceHtml = await readProjectFile("src/app.html");
const publicHtml = await readProjectFile("public/app.html");

assert(sourceHtml.length > 0, "src/app.html phai co noi dung.");
assert(publicHtml.length > 0, "public/app.html phai co noi dung.");

assert(normalizeText(sourceHtml) === normalizeText(publicHtml), "public/app.html phai khop 1:1 voi src/app.html sau build.");

assert(sourceHtml.includes("Autoscript TCP Pro"), "src/app.html phai giu title cua webapp.");
assert(sourceHtml.includes('/tcpscript/assets/app/styles/design-system.css'), "src/app.html phai nap design-system.css.");
assert(sourceHtml.includes('/tcpscript/assets/app/js/renderer.js'), "src/app.html phai nap renderer.js.");
assert(sourceHtml.includes('/tcpscript/assets/app/js/init.js'), "src/app.html phai nap init.js.");

for (const relativePath of APP_CSS_MODULES) {
  const sourceModule = await readProjectFile(relativePath);
  const fileName = path.basename(relativePath);
  const sourceAsset = await readProjectFile(path.join(APP_SOURCE_ASSET_DIR, "styles", fileName));
  const publicAsset = await readProjectFile(path.join(APP_PUBLIC_ASSET_DIR, "styles", fileName));

  assert(normalizeText(sourceModule) === normalizeText(sourceAsset), `${fileName} trong src/assets phai khop source module.`);
  assert(normalizeText(sourceModule) === normalizeText(publicAsset), `${fileName} trong public/assets phai khop source module.`);
}

for (const relativePath of APP_JS_MODULES) {
  const sourceModule = await readProjectFile(relativePath);
  const fileName = path.basename(relativePath);
  const sourceAsset = await readProjectFile(path.join(APP_SOURCE_ASSET_DIR, "js", fileName));
  const publicAsset = await readProjectFile(path.join(APP_PUBLIC_ASSET_DIR, "js", fileName));

  assert(normalizeText(sourceModule) === normalizeText(sourceAsset), `${fileName} trong src/assets phai khop source module.`);
  assert(normalizeText(sourceModule) === normalizeText(publicAsset), `${fileName} trong public/assets phai khop source module.`);
}

for (const relativePath of APP_JS_MODULES) {
  const scriptContent = await readProjectFile(relativePath);
  new Function(scriptContent);
}

console.log("[Autoscript] Verify app source OK.");
