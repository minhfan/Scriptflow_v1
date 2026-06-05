import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "../..");

export const APP_TEMPLATE_PATH = "src/app/template.html";
export const APP_SOURCE_PATH = "src/app.html";
export const APP_PUBLIC_PATH = "public/app.html";
export const APP_SOURCE_ASSET_DIR = "src/assets/app";
export const APP_PUBLIC_ASSET_DIR = "public/assets/app";
export const APP_ASSET_URL_PREFIX = "/tcpscript/assets/app";

export const APP_CSS_MODULES = [
  "src/app/styles/design-system.css",
  "src/app/styles/layout.css",
  "src/app/styles/timeline.css",
  "src/app/styles/table.css",
  "src/app/styles/modals.css",
];

export const APP_JS_MODULES = [
  "src/app/js/constants.js",
  "src/app/js/timecode.js",
  "src/app/js/i18n.js",
  "src/app/js/state.js",
  "src/app/js/shortcuts.js",
  "src/app/js/modals.js",
  "src/app/js/api.js",
  "src/app/js/storage.js",
  "src/app/js/renderer.js",
  "src/app/js/playback.js",
  "src/app/js/timeline.js",
  "src/app/js/tabs.js",
  "src/app/js/toolbar.js",
  "src/app/js/init.js",
];

export const APP_HTML_COMPONENTS = {
  "<!-- INJECT_COMPONENT:HEADER -->": "src/app/components/header.html",
  "<!-- INJECT_COMPONENT:WORKSPACE -->": "src/app/components/workspace.html",
  "<!-- INJECT_COMPONENT:SHEET_TABS -->": "src/app/components/sheet-tabs.html",
  "<!-- INJECT_COMPONENT:VIDEO_PANEL -->": "src/app/components/video-panel.html",
  "<!-- INJECT_COMPONENT:TIMELINE_PANEL -->": "src/app/components/timeline-panel.html",
  "<!-- INJECT_COMPONENT:FORM_PANEL -->": "src/app/components/form-panel.html",
  "<!-- INJECT_COMPONENT:TABLE_PANEL -->": "src/app/components/table-panel.html",
  "<!-- INJECT_COMPONENT:MODALS -->": "src/app/components/modals.html",
  "<!-- INJECT_COMPONENT:HELP_PANEL -->": "src/app/components/help-panel.html",
  "<!-- INJECT_COMPONENT:SETTINGS_MODAL -->": "src/app/components/settings-modal.html",
  "<!-- INJECT_COMPONENT:MESSAGE_MODAL -->": "src/app/components/message-modal.html",
  "<!-- INJECT_COMPONENT:CONFIRM_MODAL -->": "src/app/components/confirm-modal.html",
  "<!-- INJECT_COMPONENT:CONTEXT_MENU -->": "src/app/components/context-menu.html",
};

function resolveProjectPath(relativePath) {
  return path.join(projectRoot, relativePath);
}

function toCrlf(text) {
  return text.replace(/\r?\n/g, "\r\n");
}

async function readProjectFile(relativePath) {
  return readFile(resolveProjectPath(relativePath), "utf8");
}

async function hasAppTemplate() {
  try {
    await readFile(resolveProjectPath(APP_TEMPLATE_PATH), "utf8");
    return true;
  } catch (_) {
    return false;
  }
}

function getCssAssetUrl(modulePath) {
  return `${APP_ASSET_URL_PREFIX}/styles/${path.basename(modulePath)}`;
}

function getJsAssetUrl(modulePath) {
  return `${APP_ASSET_URL_PREFIX}/js/${path.basename(modulePath)}`;
}

export async function buildAppPageHtml() {
  if (!(await hasAppTemplate())) {
    return {
      html: await readProjectFile(APP_SOURCE_PATH),
      mode: "monolith",
      cssModuleCount: 0,
      jsModuleCount: 0,
    };
  }

  const template = await readProjectFile(APP_TEMPLATE_PATH);
  const componentEntries = await Promise.all(
    Object.entries(APP_HTML_COMPONENTS).map(async ([placeholder, relativePath]) => {
      const content = await readProjectFile(relativePath);
      return [placeholder, content];
    })
  );

  const styleTags = APP_CSS_MODULES
    .map((modulePath) => `    <link rel="stylesheet" href="${getCssAssetUrl(modulePath)}">`)
    .join("\n");

  const scriptTags = APP_JS_MODULES
    .map((modulePath) => `    <script src="${getJsAssetUrl(modulePath)}"></script>`)
    .join("\n");

  const htmlWithComponents = componentEntries.reduce(
    (currentHtml, [placeholder, content]) => currentHtml.replace(placeholder, content),
    template
  );

  const html = htmlWithComponents
    .replace("<!-- INJECT_STYLES -->", styleTags)
    .replace("<!-- INJECT_SCRIPTS -->", scriptTags);

  return {
    html,
    mode: "modular",
    cssModuleCount: APP_CSS_MODULES.length,
    jsModuleCount: APP_JS_MODULES.length,
  };
}

export async function writeBuiltAppPage(relativePath) {
  const result = await buildAppPageHtml();
  await writeFile(resolveProjectPath(relativePath), toCrlf(result.html), "utf8");
  return result;
}

export async function syncAppRuntimeAssets(targetBaseRelativePath) {
  const styleDir = resolveProjectPath(path.join(targetBaseRelativePath, "styles"));
  const jsDir = resolveProjectPath(path.join(targetBaseRelativePath, "js"));

  await mkdir(styleDir, { recursive: true });
  await mkdir(jsDir, { recursive: true });

  await Promise.all([
    ...APP_CSS_MODULES.map(async (modulePath) => {
      const content = await readProjectFile(modulePath);
      await writeFile(path.join(styleDir, path.basename(modulePath)), toCrlf(content), "utf8");
    }),
    ...APP_JS_MODULES.map(async (modulePath) => {
      const content = await readProjectFile(modulePath);
      await writeFile(path.join(jsDir, path.basename(modulePath)), toCrlf(content), "utf8");
    }),
  ]);
}
