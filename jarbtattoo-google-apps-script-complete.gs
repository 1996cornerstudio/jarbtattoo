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
 *   ข้อมูลเก็บเป็น JSON ในเซลล์ A1 ต่อชีต (ถ้ายังไม่มีชีต จะถูกสร้างตอน save ครั้งแรก)
 *
 * === API ฝั่งเว็บ (jarbtattoo-sheets-storage.js) ===
 *   GET  ?action=loadAll[&_secret=...]
 *   POST body: JSON { action:"save", key:"...", payload: ... } [, _secret ]
 *   Content-Type จากเว็บมักเป็น text/plain;charset=utf-8
 *
 * === Script property (ไม่บังคับ) ===
 *   คีย์ JARBTATTOO_WEB_SECRET — ถ้าตั้งค่าแล้ว ต้องส่ง _secret ใน query (GET) หรือใน body (POST)
 *   ให้ตรงกับค่าที่ส่งจาก JarbtattooSheetsStorage.configure({ secret: "..." })
 *
 * === หมายเหตุ ===
 *   เซลล์ A1 จำกัดความยาว ~50,000 ตัวอักษร — แปลง base64 เป็น Drive URL ก่อนเขียน (processBookingImages_)
 *   ครั้งแรกที่ใช้ DriveApp ระบบจะขอสิทธิ์ OAuth — ยอมรับตามขั้นตอน Google
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
 * GET: ไม่มี ?action → ข้อความสุขภาพ (เปิด URL ในเบราว์เซอร์)
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
      if (key === "jarbtattoo-bookings-v1") {
        payload = processBookingImages_(payload);
      }
      writeJson_(ss, shName, payload);
      return jsonOut_({ ok: true });
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

function readJson_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return null;
  var v = sh.getRange("A1").getValue();
  if (v === "" || v === null) return null;
  try {
    return JSON.parse(String(v));
  } catch (err) {
    return null;
  }
}

function writeJson_(ss, sheetName, payload) {
  var sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sh.clear();
  sh.getRange("A1").setValue(JSON.stringify(payload));
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

  for (var i = 0; i < payload.length; i++) {
    var booking = payload[i];
    if (!booking || typeof booking !== "object") continue;

    var id = booking.id != null ? String(booking.id) : String(Date.now()) + "_" + i;

    if (booking.referenceImage && String(booking.referenceImage).indexOf("data:image") === 0) {
      if (!folder) folder = getOrCreateImageFolder_();
      booking.referenceImage = uploadBase64ToDrive_(booking.referenceImage, "ref_" + id, folder);
    }

    if (booking.placementImage && String(booking.placementImage).indexOf("data:image") === 0) {
      if (!folder) folder = getOrCreateImageFolder_();
      booking.placementImage = uploadBase64ToDrive_(booking.placementImage, "place_" + id, folder);
    }
  }

  return payload;
}

/**
 * ค้นหาหรือสร้างโฟลเดอร์สำหรับเก็บรูป
 */
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

/**
 * แยก data URL แล้วสร้างไฟล์ใน Drive — ตั้งลิงก์ให้เปิดดูรูปนอก Google ได้
 */
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
