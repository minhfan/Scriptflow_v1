/**
 * GOOGLE APPS SCRIPT BACKEND WEB APP (Code.gs)
 *
 * Bản cập nhật ổn định: tạo project từ template, cập nhật metadata,
 * rename file Google Sheet khi project name thay đổi, đồng bộ log,
 * và hỗ trợ nạp danh sách Sheet Tabs cũng như gửi logs đơn lẻ (Cutdown).
 */

var SPREADSHEET_ID = "1S6YxzKJE7X5vZRZduA36KDc_E00Cdkxp2mD3VXhwfmA";

/**
 * Xử lý request GET.
 */
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;

    // LẤY DANH SÁCH SHEET TABS
    if (action === "getTabs") {
      var sheetId = e.parameter.id;
      var ss = SpreadsheetApp.openById(sheetId);
      var sheets = ss.getSheets();
      var tabs = [];
      for (var i = 0; i < sheets.length; i++) {
        tabs.push(sheets[i].getName());
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        tabs: tabs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // TẠO PROJECT MỚI TỪ TEMPLATE
    if (action === "createProject") {
      var projectName = e.parameter.name || "Autoscript Project";
      var templateId = e.parameter.templateId || SPREADSHEET_ID;

      if (!templateId || templateId === "ĐIỀN_ID_TRANG_TÍNH_CỦA_BẠN_VÀO_ĐÂY") {
        throw new Error("LỖI: Chưa có Template Spreadsheet ID được cấu hình.");
      }

      var templateSpreadsheet = SpreadsheetApp.openById(templateId);
      if (!templateSpreadsheet) {
        throw new Error("Không thể mở file Spreadsheet mẫu để nhân bản.");
      }

      var newSpreadsheet = templateSpreadsheet.copy(projectName);
      var newId = newSpreadsheet.getId();
      var newUrl = newSpreadsheet.getUrl();

      try {
        var file = DriveApp.getFileById(newId);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
      } catch (shareErr) {
        Logger.log("Lỗi thiết lập chia sẻ trang tính: " + shareErr.toString());
      }

      var moveStatus = "not_attempted";
      var moveError = null;
      var folderId = e.parameter.folderId;
      if (folderId) {
        moveStatus = "attempted";
        try {
          var targetFile = DriveApp.getFileById(newId);
          var targetFolder = DriveApp.getFolderById(folderId);
          targetFile.moveTo(targetFolder);
          moveStatus = "success";
        } catch (folderErr) {
          moveStatus = "failed";
          moveError = folderErr.toString();
          Logger.log("Lỗi di chuyển file vào thư mục Google Drive: " + moveError);
        }
      }

      var newSheet = newSpreadsheet.getSheetByName("Full-show");
      if (newSheet) {
        if (e.parameter.speaker !== undefined) {
          newSheet.getRange("B1").setValue(e.parameter.speaker);
        }
        if (e.parameter.source !== undefined) {
          newSheet.getRange("B2").setValue(e.parameter.source);
        }

        var lastRow = newSheet.getLastRow();
        if (lastRow >= 5) {
          newSheet.getRange(5, 1, lastRow - 5 + 1, 7).clearContent();
        }
      }

      var result = {
        status: "success",
        spreadsheetId: newId,
        spreadsheetUrl: newUrl,
        spreadsheetName: projectName,
        folderIdReceived: folderId || "",
        moveStatus: moveStatus,
        moveError: moveError
      };

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // CẬP NHẬT METADATA CỦA PROJECT
    if (action === "updateInfo") {
      var targetId = e.parameter.spreadsheetId;
      if (!targetId) throw new Error("Thiếu spreadsheetId");

      var targetSpreadsheet = SpreadsheetApp.openById(targetId);

      if (e.parameter.name !== undefined) {
        var nextName = String(e.parameter.name || "").trim();
        if (nextName) {
          targetSpreadsheet.rename(nextName);
          DriveApp.getFileById(targetId).setName(nextName);
        }
      }

      var targetSheet = targetSpreadsheet.getSheetByName("Full-show");
      if (targetSheet) {
        if (e.parameter.speaker !== undefined) {
          targetSheet.getRange("B1").setValue(e.parameter.speaker);
        }
        if (e.parameter.source !== undefined) {
          targetSheet.getRange("B2").setValue(e.parameter.source);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // LẤY THÔNG TIN CỦA PROJECT (SPEAKER & SOURCE)
    if (action === "getProjectInfo") {
      var infoTargetId = e.parameter.spreadsheetId;
      if (!infoTargetId) throw new Error("Thiếu spreadsheetId");

      var infoSpreadsheet = SpreadsheetApp.openById(infoTargetId);
      var infoSheet = infoSpreadsheet.getSheetByName("Full-show");
      var speaker = "";
      var source = "";
      if (infoSheet) {
        speaker = infoSheet.getRange("B1").getValue();
        source = infoSheet.getRange("B2").getValue();
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        speaker: speaker,
        source: source
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // MẶC ĐỊNH (Legacy / Kiểm tra kết nối)
    if (!SPREADSHEET_ID || SPREADSHEET_ID === "ĐIỀN_ID_TRANG_TÍNH_CỦA_BẠN_VÀO_ĐÂY") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "LỖI: Bạn chưa điền SPREADSHEET_ID."
      }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (!spreadsheet) {
      throw new Error("Không thể kết nối đến Google Sheets.");
    }

    var sheets = spreadsheet.getSheets();
    var sheetNames = sheets.map(function(s) { return s.getName(); });
    var hasFullShow = sheetNames.indexOf("Full-show") !== -1;

    var sheet = spreadsheet.getSheetByName("Full-show");
    var allowedActions = [];
    if (sheet) {
      allowedActions = getAllowedValues(sheet.getRange(5, 2)) || [];
    }

    var report = {
      status: "success",
      message: "Kết nối đến Google Sheets thành công.",
      spreadsheetName: spreadsheet.getName(),
      spreadsheetId: SPREADSHEET_ID,
      allTabs: sheetNames,
      targetTabExists: hasFullShow,
      validationOnColumnB: allowedActions,
      diagnostics: hasFullShow
        ? "Tab 'Full-show' tồn tại và sẵn sàng đồng bộ."
        : "CẢNH BÁO: Không tìm thấy tab 'Full-show'."
    };

    return ContentService.createTextOutput(JSON.stringify(report, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "LỖI KẾT NỐI TRANG TÍNH: " + err.toString(),
      currentId: SPREADSHEET_ID
    }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Xử lý request POST: Đồng bộ toàn bộ logs hoặc chèn logs đơn lẻ.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    // Hỗ trợ tương thích ngược cho các request truyền thống
    if (!action && Array.isArray(payload)) {
      payload = {
        action: 'syncLogs',
        sheetId: SPREADSHEET_ID,
        tab: 'Full-show',
        values: payload.map(function(log) {
          return ["", log.action, log.tcin, log.tcout, log.tcswap, log.script, log.note];
        })
      };
      action = 'syncLogs';
    } else if (!action && payload && payload.logs) {
      payload = {
        action: 'syncLogs',
        sheetId: payload.spreadsheetId || SPREADSHEET_ID,
        tab: 'Full-show',
        values: payload.logs.map(function(log) {
          return ["", log.action, log.tcin, log.tcout, log.tcswap, log.script, log.note];
        })
      };
      action = 'syncLogs';
    }

    // ĐỒNG BỘ TOÀN BỘ LOGS CHO 1 TAB
    if (action === 'syncLogs') {
      var sheetId = payload.sheetId;
      var tabName = payload.tab || 'Full-show';
      var values = payload.values;
      var ss = SpreadsheetApp.openById(sheetId);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Tab không tồn tại: ' + tabName})).setMimeType(ContentService.MimeType.JSON);
      }

      // Xoá vùng cũ từ dòng 5 tới cột G trở xuống
      var lastRow = sheet.getLastRow();
      if (lastRow >= 5) {
        sheet.getRange(5, 1, lastRow - 4, 7).clearContent();
      }

      // Ghi dữ liệu mới nếu có
      if (values && values.length > 0) {
        values = cleanValues(sheet, values);
        sheet.getRange(5, 1, values.length, values[0].length).setValues(values);
      }

      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    // CHÈN THÊM LOG ĐƠN LẺ VÀO TAB CHỈ ĐỊNH (CUTDOWN)
    if (action === 'appendLog') {
      var sheetId = payload.sheetId;
      var tabName = payload.tab;
      var values = payload.values;
      var ss = SpreadsheetApp.openById(sheetId);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Tab không tồn tại: ' + tabName})).setMimeType(ContentService.MimeType.JSON);
      }

      // Tìm dòng trống tiếp theo (tối thiểu bắt đầu từ dòng 5)
      var lastRow = sheet.getLastRow();
      var targetRow = Math.max(5, lastRow + 1);

      if (values && values.length > 0) {
        values = cleanValues(sheet, values);
        sheet.getRange(targetRow, 1, values.length, values[0].length).setValues(values);
      }

      return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hỗ trợ chuyển đổi giá trị Action "DELETE" dựa trên Data Validation thực tế của cột B dòng 5.
 */
function cleanValues(sheet, values) {
  if (!values || !values.length) return values;
  try {
    var sampleCell = sheet.getRange(5, 2);
    var allowedActions = getAllowedValues(sampleCell);
    if (allowedActions) {
      for (var i = 0; i < values.length; i++) {
        var actionValue = values[i][1] || "";
        if (actionValue === "DELETE") {
          if (allowedActions.indexOf("DELETE") === -1) {
            for (var k = 0; k < allowedActions.length; k++) {
              var val = allowedActions[k].toString().toUpperCase();
              if (val.indexOf("DEL") === 0) {
                values[i][1] = allowedActions[k];
                break;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    Logger.log("cleanValues error: " + err.toString());
  }
  return values;
}

/**
 * Đọc các giá trị Data Validation từ một ô.
 */
function getAllowedValues(cell) {
  var rule = cell.getDataValidation();
  if (!rule) return null;

  var criteria = rule.getCriteriaType();
  var args = rule.getCriteriaValues();

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return args[0];
  }

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    var range = args[0];
    var values = range.getValues();
    return values.flat();
  }

  return null;
}

/**
 * Kích hoạt quyền ghi Google Drive.
 */
function authorizeDrive() {
  var tempFile = DriveApp.createFile("Autoscript_Auth_Temp.txt", "Temp");
  tempFile.setTrashed(true);
  Logger.log("Đã cấp quyền ghi Google Drive thành công.");
}
