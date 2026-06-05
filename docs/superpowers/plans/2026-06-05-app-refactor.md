# App Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất refactor an toàn cho `app.html` bằng cách dùng bộ source modular sẵn có, nhưng vẫn giữ nguyên giao diện, logic và flow hiện tại.

**Architecture:** `src/app/template.html` giữ HTML shell, `src/app/styles/*` giữ CSS theo dependency order, `src/app/js/*` giữ JavaScript theo load order cũ. Build scripts sẽ sinh lại cùng một output cho cả `src/app.html` và `public/app.html` để local server và deploy dùng chung một nội dung.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js build scripts

---

## Chunk 1: Nhóm thay đổi an toàn đầu tiên

### Task 1: Khóa source-of-truth cho app page

**Files:**
- Create: `docs/superpowers/plans/2026-06-05-app-refactor.md`
- Create: `scripts/build-app-source.js`
- Create: `scripts/lib/build-app-page.js`
- Modify: `package.json`
- Modify: `scripts/build-public.js`
- Test: `scripts/verify-refactor.js`

- [ ] **Step 1: Tạo backup monolith**

Run: `Copy-Item -LiteralPath 'src\app.html' -Destination 'src\app.backup.html' -Force`
Expected: `src/app.backup.html` tồn tại và giữ nguyên nội dung gốc trước khi overwrite.

- [ ] **Step 2: Tách shared builder cho app page**

Tạo helper build từ `src/app/template.html` + `src/app/styles/*` + `src/app/js/*`, giữ đúng dependency order hiện tại.

- [ ] **Step 3: Thêm source sync script**

Tạo script sinh `src/app.html` từ helper chung để local runtime dùng đúng output modular.

- [ ] **Step 4: Cho public build dùng cùng helper**

Sửa `scripts/build-public.js` để `public/app.html` sinh từ đúng helper ở Step 2.

- [ ] **Step 5: Thêm package script**

Thêm command rõ ràng để sync lại `src/app.html` khi cần.

- [ ] **Step 6: Chạy source/public sync**

Run:
```bash
node scripts/build-app-source.js
npm run sync:public
```
Expected: `src/app.html` và `public/app.html` được build lại từ cùng một nguồn modular.

- [ ] **Step 7: Chạy verification**

Run:
```bash
npm run verify:refactor
```
Expected: PASS.

### Task 2: Nhóm tiếp theo sau khi user duyệt

**Files:**
- Review tiếp sau khi user xác nhận

- [ ] **Step 1: Chốt nhóm 1 với user**

Report: file đã tạo/sửa, command đã chạy, rủi ro còn lại.

- [ ] **Step 2: Chờ xác nhận trước khi tiếp tục**

Không đụng logic UI/UX ở bước này.
