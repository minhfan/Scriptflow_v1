import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_PUBLIC_ASSET_DIR,
  APP_PUBLIC_PATH,
  syncAppRuntimeAssets,
  writeBuiltAppPage,
} from "./lib/build-app-page.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const publicDir = path.join(projectRoot, "public");

async function readRelative(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

async function buildAppPage() {
  const result = await writeBuiltAppPage(APP_PUBLIC_PATH);
  await syncAppRuntimeAssets(APP_PUBLIC_ASSET_DIR);

  if (result.mode === "modular") {
    console.log(
      `[Autoscript] ✓ Built public/app.html (modular: ${result.cssModuleCount} CSS + ${result.jsModuleCount} JS modules)`
    );
    console.log(`[Autoscript] ✓ Synced public assets to ${APP_PUBLIC_ASSET_DIR}`);
  } else {
    console.log("[Autoscript] ✓ Built public/app.html (monolith)");
  }
}

async function buildLoginPage() {
  const [html, css, js] = await Promise.all([
    readRelative("src/login.html"),
    readRelative("src/login.css"),
    readRelative("src/login.js"),
  ]);

  const builtHtml = html
    .replace(/<link rel="stylesheet" href="login\.css">/, `<style>\n${css}</style>`)
    .replace(/<script src="login\.js"><\/script>/, `<script>\n${js}</script>`);

  await writeFile(path.join(publicDir, "login.html"), builtHtml, "utf8");
  console.log("[Autoscript] ✓ Built public/login.html");
}

async function buildProjectPage() {
  const [html, css, js] = await Promise.all([
    readRelative("src/project.html"),
    readRelative("src/project.css"),
    readRelative("src/project.js"),
  ]);

  const builtHtml = html
    .replace(/<link rel="stylesheet" href="project\.css">/, `<style>\n${css}</style>`)
    .replace(/<script src="project\.js"><\/script>/, `<script>\n${js}</script>`);

  await writeFile(path.join(publicDir, "project.html"), builtHtml, "utf8");
  console.log("[Autoscript] ✓ Built public/project.html");
}

async function buildSettingPage() {
  const [html, css, js] = await Promise.all([
    readRelative("src/setting.html"),
    readRelative("src/setting.css"),
    readRelative("src/setting.js"),
  ]);

  const builtHtml = html
    .replace(/<link rel="stylesheet" href="setting\.css">/, `<style>\n${css}</style>`)
    .replace(/<script src="setting\.js"><\/script>/, `<script>\n${js}</script>`);

  await writeFile(path.join(publicDir, "setting.html"), builtHtml, "utf8");
  console.log("[Autoscript] ✓ Built public/setting.html");
}

async function buildRedirectIndex() {
  const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; url=login.html">
    <title>Autoscript TCP — Redirecting...</title>
    <style>
        body {
            background: #09090b;
            color: #a1a1aa;
            font-family: 'Outfit', system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
    </style>
</head>
<body>
    <p>Redirecting to sign in...</p>
    <script>window.location.href = 'login.html';</script>
</body>
</html>`;

  await writeFile(path.join(publicDir, "index.html"), redirectHtml, "utf8");
  console.log("[Autoscript] ✓ Built public/index.html (redirect → login)");
}

async function buildAll() {
  await mkdir(publicDir, { recursive: true });

  await Promise.all([
    buildAppPage(),
    buildLoginPage(),
    buildProjectPage(),
    buildSettingPage(),
    buildRedirectIndex(),
  ]);

  console.log("\n[Autoscript] Build complete! All pages ready in public/");
}

buildAll().catch((error) => {
  console.error("[Autoscript] Build failed:");
  console.error(error);
  process.exit(1);
});
