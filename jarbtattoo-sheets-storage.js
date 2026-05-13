/**
 * Jarbtattoo — Google Sheets backend via Google Apps Script Web App
 *
 * วาง URL จาก Deploy > Web app (Execute as: Me, Who has access: Anyone)
 * ตั้ง JARBTATTOO_SHEETS_URL หรือเรียก configure({ baseUrl, secret }) — ถ้าไม่ระบุ baseUrl
 * จะ fallback เป็น JARBTATTOO_SHEETS_URL หรือ DEFAULT_SHEETS_EXEC_URL ในไฟล์นี้
 * ถ้า GAS ใช้ JARBTATTOO_WEB_SECRET ให้ตั้ง window.JARBTATTOO_SHEETS_SECRET หรือส่ง secret ใน configure
 *
 * ---------------------------------------------------------------------------
 * สัญญา API ฝั่ง Google Apps Script
 * ---------------------------------------------------------------------------
 * - loadAll: เรียก GET ?action=loadAll (&_secret=… ถ้ามี) — อ่าน JSON ได้ (CORS)
 *              ถ้าเปิด URL แบบไม่มี query ฝั่ง GAS อาจคืนข้อความสุขภาพ (plain text) แทน JSON
 * - save:     เรียก POST body เป็น JSON string + Content-Type text/plain (simple request)
 *              ใช้ mode cors เพื่ออ่านผลลัพธ์ — GAS ควรส่ง Access-Control-Allow-Origin ใน response
 *
 *   function doGet(e) {
 *     var action = e.parameter.action;
 *     var ss = SpreadsheetApp.getActiveSpreadsheet();
 *     if (action === "loadAll") {
 *       return jsonOut({
 *         ok: true,
 *         stores: {
 *           "jarbtattoo-bookings-v1": readJson_(ss, "bookings"),
 *           "jarbtattoo-artist-availability": readJson_(ss, "availability"),
 *           "contentTasks": readJson_(ss, "contentTasks"),
 *           "contentFormatTags": readJson_(ss, "contentFormatTags"),
 *           "contentPillarTags": readJson_(ss, "contentPillarTags"),
 *           "usersList": readJson_(ss, "usersList"),
 *           "jarbtattoo-custom-roles": readJson_(ss, "customRoles")
 *         }
 *       });
 *     }
 *     return jsonOut({ ok: false, error: "unknown GET action" });
 *   }
 *
 *   function doPost(e) {
 *     var lock = LockService.getScriptLock();
 *     lock.waitLock(30000);
 *     try {
 *       var body = JSON.parse(e.postData.contents || "{}");
 *       var action = body.action;
 *       var ss = SpreadsheetApp.getActiveSpreadsheet();
 *       if (action === "save") {
 *         var key = body.key;
 *         var sheetMap = {
 *           "jarbtattoo-bookings-v1": "bookings",
 *           "jarbtattoo-artist-availability": "availability",
 *           "contentTasks": "contentTasks",
 *           "contentFormatTags": "contentFormatTags",
 *           "contentPillarTags": "contentPillarTags",
 *           "usersList": "usersList",
 *           "jarbtattoo-custom-roles": "customRoles"
 *         };
 *         var shName = sheetMap[key];
 *         if (!shName) return jsonOut({ ok: false, error: "unknown key: " + key });
 *         writeJson_(ss, shName, body.payload);
 *         return jsonOut({ ok: true });
 *       }
 *       return jsonOut({ ok: false, error: "unknown POST action" });
 *     } catch (err) {
 *       return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
 *     } finally {
 *       lock.releaseLock();
 *     }
 *   }
 *
 *   function readJson_(ss, sheetName) {
 *     var sh = ss.getSheetByName(sheetName);
 *     if (!sh) return null;
 *     var v = sh.getRange("A1").getValue();
 *     if (!v) return null;
 *     return JSON.parse(String(v));
 *   }
 *
 *   function writeJson_(ss, sheetName, payload) {
 *     var sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
 *     sh.clear();
 *     sh.getRange("A1").setValue(JSON.stringify(payload));
 *   }
 *
 *   function jsonOut(obj) {
 *     return ContentService
 *       .createTextOutput(JSON.stringify(obj))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 *
 * เก็บ JSON ทั้งก้อนในเซลล์ A1 ต่อชีต — โครงสร้างตรงกับที่ localStorage เคยเก็บ
 * เพื่อให้สถานะงาน / SLA / deadline ใน admin คำนวณจากฟิลด์เดิม (เช่น createdAt,
 * depositSlipImage, designSketchImage, status, …) และป้ายสีคอนเทนต์จาก bgHex/textHex
 *
 * @fileoverview Remote load/save แทน localStorage สำหรับคิวนัด คิวว่าง คอนเทนต์ และ users/login
 */
