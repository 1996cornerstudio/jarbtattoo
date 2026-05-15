/**
 * Jarbtattoo — Google Apps Script (ผูกกับสเปรดชีตเดียวกับที่ Deploy Web App)
 *
 * === Deploy Web App ===
 * 1. สร้าง/เปิดสคริปต์จากสเปรดชีต: ส่วนขยาย > Apps Script
 * 2. วางโค้ดนี้ใน Code.gs แล้วบันทึก
 * 3. Deploy > New deployment > Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (หรือตามนโยบายของคุณ)
 * 4. คัดลอก URL ลงท้าย /exec ไปใส่ JARBTATTOO_SHEETS_URL ในเว็บ
 *
 * === ชื่อแท็บชีต (ต้องตรงกับ getSheetMap_) ===
 *   bookings, availability, contentTasks, contentFormatTags, contentPillarTags,
 *   usersList, customRoles
 *
 * === รูปแบบเก็บข้อมูล ===
 *   - Array ของ object (เช่น bookings): แถวแรก = หัวคอลัมน์, แถวถัดไป = 1 รายการ/แถว
 *   - ข้อมูลก้อนเดียว / array ว่าง: JSON ในเซลล์ A1 (รองรับข้อมูลเก่า)
 *   - readJson_ อ่านได้ทั้งแบบตาราง (ใหม่) และ A1 JSON (เก่า) อัตโนมัติ
 *
 * === API ฝั่งเว็บ (jarbtattoo-sheets-storage.js) ===
 *   GET  ?action=loadAll[&_secret=...]
 *   POST { action:"save", key:"...", payload: ... }
 *   ตอบกลับ bookings หลังแปลงรูป: { ok: true, bookings: [...] }
 *
 * === Script property (ไม่บังคับ) ===
 *   JARBTATTOO_WEB_SECRET — ส่ง _secret ใน query (GET) หรือ body (POST)
 */

/** ชื่อ property ใน File > Project settings > Script properties */
var SCRIPT_PROPERTY_SECRET_KEY = "JARBTATTOO_WEB_SECRET";

/** แมป: คีย์จากเว็บ (body.key / stores key) -> ชื่อแท็บชีต */
function getSheetMap_() {
  return {
    "jarbtattoo-bookings-v1": "bookings",
    "jarbtattoo-artist-availability": "availability",
    contentTasks: "contentTasks",
    contentFormatTags: "contentFormatTags",
    contentPillarTags: "contentPillarTags",
    usersList: "usersList",
    "jarbtattoo-custom-roles": "customRoles",
  };
}

/**
 * GET: ไม่มี ?action → ข้อความสุขภาพ
 *      ?action=loadAll → JSON ทุก store
 */
function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  if (!p.action) {
    return ContentService.createTextOutput(
      "Jarbtattoo API is ready for Action! 🟢 (GET Mode)"
    ).setMimeType(ContentService.MimeType.TEXT);
  }
  try {
    if (!checkSecret_(p._secret, null)) {
      return jsonOut_({ ok: false, error: "unauthorized" });
    }
    var action = String(p.action || "");
    if (action !== "loadAll") {
      return jsonOut_({ ok: false, error: "unknown GET action" });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonOut_({
        ok: false,
        error: "no active spreadsheet — bind this script to the spreadsheet (Extensions > Apps Script from file)",
      });
    }
    var map = getSheetMap_();
    var stores = {};
    for (var clientKey in map) {
      if (!Object.prototype.hasOwnProperty.call(map, clientKey)) continue;
      stores[clientKey] = readJson_(ss, map[clientKey]);
    }
    return jsonOut_({ ok: true, stores: stores });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var body = parsePostBody_(e);
    if (!checkSecret_(e && e.parameter && e.parameter._secret, body && body._secret)) {
      return jsonOut_({ ok: false, error: "unauthorized" });
    }
    var action = body.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonOut_({
        ok: false,
        error: "no active spreadsheet — bind this script to the spreadsheet",
      });
    }
    if (action === "save") {
      var key = body.key;
      var sheetMap = getSheetMap_();
      var shName = sheetMap[key];
      if (!shName) {
        return jsonOut_({ ok: false, error: "unknown key: " + key });
      }
      var payload = body.payload;
      var response = { ok: true };
      if (key === "jarbtattoo-bookings-v1") {
        payload = processBookingImages_(payload);
        response.bookings = payload;
      }
      writeJson_(ss, shName, payload);
      return jsonOut_(response);
    }
    return jsonOut_({ ok: false, error: "unknown POST action" });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function parsePostBody_(e) {
  if (!e || !e.postData || e.postData.contents == null) {
    return {};
  }
  try {
    return JSON.parse(String(e.postData.contents));
  } catch (err) {
    return {};
  }
}

/** ถ้าไม่ได้ตั้ง Script property secret → ผ่านเสมอ */
function checkSecret_(querySecret, bodySecret) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty(SCRIPT_PROPERTY_SECRET_KEY);
  if (!expected || String(expected).trim() === "") {
    return true;
  }
  var got = querySecret != null && String(querySecret) !== "" ? String(querySecret) : "";
  if (!got && bodySecret != null) got = String(bodySecret);
  return got === String(expected);
}

