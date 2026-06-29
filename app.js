const UI_LABELS = {
  appTitle: "業務メモ",
  home: "ホーム",
  search: "検索",
  newNote: "新規メモ",
  editNote: "メモ編集",
  noteDetail: "メモ詳細",
  importantNotes: "重要メモ",
  expiredNotes: "期限切れメモ",
  recentNotes: "最近更新したメモ",
  searchPlaceholder: "キーワード・タグで検索",
  title: "タイトル",
  body: "本文",
  suggestedTags: "おすすめタグ",
  defaultTags: "基本タグ",
  customTags: "自由タグ",
  addTag: "タグを追加",
  importance: "重要度",
  status: "状態",
  validUntil: "有効期限",
  checklist: "チェックリスト",
  save: "保存",
  delete: "削除",
  cancel: "キャンセル"
};

const IMPORTANCE_LABELS = { low: "低", normal: "通常", high: "高" };
const STATUS_LABELS = {
  active: "有効",
  needs_check: "確認必要",
  expired: "期限切れ",
  archived: "保管"
};

const DEFAULT_WORK_TAGS = [
  "チェックイン",
  "チェックアウト",
  "予約",
  "料金・返金",
  "客室変更",
  "長期滞在",
  "駐車場",
  "バス・交通",
  "荷物・ロッカー",
  "電話対応",
  "クレーム",
  "清掃・点検",
  "夜勤",
  "システム・機械",
  "その他のお知らせ"
];

const DEFAULT_CONTEXT_TAGS = [
  "重要",
  "緊急",
  "確認必要",
  "マネージャー確認",
  "よくある質問",
  "注意",
  "一時的なお知らせ",
  "常時ルール",
  "お客様案内",
  "スタッフ用",
  "フロント内部",
  "英語必要",
  "案内文"
];

const TAG_RULES = {
  "駐車場": ["駐車", "駐車場", "駐車タワー", "parking", "parking lot", "コインパーキング", "주차", "주차타워", "height limit"],
  "荷物・ロッカー": ["荷物", "手荷物", "ロッカー", "locker", "luggage", "預かり", "짐", "수하물", "락커"],
  "長期滞在": ["長期", "連泊", "15日", "long stay", "장기", "연박"],
  "料金・返金": ["返金", "取消", "キャンセル", "refund", "cancel", "料金", "決済", "booking.com", "Agoda", "환불", "취소"],
  "バス・交通": ["バス", "シャトル", "空港", "時刻表", "bus", "Tokoname", "버스", "셔틀"],
  "客室変更": ["客室変更", "部屋変更", "ルームチェンジ", "room change", "객실변경", "방 변경"],
  "クレーム": ["騒音", "苦情", "クレーム", "complaint", "うるさい", "소음", "불만", "항의"],
  "電話対応": ["電話", "通話", "transfer", "connect", "call", "전화", "통화"],
  "英語必要": ["英語", "English", "英文", "英語で", "영어", "how to say"],
  "案内文": ["案内", "説明", "お客様へ", "guest", "customer", "안내", "설명"]
};

const DB_NAME = "work-memo-db";
const STORE_NAME = "notes";
const BACKUP_VERSION = 1;
const BACKUP_ITERATIONS = 250000;
const app = document.querySelector("#app");

let notes = [];
let route = { page: "home", id: null };
let searchState = { query: "", tag: "", status: "", importance: "", expiredOnly: "" };
let editorState = null;

function sameRoute(first, second) {
  return first.page === second.page && first.id === second.id;
}

function syncEditorForRoute() {
  if (route.page !== "edit") {
    editorState = null;
    return;
  }
  if (!route.id) {
    editorState = editorState || blankEditor();
    return;
  }
  const note = notes.find((item) => item.id === route.id);
  editorState = note ? JSON.parse(JSON.stringify(note)) : blankEditor();
}

function navigate(nextRoute, { replace = false } = {}) {
  if (sameRoute(route, nextRoute) && !replace) {
    return;
  }
  route = nextRoute;
  syncEditorForRoute();
  const state = { route };
  if (replace) {
    history.replaceState(state, "", location.href);
  } else {
    history.pushState(state, "", location.href);
  }
  render();
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value) {
  return value ? value.slice(0, 10) : "";
}