(function (global) {
  "use strict";

  /** คีย์เดียวกับที่ใช้ใน index / admin / schedule / content.js / users.html / login.html */
  var STORE_KEYS = {
    BOOKINGS: "jarbtattoo-bookings-v1",
    AVAILABILITY: "jarbtattoo-artist-availability",
    CONTENT_TASKS: "contentTasks",
    CONTENT_FORMAT_TAGS: "contentFormatTags",
    CONTENT_PILLAR_TAGS: "contentPillarTags",
    USERS_LIST: "usersList",
    CUSTOM_ROLES: "jarbtattoo-custom-roles",
  };

  /** URL Web App ค่าเริ่มต้น (Deploy จบที่ /exec) */
  var DEFAULT_SHEETS_EXEC_URL =
    "https://script.google.com/macros/s/AKfycbzi5BMtlvv75d_DhBc3mTv0xdtgKOrzSn3bXS67O5KweWoSaMNlZsmtV_hvXNMF-lvUKw/exec";

  var state = {
    baseUrl: "",
    /** เว้นว่าง = ไม่แนบ token (ถ้า Web App ของคุณตรวจ query แทน body ให้ต่อเอง) */
    secret: "",
  };

  var SYNCABLE_KEY_SET = {};
  Object.keys(STORE_KEYS).forEach(function (k) {
    SYNCABLE_KEY_SET[STORE_KEYS[k]] = true;
  });

  var loadOverlayEl = null;
  var badgeEl = null;
  var badgeHideTimer = null;
  var remoteSaveCount = 0;

  /** ISO timestamp ของครั้งล่าสุดที่ดึงจาก Sheets ลงเครื่องสำเร็จ */
  var LAST_SYNC_STORAGE_KEY = "jarbtattoo-sheets-last-sync-at";

  function recordLastSyncedAt() {
    if (typeof global.localStorage === "undefined") return;
    try {
      global.localStorage.setItem(LAST_SYNC_STORAGE_KEY, new Date().toISOString());
    } catch (e) {
      console.warn("[JarbtattooSheets] recordLastSyncedAt failed", e);
    }
  }

  function getLastSyncedAt() {
    if (typeof global.localStorage === "undefined") return null;
    try {
      return global.localStorage.getItem(LAST_SYNC_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function formatLastSyncedForDisplay(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
    } catch (e) {
      return String(iso);
    }
  }

  /**
   * แจ้ง Last Synced — console เสมอ; badge เฉพาะตอนไม่มี remote save ค้าง
   * @param {{ fullSync?: boolean }} opts
   */
  function flashLastSyncFeedback(opts) {
    var o = opts || {};
    var iso = getLastSyncedAt();
    var line = "[JarbtattooSheets] Last synced at: " + (iso || "(unknown)") + (iso ? " — " + formatLastSyncedForDisplay(iso) : "");
    if (o.fullSync) line += " (full sync: pull + push)";
    console.log(line);
    if (typeof document === "undefined") return;
    if (remoteSaveCount > 0) return;
    initSyncBadge();
    var msg = o.fullSync ? "✅ ซิงค์ครบ (ดึง+ส่ง) · " : "✅ ดึงล่าสุด · ";
    msg += iso ? formatLastSyncedForDisplay(iso) : "—";
    setBadgeVisible(msg, 1);
    clearTimeout(badgeHideTimer);
    badgeHideTimer = setTimeout(function () {
      if (badgeEl) badgeEl.style.opacity = "0";
    }, 2200);
  }

  /**
   * @param {{ baseUrl?: string, secret?: string }} cfg
   *   baseUrl — URL Web App จบที่ /exec (ว่าง = ไม่บังคับ state; ยังอาจ fallback URL เริ่มต้นในไฟล์นี้)
   *   secret — ตรงกับ Script property JARBTATTOO_WEB_SECRET ฝั่ง GAS (ถ้าไม่ส่ง จะลองอ่าน window.JARBTATTOO_SHEETS_SECRET)
   */
  function configure(cfg) {
    state.baseUrl = "";
    state.secret = "";
    if (cfg) {
      var u = cfg.baseUrl != null ? String(cfg.baseUrl).trim() : "";
      if (u) state.baseUrl = u.replace(/\/?$/, "");
      if (cfg.secret != null) state.secret = String(cfg.secret);
    }
    if (!state.secret && typeof global.JARBTATTOO_SHEETS_SECRET === "string") {
      var gsec = String(global.JARBTATTOO_SHEETS_SECRET).trim();
      if (gsec) state.secret = gsec;
    }
  }

  function getConfiguredUrl() {
    var fromGlobal =
      typeof global.JARBTATTOO_SHEETS_URL === "string" ? String(global.JARBTATTOO_SHEETS_URL).trim() : "";
    var u = state.baseUrl || fromGlobal || DEFAULT_SHEETS_EXEC_URL;
    return String(u).replace(/\/?$/, "");
  }

  function buildUrlWithQuery(baseUrl, query) {
    var parts = [];
    Object.keys(query).forEach(function (k) {
      var v = query[k];
      if (v === undefined || v === null || v === "") return;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    });
    if (!parts.length) return baseUrl;
    var sep = baseUrl.indexOf("?") >= 0 ? "&" : "?";
    return baseUrl + sep + parts.join("&");
  }

  /**
   * ดึงข้อมูลทั้งหมด — GET + query (ไม่ preflight) เพื่ออ่าน JSON จาก GAS ได้
   */
  function fetchLoadAll() {
    var url = getConfiguredUrl();
    if (!url) {
      return Promise.reject(new Error("ยังไม่ได้ตั้ง baseUrl (Sheets ปิดอยู่)"));
    }
    var query = { action: "loadAll" };
    if (state.secret) query._secret = state.secret;
    var fullUrl = buildUrlWithQuery(url, query);
    return fetch(fullUrl, {
      method: "GET",
      mode: "cors",
      redirect: "follow",
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error("loadAll HTTP " + res.status + ": " + String(text).slice(0, 200));
        });
      }
      return res.json();
    });
  }

  /**
   * บันทึกขึ้น Sheets — POST + text/plain (ลดปัญหา preflight) อ่าน JSON ตอบกลับได้
   */
  function postJson(payload) {
    var url = getConfiguredUrl();
    if (!url) {
      return Promise.reject(new Error("ยังไม่ได้ตั้ง baseUrl (Sheets ปิดอยู่)"));
    }
    var body = Object.assign({}, payload);
    if (state.secret) body._secret = state.secret;
    return fetch(url, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          throw new Error("ตอบกลับไม่ใช่ JSON: " + String(text).slice(0, 200));
        }
        if (!res.ok) {
          throw new Error(data.error || "HTTP " + res.status);
        }
        if (data && data.ok === false) {
          throw new Error(data.error || "save failed");
        }
        return data;
      });
    });
  }

  /**
   * โหลดทุก store ในครั้งเดียว (แนะนำให้ GAS รองรับ action loadAll)
   * @returns {Promise<{
   *   ok: boolean,
   *   stores: Record<string, unknown>
   * }>}
   */
  function loadAll() {
    return fetchLoadAll().then(function (data) {
      if (!data.ok) throw new Error(data.error || "loadAll failed");
      if (!data.stores || typeof data.stores !== "object") {
        throw new Error("loadAll: ตอบกลับไม่มี stores");
      }
      return data;
    });
  }

  /**
   * บันทึก store เดียว (ทับค่าเต็มก้อน — ส่ง array/object เดียวกับ localStorage)
   * @param {string} key — ใช้ค่าจาก STORE_KEYS
   * @param {unknown} payload — จะถูก JSON.stringify ฝั่ง GAS
   */
  function save(key, payload) {
    if (!getConfiguredUrl()) {
      return Promise.resolve({ ok: true, skipped: true });
    }
    return postJson({ action: "save", key: key, payload: payload }).then(function (data) {
      if (!data.ok) throw new Error(data.error || "save failed");
      return data;
    });
  }

  /** --- ตัวช่วยเฉพาะโดเมน (คิวนัด / คิวว่าง / คอนเทนต์) --- */

  function loadBookings() {
    return loadAll().then(function (d) {
      var v = d.stores[STORE_KEYS.BOOKINGS];
      return Array.isArray(v) ? v : [];
    });
  }

  function saveBookings(list) {
    return save(STORE_KEYS.BOOKINGS, Array.isArray(list) ? list : []);
  }

  function loadAvailability() {
    return loadAll().then(function (d) {
      var v = d.stores[STORE_KEYS.AVAILABILITY];
      return Array.isArray(v) ? v : [];
    });
  }

  function saveAvailability(list) {
    return save(STORE_KEYS.AVAILABILITY, Array.isArray(list) ? list : []);
  }

  /**
   * @returns {Promise<{
   *   tasks: Array,
   *   formats: Array,
   *   pillars: Array
   * }>}
   */
  function loadContentBundle() {
    return loadAll().then(function (d) {
      var tasks = d.stores[STORE_KEYS.CONTENT_TASKS];
      var formats = d.stores[STORE_KEYS.CONTENT_FORMAT_TAGS];
      var pillars = d.stores[STORE_KEYS.CONTENT_PILLAR_TAGS];
      return {
        tasks: Array.isArray(tasks) ? tasks : [],
        formats: Array.isArray(formats) ? formats : [],
        pillars: Array.isArray(pillars) ? pillars : [],
      };
    });
  }

  function saveContentBundle(bundle) {
    var b = bundle || {};
    return Promise.all([
      save(STORE_KEYS.CONTENT_TASKS, Array.isArray(b.tasks) ? b.tasks : []),
      save(STORE_KEYS.CONTENT_FORMAT_TAGS, Array.isArray(b.formats) ? b.formats : []),
      save(STORE_KEYS.CONTENT_PILLAR_TAGS, Array.isArray(b.pillars) ? b.pillars : []),
    ]).then(function () {
      return { ok: true };
    });
  }

  /**
   * ผูกข้อมูลจาก Sheets ลง localStorage ชั่วคราว เพื่อให้โค้ดเดิมที่อ่าน localStorage ยังทำงาน
   * (เหมาะกับช่วงย้ายระบบ — โหลดครั้งเดียวหลัง login แล้วค่อยรีแฟกเตอร์เป็น async ทีหลัง)
   */
  function hydrateLocalStorageFromStores(stores) {
    if (!stores || typeof stores !== "object") return;
    Object.keys(STORE_KEYS).forEach(function (k) {
      var key = STORE_KEYS[k];
      if (stores[key] !== undefined && stores[key] !== null) {
        try {
          global.localStorage.setItem(key, JSON.stringify(stores[key]));
        } catch (e) {
          console.warn("hydrate skip " + key, e);
        }
      }
    });
  }

  function showSheetsLoadingOverlay() {
    if (typeof document === "undefined") return;
    if (!loadOverlayEl) {
      loadOverlayEl = document.createElement("div");
      loadOverlayEl.id = "jarbtattoo-sheets-loading-overlay";
      loadOverlayEl.setAttribute("role", "status");
      loadOverlayEl.className =
        "fixed inset-0 z-[10000] hidden flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-[2px]";
      loadOverlayEl.innerHTML =
        '<div class="h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" aria-hidden="true"></div>' +
        '<p class="text-sm font-medium text-neutral-800">กำลังดึงข้อมูลจาก Sheets…</p>';
      document.body.appendChild(loadOverlayEl);
    }
    loadOverlayEl.classList.remove("hidden");
  }

  function hideSheetsLoadingOverlay() {
    if (loadOverlayEl) loadOverlayEl.classList.add("hidden");
  }

  /**
   * ดึงจาก Sheets แล้วเขียนลง localStorage ทั้งหมด (ไม่มี URL = resolve ทันที ไม่ทับ local)
   * @param {{ skipOverlay?: boolean }} [opts]
   */
  function pullAllToLocal(opts) {
    var options = opts || {};
    if (!getConfiguredUrl()) {
      return Promise.resolve(null);
    }
    if (!options.skipOverlay) showSheetsLoadingOverlay();
    return loadAll()
      .then(function (d) {
        hydrateLocalStorageFromStores(d.stores);
        recordLastSyncedAt();
        flashLastSyncFeedback();
        return d.stores;
      })
      .finally(function () {
        if (!options.skipOverlay) hideSheetsLoadingOverlay();
      });
  }

  /**
   * Full sync: ดึงจาก Sheets ลงเครื่อง แล้ว push ทุกคีย์จาก localStorage ขึ้น Sheets
   * (ใช้เมื่อต้องการให้แน่ใจว่าข้อมูลบนเครื่องถูกส่งขึ้นไปหลังดึงล่าสุด)
   * @returns {Promise<{ ok: true, lastSyncedAt: string | null }>}
   */
  function forceSync() {
    if (!getConfiguredUrl()) {
      return Promise.reject(new Error("ยังไม่ได้ตั้ง baseUrl (Sheets ปิดอยู่)"));
    }
    return pullAllToLocal({ skipOverlay: true })
      .then(function (stores) {
        if (stores == null) {
          throw new Error("ดึงข้อมูลไม่สำเร็จหรือถูกข้าม");
        }
        return pushAllFromLocal().then(function () {
          flashLastSyncFeedback({ fullSync: true });
          return { ok: true, lastSyncedAt: getLastSyncedAt() };
        });
      });
  }

  function initSyncBadge() {
    if (typeof document === "undefined" || badgeEl) return;
    badgeEl = document.createElement("div");
    badgeEl.id = "jarbtattoo-sync-badge";
    badgeEl.setAttribute("aria-live", "polite");
    badgeEl.className =
      "pointer-events-none fixed bottom-4 left-4 z-[9999] max-w-[min(100vw-2rem,20rem)] rounded-full border border-neutral-200 bg-white/95 px-3 py-2 text-xs font-medium text-neutral-800 shadow-lg opacity-0 transition-opacity duration-500";
    badgeEl.textContent = "";
    document.body.appendChild(badgeEl);
  }

  function setBadgeVisible(text, opacity) {
    if (!badgeEl) return;
    badgeEl.textContent = text;
    badgeEl.style.opacity = opacity != null ? String(opacity) : "1";
  }

  function beginRemoteSaveIndicator() {
    if (!getConfiguredUrl()) return;
    initSyncBadge();
    remoteSaveCount++;
    clearTimeout(badgeHideTimer);
    setBadgeVisible("⏳ กำลังบันทึก…", 1);
  }

  function endRemoteSaveIndicator(success) {
    if (!getConfiguredUrl() || !badgeEl) return;
    remoteSaveCount = Math.max(0, remoteSaveCount - 1);
    if (remoteSaveCount > 0) return;
    clearTimeout(badgeHideTimer);
    if (success) {
      setBadgeVisible("✅ ข้อมูลตรงกัน", 1);
      badgeHideTimer = setTimeout(function () {
        if (badgeEl) badgeEl.style.opacity = "0";
      }, 2200);
    } else {
      setBadgeVisible("⚠️ ยังไม่ซิงค์ขึ้น Sheets", 1);
      badgeHideTimer = setTimeout(function () {
        if (badgeEl) badgeEl.style.opacity = "0";
      }, 3200);
    }
  }

  /**
   * หลัง localStorage.setItem แล้ว — ซิงก์ขึ้น Sheets แบบไม่บล็อก UI
   * @param {string} key
   * @param {unknown} value — object/array เดียวกับที่ stringify ลง local แล้ว
   */
  function syncAfterLocalWrite(key, value) {
    if (!SYNCABLE_KEY_SET[key]) return;
    if (!getConfiguredUrl()) return;
    beginRemoteSaveIndicator();
    save(key, value)
      .then(function () {
        endRemoteSaveIndicator(true);
      })
      .catch(function (err) {
        var msg = err && err.message ? String(err.message) : String(err);
        console.error("[JarbtattooSheets] syncAfterLocalWrite failed:", key, err);
        if (/unauthorized/i.test(msg)) {
          console.warn(
            "[JarbtattooSheets] บันทึกถูกปฏิเสธ (unauthorized) — ตั้ง Script property JARBTATTOO_WEB_SECRET ใน GAS แล้วต้องใส่ window.JARBTATTOO_SHEETS_SECRET หรือ JarbtattooSheetsStorage.configure({ secret: \"…\" }) ให้ตรงกัน"
          );
        }
        if (key === STORE_KEYS.BOOKINGS && value != null) {
          try {
            var approx = JSON.stringify(value).length;
            if (approx > 45000) {
              console.warn(
                "[JarbtattooSheets] payload จองยาว ~" +
                  approx +
                  " ตัวอักษร — Google Sheets จำกัดเซลล์ A1 ~50,000 ตัว; รูป data URL ควรถูกอัปโหลดเป็นลิงก์ (อัปเดตโค้ด GAS processBookingImages_ ให้ครบทุกฟิลด์รูป)"
              );
            }
          } catch (ignore) {}
        }
        endRemoteSaveIndicator(false);
      });
  }

  /**
   * อ่านจาก localStorage แล้ว push ขึ้น Sheets (ทีละคีย์)
   */
  function pushAllFromLocal() {
    function read(key) {
      try {
        var raw = global.localStorage.getItem(key);
        if (raw == null) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    var ops = [];
    ops.push(save(STORE_KEYS.BOOKINGS, read(STORE_KEYS.BOOKINGS) || []));
    ops.push(save(STORE_KEYS.AVAILABILITY, read(STORE_KEYS.AVAILABILITY) || []));
    ops.push(save(STORE_KEYS.CONTENT_TASKS, read(STORE_KEYS.CONTENT_TASKS) || []));
    ops.push(save(STORE_KEYS.CONTENT_FORMAT_TAGS, read(STORE_KEYS.CONTENT_FORMAT_TAGS) || []));
    ops.push(save(STORE_KEYS.CONTENT_PILLAR_TAGS, read(STORE_KEYS.CONTENT_PILLAR_TAGS) || []));
    ops.push(save(STORE_KEYS.USERS_LIST, read(STORE_KEYS.USERS_LIST) || []));
    ops.push(save(STORE_KEYS.CUSTOM_ROLES, read(STORE_KEYS.CUSTOM_ROLES) || []));
    return Promise.all(ops);
  }

  /** ตรวจว่า booking มีฟิลด์หลักสำหรับ SLA / การ์ด (ไม่บังคับรันใน production) */
  function assertBookingShapeForUi(bookings) {
    if (!Array.isArray(bookings)) return { ok: false, message: "bookings ไม่ใช่ array" };
    for (var i = 0; i < Math.min(bookings.length, 3); i++) {
      var b = bookings[i];
      if (!b || typeof b !== "object") continue;
      if (b.status == null) console.warn("assertBookingShape: รายการขาด status", b.id);
    }
    return { ok: true };
  }

  var api = {
    STORE_KEYS: STORE_KEYS,
    configure: configure,
    initSyncBadge: initSyncBadge,
    syncAfterLocalWrite: syncAfterLocalWrite,
    loadAll: loadAll,
    save: save,
    loadBookings: loadBookings,
    saveBookings: saveBookings,
    loadAvailability: loadAvailability,
    saveAvailability: saveAvailability,
    loadContentBundle: loadContentBundle,
    saveContentBundle: saveContentBundle,
    hydrateLocalStorageFromStores: hydrateLocalStorageFromStores,
    pullAllToLocal: pullAllToLocal,
    forceSync: forceSync,
    getLastSyncedAt: getLastSyncedAt,
    pushAllFromLocal: pushAllFromLocal,
    assertBookingShapeForUi: assertBookingShapeForUi,
  };

  global.JarbtattooSheetsStorage = api;
})(typeof window !== "undefined" ? window : this);
