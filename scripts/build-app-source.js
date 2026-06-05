import {
  APP_SOURCE_ASSET_DIR,
  APP_SOURCE_PATH,
  syncAppRuntimeAssets,
  writeBuiltAppPage,
} from "./lib/build-app-page.js";

const result = await writeBuiltAppPage(APP_SOURCE_PATH);
await syncAppRuntimeAssets(APP_SOURCE_ASSET_DIR);

if (result.mode === "modular") {
  console.log(
    `[Autoscript] Đã build ${APP_SOURCE_PATH} từ ${result.cssModuleCount} CSS modules và ${result.jsModuleCount} JS modules.`
  );
  console.log(`[Autoscript] Đã sync runtime assets vào ${APP_SOURCE_ASSET_DIR}.`);
} else {
  console.log(`[Autoscript] Đã giữ nguyên ${APP_SOURCE_PATH} theo chế độ monolith.`);
}