function notePreviewDate(note) {
  return note.validUntil ? `有効期限 ${note.validUntil}` : `更新 ${toDateOnly(note.updatedAt)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function loadNotes() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

function saveNote(note) {
  return withStore("readwrite", (store) => store.put(note));
}

function removeNote(id) {
  return withStore("readwrite", (store) => store.delete(id));
}

function replaceAllNotes(nextNotes) {
  return withStore("readwrite", (store) => {
    store.clear();
    nextNotes.forEach((note) => store.put(note));
  });
}

function suggestTags(title, body) {
  const source = `${title} ${body}`.toLowerCase();
  return Object.entries(TAG_RULES)
    .filter(([, keywords]) => keywords.some((keyword) => source.includes(keyword.toLowerCase())))
    .map(([tag]) => tag);
}

function effectiveStatus(note) {
  if (note.status === "archived") return "archived";
  if (note.validUntil && note.validUntil < today()) return "expired";
  return note.status;
}

function sortedNotes(items) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function allTags() {
  return unique([...DEFAULT_WORK_TAGS, ...DEFAULT_CONTEXT_TAGS, ...notes.flatMap((note) => note.tags || [])]).sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function searchNotes(items, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  const tokens = normalizedQuery.split(/\s+/);
  return items.filter((note) => {
    const haystack = [note.title, note.body, ...(note.tags || [])].join(" ").toLowerCase();
    return tokens.every((token) => {
      if (token.startsWith("#")) {
        const tag = token.slice(1);
        return (note.tags || []).some((item) => item.toLowerCase() === tag);
      }
      return haystack.includes(token);
    });
  });
}

function filteredNotes() {
  return searchNotes(notes, searchState.query).filter((note) => {
    const status = effectiveStatus(note);
    if (searchState.tag && !(note.tags || []).includes(searchState.tag)) return false;
    if (searchState.status && status !== searchState.status) return false;
    if (searchState.importance && note.importance !== searchState.importance) return false;
    if (searchState.expiredOnly === "expired" && status !== "expired") return false;
    return true;
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveBackupKey(password, salt) {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: BACKUP_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function ensureCryptoAvailable() {
  if (!window.crypto?.subtle) {
    throw new Error("このブラウザでは暗号化バックアップを利用できません。HTTPSまたはlocalhostで開いてください。");
  }
}

async function createEncryptedBackup(password) {
  ensureCryptoAvailable();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const payload = {
    app: "work-memo",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes: notes.map(normalizeNote)
  };
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return {
    app: "work-memo",
    version: BACKUP_VERSION,
    encrypted: true,
    kdf: "PBKDF2",
    iterations: BACKUP_ITERATIONS,
    cipher: "AES-GCM",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function readEncryptedBackup(file, password) {
  ensureCryptoAvailable();
  const backup = JSON.parse(await file.text());
  if (backup.app !== "work-memo" || !backup.encrypted || backup.cipher !== "AES-GCM" || backup.kdf !== "PBKDF2") {
    throw new Error("業務メモの暗号化バックアップファイルではありません。");
  }
  const salt = base64ToBytes(backup.salt);
  const iv = base64ToBytes(backup.iv);
  const key = await deriveBackupKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(backup.data));
  const payload = JSON.parse(new TextDecoder().decode(decrypted));
  if (payload.app !== "work-memo" || !Array.isArray(payload.notes)) {
    throw new Error("バックアップ内容を読み込めません。");
  }
  return payload.notes.map(normalizeNote);
}

function normalizeNote(note) {
  const now = new Date().toISOString();
  return {
    id: String(note.id || uid("note")),
    title: String(note.title || ""),
    body: String(note.body || ""),
    tags: Array.isArray(note.tags) ? unique(note.tags.map(String)) : [],
    autoTags: Array.isArray(note.autoTags) ? unique(note.autoTags.map(String)) : [],
    dismissedAutoTags: Array.isArray(note.dismissedAutoTags) ? unique(note.dismissedAutoTags.map(String)) : [],
    manualTags: Array.isArray(note.manualTags) ? unique(note.manualTags.map(String)) : [],
    importance: ["low", "normal", "high"].includes(note.importance) ? note.importance : "normal",
    status: ["active", "needs_check", "expired", "archived"].includes(note.status) ? note.status : "active",
    validUntil: note.validUntil || "",
    tasks: Array.isArray(note.tasks)
      ? note.tasks.map((task) => ({
          id: String(task.id || uid("task")),
          text: String(task.text || ""),
          done: Boolean(task.done),
          dueDate: task.dueDate || undefined
        }))
      : [],
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function requestBackupPassword({ confirmPassword = false } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "modal-backdrop";
    dialog.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>バックアップパスワード</h2>
        <p>パスワードを忘れると復元できません。</p>
        <input class="input" type="password" data-password="main" autocomplete="new-password" placeholder="パスワード" />
        ${
          confirmPassword
            ? `<input class="input" type="password" data-password="confirm" autocomplete="new-password" placeholder="確認用パスワード" />`
            : ""
        }
        <div class="actions">
          <button class="btn ghost" type="button" data-modal="cancel">キャンセル</button>
          <button class="btn primary" type="button" data-modal="ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const main = dialog.querySelector("[data-password='main']");
    const confirmation = dialog.querySelector("[data-password='confirm']");
    main.focus();

    function close(value) {
      dialog.remove();
      resolve(value);
    }

    dialog.addEventListener("click", (event) => {
      const action = event.target.dataset.modal;
      if (action === "cancel") close(null);
      if (action === "ok") {
        if (!main.value) return;
        if (confirmPassword && main.value !== confirmation.value) {
          alert("パスワードが一致しません。");
          return;
        }
        close(main.value);
      }
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close(null);
      if (event.key === "Enter") {
        event.preventDefault();
        dialog.querySelector("[data-modal='ok']").click();
      }
    });
  });
}

async function exportEncryptedBackup() {
  try {
    const password = await requestBackupPassword({ confirmPassword: true });
    if (!password) return;
    const backup = await createEncryptedBackup(password);
    downloadJson(`work-memo-backup-${today()}.wmemo`, backup);
    alert("暗号化バックアップを書き出しました。");
  } catch (error) {
    alert(error.message || "バックアップに失敗しました。");
  }
}

async function importEncryptedBackup(file) {
  try {
    if (!file) return;
    const password = await requestBackupPassword();
    if (!password) return;
    const importedNotes = await readEncryptedBackup(file, password);
    const ok = confirm(`現在のメモをバックアップ内の${importedNotes.length}件で置き換えます。よろしいですか？`);
    if (!ok) return;
    await replaceAllNotes(importedNotes);
    notes = sortedNotes(await loadNotes());
    navigate({ page: "home", id: null }, { replace: true });
    alert("バックアップを復元しました。");
  } catch (error) {
    alert("復元できませんでした。パスワードまたはファイルを確認してください。");
  }
}

function noteCard(note) {
  const status = effectiveStatus(note);
  const tags = (note.tags || []).slice(0, 5).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
  return `
    <button class="note-card ${note.importance} ${status}" data-action="detail" data-id="${note.id}">
      <h3>${escapeHtml(note.title || "無題メモ")}</h3>
      <p>${escapeHtml(note.body || "本文なし")}</p>
      <div class="meta">
        <span class="pill ${note.importance}">${IMPORTANCE_LABELS[note.importance]}</span>
        <span class="pill ${status}">${STATUS_LABELS[status]}</span>
        ${note.validUntil ? `<span class="pill">有効期限 ${escapeHtml(note.validUntil)}</span>` : ""}
        ${tags}
      </div>
      <small class="count">${escapeHtml(notePreviewDate(note))}</small>
    </button>
  `;
}

function section(title, items, emptyText) {
  return `
    <section class="section">
      <div class="section-title">
        <h2>${title}</h2>
        <span class="count">${items.length}件</span>
      </div>
      <div class="grid two">
        ${items.length ? items.map(noteCard).join("") : `<div class="empty">${emptyText}</div>`}
      </div>
    </section>
  `;
}

function shell(content) {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>${UI_LABELS.appTitle}</h1>
          <p>タグ中心の個人業務メモ</p>
        </div>
        <button class="btn primary" data-action="new">＋ ${UI_LABELS.newNote}</button>
      </header>
      <nav class="bottom-nav" aria-label="メインメニュー">
        <button class="nav-btn ${route.page === "home" ? "active" : ""}" data-action="home">⌂<br>${UI_LABELS.home}</button>
        <button class="nav-btn ${route.page === "search" ? "active" : ""}" data-action="search">⌕<br>${UI_LABELS.search}</button>
        <button class="nav-btn ${route.page === "edit" && !route.id ? "active" : ""}" data-action="new">＋<br>${UI_LABELS.newNote}</button>
      </nav>
      <main class="container">${content}</main>
    </div>
  `;
}

