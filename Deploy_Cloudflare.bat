@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "MODE=deploy"
set "PAUSE_ON_EXIT=1"

for %%A in (%*) do (
    if /I "%%~A"=="--dry-run" set "MODE=dry-run"
    if /I "%%~A"=="--no-pause" set "PAUSE_ON_EXIT=0"
)

pushd "%PROJECT_ROOT%" || goto :fail_cd

echo.
echo [Autoscript] Bắt đầu deploy Cloudflare Worker.
echo [Autoscript] Thư mục dự án: %PROJECT_ROOT%

if not exist "package.json" goto :fail_package
if not exist "wrangler.jsonc" goto :fail_wrangler_config
if not exist "src\app.html" goto :fail_source_html

where node >nul 2>nul || goto :fail_node
where npm >nul 2>nul || goto :fail_npm

if not exist "node_modules\.bin\wrangler.cmd" (
    echo [Autoscript] Chưa có dependencies. Đang chạy npm install...
    call npm install || goto :fail_npm_install
)

echo [Autoscript] Kiểm tra đăng nhập Cloudflare...
call npx wrangler whoami || goto :fail_auth

if /I "%MODE%"=="dry-run" (
    echo [Autoscript] Chạy dry-run, chưa deploy thật.
    call npm run deploy:dry-run || goto :fail_deploy
) else (
    echo [Autoscript] Deploy thật lên Cloudflare.
    call npm run deploy || goto :fail_deploy
)

echo.
echo [Autoscript] Deploy Cloudflare hoàn tất.
goto :success_exit

:fail_cd
echo [Autoscript] Lỗi: Không vào được thư mục dự án.
goto :fail_exit

:fail_package
echo [Autoscript] Lỗi: Thiếu package.json.
goto :fail_exit

:fail_wrangler_config
echo [Autoscript] Lỗi: Thiếu wrangler.jsonc.
goto :fail_exit

:fail_source_html
echo [Autoscript] Lỗi: Thiếu src\app.html.
goto :fail_exit

:fail_node
echo [Autoscript] Lỗi: Không tìm thấy Node.js trong PATH.
goto :fail_exit

:fail_npm
echo [Autoscript] Lỗi: Không tìm thấy npm trong PATH.
goto :fail_exit

:fail_npm_install
echo [Autoscript] Lỗi: npm install thất bại.
goto :fail_exit

:fail_auth
echo [Autoscript] Lỗi: Chưa đăng nhập Cloudflare hoặc token không hợp lệ.
echo [Autoscript] Chạy lệnh này rồi thử lại: npx wrangler login
goto :fail_exit

:fail_deploy
echo [Autoscript] Lỗi: Deploy Cloudflare thất bại.
goto :fail_exit

:success_exit
popd >nul 2>nul
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b 0

:fail_exit
popd >nul 2>nul
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b 1