/**
 * อ่านข้อมูลจากชีต — รองรับทั้งแบบตาราง (แยกคอลัมน์) และ JSON ใน A1 (ข้อมูลเก่า)
 * @returns {Array|Object|null}
 */
function readJson_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return null;
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return null;

  // แบบเก่า: JSON ทั้งก้อนใน A1 เดียว
  if (lastRow === 1 && lastCol === 1) {
    var v = sh.getRange("A1").getValue();
    if (v === "" || v === null) return null;
    try {
      return JSON.parse(String(v));
    } catch (err) {
      return null;
    }
  }

  // แบบใหม่: แถว 1 = headers, แถว 2+ = ข้อมูล
  var data = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var rows = data.slice(1);
  var list = [];

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var empty = true;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== "" && row[c] != null) {
        empty = false;
        break;
      }
    }
    if (empty) continue;

    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (h === "" || h == null) continue;
      var val = row[i];
      if (typeof val === "string") {
        var trimmed = val.trim();
        if (trimmed.indexOf("{") === 0 || trimmed.indexOf("[") === 0) {
          try {
            val = JSON.parse(trimmed);
          } catch (parseErr) {}
        }
      }
      obj[String(h)] = val;
    }
    list.push(obj);
  }

  return list;
}

/** แปลงค่า cell — object/array เก็บเป็น JSON string */
function cellValue_(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return val;
}

/** รวมชื่อคอลัมน์จากทุกแถว (ลำดับตามรายการแรกที่พบ) */
function collectHeaders_(items) {
  var seen = {};
  var headers = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || typeof item !== "object") continue;
    var keys = Object.keys(item);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!seen[key]) {
        seen[key] = true;
        headers.push(key);
      }
    }
  }
  return headers;
}

/**
 * บันทึกลงชีต
 * - Array ที่มีข้อมูล → แยกคอลัมน์ (ลดปัญหาเซลล์ A1 จำกัด ~50k ตัวอักษร)
 * - อื่นๆ → JSON ใน A1
 */
function writeJson_(ss, sheetName, payload) {
  var sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sh.clear();

  if (payload === undefined || payload === null) {
    return;
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    sh.getRange("A1").setValue(JSON.stringify(payload));
    return;
  }

  var headers = collectHeaders_(payload);
  if (headers.length === 0) {
    sh.getRange("A1").setValue(JSON.stringify(payload));
    return;
  }

  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#f3f3f3");

  var rows = [];
  for (var i = 0; i < payload.length; i++) {
    var item = payload[i];
    if (!item || typeof item !== "object") {
      rows.push(
        headers.map(function () {
          return "";
        })
      );
      continue;
    }
    rows.push(
      headers.map(function (h) {
        return cellValue_(item[h]);
      })
    );
  }

  if (rows.length > 0) {
    sh.getRange(2, 1, 1 + rows.length, headers.length).setValues(rows);
    try {
      sh.autoResizeColumns(1, headers.length);
    } catch (resizeErr) {}
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// ส่วนจัดการรูปภาพเข้า Google Drive
// ==========================================

/**
 * แปลง Base64 (data URL) ในรายการจองให้เป็นลิงก์ Google Drive ก่อนบันทึกลงชีต
 */
function processBookingImages_(payload) {
  if (!Array.isArray(payload)) return payload;

  var folder = null;

  function folder_() {
    if (!folder) folder = getOrCreateImageFolder_();
    return folder;
  }

  function uploadField_(booking, fieldName, filePrefix) {
    var v = booking[fieldName];
    if (!v) return;
    if (isRemoteImageUrl_(v)) return;
    if (String(v).indexOf("data:image") !== 0) return;
    var id = booking.id != null ? String(booking.id) : String(Date.now());
    booking[fieldName] = uploadBase64ToDrive_(String(v), filePrefix + "_" + id, folder_());
  }

  for (var i = 0; i < payload.length; i++) {
    var booking = payload[i];
    if (!booking || typeof booking !== "object") continue;

    uploadField_(booking, "referenceImage", "ref");
    uploadField_(booking, "placementImage", "place");
    uploadField_(booking, "depositSlipImage", "deposit");
    uploadField_(booking, "designSketchImage", "design");
    uploadField_(booking, "cotSlipImage", "cot");
  }

  return payload;
}

/** รูปที่อัปโหลด Drive แล้ว หรือเป็น URL ภายนอก — ไม่แปลงซ้ำ */
function isRemoteImageUrl_(v) {
  if (v === "" || v == null) return false;
  var s = String(v).trim();
  if (s.indexOf("data:image") === 0) return false;
  if (s.indexOf("drive.google.com") !== -1) return true;
  if (s.indexOf("googleusercontent.com") !== -1) return true;
  if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return true;
  return false;
}

function getOrCreateImageFolder_() {
  var folderName = "Jarbtattoo_Images";
  var folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }
  var newFolder = DriveApp.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

function uploadBase64ToDrive_(base64String, filename, folder) {
  try {
    var splitData = String(base64String).split(",");
    if (splitData.length !== 2) return base64String;

    var typeMatch = splitData[0].match(/:(.*?);/);
    if (!typeMatch) return base64String;

    var mimeType = typeMatch[1];
    var extPart = mimeType.split("/")[1] || "png";
    var extension = extPart.replace("svg+xml", "svg");
    var data = splitData[1];

    var blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, filename + "." + extension);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (error) {
    return base64String;
  }
}