function renderHome() {
  const ordered = sortedNotes(notes);
  const important = ordered.filter((note) => note.importance === "high").slice(0, 4);
  const expired = ordered.filter((note) => effectiveStatus(note) === "expired").slice(0, 4);
  shell(`
    <div class="notice">このアプリは個人の業務メモ用です。お客様の個人情報、予約番号、電話番号、決済情報などの機密情報を保存しないでください。</div>
    <section class="backup-panel" aria-label="バックアップ">
      <button class="btn" data-action="exportBackup">暗号化バックアップを書き出す</button>
      <button class="btn" data-action="importBackup">暗号化バックアップを復元</button>
      <input class="visually-hidden" type="file" data-field="backupFile" accept=".wmemo,application/json" />
    </section>
    <div class="toolbar">
      <div class="search-row">
        <input class="input" data-field="quickSearch" placeholder="${UI_LABELS.searchPlaceholder}" value="${escapeHtml(searchState.query)}" />
        <button class="btn" data-action="search">検索</button>
      </div>
    </div>
    ${section(UI_LABELS.importantNotes, important, "重要メモはまだありません")}
    ${section(UI_LABELS.expiredNotes, expired, "期限切れメモはありません")}
    ${section(UI_LABELS.recentNotes, ordered.slice(0, 6), "まだメモがありません")}
  `);
}

