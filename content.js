/**
 * Content Management — localStorage: contentTasks, contentFormatTags, contentPillarTags
 */
(function () {
  "use strict";

  var TASKS_KEY = "contentTasks";
  var FORMAT_TAGS_KEY = "contentFormatTags";
  var PILLAR_TAGS_KEY = "contentPillarTags";
  var USERS_KEY = "usersList";
  var AUTH_ROLE_KEY = "jarbtattoo-auth-role";
  var AUTH_USER_KEY = "jarbtattoo-auth-username";

  var STATUSES = [
    { id: "idea", label: "Idea" },
    { id: "in-progress", label: "In Progress" },
    { id: "ready-to-post", label: "Ready to Post" },
    { id: "published", label: "Published" },
  ];

  /** พาเลทโทนพาสเทล / Notion (รายการเต็ม — ใช้สำหรับ nextColorPair และ HEX อิสระ) */
  var TAG_PASTEL_PALETTE = [
    { bgHex: "#FFE4E6", textHex: "#881337" },
    { bgHex: "#FFEDD5", textHex: "#9A3412" },
    { bgHex: "#FEF3C7", textHex: "#854D0E" },
    { bgHex: "#FEF9C3", textHex: "#713F12" },
    { bgHex: "#ECFCCB", textHex: "#365314" },
    { bgHex: "#D9F99D", textHex: "#3F6212" },
    { bgHex: "#BBF7D0", textHex: "#14532D" },
    { bgHex: "#A7F3D0", textHex: "#065F46" },
    { bgHex: "#99F6E4", textHex: "#134E4A" },
    { bgHex: "#A5F3FC", textHex: "#155E75" },
    { bgHex: "#BAE6FD", textHex: "#075985" },
    { bgHex: "#BFDBFE", textHex: "#1E40AF" },
    { bgHex: "#C7D2FE", textHex: "#312E81" },
    { bgHex: "#DDD6FE", textHex: "#5B21B6" },
    { bgHex: "#E9D5FF", textHex: "#6B21A8" },
    { bgHex: "#F3E8FF", textHex: "#581C87" },
    { bgHex: "#FAE8FF", textHex: "#86198F" },
    { bgHex: "#FCE7F3", textHex: "#9D174D" },
    { bgHex: "#FED7AA", textHex: "#C2410C" },
    { bgHex: "#FECACA", textHex: "#B91C1C" },
    { bgHex: "#FECDD3", textHex: "#BE123C" },
    { bgHex: "#FBCFE8", textHex: "#A21CAF" },
    { bgHex: "#E0E7FF", textHex: "#3730A3" },
    { bgHex: "#DBEAFE", textHex: "#1D4ED8" },
    { bgHex: "#CCFBF1", textHex: "#0F766E" },
    { bgHex: "#D1FAE5", textHex: "#047857" },
    { bgHex: "#DCFCE7", textHex: "#166534" },
    { bgHex: "#F5F5F4", textHex: "#44403C" },
    { bgHex: "#E7E5E4", textHex: "#292524" },
    { bgHex: "#F1F5F9", textHex: "#334155" },
    { bgHex: "#EDE9FE", textHex: "#5B21B6" },
    { bgHex: "#EFF6FF", textHex: "#1E40AF" },
  ];

  /** แมปคลาส Tailwind เดิม → HEX (งานเก่าใน localStorage) */
  var TW_LEGACY = {
    "bg-pink-100": { bgHex: "#FCE7F3", textHex: "#9F1239" },
    "bg-blue-100": { bgHex: "#DBEAFE", textHex: "#1E40AF" },
    "bg-cyan-100": { bgHex: "#CFFAFE", textHex: "#0E7490" },
    "bg-purple-100": { bgHex: "#F3E8FF", textHex: "#6B21A8" },
    "bg-stone-100": { bgHex: "#F5F5F4", textHex: "#44403C" },
    "bg-orange-100": { bgHex: "#FFEDD5", textHex: "#9A3412" },
    "bg-green-100": { bgHex: "#DCFCE7", textHex: "#166534" },
    "bg-fuchsia-100": { bgHex: "#FAE8FF", textHex: "#86198F" },
    "bg-violet-100": { bgHex: "#EDE9FE", textHex: "#5B21B6" },
    "bg-emerald-100": { bgHex: "#D1FAE5", textHex: "#065F46" },
    "bg-sky-100": { bgHex: "#E0F2FE", textHex: "#0369A1" },
    "bg-amber-100": { bgHex: "#FEF3C7", textHex: "#92400E" },
    "bg-rose-100": { bgHex: "#FFE4E6", textHex: "#881337" },
    "bg-teal-100": { bgHex: "#CCFBF1", textHex: "#134E4A" },
    "bg-indigo-100": { bgHex: "#E0E7FF", textHex: "#3730A3" },
    "bg-lime-100": { bgHex: "#ECFCCB", textHex: "#365314" },
  };

  var DEFAULT_FORMATS = [
    { id: "fmt-reel", label: "Reel", bg: "bg-pink-100", text: "text-pink-900" },
    { id: "fmt-post-single", label: "Post (Single)", bg: "bg-blue-100", text: "text-blue-900" },
    { id: "fmt-post-carousel", label: "Post (Carousel)", bg: "bg-cyan-100", text: "text-cyan-900" },
    { id: "fmt-reel-gif", label: "Reel (Gif)", bg: "bg-purple-100", text: "text-purple-900" },
  ];

  var DEFAULT_PILLARS = [
    { id: "pil-daily", label: "Daily Content", bg: "bg-stone-100", text: "text-stone-800" },
    { id: "pil-story", label: "Storytelling", bg: "bg-orange-100", text: "text-orange-900" },
    { id: "pil-engage", label: "Engagement", bg: "bg-green-100", text: "text-green-900" },
    { id: "pil-edu", label: "Educate", bg: "bg-blue-100", text: "text-blue-900" },
  ];

  var currentView = "table";
  var tableSortAsc = true;
  var editingId = null;
  var openDropdown = null;
  var viewDate = new Date();
  viewDate.setDate(1);

  /** อีโมจินำหน้าแถบปฏิทิน (สีพื้นหลัง/ตัวอักษรตาม Content Pillar) */
  var STATUS_CAL = {
    idea: { cls: "border-neutral-200 bg-neutral-100 text-neutral-800", short: "💡" },
    "in-progress": { cls: "border-amber-200 bg-amber-100 text-amber-950", short: "⏳" },
    "ready-to-post": { cls: "border-emerald-200 bg-emerald-100 text-emerald-950", short: "✓" },
    published: { cls: "border-neutral-700 bg-neutral-800 text-white", short: "✓" },
  };

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v != null ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    if (typeof JarbtattooSheetsStorage !== "undefined" && JarbtattooSheetsStorage.syncAfterLocalWrite) {
      JarbtattooSheetsStorage.syncAfterLocalWrite(key, val);
    }
  }

  function ensureTagDefaults() {
    var f = loadJSON(FORMAT_TAGS_KEY, null);
    if (!Array.isArray(f) || f.length === 0) saveJSON(FORMAT_TAGS_KEY, DEFAULT_FORMATS);
    var p = loadJSON(PILLAR_TAGS_KEY, null);
    if (!Array.isArray(p) || p.length === 0) saveJSON(PILLAR_TAGS_KEY, DEFAULT_PILLARS);
  }

  function loadTasks() {
    var a = loadJSON(TASKS_KEY, []);
    return Array.isArray(a) ? a : [];
  }

  function saveTasks(list) {
    saveJSON(TASKS_KEY, list);
  }

  function loadFormats() {
    return loadJSON(FORMAT_TAGS_KEY, DEFAULT_FORMATS);
  }

  function loadPillars() {
    return loadJSON(PILLAR_TAGS_KEY, DEFAULT_PILLARS);
  }

  function saveFormats(arr) {
    saveJSON(FORMAT_TAGS_KEY, arr);
  }

  function savePillars(arr) {
    saveJSON(PILLAR_TAGS_KEY, arr);
  }

  function findTag(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function normalizeHex6(s) {
    if (s == null) return null;
    s = String(s).trim();
    if (!s) return null;
    if (s[0] !== "#") s = "#" + s;
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
      s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return null;
    return s.toUpperCase();
  }

  function hexToRgb(hex) {
    var h = normalizeHex6(hex);
    if (!h) return null;
    h = h.slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function relativeLuminance(rgb) {
    function lin(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var R = lin(rgb.r);
    var G = lin(rgb.g);
    var B = lin(rgb.b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  /** สีตัวอักษรบนพื้นหลัง HEX อ่านง่าย */
  function readableTextForBg(bgHex) {
    var rgb = hexToRgb(bgHex);
    if (!rgb) return "#171717";
    return relativeLuminance(rgb) > 0.58 ? "#171717" : "#FAFAFA";
  }

  /** 10 สีสำหรับพาเลทแบบ 2 แถว × 5 (แสดงในฟอร์ม) */
  function getPaletteSwatchGrid() {
    return TAG_PASTEL_PALETTE.slice(0, 10);
  }

  function tagUsesHex(tag) {
    return !!(tag && normalizeHex6(tag.bgHex) && normalizeHex6(tag.textHex));
  }

  function tagResolveColors(tag) {
    if (tagUsesHex(tag)) {
      return { bgHex: normalizeHex6(tag.bgHex), textHex: normalizeHex6(tag.textHex) };
    }
    var tw = tag && tag.bg ? TW_LEGACY[tag.bg] : null;
    if (tw) return { bgHex: tw.bgHex, textHex: tw.textHex };
    var d0 = TAG_PASTEL_PALETTE[0];
    return { bgHex: d0.bgHex, textHex: d0.textHex };
  }

  function syncPaletteGridSelection(gridBox, pendingObj) {
    if (!gridBox) return;
    var selBg = normalizeHex6(pendingObj.bgHex);
    var selTx = normalizeHex6(pendingObj.textHex);
    gridBox.querySelectorAll("[data-pal-bg]").forEach(function (b) {
      var active = b.getAttribute("data-pal-bg") === selBg && b.getAttribute("data-pal-tx") === selTx;
      b.classList.toggle("ring-2", active);
      b.classList.toggle("ring-neutral-900", active);
      b.classList.toggle("ring-offset-2", active);
    });
  }

  /** พาเลท 2 แถว × 5 สี + <input type="color"> (HEX อิสระ) */
  function renderTagPaletteHost(hostEl, pendingObj) {
    if (!hostEl || !pendingObj) return;
    hostEl.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "mx-auto flex w-full max-w-[220px] flex-col items-stretch gap-2";

    var gridBox = document.createElement("div");
    gridBox.className = "grid w-full grid-cols-5 gap-1.5";
    gridBox.setAttribute("role", "group");

    getPaletteSwatchGrid().forEach(function (pal) {
      var palBg = normalizeHex6(pal.bgHex);
      var palTx = normalizeHex6(pal.textHex);
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-pal-bg", palBg);
      b.setAttribute("data-pal-tx", palTx);
      b.title = "พื้น " + palBg;
      b.className =
        "mx-auto h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-md outline-none ring-1 ring-black/15 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-violet-500";
      b.style.backgroundColor = palBg;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        pendingObj.bgHex = palBg;
        pendingObj.textHex = palTx;
        if (hostEl.__cinp) hostEl.__cinp.value = palBg;
        if (hostEl.__readout) hostEl.__readout.textContent = palBg;
        syncPaletteGridSelection(gridBox, pendingObj);
      });
      gridBox.appendChild(b);
    });
    wrap.appendChild(gridBox);

    var hint = document.createElement("p");
    hint.className = "w-full text-center text-[9px] font-medium uppercase tracking-wide text-neutral-400";
    hint.textContent = "สีละเอียด (HEX)";

    var hexRow = document.createElement("div");
    hexRow.className = "flex w-full items-center gap-2";
    var cinp = document.createElement("input");
    cinp.type = "color";
    cinp.className =
      "h-9 w-11 shrink-0 cursor-pointer rounded-md border border-neutral-200 bg-white p-0.5 shadow-inner";
    cinp.title = "เลือกสีพื้นหลังแบบอิสระ (HEX)";
    var curBg = normalizeHex6(pendingObj.bgHex) || "#E8E4F0";
    cinp.value = curBg;
    var hexReadout = document.createElement("span");
    hexReadout.className = "min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-600";
    hexReadout.textContent = curBg;

    cinp.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    cinp.addEventListener("input", function (e) {
      e.stopPropagation();
      var v = normalizeHex6(cinp.value);
      if (!v) return;
      pendingObj.bgHex = v;
      pendingObj.textHex = readableTextForBg(v);
      hexReadout.textContent = v;
      syncPaletteGridSelection(gridBox, pendingObj);
    });

    hostEl.__cinp = cinp;
    hostEl.__readout = hexReadout;
    hexRow.appendChild(cinp);
    hexRow.appendChild(hexReadout);
    wrap.appendChild(hint);
    wrap.appendChild(hexRow);
    hostEl.appendChild(wrap);
    syncPaletteGridSelection(gridBox, pendingObj);
  }

  function badgeHTML(tag) {
    if (!tag) return '<span class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">—</span>';
    var lab = escapeHtml(tag.label);
    if (tagUsesHex(tag)) {
      var bh = normalizeHex6(tag.bgHex);
      var th = normalizeHex6(tag.textHex);
      return (
        '<span class="inline-flex items-center rounded-md border border-neutral-200/90 px-2 py-0.5 text-xs font-medium" style="background-color:' +
        bh +
        ";color:" +
        th +
        '">' +
        lab +
        "</span>"
      );
    }
    return (
      '<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ' +
      (tag.bg || "bg-neutral-100") +
      " " +
      (tag.text || "text-neutral-700") +
      '">' +
      lab +
      "</span>"
    );
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusLabel(id) {
    for (var i = 0; i < STATUSES.length; i++) {
      if (STATUSES[i].id === id) return STATUSES[i].label;
    }
    return id || "—";
  }

  function nextColorPair(index) {
    var p = TAG_PASTEL_PALETTE[index % TAG_PASTEL_PALETTE.length];
    return { bgHex: p.bgHex, textHex: p.textHex };
  }

  function uid(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function ymd(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fillAssigneeSelect() {
    var sel = document.getElementById("field-assignee");
    if (!sel || sel.tagName !== "SELECT") return;
    var current = (sel.value || "").trim();
    while (sel.options.length) sel.remove(0);
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "— เลือกผู้รับผิดชอบ —";
    sel.appendChild(o0);
    var list = loadJSON(USERS_KEY, []);
    if (Array.isArray(list)) {
      list.forEach(function (u) {
        if (!u || !u.username) return;
        var o = document.createElement("option");
        o.value = u.username;
        o.textContent = (u.name && String(u.name).trim()) ? u.name + " (" + u.username + ")" : u.username;
        sel.appendChild(o);
      });
    }
    if (current) {
      var found = false;
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === current) {
          found = true;
          break;
        }
      }
      if (found) sel.value = current;
      else {
        var ox = document.createElement("option");
        ox.value = current;
        ox.textContent = current + " (ไม่พบในระบบ)";
        sel.appendChild(ox);
        sel.value = current;
      }
    }
  }

  function reassignTasksTagId(oldId, newId, type) {
    var key = type === "format" ? "formatId" : "pillarId";
    var list = loadTasks();
    var ch = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i][key] === oldId) {
        list[i][key] = newId;
        ch = true;
      }
    }
    if (ch) saveTasks(list);
  }

  function refreshTagPanel(type) {
    var pid = type === "format" ? "panel-dd-format" : "panel-dd-pillar";
    var p = document.getElementById(pid);
    if (p && typeof p._renderTagPanel === "function") p._renderTagPanel();
  }

  function deleteTag(type, tagId) {
    var arr = type === "format" ? loadFormats().slice() : loadPillars().slice();
    if (arr.length <= 1) {
      alert("ต้องมีอย่างน้อย 1 ตัวเลือก");
      return;
    }
    var replacement = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id !== tagId) {
        replacement = arr[i].id;
        break;
      }
    }
    if (!replacement) return;
    var idx = -1;
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].id === tagId) {
        idx = j;
        break;
      }
    }
    if (idx < 0) return;
    reassignTasksTagId(tagId, replacement, type);
    arr.splice(idx, 1);
    if (type === "format") saveFormats(arr);
    else savePillars(arr);
    var hidId = type === "format" ? "field-format-id" : "field-pillar-id";
    var btnId = type === "format" ? "btn-dd-format" : "btn-dd-pillar";
    var hid = document.getElementById(hidId);
    if (hid && hid.value === tagId) {
      hid.value = replacement;
      syncDropdownButtonLabel(btnId, findTag(arr, replacement));
    }
    refreshTagPanel(type);
    renderViews();
  }

  function updateTagFields(type, tagId, label, bgHex, textHex) {
    var trimmed = label != null ? String(label).trim() : "";
    if (!trimmed) {
      alert("กรุณากรอกชื่อตัวเลือก");
      return false;
    }
    var bh = normalizeHex6(bgHex);
    var th = normalizeHex6(textHex);
    if (!bh || !th) {
      alert("สีไม่ถูกต้อง กรุณาเลือกสีอีกครั้ง");
      return false;
    }
    var arr = type === "format" ? loadFormats() : loadPillars();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === tagId) {
        arr[i].label = trimmed;
        arr[i].bgHex = bh;
        arr[i].textHex = th;
        delete arr[i].bg;
        delete arr[i].text;
        break;
      }
    }
    if (type === "format") saveFormats(arr);
    else savePillars(arr);
    var hidId = type === "format" ? "field-format-id" : "field-pillar-id";
    var btnId = type === "format" ? "btn-dd-format" : "btn-dd-pillar";
    var hid = document.getElementById(hidId);
    if (hid && hid.value === tagId) {
      syncDropdownButtonLabel(btnId, findTag(arr, tagId));
    }
    refreshTagPanel(type);
    renderViews();
    return true;
  }

  function setAuthHeader() {
    var user = sessionStorage.getItem(AUTH_USER_KEY) || "";
    var role = (sessionStorage.getItem(AUTH_ROLE_KEY) || "").toLowerCase();
    var uEl = document.getElementById("content-auth-user");
    var rEl = document.getElementById("content-auth-role");
    if (uEl) uEl.textContent = user || "—";
    if (rEl) rEl.textContent = role ? "สิทธิ์: " + role : "";
    var lu = document.getElementById("link-users-content");
    if (lu) lu.classList.toggle("hidden", role !== "manager");
  }

  function closeAllDropdowns() {
    var nodes = document.querySelectorAll("[data-notion-dropdown]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.add("hidden");
    }
    openDropdown = null;
  }

  function buildNotionDropdown(btnId, panelId, fieldHiddenId, type) {
    var btn = document.getElementById(btnId);
    var panel = document.getElementById(panelId);
    var hidden = document.getElementById(fieldHiddenId);
    if (!btn || !panel || !hidden) return;

    function initNewSwatches() {
      var newSw = panel.querySelector("[data-dd-new-swatches]");
      if (!newSw) return;
      var d0 = TAG_PASTEL_PALETTE[0];
      if (!panel._addColorPending) {
        panel._addColorPending = { bgHex: d0.bgHex, textHex: d0.textHex };
      } else {
        panel._addColorPending.bgHex = d0.bgHex;
        panel._addColorPending.textHex = d0.textHex;
      }
      renderTagPaletteHost(newSw, panel._addColorPending);
    }

    function renderPanel() {
      var arr = type === "format" ? loadFormats() : loadPillars();
      var body = panel.querySelector("[data-dd-body]");
      if (!body) return;
      body.innerHTML = "";
      arr.forEach(function (t) {
        var tagId = t.id;
        var wrap = document.createElement("div");
        wrap.className =
          "rounded-md border border-transparent px-1 py-1 hover:border-neutral-100 hover:bg-neutral-50/80";

        var row = document.createElement("div");
        row.className = "flex flex-wrap items-center gap-1";

        var pick = document.createElement("button");
        pick.type = "button";
        pick.className = "min-w-0 flex-1 text-left text-sm";
        pick.innerHTML = badgeHTML(t);
        pick.addEventListener("click", function () {
          hidden.value = tagId;
          syncDropdownButtonLabel(btnId, findTag(type === "format" ? loadFormats() : loadPillars(), tagId));
          panel.classList.add("hidden");
          openDropdown = null;
        });

        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className =
          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100";
        editBtn.textContent = "แก้ไข";
        editBtn.title = "แก้ไขชื่อและสี";

        var del = document.createElement("button");
        del.type = "button";
        del.className =
          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50";
        del.textContent = "ลบ";
        del.title = "ลบตัวเลือก";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          var cur = findTag(type === "format" ? loadFormats() : loadPillars(), tagId);
          var lab = cur ? cur.label : "";
          if (!confirm('ลบตัวเลือก "' + lab + '" ? งานที่ใช้ตัวเลือกนี้จะถูกเปลี่ยนไปใช้ตัวเลือกอื่น')) return;
          deleteTag(type, tagId);
        });

        var editor = document.createElement("div");
        editor.setAttribute("data-tag-editor", "1");
        editor.className = "mt-2 hidden rounded-md border border-neutral-200 bg-neutral-50/50 p-2";

        var labelInp = document.createElement("input");
        labelInp.type = "text";
        labelInp.className =
          "mb-2 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900";

        var pending = tagResolveColors(t);
        var paletteHost = document.createElement("div");
        paletteHost.className = "mb-2";

        function loadEditorFromStorage() {
          var cur = findTag(type === "format" ? loadFormats() : loadPillars(), tagId);
          if (!cur) return;
          labelInp.value = cur.label;
          var r = tagResolveColors(cur);
          pending.bgHex = r.bgHex;
          pending.textHex = r.textHex;
          renderTagPaletteHost(paletteHost, pending);
        }

        var btnRow = document.createElement("div");
        btnRow.className = "flex flex-wrap justify-end gap-2";
        var btnCancel = document.createElement("button");
        btnCancel.type = "button";
        btnCancel.className =
          "rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50";
        btnCancel.textContent = "ยกเลิก";
        var btnSave = document.createElement("button");
        btnSave.type = "button";
        btnSave.className =
          "rounded bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-neutral-800";
        btnSave.textContent = "บันทึก";
        btnRow.appendChild(btnCancel);
        btnRow.appendChild(btnSave);

        renderTagPaletteHost(paletteHost, pending);
        editor.appendChild(labelInp);
        editor.appendChild(paletteHost);
        editor.appendChild(btnRow);

        editBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var opening = editor.classList.contains("hidden");
          body.querySelectorAll("[data-tag-editor]").forEach(function (el) {
            el.classList.add("hidden");
          });
          if (opening) {
            loadEditorFromStorage();
            editor.classList.remove("hidden");
            labelInp.focus();
          }
        });

        btnCancel.addEventListener("click", function (e) {
          e.stopPropagation();
          editor.classList.add("hidden");
        });

        btnSave.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!updateTagFields(type, tagId, labelInp.value, pending.bgHex, pending.textHex)) return;
          editor.classList.add("hidden");
        });

        row.appendChild(pick);
        row.appendChild(editBtn);
        row.appendChild(del);
        wrap.appendChild(row);
        wrap.appendChild(editor);
        body.appendChild(wrap);
      });
    }

    panel._renderTagPanel = renderPanel;
    initNewSwatches();

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var wasOpen = !panel.classList.contains("hidden");
      closeAllDropdowns();
      if (wasOpen) return;
      renderPanel();
      initNewSwatches();
      var colorBlock = panel.querySelector("[data-dd-new-color-block]");
      if (colorBlock) colorBlock.classList.add("hidden");
      panel.classList.remove("hidden");
      openDropdown = panel;
    });

    panel.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target.closest && e.target.closest("[data-dd-toggle-new-swatches]")) {
        var block = panel.querySelector("[data-dd-new-color-block]");
        if (block) block.classList.toggle("hidden");
      }
    });
    var addBtn = panel.querySelector("[data-dd-add]");
    if (addBtn) {
      addBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var inp = panel.querySelector("[data-dd-new-input]");
        if (!inp) return;
        var label = String(inp.value || "").trim();
        if (!label) {
          alert("กรุณาพิมพ์ชื่อตัวเลือก");
          return;
        }
        var arr = type === "format" ? loadFormats() : loadPillars();
        var p = panel._addColorPending;
        if (!p) {
          var d0 = TAG_PASTEL_PALETTE[0];
          p = { bgHex: d0.bgHex, textHex: d0.textHex };
          panel._addColorPending = p;
        }
        var bh = normalizeHex6(p.bgHex);
        var th = normalizeHex6(p.textHex);
        if (!bh || !th) {
          var np = nextColorPair(arr.length);
          bh = np.bgHex;
          th = np.textHex;
        }
        var newTag = {
          id: uid(type === "format" ? "fmt" : "pil"),
          label: label,
          bgHex: bh,
          textHex: th,
        };
        arr.push(newTag);
        if (type === "format") saveFormats(arr);
        else savePillars(arr);
        inp.value = "";
        hidden.value = newTag.id;
        syncDropdownButtonLabel(btnId, newTag);
        renderPanel();
        renderViews();
      });
    }
  }

  function syncDropdownButtonLabel(btnId, tag) {
    var btn = document.getElementById(btnId);
    if (!btn || !tag) return;
    btn.innerHTML = badgeHTML(tag);
  }

  function syncDropdownsFromHidden() {
    var fid = document.getElementById("field-format-id").value;
    var pid = document.getElementById("field-pillar-id").value;
    var ft = findTag(loadFormats(), fid) || loadFormats()[0];
    var pt = findTag(loadPillars(), pid) || loadPillars()[0];
    if (ft) {
      document.getElementById("field-format-id").value = ft.id;
      syncDropdownButtonLabel("btn-dd-format", ft);
    }
    if (pt) {
      document.getElementById("field-pillar-id").value = pt.id;
      syncDropdownButtonLabel("btn-dd-pillar", pt);
    }
  }

  function openModal(task) {
    editingId = task ? task.id : null;
    document.getElementById("modal-title").textContent = task ? "แก้ไขคอนเทนต์" : "คอนเทนต์ใหม่";
    document.getElementById("field-period").value = (task && task.periodDate) || "";
    document.getElementById("field-name").value = (task && task.contentName) || "";
    document.getElementById("field-captions").value = (task && task.captionsPost) || "";
    document.getElementById("field-link").value = (task && task.linkPost) || "";
    document.getElementById("field-status").value = (task && task.status) || "idea";
    var fid = (task && task.formatId) || loadFormats()[0].id;
    var pid = (task && task.pillarId) || loadPillars()[0].id;
    document.getElementById("field-format-id").value = fid;
    document.getElementById("field-pillar-id").value = pid;
    syncDropdownsFromHidden();
    fillAssigneeSelect();
    document.getElementById("field-assignee").value = (task && task.assignee) || "";
    var delBtn = document.getElementById("modal-delete");
    if (delBtn) delBtn.classList.toggle("hidden", !editingId);
    var m = document.getElementById("task-modal");
    m.classList.remove("hidden");
    m.classList.add("flex");
  }

  function closeModal() {
    var m = document.getElementById("task-modal");
    m.classList.add("hidden");
    m.classList.remove("flex");
    editingId = null;
    closeAllDropdowns();
  }

  function saveTaskFromForm() {
    var period = document.getElementById("field-period").value;
    if (!period) {
      alert("กรุณาเลือกวันที่โพสต์");
      return;
    }
    var assignee = (document.getElementById("field-assignee").value || "").trim();
    if (!assignee) {
      alert("กรุณาเลือกผู้รับผิดชอบจากผู้ใช้ในระบบ");
      return;
    }
    var contentName = (document.getElementById("field-name").value || "").trim();
    if (!contentName) {
      alert("กรุณากรอกชื่องาน / หัวข้อ");
      return;
    }
    var list = loadTasks();
    var now = new Date().toISOString();
    var payload = {
      id: editingId || uid("ct"),
      periodDate: period,
      assignee: assignee,
      formatId: document.getElementById("field-format-id").value,
      pillarId: document.getElementById("field-pillar-id").value,
      contentName: contentName,
      captionsPost: document.getElementById("field-captions").value || "",
      linkPost: document.getElementById("field-link").value || "",
      status: document.getElementById("field-status").value,
      updatedAt: now,
    };
    if (editingId) {
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === editingId) {
          payload.createdAt = list[i].createdAt || now;
          list[i] = payload;
          found = true;
          break;
        }
      }
      if (!found) return;
    } else {
      payload.createdAt = now;
      list.push(payload);
    }
    saveTasks(list);
    closeModal();
    renderViews();
  }

  function deleteCurrentTask() {
    if (!editingId) return;
    if (!confirm("ลบงานนี้?")) return;
    var list = loadTasks().filter(function (t) {
      return t.id !== editingId;
    });
    saveTasks(list);
    closeModal();
    renderViews();
  }

  function renderTable() {
    var tb = document.getElementById("table-body");
    if (!tb) return;
    var tasks = loadTasks().slice();
    tasks.sort(function (a, b) {
      var da = (a.periodDate || "").localeCompare(b.periodDate || "");
      return tableSortAsc ? da : -da;
    });
    var formats = loadFormats();
    var pillars = loadPillars();
    tb.innerHTML = "";
    if (tasks.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="9" class="px-4 py-8 text-center text-sm text-neutral-500">ยังไม่มีงาน — กด "+ New Content"</td>';
      tb.appendChild(tr);
      return;
    }
    tasks.forEach(function (t) {
      var tr = document.createElement("tr");
      tr.className = "cursor-pointer border-b border-neutral-100 hover:bg-neutral-50/80";
      tr.addEventListener("click", function () {
        openModal(t);
      });
      var fmt = findTag(formats, t.formatId);
      var pil = findTag(pillars, t.pillarId);
      tr.innerHTML =
        "<td class=\"whitespace-nowrap px-3 py-2 text-sm text-neutral-800\">" +
        escapeHtml(t.periodDate || "—") +
        "</td>" +
        "<td class=\"px-3 py-2 text-sm text-neutral-800\">" +
        escapeHtml(t.assignee || "—") +
        "</td>" +
        "<td class=\"px-3 py-2\">" +
        badgeHTML(fmt) +
        "</td>" +
        "<td class=\"px-3 py-2\">" +
        badgeHTML(pil) +
        "</td>" +
        "<td class=\"max-w-[200px] truncate px-3 py-2 text-sm font-medium text-neutral-900\">" +
        escapeHtml(t.contentName) +
        "</td>" +
        "<td class=\"max-w-[220px] truncate px-3 py-2 text-xs text-neutral-600\">" +
        escapeHtml((t.captionsPost || "").replace(/\n/g, " ")) +
        "</td>" +
        "<td class=\"px-3 py-2 text-xs\">" +
        (t.linkPost
          ? '<a href="' +
            escapeHtml(t.linkPost) +
            '" class="text-violet-700 underline" target="_blank" rel="noopener" onclick="event.stopPropagation()">ลิงก์</a>'
          : "—") +
        "</td>" +
        "<td class=\"px-3 py-2 text-sm text-neutral-700\">" +
        escapeHtml(statusLabel(t.status)) +
        "</td>" +
        "<td class=\"px-3 py-2 text-right\">" +
        '<button type="button" class="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-white" data-edit="' +
        escapeHtml(t.id) +
        '">แก้ไข</button></td>';
      var btn = tr.querySelector("[data-edit]");
      if (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          openModal(t);
        });
      }
      tb.appendChild(tr);
    });
  }

  function renderBoard() {
    var wrap = document.getElementById("board-columns");
    if (!wrap) return;
    wrap.innerHTML = "";
    var tasks = loadTasks();
    var formats = loadFormats();
    var pillars = loadPillars();
    STATUSES.forEach(function (st) {
      var col = document.createElement("div");
      col.className = "flex min-h-[280px] min-w-[220px] flex-1 flex-col rounded-xl border border-neutral-200 bg-neutral-50/80";
      col.dataset.statusDrop = st.id;
      col.innerHTML =
        '<div class="border-b border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">' +
        escapeHtml(st.label) +
        "</div>" +
        '<div class="flex flex-1 flex-col gap-2 p-2" data-cards></div>';
      var cardHost = col.querySelector("[data-cards]");
      tasks
        .filter(function (t) {
          return (t.status || "idea") === st.id;
        })
        .forEach(function (t) {
          var fmt = findTag(formats, t.formatId);
          var pil = findTag(pillars, t.pillarId);
          var card = document.createElement("div");
          card.draggable = true;
          card.dataset.taskId = t.id;
          card.className =
            "cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm active:cursor-grabbing";
          card.innerHTML =
            '<p class="text-sm font-semibold text-neutral-900">' +
            escapeHtml(t.contentName) +
            "</p>" +
            '<p class="mt-1 text-xs text-neutral-500">' +
            escapeHtml(t.periodDate || "") +
            "</p>" +
            '<div class="mt-2 flex flex-wrap gap-1">' +
            badgeHTML(fmt) +
            badgeHTML(pil) +
            "</div>";
          card.addEventListener("dragstart", function (e) {
            e.dataTransfer.setData("text/task-id", t.id);
            e.dataTransfer.effectAllowed = "move";
            card.classList.add("opacity-60");
          });
          card.addEventListener("dragend", function () {
            card.classList.remove("opacity-60");
          });
          card.addEventListener("click", function (e) {
            e.stopPropagation();
            openModal(t);
          });
          cardHost.appendChild(card);
        });
      col.addEventListener("dragover", function (e) {
        e.preventDefault();
        col.classList.add("ring-2", "ring-violet-200");
      });
      col.addEventListener("dragleave", function () {
        col.classList.remove("ring-2", "ring-violet-200");
      });
      col.addEventListener("drop", function (e) {
        e.preventDefault();
        col.classList.remove("ring-2", "ring-violet-200");
        var id = e.dataTransfer.getData("text/task-id");
        if (!id) return;
        var list = loadTasks();
        var now = new Date().toISOString();
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) {
            list[i].status = st.id;
            list[i].updatedAt = now;
            break;
          }
        }
        saveTasks(list);
        renderViews();
      });
      wrap.appendChild(col);
    });
  }

  function tasksForCalendarDate(ymdStr) {
    return loadTasks().filter(function (t) {
      return String(t.periodDate || "").trim() === ymdStr;
    });
  }

  function renderCalendar() {
    var title = document.getElementById("content-cal-title");
    var tb = document.getElementById("content-cal-body");
    if (title) {
      title.textContent = viewDate.toLocaleString("th-TH", { month: "long", year: "numeric" });
    }
    if (!tb) return;
    tb.innerHTML = "";
    var pillars = loadPillars();
    var y = viewDate.getFullYear();
    var m = viewDate.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var dayNum = 1;
    for (var row = 0; row < 6; row++) {
      var tr = document.createElement("tr");
      for (var col = 0; col < 7; col++) {
        var td = document.createElement("td");
        td.className =
          "align-top border border-neutral-100 bg-white p-2 align-top min-h-[120px] w-[14.28%] align-top";
        var idx = row * 7 + col;
        if (idx < startDow || dayNum > daysInMonth) {
          td.className += " bg-neutral-50/80";
        } else {
          var cellDate = new Date(y, m, dayNum);
          var ds = ymd(cellDate);
          var num = document.createElement("div");
          num.className = "mb-1.5 text-lg font-semibold tabular-nums text-neutral-800";
          num.textContent = String(dayNum);
          td.appendChild(num);
          var stack = document.createElement("div");
          stack.className = "flex max-h-44 flex-col gap-1 overflow-y-auto";
          tasksForCalendarDate(ds).forEach(function (t) {
            var st = STATUS_CAL[t.status] || STATUS_CAL.idea;
            var pil = findTag(pillars, t.pillarId);
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className =
              "w-full rounded-md border px-1.5 py-1 text-left text-[11px] font-medium leading-snug border-neutral-300/80";
            if (pil && tagUsesHex(pil)) {
              btn.style.backgroundColor = normalizeHex6(pil.bgHex);
              btn.style.color = normalizeHex6(pil.textHex);
            } else if (pil && pil.bg && pil.text) {
              btn.className += " " + pil.bg + " " + pil.text;
            } else {
              btn.className += " border-neutral-200 bg-neutral-100 text-neutral-800";
            }
            btn.textContent = st.short + " " + (t.contentName || "—");
            btn.addEventListener("click", function () {
              openModal(t);
            });
            stack.appendChild(btn);
          });
          td.appendChild(stack);
          dayNum++;
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
      if (dayNum > daysInMonth && row >= 4) break;
    }
  }

  function setActiveTab(view) {
    currentView = view;
    var tabs = [
      { id: "tab-table", v: "table" },
      { id: "tab-board", v: "board" },
      { id: "tab-calendar", v: "calendar" },
    ];
    for (var i = 0; i < tabs.length; i++) {
      var el = document.getElementById(tabs[i].id);
      if (!el) continue;
      if (tabs[i].v === view) {
        el.classList.add("border-neutral-900", "text-neutral-900");
        el.classList.remove("border-transparent", "text-neutral-500");
      } else {
        el.classList.remove("border-neutral-900", "text-neutral-900");
        el.classList.add("border-transparent", "text-neutral-500");
      }
    }
    renderViews();
  }

  function renderViews() {
    var vt = document.getElementById("view-table");
    var vb = document.getElementById("view-board");
    var vc = document.getElementById("view-calendar");
    if (vt) vt.classList.toggle("hidden", currentView !== "table");
    if (vb) vb.classList.toggle("hidden", currentView !== "board");
    if (vc) vc.classList.toggle("hidden", currentView !== "calendar");
    if (currentView === "table") renderTable();
    else if (currentView === "board") renderBoard();
    else renderCalendar();
  }

  function wire() {
    document.getElementById("btn-new-content").addEventListener("click", function () {
      openModal(null);
    });
    document.getElementById("tab-table").addEventListener("click", function () {
      setActiveTab("table");
    });
    document.getElementById("tab-board").addEventListener("click", function () {
      setActiveTab("board");
    });
    document.getElementById("tab-calendar").addEventListener("click", function () {
      setActiveTab("calendar");
    });
    document.getElementById("content-cal-prev").addEventListener("click", function () {
      viewDate.setMonth(viewDate.getMonth() - 1);
      renderCalendar();
    });
    document.getElementById("content-cal-next").addEventListener("click", function () {
      viewDate.setMonth(viewDate.getMonth() + 1);
      renderCalendar();
    });
    document.getElementById("sort-date").addEventListener("click", function () {
      tableSortAsc = !tableSortAsc;
      renderTable();
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-backdrop").addEventListener("click", closeModal);
    document.getElementById("modal-save").addEventListener("click", saveTaskFromForm);
    document.getElementById("modal-delete").addEventListener("click", deleteCurrentTask);
    document.getElementById("btn-content-logout").addEventListener("click", function () {
      sessionStorage.removeItem(AUTH_ROLE_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem("jarbtattoo-auth-artist-key");
      try {
        localStorage.removeItem(AUTH_ROLE_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem("jarbtattoo-auth-artist-key");
      } catch (e) {}
      window.location.href = "login.html";
    });
    document.addEventListener("click", function () {
      closeAllDropdowns();
    });
    buildNotionDropdown("btn-dd-format", "panel-dd-format", "field-format-id", "format");
    buildNotionDropdown("btn-dd-pillar", "panel-dd-pillar", "field-pillar-id", "pillar");
  }

  async function jarbtattooContentBoot() {
    try {
      if (typeof JarbtattooSheetsStorage !== "undefined") {
        JarbtattooSheetsStorage.configure({
          baseUrl: (typeof JARBTATTOO_SHEETS_URL !== "undefined" && JARBTATTOO_SHEETS_URL) || "",
        });
        JarbtattooSheetsStorage.initSyncBadge();
        await JarbtattooSheetsStorage.pullAllToLocal();
      }
    } catch (e) {
      console.error("[JarbtattooSheets] initial pull failed", e);
    }
    ensureTagDefaults();
    setAuthHeader();
    wire();
    syncDropdownsFromHidden();
    renderViews();
    window.addEventListener("storage", function (e) {
      if (e.key === TASKS_KEY || e.key === FORMAT_TAGS_KEY || e.key === PILLAR_TAGS_KEY || e.key === USERS_KEY) {
        fillAssigneeSelect();
        renderViews();
      }
    });
  }
  jarbtattooContentBoot();
})();
