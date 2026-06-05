#!/usr/bin/env zsh
# Tự động dừng script nếu có lệnh nào trả về lỗi (exit code khác 0)
set -e

# Khai báo màu sắc cho giao diện hiển thị
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m' # No Color

# Hàm in lỗi và thoát
error_exit() {
  echo -e "${RED}[Lỗi] $1${NC}"
  exit 1
}

echo -e "${YELLOW}[Autoscript] Khởi động tiến trình Deploy lên Cloudflare...${NC}"

# Chuyển tới thư mục chứa script
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"
echo -e "${GREEN}[Autoscript] Thư mục dự án: $PROJECT_ROOT${NC}"

# 1. Kiểm tra môi trường (Node.js & npm)
if ! command -v node >/dev/null 2>&1; then
  error_exit "Chưa cài đặt Node.js! Vui lòng tải và cài đặt tại: https://nodejs.org/"
fi

if ! command -v npm >/dev/null 2>&1; then
  error_exit "Chưa cài đặt npm! Vui lòng cài đặt npm cùng với Node.js."
fi

# 2. Kiểm tra các file quan trọng
for file in "package.json" "wrangler.jsonc" "src/app.html"; do
  if [[ ! -f "$file" ]]; then
    error_exit "Không tìm thấy file bắt buộc: $file"
  fi
done

# 3. Cài đặt thư viện nếu chưa có
if [[ ! -d "node_modules" ]] || [[ ! -x "node_modules/.bin/wrangler" ]]; then
  echo -e "${YELLOW}[Autoscript] Đang tiến hành cài đặt thư viện (npm install)...${NC}"
  npm install
  echo -e "${GREEN}[Autoscript] Cài đặt thư viện thành công!${NC}"
fi

# 4. Kiểm tra trạng thái đăng nhập Cloudflare
echo -e "${YELLOW}[Autoscript] Kiểm tra kết nối tài khoản Cloudflare...${NC}"
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo -e "${RED}[Lỗi] Bạn chưa đăng nhập Cloudflare hoặc phiên làm việc đã hết hạn.${NC}"
  echo -e "${YELLOW}Vui lòng chạy lệnh sau trên Terminal để đăng nhập lại:${NC} npx wrangler login"
  exit 1
fi
echo -e "${GREEN}[Autoscript] Đã kết nối Cloudflare thành công.${NC}"

# 5. Xử lý cờ (dry-run)
MODE="deploy"
if [[ "$1" == "--dry-run" ]]; then
  MODE="dry-run"
fi

# 6. Triển khai (Deploy)
echo -e "${YELLOW}==============================================${NC}"
if [[ "$MODE" == "dry-run" ]]; then
  echo -e "${YELLOW}[Autoscript] Đang chạy chế độ chạy thử (--dry-run), chưa đẩy lên Cloudflare thật...${NC}"
  npm run deploy:dry-run
else
  echo -e "${YELLOW}[Autoscript] Bắt đầu đẩy mã nguồn lên Cloudflare Workers...${NC}"
  npm run deploy
fi
echo -e "${YELLOW}==============================================${NC}"

# Hoàn tất
echo -e "${GREEN}[Autoscript] 🎉 Triển khai lên Cloudflare thành công!${NC}"