function renderSearch() {
  shell(`
    <div class="toolbar">
      <div class="search-row">
        <input class="input" data-field="query" enterkeyhint="search" autocomplete="off" placeholder="${UI_LABELS.searchPlaceholder}" value="${escapeHtml(searchState.query)}" />
        <button class="btn" data-action="runSearch">検索</button>
      </div>
      <button class="btn primary" data-action="new">＋ ${UI_LABELS.newNote}</button>
    </div>
    <div class="filters">
      <select class="select" data-field="tag">
        <option value="">すべてのタグ</option>
        ${allTags().map((tag) => `<option value="${escapeHtml(tag)}" ${searchState.tag === tag ? "selected" : ""}>#${escapeHtml(tag)}</option>`).join("")}
      </select>
      <select class="select" data-field="status">
        <option value="">すべての状態</option>
        ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${searchState.status === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <select class="select" data-field="importance">
        <option value="">すべての重要度</option>
        ${Object.entries(IMPORTANCE_LABELS).map(([value, label]) => `<option value="${value}" ${searchState.importance === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <select class="select" data-field="expiredOnly">
        <option value="">期限フィルターなし</option>
        <option value="expired" ${searchState.expiredOnly === "expired" ? "selected" : ""}>期限切れ</option>
      </select>
    </div>
    <div data-search-results>${searchResultsHtml()}</div>
  `);
}

function searchResultsHtml() {
  return section("検索結果", sortedNotes(filteredNotes()), "条件に合うメモはありません");
}

function updateSearchResults() {
  const results = document.querySelector("[data-search-results]");
  if (results) results.innerHTML = searchResultsHtml();
}

function blankEditor() {
  return {
    id: null,
    title: "",
    body: "",
    autoTags: [],
    dismissedAutoTags: [],
    manualTags: [],
    importance: "normal",
    status: "active",
    validUntil: "",
    tasks: []
  };
}

function startEditor(note) {
  editorState = note
    ? JSON.parse(JSON.stringify(note))
    : blankEditor();
  navigate({ page: "edit", id: editorState.id });
}

function renderEditor() {
  const state = editorState || blankEditor();
  const dismissed = state.dismissedAutoTags || [];
  const suggestions = suggestTags(state.title, state.body).filter((tag) => !dismissed.includes(tag));
  state.autoTags = unique(
    [...(state.autoTags || []), ...suggestions].filter((tag) => !(state.manualTags || []).includes(tag) && !dismissed.includes(tag))
  );
  const selected = unique([...(state.manualTags || []), ...(state.autoTags || [])]);
  const defaultTags = [...DEFAULT_WORK_TAGS, ...DEFAULT_CONTEXT_TAGS];
  shell(`
    <form class="form" data-form="editor">
      <div class="section-title">
        <h2>${state.id ? UI_LABELS.editNote : UI_LABELS.newNote}</h2>
        <div class="actions">
          <button class="btn ghost" type="button" data-action="home">${UI_LABELS.cancel}</button>
          <button class="btn primary" type="submit">${UI_LABELS.save}</button>
        </div>
      </div>
      <div class="field">
        <label>${UI_LABELS.title}</label>
        <input class="input" data-edit="title" value="${escapeHtml(state.title)}" required />
      </div>
      <div class="field">
        <label>${UI_LABELS.body}</label>
        <textarea class="textarea" data-edit="body" required>${escapeHtml(state.body)}</textarea>
      </div>
      <div class="field">
        <div class="legend">${UI_LABELS.suggestedTags}</div>
        <div class="tag-list">
          ${state.autoTags.length ? state.autoTags.map((tag) => `<button class="tag suggested selected" type="button" data-action="toggleAutoTag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("") : `<span class="count">入力内容から自動表示されます</span>`}
        </div>
      </div>
      <div class="field">
        <div class="legend">${UI_LABELS.defaultTags}</div>
        <div class="tag-list">
          ${defaultTags.map((tag) => `<button class="tag ${selected.includes(tag) ? "selected" : ""}" type="button" data-action="toggleManualTag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <label>${UI_LABELS.customTags}</label>
        <div class="tag-input-row">
          <input class="input" data-field="customTag" placeholder="例: 駐車タワー" />
          <button class="btn" type="button" data-action="addCustomTag">${UI_LABELS.addTag}</button>
        </div>
        <div class="tag-list">${(state.manualTags || []).map((tag) => `<button class="tag selected" type="button" data-action="toggleManualTag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>
      </div>
      <div class="field">
        <div class="legend">${UI_LABELS.importance}</div>
        <div class="segmented">
          ${Object.entries(IMPORTANCE_LABELS).map(([value, label]) => `<button class="btn ${state.importance === value ? "active" : ""}" type="button" data-action="setImportance" data-value="${value}">${label}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <div class="legend">${UI_LABELS.status}</div>
        <div class="segmented status">
          ${Object.entries(STATUS_LABELS).map(([value, label]) => `<button class="btn ${state.status === value ? "active" : ""}" type="button" data-action="setStatus" data-value="${value}">${label}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <label>${UI_LABELS.validUntil}</label>
        <input class="input" type="date" data-edit="validUntil" value="${escapeHtml(state.validUntil || "")}" />
      </div>
      <div class="field">
        <label>${UI_LABELS.checklist}</label>
        <div class="task-row">
          <input class="input" data-field="taskText" placeholder="確認すること" />
          <input class="input" type="date" data-field="taskDue" aria-label="期限" />
          <button class="btn" type="button" data-action="addTask">追加</button>
        </div>
        <div class="grid">
          ${(state.tasks || []).map((task) => `
            <div class="task-item ${task.done ? "done" : ""}">
              <input type="checkbox" ${task.done ? "checked" : ""} data-action="toggleTask" data-id="${task.id}" />
              <span>${escapeHtml(task.text)}</span>
              <button class="btn ghost" type="button" data-action="deleteTask" data-id="${task.id}">削除</button>
            </div>
          `).join("")}
        </div>
      </div>
    </form>
  `);
}

function renderDetail() {
  const note = notes.find((item) => item.id === route.id);
  if (!note) {
    navigate({ page: "home", id: null }, { replace: true });
    return;
  }
  const status = effectiveStatus(note);
  shell(`
    <article class="detail">
      <div class="section-title">
        <h2>${escapeHtml(note.title || "無題メモ")}</h2>
        <div class="actions">
          <button class="btn" data-action="edit" data-id="${note.id}">編集</button>
          <button class="btn danger" data-action="delete" data-id="${note.id}">${UI_LABELS.delete}</button>
        </div>
      </div>
      <div class="meta">
        <span class="pill ${note.importance}">${IMPORTANCE_LABELS[note.importance]}</span>
        <span class="pill ${status}">${STATUS_LABELS[status]}</span>
        ${note.validUntil ? `<span class="pill">有効期限 ${escapeHtml(note.validUntil)}</span>` : ""}
      </div>
      <div class="tag-list">${(note.tags || []).map((tag) => `<button class="tag" data-action="tagSearch" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>
      <div class="detail-body">${escapeHtml(note.body)}</div>
      <section class="section">
        <div class="section-title"><h2>${UI_LABELS.checklist}</h2></div>
        <div class="grid">
          ${(note.tasks || []).length ? note.tasks.map((task) => `<div class="task-item ${task.done ? "done" : ""}"><input type="checkbox" disabled ${task.done ? "checked" : ""} /><span>${escapeHtml(task.text)}</span><small>${escapeHtml(task.dueDate || "")}</small></div>`).join("") : `<div class="empty">チェックリストはありません</div>`}
        </div>
      </section>
      <small class="count">作成 ${toDateOnly(note.createdAt)} / 更新 ${toDateOnly(note.updatedAt)}</small>
    </article>
  `);
}

function render() {
  if (route.page === "search") return renderSearch();
  if (route.page === "edit") return renderEditor();
  if (route.page === "detail") return renderDetail();
  return renderHome();
}

function updateEditorFromInputs() {
  if (!editorState) return;
  document.querySelectorAll("[data-edit]").forEach((input) => {
    editorState[input.dataset.edit] = input.value;
  });
}

async function handleSave() {
  updateEditorFromInputs();
  const now = new Date().toISOString();
  const dismissed = editorState.dismissedAutoTags || [];
  const latestSuggestions = suggestTags(editorState.title, editorState.body).filter((tag) => !dismissed.includes(tag));
  const autoTags = unique([...(editorState.autoTags || []), ...latestSuggestions].filter((tag) => !dismissed.includes(tag)));
  const manualTags = unique(editorState.manualTags || []);
  const note = {
    id: editorState.id || uid("note"),
    title: editorState.title.trim(),
    body: editorState.body.trim(),
    autoTags,
    dismissedAutoTags: unique(editorState.dismissedAutoTags || []),
    manualTags,
    tags: unique([...autoTags, ...manualTags]),
    importance: editorState.importance,
    status: editorState.status,
    validUntil: editorState.validUntil || "",
    tasks: editorState.tasks || [],
    createdAt: editorState.createdAt || now,
    updatedAt: now
  };
  await saveNote(note);
  notes = sortedNotes(await loadNotes());
  editorState = null;
  navigate({ page: "detail", id: note.id }, { replace: true });
}

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.edit && editorState) {
    editorState[target.dataset.edit] = target.value;
  }
  if (target.dataset.field === "quickSearch") {
    searchState.query = target.value;
  }
  if (target.dataset.field === "query") {
    searchState.query = target.value;
  }
});

app.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target.dataset.field === "query" && event.key === "Enter") {
    event.preventDefault();
    searchState.query = target.value;
    updateSearchResults();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.field === "backupFile") {
    importEncryptedBackup(target.files?.[0]);
    target.value = "";
  }
  if (target.dataset.edit && editorState) {
    editorState[target.dataset.edit] = target.value;
    if (target.dataset.edit === "title" || target.dataset.edit === "body") renderEditor();
  }
  if (["tag", "status", "importance", "expiredOnly"].includes(target.dataset.field)) {
    searchState[target.dataset.field] = target.value;
    renderSearch();
  }
});

app.addEventListener("submit", async (event) => {
  if (event.target.dataset.form === "editor") {
    event.preventDefault();
    await handleSave();
  }
});

app.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const { action, id, tag, value } = actionTarget.dataset;

  if (action === "home") {
    navigate({ page: "home", id: null });
  }
  if (action === "search") {
    const quick = document.querySelector("[data-field='quickSearch']");
    if (quick) searchState.query = quick.value;
    navigate({ page: "search", id: null });
  }
  if (action === "runSearch") {
    const query = document.querySelector("[data-field='query']");
    if (query) searchState.query = query.value;
    updateSearchResults();
  }
  if (action === "exportBackup") {
    await exportEncryptedBackup();
  }
  if (action === "importBackup") {
    document.querySelector("[data-field='backupFile']")?.click();
  }
  if (action === "new") startEditor(null);
  if (action === "detail") {
    navigate({ page: "detail", id });
  }
  if (action === "edit") {
    const note = notes.find((item) => item.id === id);
    startEditor(note);
  }
  if (action === "delete") {
    if (confirm("このメモを削除しますか？")) {
      await removeNote(id);
      notes = sortedNotes(await loadNotes());
      navigate({ page: "home", id: null }, { replace: true });
    }
  }
  if (action === "tagSearch") {
    searchState.query = `#${tag}`;
    searchState.tag = tag;
    navigate({ page: "search", id: null });
  }
  if (!editorState) return;
  if (action === "toggleManualTag") {
    updateEditorFromInputs();
    editorState.manualTags = editorState.manualTags.includes(tag)
      ? editorState.manualTags.filter((item) => item !== tag)
      : unique([...editorState.manualTags, tag]);
    renderEditor();
  }
  if (action === "toggleAutoTag") {
    updateEditorFromInputs();
    editorState.autoTags = editorState.autoTags.filter((item) => item !== tag);
    editorState.dismissedAutoTags = unique([...(editorState.dismissedAutoTags || []), tag]);
    renderEditor();
  }
  if (action === "addCustomTag") {
    updateEditorFromInputs();
    const input = document.querySelector("[data-field='customTag']");
    if (input.value.trim()) {
      editorState.manualTags = unique([...editorState.manualTags, input.value.trim()]);
      renderEditor();
    }
  }
  if (action === "setImportance") {
    updateEditorFromInputs();
    editorState.importance = value;
    renderEditor();
  }
  if (action === "setStatus") {
    updateEditorFromInputs();
    editorState.status = value;
    renderEditor();
  }
  if (action === "addTask") {
    updateEditorFromInputs();
    const input = document.querySelector("[data-field='taskText']");
    const dueInput = document.querySelector("[data-field='taskDue']");
    if (input.value.trim()) {
      editorState.tasks = [
        ...(editorState.tasks || []),
        { id: uid("task"), text: input.value.trim(), done: false, dueDate: dueInput.value || undefined }
      ];
      renderEditor();
    }
  }
  if (action === "toggleTask") {
    updateEditorFromInputs();
    editorState.tasks = editorState.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
    renderEditor();
  }
  if (action === "deleteTask") {
    updateEditorFromInputs();
    editorState.tasks = editorState.tasks.filter((task) => task.id !== id);
    renderEditor();
  }
});

window.addEventListener("popstate", (event) => {
  route = event.state?.route || { page: "home", id: null };
  syncEditorForRoute();
  render();
});

async function init() {
  notes = sortedNotes(await loadNotes());
  route = history.state?.route || route;
  syncEditorForRoute();
  history.replaceState({ route }, "", location.href);
  render();
}

init().catch((error) => {
  app.innerHTML = `<main class="container"><div class="notice">IndexedDBを開けませんでした: ${escapeHtml(error.message)}</div></main>`;
});
