const MAX_LISTS = 40;
const APP_VERSION = "3.15";
const CUSTOM_HYMN_START = 1001;
// Las 1–214 son las originales: no se pueden eliminar. De la 215 en adelante viven en
// Cloudflare y solo un administrador las elimina (por completo, y las siguientes se recorren).
// Dirección oficial del himnario (Cloudflare). La de GitHub Pages queda solo para avisar de la mudanza.
const PUBLIC_URL = "https://himnario-ibsi.hiptank-news.workers.dev/";
const OLD_HOSTS = ["dav04perezhip.github.io"];
// Servicio en Cloudflare donde se guardan las alabanzas publicadas para todos (carpeta api/).
// Para pruebas en la computadora: http://localhost:8000/?api-local usa la API local (wrangler dev).
const SHARED_API = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
  new URLSearchParams(window.location.search).has("api-local")
  ? "http://127.0.0.1:8787"
  : "https://himnario-ibsi-api.hiptank-news.workers.dev";
const SHARED_FIRST_NUMBER = 215;
// Modo Consejos: por ahora solo se prueba en estas alabanzas.
const TIPS_TEST_NUMBERS = [221];
const ORIGINAL_LAST_NUMBER = 214;
const FONT_SCALE_MIN = 0.6;
const FONT_SCALE_MAX = 2.5;

const STORAGE_KEYS = {
  legacySetlist: "ibsi-setlist-v1",
  legacySetlistName: "ibsi-setlist-name-v1",
  savedLists: "ibsi-saved-lists-v2",
  activeListId: "ibsi-active-list-id-v2",
  transposeMap: "ibsi-transpose-v1",
  emptyDefaultCleaned: "ibsi-empty-default-cleaned-v2-2",
  customHymns: "ibsi-custom-hymns-v1",
  hiddenHymns: "ibsi-hidden-hymns-v1",
  sharedSongs: "ibsi-shared-songs-cache-v1",
  originalFixes: "ibsi-original-fixes-cache-v1",
  adminPin: "ibsi-admin-pin-v1",
  viewMode: "ibsi-view-mode-v1",
  fontScale: "ibsi-font-scale-v1",
  pinchHint: "ibsi-pinch-hint-v1",
  tips: "ibsi-tips-v1",
  theme: "ibsi-theme-v1",
  live: "ibsi-live-v1"
};

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11
};

let hymns = [];
let catalogFilter = "all";
let originalHymns = [];
let hymnLayouts = null;
let hymnLayoutsPromise = null;
let hymnTexts = {};
let customHymns = loadCustomHymns();
let hiddenHymns = loadHiddenHymns();
let sharedSongs = loadSharedSongsCache();
let originalFixes = loadOriginalFixesCache();
let sharedSongsFromServer = false;
let viewMode = readSetting(STORAGE_KEYS.viewMode, "texto");
let fontScale = Number(readSetting(STORAGE_KEYS.fontScale, "1")) || 1;
let importerState = { editingNumber: null, editingId: null, editingKind: null, previewShift: 0 };
let savedLists = loadSavedLists();
let activeListId = loadActiveListId(savedLists);
let transposeMap = loadTransposeMap();
let currentHymn = null;
let viewerContext = { source: "catalog", listId: null };
let sharedList = null;
let reopenSharedModalAfterViewer = false;
let swipeStart = null;
let deferredInstallPrompt = null;
let waitingServiceWorker = null;

const elements = {
  hymnGrid: document.querySelector("#hymnGrid"),
  searchInput: document.querySelector("#searchInput"),
  emptySearch: document.querySelector("#emptySearch"),
  tabs: [...document.querySelectorAll(".tab")],
  catalogView: document.querySelector("#catalogView"),
  setlistView: document.querySelector("#setlistView"),
  noListsState: document.querySelector("#noListsState"),
  savedListsGrid: document.querySelector("#savedListsGrid"),
  activeListEditor: document.querySelector("#activeListEditor"),
  activeListTitle: document.querySelector("#activeListTitle"),
  listLimitText: document.querySelector("#listLimitText"),
  createListButton: document.querySelector("#createListButton"),
  createFirstListButton: document.querySelector("#createFirstListButton"),
  deleteListButton: document.querySelector("#deleteListButton"),
  shareListButton: document.querySelector("#shareListButton"),
  setlistItems: document.querySelector("#setlistItems"),
  emptySetlist: document.querySelector("#emptySetlist"),
  setlistCount: document.querySelector("#setlistCount"),
  setlistName: document.querySelector("#setlistName"),
  setlistDate: document.querySelector("#setlistDate"),
  setlistTime: document.querySelector("#setlistTime"),
  setlistNameHint: document.querySelector("#setlistNameHint"),
  listSearchInput: document.querySelector("#listSearchInput"),
  listSearchResults: document.querySelector("#listSearchResults"),
  saveStatus: document.querySelector("#saveStatus"),
  clearSetlistButton: document.querySelector("#clearSetlistButton"),
  viewer: document.querySelector("#viewer"),
  viewerTitle: document.querySelector("#viewerTitle"),
  viewerSubtitle: document.querySelector("#viewerSubtitle"),
  transposedSheet: document.querySelector("#transposedSheet"),
  closeViewer: document.querySelector("#closeViewer"),
  viewerAddButton: document.querySelector("#viewerAddButton"),
  pageViewport: document.querySelector("#pageViewport"),
  transposeDown: document.querySelector("#transposeDown"),
  transposeUp: document.querySelector("#transposeUp"),
  transposeReset: document.querySelector("#transposeReset"),
  currentKey: document.querySelector("#currentKey"),
  transposeAmount: document.querySelector("#transposeAmount"),
  setlistNavigation: document.querySelector("#setlistNavigation"),
  previousHymnButton: document.querySelector("#previousHymnButton"),
  previousHymnName: document.querySelector("#previousHymnName"),
  nextHymnButton: document.querySelector("#nextHymnButton"),
  nextHymnName: document.querySelector("#nextHymnName"),
  setlistPosition: document.querySelector("#setlistPosition"),
  sharedListModal: document.querySelector("#sharedListModal"),
  sharedListTitle: document.querySelector("#sharedListTitle"),
  sharedListSummary: document.querySelector("#sharedListSummary"),
  sharedListItems: document.querySelector("#sharedListItems"),
  closeSharedListButton: document.querySelector("#closeSharedListButton"),
  openSharedListButton: document.querySelector("#openSharedListButton"),
  saveSharedListButton: document.querySelector("#saveSharedListButton"),
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#installButton"),
  connectionState: document.querySelector("#connectionState"),
  catalogCount: document.querySelector("#catalogCount"),
  updateBanner: document.querySelector("#updateBanner"),
  updateButton: document.querySelector("#updateButton"),
  moveBanner: document.querySelector("#moveBanner"),
  moveButton: document.querySelector("#moveButton"),
  fontSmaller: document.querySelector("#fontSmaller"),
  fontLarger: document.querySelector("#fontLarger"),
  viewModeButton: document.querySelector("#viewModeButton"),
  tipsButton: document.querySelector("#tipsButton"),
  editHymnButton: document.querySelector("#editHymnButton"),
  openImporterButton: document.querySelector("#openImporterButton"),
  importerModal: document.querySelector("#importerModal"),
  importerTitle: document.querySelector("#importerTitle"),
  closeImporterButton: document.querySelector("#closeImporterButton"),
  importTitle: document.querySelector("#importTitle"),
  importArtist: document.querySelector("#importArtist"),
  importKey: document.querySelector("#importKey"),
  importText: document.querySelector("#importText"),
  importError: document.querySelector("#importError"),
  importPreview: document.querySelector("#importPreview"),
  importPreviewKey: document.querySelector("#importPreviewKey"),
  importTransposeDown: document.querySelector("#importTransposeDown"),
  importTransposeUp: document.querySelector("#importTransposeUp"),
  saveLocalButton: document.querySelector("#saveLocalButton"),
  publishButton: document.querySelector("#publishButton"),
  adminButton: document.querySelector("#adminButton"),
  deleteCustomHymnButton: document.querySelector("#deleteCustomHymnButton"),
  catalogTools: document.querySelector("#catalogTools"),
  settingsView: document.querySelector("#settingsView"),
  catalogFilters: document.querySelector("#catalogFilters"),
  themeSwitch: document.querySelector("#themeSwitch"),
  customHymnsNote: document.querySelector("#customHymnsNote"),
  sendCustomHymnsButton: document.querySelector("#sendCustomHymnsButton"),
  restoreHiddenButton: document.querySelector("#restoreHiddenButton"),
  sectionButtons: document.querySelector("#sectionButtons"),
  listsOverview: document.querySelector("#listsOverview"),
  statLists: document.querySelector("#statLists"),
  statUpcoming: document.querySelector("#statUpcoming"),
  statHymns: document.querySelector("#statHymns"),
  liveCard: document.querySelector("#liveCard"),
  liveCardTitle: document.querySelector("#liveCardTitle"),
  liveCardText: document.querySelector("#liveCardText"),
  startLiveButton: document.querySelector("#startLiveButton"),
  joinLiveButton: document.querySelector("#joinLiveButton"),
  listsFilter: document.querySelector("#listsFilter"),
  listsFilterEmpty: document.querySelector("#listsFilterEmpty"),
  newListFab: document.querySelector("#newListFab"),
  backToListsButton: document.querySelector("#backToListsButton"),
  listMenuButton: document.querySelector("#listMenuButton"),
  activeListWhen: document.querySelector("#activeListWhen"),
  activeListNote: document.querySelector("#activeListNote"),
  activeListCount: document.querySelector("#activeListCount"),
  playListButton: document.querySelector("#playListButton"),
  directListButton: document.querySelector("#directListButton"),
  listDetails: document.querySelector("#listDetails"),
  setlistNote: document.querySelector("#setlistNote"),
  viewerNote: document.querySelector("#viewerNote"),
  actionSheet: document.querySelector("#actionSheet"),
  actionSheetTitle: document.querySelector("#actionSheetTitle"),
  actionSheetBody: document.querySelector("#actionSheetBody"),
  actionSheetClose: document.querySelector("#actionSheetClose"),
  liveBar: document.querySelector("#liveBar"),
  liveBarText: document.querySelector("#liveBarText"),
  liveBarAction: document.querySelector("#liveBarAction"),
  liveBarStop: document.querySelector("#liveBarStop"),
  viewerLiveChip: document.querySelector("#viewerLiveChip"),
  viewerLiveChipText: document.querySelector("#viewerLiveChipText")
};

// ---------- Tono y notas de cada alabanza dentro de un listado ----------

function sanitizeListKeys(raw, numbers) {
  const keys = {};
  if (!raw || typeof raw !== "object") return keys;
  numbers.forEach((number) => {
    const value = Number(raw[number]);
    if (Number.isInteger(value) && value >= -11 && value <= 11) keys[number] = value;
  });
  return keys;
}

function sanitizeListNotes(raw, numbers) {
  const notes = {};
  if (!raw || typeof raw !== "object") return notes;
  numbers.forEach((number) => {
    const text = String(raw[number] ?? "").trim().slice(0, 200);
    if (text) notes[number] = text;
  });
  return notes;
}

// Tono de una alabanza en un listado: el que se eligió para ese servicio o, si no, el de siempre.
function listShift(list, number) {
  const value = list?.keys?.[number];
  return Number.isInteger(value) ? value : getTranspose(number);
}

function currentShift(number = currentHymn?.number) {
  if (number == null) return 0;
  const list = getViewerList();
  return list ? listShift(list, number) : getTranspose(number);
}

function hymnKeyLabel(hymn, shift) {
  return transposeKey(hymn.originalKey, shift, hymn.preferFlats);
}

function currentHymnNote() {
  if (!currentHymn) return "";
  const list = getViewerList();
  return list?.notes?.[currentHymn.number] || "";
}

function updateViewerNote() {
  const note = currentHymnNote();
  elements.viewerNote.textContent = note;
  elements.viewerNote.classList.toggle("hidden", !note);
}

// ---------- Hoja de opciones (abre desde abajo) ----------

let sheetOpenedAt = 0;

function openSheet(title, build) {
  sheetOpenedAt = Date.now();
  elements.actionSheetTitle.textContent = title;
  elements.actionSheetBody.replaceChildren();
  build(elements.actionSheetBody);
  elements.actionSheet.classList.remove("hidden");
  const focusable = elements.actionSheetBody.querySelector("input, textarea, button:not(:disabled)");
  if (focusable && focusable.matches("input, textarea")) setTimeout(() => focusable.focus(), 60);
}

function closeSheet() {
  elements.actionSheet.classList.add("hidden");
  elements.actionSheetBody.replaceChildren();
}

function isSheetOpen() {
  return !elements.actionSheet.classList.contains("hidden");
}

function sheetAction(label, onClick, { danger = false, disabled = false, hint = "" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `sheet-action${danger ? " danger-text" : ""}`;
  button.disabled = disabled;
  button.innerHTML = `<span>${escapeHtml(label)}</span>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}`;
  button.addEventListener("click", onClick);
  return button;
}

// ---------- Pantallas de Listados ----------

let listDetailOpen = false;
let listFilter = "upcoming";

function openListDetail(listId, { expandDetails = false } = {}) {
  if (!savedLists.some((list) => list.id === listId)) return;
  activeListId = listId;
  listDetailOpen = true;
  persistLists();
  elements.listSearchInput.value = "";
  elements.listDetails.open = expandDetails;
  renderListManager();
  updateViewerAddButton();
  window.scrollTo({ top: 0 });
}

function closeListDetail() {
  listDetailOpen = false;
  renderListManager();
  window.scrollTo({ top: 0 });
}

function renderListStats() {
  const upcoming = savedLists.filter((list) => list.date && !isPastList(list)).length;
  const allHymns = new Set(savedLists.flatMap((list) => list.hymns));
  elements.statLists.textContent = String(savedLists.length);
  elements.statUpcoming.textContent = String(upcoming);
  elements.statHymns.textContent = String(allHymns.size);
}

function listCardTile(list) {
  const date = listDateObject(list);
  if (!date) return '<span class="date-tile no-date" aria-hidden="true">♫</span>';
  return `
    <span class="date-tile" aria-hidden="true">
      <small>${WEEKDAYS[date.getDay()].slice(0, 3)}</small>
      <strong>${date.getDate()}</strong>
      <small>${MONTHS_SHORT[date.getMonth()]}</small>
    </span>`;
}

function openListMenu() {
  const list = getActiveList();
  if (!list) return;
  openSheet(displayListName(list), (body) => {
    body.append(
      sheetAction("Compartir por WhatsApp", () => { closeSheet(); shareActiveList(); }, { disabled: !list.hymns.length }),
      sheetAction(liveSession?.role === "director" ? "Dirigir este listado (ya estás dirigiendo)" : "Dirigir este listado", () => {
        closeSheet();
        directActiveList();
      }),
      sheetAction("Datos del servicio", () => {
        closeSheet();
        elements.listDetails.open = true;
        elements.listDetails.scrollIntoView({ behavior: "smooth", block: "start" });
      }, { hint: "Fecha, hora, nombre y nota" }),
      sheetAction("Vaciar listado", () => { closeSheet(); elements.clearSetlistButton.click(); }, { danger: true, disabled: !list.hymns.length }),
      sheetAction("Eliminar listado", () => { closeSheet(); deleteActiveList(); }, { danger: true })
    );
  });
}

function openRowMenu(number) {
  const list = getActiveList();
  const hymn = hymns.find((item) => item.number === number);
  if (!list || !hymn) return;
  const index = list.hymns.indexOf(number);
  const key = hymnKeyLabel(hymn, listShift(list, number));
  openSheet(`${index + 1}. ${hymn.title}`, (body) => {
    body.append(
      sheetAction("Ver alabanza", () => { closeSheet(); openViewer(number, { source: "setlist", listId: list.id }); }),
      sheetAction(`Cambiar tono (${key})`, () => openKeySheet(number)),
      sheetAction(list.notes?.[number] ? "Editar nota" : "Agregar nota", () => openNoteSheet(number), {
        hint: list.notes?.[number] || "Ej.: entra solo el piano, coro 2 veces"
      }),
      sheetAction("Subir", () => { moveActiveListItem(index, -1); closeSheet(); }, { disabled: index === 0 }),
      sheetAction("Bajar", () => { moveActiveListItem(index, 1); closeSheet(); }, { disabled: index === list.hymns.length - 1 }),
      sheetAction("Quitar del listado", () => { closeSheet(); removeFromActiveList(number); }, { danger: true })
    );
  });
}

function openKeySheet(number) {
  const list = getActiveList();
  const hymn = hymns.find((item) => item.number === number);
  if (!list || !hymn) return;

  openSheet(`Tono para este servicio · ${hymn.title}`, (body) => {
    const intro = document.createElement("p");
    intro.className = "sheet-note";
    intro.textContent = `Original: ${hymn.originalKey}. Este tono solo se usa en “${displayListName(list)}”.`;
    const grid = document.createElement("div");
    grid.className = "key-grid";
    const current = listShift(list, number);
    for (let shift = -5; shift <= 6; shift += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `key-choice${shift === current ? " active" : ""}${shift === 0 ? " original" : ""}`;
      button.innerHTML = `<strong>${escapeHtml(hymnKeyLabel(hymn, shift))}</strong><small>${shift === 0 ? "original" : formatTransposeAmount(shift)}</small>`;
      button.addEventListener("click", () => {
        list.keys = { ...(list.keys || {}), [number]: shift };
        list.updatedAt = Date.now();
        persistLists();
        renderActiveList();
        if (currentHymn?.number === number) liveBroadcast();
        closeSheet();
        showToast(`Tono ${hymnKeyLabel(hymn, shift)} para este listado.`);
      });
      grid.appendChild(button);
    }
    body.append(intro, grid);
  });
}

function openNoteSheet(number) {
  const list = getActiveList();
  const hymn = hymns.find((item) => item.number === number);
  if (!list || !hymn) return;

  openSheet(`Nota · ${hymn.title}`, (body) => {
    const textarea = document.createElement("textarea");
    textarea.className = "sheet-textarea";
    textarea.maxLength = 200;
    textarea.rows = 3;
    textarea.placeholder = "Ej.: Empieza solo el piano. Repetir el coro al final.";
    textarea.value = list.notes?.[number] || "";
    const save = (text) => {
      const notes = { ...(list.notes || {}) };
      if (text) notes[number] = text;
      else delete notes[number];
      list.notes = notes;
      list.updatedAt = Date.now();
      persistLists();
      renderActiveList();
      closeSheet();
    };
    const actions = document.createElement("div");
    actions.className = "sheet-buttons";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "primary";
    saveButton.textContent = "Guardar nota";
    saveButton.addEventListener("click", () => save(textarea.value.trim().slice(0, 200)));
    actions.appendChild(saveButton);
    if (list.notes?.[number]) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "danger";
      removeButton.textContent = "Borrar nota";
      removeButton.addEventListener("click", () => save(""));
      actions.appendChild(removeButton);
    }
    body.append(textarea, actions);
  });
}

function playActiveList() {
  const list = getActiveList();
  if (!list?.hymns.length) {
    showToast("Agrega alabanzas primero.");
    return;
  }
  openViewer(list.hymns[0], { source: "setlist", listId: list.id });
}

async function directActiveList() {
  const list = getActiveList();
  if (!liveSession || liveSession.role !== "director") {
    const started = await startLive();
    if (!started) return;
  }
  if (list?.hymns.length) openViewer(list.hymns[0], { source: "setlist", listId: list.id });
  openLiveInvite();
}

// ---------- Modo director (en vivo) ----------

const LIVE_WS_BASE = SHARED_API.replace(/^http/, "ws");
const LIVE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
let liveSession = null;
let liveBroadcastTimer = null;

function liveLink(code) {
  return `${PUBLIC_URL}#vivo=${code}`;
}

function saveLiveSession() {
  try {
    if (!liveSession) {
      localStorage.removeItem(STORAGE_KEYS.live);
      return;
    }
    const { role, code, token } = liveSession;
    localStorage.setItem(STORAGE_KEYS.live, JSON.stringify({ role, code, token: token || "", at: Date.now() }));
  } catch { /* sin almacenamiento: la sesión sigue mientras la app esté abierta */ }
}

function restoreLiveSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.live) || "null");
    if (!saved?.code || Date.now() - Number(saved.at) > LIVE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEYS.live);
      return;
    }
    liveSession = newLiveSession(saved.role === "director" ? "director" : "follower", saved.code, saved.token);
    connectLive();
    renderLiveUi();
  } catch {
    localStorage.removeItem(STORAGE_KEYS.live);
  }
}

function newLiveSession(role, code, token = "") {
  return { role, code, token, ws: null, state: null, listeners: 0, status: "connecting", retries: 0, ended: false };
}

async function startLive() {
  if (liveSession?.role === "director") return true;
  if (!navigator.onLine) {
    showToast("Necesitas internet para el modo director.");
    return false;
  }
  try {
    const response = await fetch(`${SHARED_API}/live`, { method: "POST" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { code, token } = await response.json();
    if (liveSession) stopLive({ silent: true });
    liveSession = newLiveSession("director", code, token);
    saveLiveSession();
    connectLive();
    renderLiveUi();
    return true;
  } catch (error) {
    console.warn(error);
    showToast("No se pudo iniciar el modo director. Revisa tu internet.");
    return false;
  }
}

async function joinLive(rawCode) {
  const code = String(rawCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 4) {
    showToast("Escribe el código de 4 letras que te dio el director.");
    return false;
  }
  if (liveSession?.code === code) return true;
  try {
    const response = await fetch(`${SHARED_API}/live/${code}`, { cache: "no-store" });
    if (response.status === 404) {
      showToast("Ese código no existe o la sesión ya terminó.");
      return false;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn(error);
    showToast("No se pudo conectar. Revisa tu internet.");
    return false;
  }
  if (liveSession) stopLive({ silent: true });
  liveSession = newLiveSession("follower", code);
  saveLiveSession();
  connectLive();
  renderLiveUi();
  showToast(`Conectado a la sesión ${code}. Las alabanzas cambiarán solas.`);
  return true;
}

function connectLive() {
  const session = liveSession;
  if (!session) return;
  clearTimeout(session.retryTimer);
  clearInterval(session.pingTimer);
  if (session.ws) {
    try { session.ws.close(); } catch { /* ya cerrada */ }
  }

  const query = session.role === "director" ? `?token=${encodeURIComponent(session.token)}` : "";
  let ws;
  try {
    ws = new WebSocket(`${LIVE_WS_BASE}/live/${session.code}/ws${query}`);
  } catch {
    scheduleLiveReconnect(session);
    return;
  }
  session.ws = ws;
  session.status = "connecting";
  renderLiveUi();

  ws.addEventListener("open", () => {
    if (liveSession !== session || session.ws !== ws) return;
    session.status = "online";
    session.retries = 0;
    session.pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);
    renderLiveUi();
    if (session.role === "director") liveBroadcast(true);
  });

  ws.addEventListener("message", (event) => {
    if (liveSession !== session || event.data === "pong") return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    handleLiveMessage(data);
  });

  ws.addEventListener("close", () => {
    if (liveSession !== session || session.ws !== ws) return;
    clearInterval(session.pingTimer);
    if (session.ended) return;
    session.status = "offline";
    renderLiveUi();
    scheduleLiveReconnect(session);
  });
}

function scheduleLiveReconnect(session) {
  const delay = Math.min(15000, 1000 * 2 ** session.retries);
  session.retries += 1;
  session.retryTimer = setTimeout(async () => {
    if (liveSession !== session) return;
    if (session.retries > 2) {
      // Después de varios intentos, ver si la sesión todavía existe.
      try {
        const response = await fetch(`${SHARED_API}/live/${session.code}`, { cache: "no-store" });
        if (response.status === 404) {
          endLiveLocally("La sesión en vivo terminó.");
          return;
        }
      } catch { /* sin internet: seguir intentando */ }
    }
    if (liveSession === session) connectLive();
  }, delay);
}

function reconnectLiveIfNeeded() {
  if (!liveSession || liveSession.ended) return;
  const ws = liveSession.ws;
  if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
    liveSession.retries = 0;
    connectLive();
  }
}

function handleLiveMessage(data) {
  if (!liveSession) return;
  if (data.type === "hello") {
    liveSession.listeners = Number(data.listeners) || 0;
    if (liveSession.role === "director" && data.role !== "director") {
      // El código ya no es nuestro (por ejemplo, venció): se termina.
      endLiveLocally("La sesión que dirigías ya no existe.");
      return;
    }
    if (liveSession.role === "follower" && data.state) applyLiveState(data.state);
    renderLiveUi();
  } else if (data.type === "count") {
    liveSession.listeners = Number(data.listeners) || 0;
    renderLiveUi();
  } else if (data.type === "state" && liveSession.role === "follower") {
    applyLiveState(data.state);
  } else if (data.type === "ended") {
    endLiveLocally(liveSession.role === "follower" ? "El director terminó la sesión." : "Sesión terminada.");
  }
}

// Lista "virtual" con la que se mueve el músico: la del director, con sus tonos.
function liveViewerList() {
  const state = liveSession?.state;
  if (!state) return null;
  const available = new Set(hymns.map((hymn) => hymn.number));
  const source = state.list?.hymns?.length ? state.list.hymns : [state.hymn].filter(Boolean);
  const keys = { ...(state.list?.keys || {}) };
  if (state.hymn) keys[state.hymn] = state.shift;
  Object.assign(keys, liveSession.localKeys || {});
  const notes = state.hymn && state.note ? { [state.hymn]: state.note } : {};
  return {
    id: "live",
    name: state.list?.name || "En vivo",
    hymns: source.filter((number) => available.has(number)),
    keys,
    notes
  };
}

function applyLiveState(state) {
  if (!liveSession || !state) return;
  const sameUpdate = liveSession.state?.seq === state.seq && liveSession.state?.at === state.at;
  liveSession.state = state;
  if (!sameUpdate) liveSession.localKeys = {};
  renderLiveUi();
  if (!state.hymn || !hymns.length) return;

  const hymn = hymns.find((item) => item.number === state.hymn);
  if (!hymn) {
    showToast(`El director abrió “${state.title || state.hymn}”, que no está en este teléfono.`);
    return;
  }
  const viewerOpen = !elements.viewer.classList.contains("hidden");
  if (sameUpdate && viewerOpen && currentHymn?.number === state.hymn) return;
  if (!elements.importerModal.classList.contains("hidden")) return; // no interrumpir si está escribiendo
  if (!elements.sharedListModal.classList.contains("hidden")) closeSharedListModal(false);
  if (isSheetOpen()) closeSheet();
  const sameHymn = viewerOpen && currentHymn?.number === state.hymn && viewerContext.source === "live";
  if (sameHymn) {
    // Mismo canto, otro tono: se vuelve a dibujar sin perder dónde iba.
    updateTransposeDisplay();
    renderTransposedSheet();
    updateViewerNote();
    updateSetlistNavigation();
  } else {
    openViewer(state.hymn, { source: "live", listId: "live" });
  }
}

function buildLiveState() {
  if (!currentHymn) return null;
  const list = getViewerList();
  const number = currentHymn.number;
  return {
    hymn: number,
    shift: currentShift(number),
    title: currentHymn.title,
    note: list?.notes?.[number] || "",
    list: list && list.hymns.length
      ? {
          name: displayListName(list),
          hymns: list.hymns,
          keys: Object.fromEntries(list.hymns.map((n) => [n, listShift(list, n)]))
        }
      : null
  };
}

function liveBroadcast(immediate = false) {
  if (liveSession?.role !== "director") return;
  clearTimeout(liveBroadcastTimer);
  const send = () => {
    const ws = liveSession?.ws;
    const state = buildLiveState();
    if (!state || !ws || ws.readyState !== WebSocket.OPEN) return; // se envía al reconectar
    ws.send(JSON.stringify({ type: "state", state }));
    liveSession.lastSent = state;
  };
  if (immediate) send();
  else liveBroadcastTimer = setTimeout(send, 120);
}

function stopLive({ silent = false } = {}) {
  const session = liveSession;
  if (!session) return;
  session.ended = true;
  if (session.role === "director" && session.ws?.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify({ type: "end" }));
  }
  teardownLive(session);
  if (!silent) showToast(session.role === "director" ? "Terminaste la sesión en vivo." : "Saliste de la sesión en vivo.");
}

function endLiveLocally(message) {
  const session = liveSession;
  if (!session) return;
  session.ended = true;
  teardownLive(session);
  if (message) showToast(message);
}

function teardownLive(session) {
  clearTimeout(session.retryTimer);
  clearInterval(session.pingTimer);
  clearTimeout(liveBroadcastTimer);
  try { session.ws?.close(1000); } catch { /* ya cerrada */ }
  if (liveSession === session) liveSession = null;
  saveLiveSession();
  if (viewerContext.source === "live") {
    viewerContext = { source: "catalog", listId: null };
    updateSetlistNavigation();
    updateViewerNote();
  }
  closeSheet();
  renderLiveUi();
}

function liveStatusText() {
  if (!liveSession) return "";
  const { role, code, status, listeners, state } = liveSession;
  if (status !== "online") return `Reconectando… ${code}`;
  if (role === "director") {
    return `${code} · ${listeners} conectado${listeners === 1 ? "" : "s"}`;
  }
  return state?.title ? `${code} · ${state.title}` : `${code} · esperando al director`;
}

function renderLiveUi() {
  const session = liveSession;
  const active = Boolean(session);
  document.body.classList.toggle("live-on", active);
  elements.liveBar.classList.toggle("hidden", !active);
  elements.liveBar.classList.toggle("offline", active && session.status !== "online");

  elements.viewerLiveChip.classList.toggle("offline", active && session.status !== "online");
  if (active) {
    // Versión corta para la esquina del visor: "29KE · 3 👥" o "29KE".
    elements.viewerLiveChipText.textContent = session.status !== "online"
      ? `${session.code} · …`
      : session.role === "director" ? `${session.code} · ${session.listeners}` : session.code;
    elements.viewerLiveChip.title = liveStatusText();
  }
  if (active) {
    elements.liveBarText.textContent = liveStatusText();
    elements.liveBarAction.textContent = session.role === "director" ? "Invitar" : "Ver";
    elements.liveBarStop.textContent = session.role === "director" ? "Terminar" : "Salir";
  }

  if (!active) {
    elements.liveCardTitle.textContent = "Modo director";
    elements.liveCardText.textContent = "Tú cambias la alabanza y el tono, y a todos los músicos les cambia al mismo tiempo.";
    elements.startLiveButton.textContent = "Dirigir";
    elements.joinLiveButton.textContent = "Unirme con código";
  } else if (session.role === "director") {
    elements.liveCardTitle.textContent = `Estás dirigiendo · ${session.code}`;
    elements.liveCardText.textContent = `${session.listeners} músico${session.listeners === 1 ? "" : "s"} conectado${session.listeners === 1 ? "" : "s"}. Abre un listado o una alabanza y les cambiará a todos.`;
    elements.startLiveButton.textContent = "Invitar";
    elements.joinLiveButton.textContent = "Terminar";
  } else {
    elements.liveCardTitle.textContent = `Siguiendo al director · ${session.code}`;
    elements.liveCardText.textContent = session.state?.title
      ? `Ahora: ${session.state.title}. Cuando cambie, se abrirá sola.`
      : "Cuando el director abra una alabanza, se abrirá sola en tu teléfono.";
    elements.startLiveButton.textContent = "Ver ahora";
    elements.joinLiveButton.textContent = "Salir";
  }
  elements.liveCard.classList.toggle("is-live", active);
  elements.directListButton.textContent = session?.role === "director" ? "● Dirigiendo" : "Dirigir";
}

function liveCardPrimary() {
  if (!liveSession) {
    startLive().then((ok) => ok && openLiveInvite());
  } else if (liveSession.role === "director") {
    openLiveInvite();
  } else {
    showLiveNow();
  }
}

function liveCardSecondary() {
  if (!liveSession) openJoinSheet();
  else confirmStopLive();
}

// Opciones del modo en vivo desde la esquina del visor.
function openLiveMenu() {
  if (!liveSession) return;
  const director = liveSession.role === "director";
  openSheet(director ? `Dirigiendo · ${liveSession.code}` : `En vivo · ${liveSession.code}`, (body) => {
    const note = document.createElement("p");
    note.className = "sheet-note";
    note.textContent = liveSession.status !== "online"
      ? "Reconectando… revisa tu internet."
      : director
        ? `${liveSession.listeners} músico${liveSession.listeners === 1 ? "" : "s"} conectado${liveSession.listeners === 1 ? "" : "s"}.`
        : liveSession.state?.title ? `El director está en: ${liveSession.state.title}.` : "Esperando al director.";
    body.appendChild(note);
    if (director) {
      body.append(
        sheetAction("Invitar a los músicos", () => openLiveInvite(), { hint: "Código y enlace por WhatsApp" }),
        sheetAction("Agregar esta alabanza a mi listado", () => { closeSheet(); elements.viewerAddButton.click(); }, {
          disabled: !currentHymn || elements.viewerAddButton.disabled
        }),
        sheetAction("Terminar la sesión", () => { closeSheet(); confirmStopLive(); }, { danger: true })
      );
    } else {
      body.append(
        sheetAction("Volver a la del director", () => { closeSheet(); showLiveNow(); }),
        sheetAction("Salir de la sesión", () => { closeSheet(); confirmStopLive(); }, { danger: true })
      );
    }
  });
}

function confirmStopLive() {
  if (!liveSession) return;
  const question = liveSession.role === "director"
    ? "¿Terminar la sesión en vivo? Los músicos dejarán de seguirte."
    : "¿Salir de la sesión en vivo?";
  if (confirm(question)) stopLive();
}

function showLiveNow() {
  const state = liveSession?.state;
  if (!state?.hymn) {
    showToast("El director todavía no ha abierto ninguna alabanza.");
    return;
  }
  liveSession.localKeys = {};
  if (hymns.some((hymn) => hymn.number === state.hymn)) openViewer(state.hymn, { source: "live", listId: "live" });
}

function openLiveInvite() {
  if (liveSession?.role !== "director") return;
  const { code } = liveSession;
  const link = liveLink(code);
  const message = `🎶 Himnario IBSI en vivo\nToca el enlace para seguir las alabanzas del servicio:\n${link}\n\nO en la app: Listados → Unirme con código → ${code}`;

  openSheet("Invitar a los músicos", (body) => {
    const codeBox = document.createElement("div");
    codeBox.className = "live-code";
    codeBox.innerHTML = `<small>Código de la sesión</small><strong>${escapeHtml(code)}</strong><p>Que abran el Himnario → <b>Listados</b> → <b>Unirme con código</b>, o envíales el enlace.</p>`;
    const actions = document.createElement("div");
    actions.className = "sheet-buttons";
    const whatsapp = document.createElement("a");
    whatsapp.className = "primary";
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener";
    whatsapp.textContent = "Enviar por WhatsApp";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondary-dark";
    copy.textContent = "Copiar enlace";
    copy.addEventListener("click", async () => {
      try {
        await copyShareContent(link);
        showToast("Enlace copiado.");
      } catch {
        showToast(link);
      }
    });
    actions.append(whatsapp, copy);
    const tip = document.createElement("p");
    tip.className = "sheet-note";
    tip.textContent = "Lo que abras (y el tono que elijas) les aparecerá a todos. Deja la pantalla encendida mientras diriges.";
    body.append(codeBox, actions, tip);
  });
}

function openJoinSheet() {
  openSheet("Unirme al director", (body) => {
    const note = document.createElement("p");
    note.className = "sheet-note";
    note.textContent = "Escribe el código de 4 letras que aparece en el teléfono del director.";
    const input = document.createElement("input");
    input.className = "live-code-input";
    input.type = "text";
    input.maxLength = 6;
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "characters");
    input.setAttribute("spellcheck", "false");
    input.placeholder = "ABCD";
    input.setAttribute("aria-label", "Código de la sesión");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Unirme";
    const submit = async () => {
      button.disabled = true;
      const ok = await joinLive(input.value);
      button.disabled = false;
      if (ok) closeSheet();
    };
    button.addEventListener("click", submit);
    input.addEventListener("input", () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
    const actions = document.createElement("div");
    actions.className = "sheet-buttons";
    actions.appendChild(button);
    body.append(note, input, actions);
  });
}

function liveCodeFromHash() {
  const match = window.location.hash.match(/^#vivo=([A-Za-z0-9]{4,8})$/);
  if (!match) return null;
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return match[1].toUpperCase();
}

init();

async function init() {
  persistLists();
  wireEvents();
  updateAdminUi();
  updateConnectionState();

  try {
    const [hymnResponse, textResponse] = await Promise.all([
      fetch(`hymns.json?v=${APP_VERSION}`),
      fetch(`alabanzas.json?v=${APP_VERSION}`)
    ]);

    if (!hymnResponse.ok || !textResponse.ok) {
      throw new Error("No se pudo leer el catálogo.");
    }

    originalHymns = await hymnResponse.json();
    hymns = [...originalHymns];
    hymnTexts = await textResponse.json();
    await refreshSharedSongs({ timeoutMs: 4000 });
    mergeCustomHymnsIntoCatalog();
    cleanSavedListsAgainstCatalog();
    renderCatalog(hymns);
    renderListManager();

    const liveCode = liveCodeFromHash();
    if (liveCode) await joinLive(liveCode);
    else restoreLiveSession();
    renderLiveUi();

    if (/^#migrar=/.test(window.location.hash)) await receiveMigration();
    showMoveBannerIfOldAddress();

    const receivedSongs = /^#songs=/.test(window.location.hash);
    const sharedPayload = receivedSongs ? null : parseSharedListFromHash();
    if (receivedSongs) {
      await receiveSharedSongs();
    } else if (sharedPayload) {
      sharedList = sharedPayload;
      renderSharedListModal();
      openSharedListModal();
    } else {
      const requestedHymn = Number(new URLSearchParams(window.location.search).get("hymn"));
      if (Number.isInteger(requestedHymn) && hymns.some((item) => item.number === requestedHymn)) {
        openViewer(requestedHymn);
      }
    }
  } catch (error) {
    console.error(error);
    showToast("No se pudieron cargar las alabanzas. Actualiza la página.");
  }

  registerServiceWorker();
  showIosInstallHintWhenNeeded();
}

function wireEvents() {
  elements.searchInput.addEventListener("input", () => {
    const query = normalize(elements.searchInput.value.trim());
    const filtered = hymns.filter((hymn) => {
      if (!matchesCatalogFilter(hymn)) return false;
      return (
        String(hymn.number).includes(query) ||
        normalize(hymn.title).includes(query) ||
        normalize(hymn.artist || "").includes(query) ||
        normalize(hymn.author || "").includes(query)
      );
    });
    renderCatalog(filtered);
  });

  elements.catalogFilters.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    catalogFilter = chip.dataset.filter;
    elements.catalogFilters.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("active", item === chip);
      item.setAttribute("aria-pressed", String(item === chip));
    });
    refreshCatalog();
  });

  elements.themeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-choice]");
    if (button) setTheme(button.dataset.themeChoice);
  });
  updateThemeSwitch();

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.createListButton.addEventListener("click", createNewList);
  elements.createFirstListButton.addEventListener("click", createNewList);
  elements.newListFab.addEventListener("click", createNewList);
  elements.backToListsButton.addEventListener("click", closeListDetail);
  elements.listMenuButton.addEventListener("click", openListMenu);
  elements.playListButton.addEventListener("click", playActiveList);
  elements.directListButton.addEventListener("click", directActiveList);
  elements.startLiveButton.addEventListener("click", liveCardPrimary);
  elements.joinLiveButton.addEventListener("click", liveCardSecondary);
  elements.liveBarAction.addEventListener("click", () => {
    if (liveSession?.role === "director") openLiveInvite();
    else showLiveNow();
  });
  elements.liveBarStop.addEventListener("click", confirmStopLive);
  elements.viewerLiveChip.addEventListener("click", openLiveMenu);
  elements.actionSheetClose.addEventListener("click", closeSheet);
  elements.actionSheet.addEventListener("click", (event) => {
    // El mismo toque que abrió la hoja no debe cerrarla (algunos teléfonos repiten el clic).
    if (event.target === elements.actionSheet && Date.now() - sheetOpenedAt > 400) closeSheet();
  });
  elements.listsFilter.addEventListener("click", (event) => {
    const button = event.target.closest("[data-list-filter]");
    if (!button) return;
    listFilter = button.dataset.listFilter;
    elements.listsFilter.querySelectorAll("[data-list-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-checked", String(item === button));
    });
    renderSavedListsGrid();
  });
  elements.setlistNote.addEventListener("input", () => {
    const activeList = getActiveList();
    if (!activeList) return;
    activeList.note = elements.setlistNote.value.slice(0, 300);
    activeList.updatedAt = Date.now();
    persistLists();
    renderActiveListNote(activeList);
    elements.saveStatus.textContent = "Cambios guardados.";
  });
  elements.deleteListButton.addEventListener("click", deleteActiveList);
  elements.shareListButton.addEventListener("click", shareActiveList);

  elements.setlistDate.addEventListener("change", () => updateActiveListWhen());
  elements.setlistTime.addEventListener("change", () => updateActiveListWhen());
  elements.listSearchInput.addEventListener("input", renderListSearch);
  elements.listSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      elements.listSearchInput.value = "";
      renderListSearch();
    }
  });

  elements.setlistName.addEventListener("input", () => {
    const activeList = getActiveList();
    if (!activeList) return;

    activeList.name = elements.setlistName.value;
    // Si escribe su propio nombre, ya no se cambia solo con la fecha.
    activeList.autoName = !elements.setlistName.value.trim() || elements.setlistName.value === autoListName(activeList);
    activeList.updatedAt = Date.now();
    persistLists();
    elements.activeListTitle.textContent = displayListName(activeList);
    elements.saveStatus.textContent = "Cambios guardados automáticamente.";
    renderSavedListsGrid();
    updateViewerAddButton();
  });

  elements.setlistName.addEventListener("blur", () => {
    const activeList = getActiveList();
    if (!activeList) return;

    if (!activeList.name.trim()) {
      activeList.autoName = true;
      activeList.name = autoListName(activeList);
      elements.setlistName.value = activeList.name;
      elements.activeListTitle.textContent = activeList.name;
      persistLists();
      renderSavedListsGrid();
    }
  });

  elements.clearSetlistButton.addEventListener("click", () => {
    const activeList = getActiveList();
    if (!activeList || activeList.hymns.length === 0) return;
    if (!confirm(`¿Deseas vaciar el listado “${displayListName(activeList)}”?`)) return;

    activeList.hymns = [];
    activeList.updatedAt = Date.now();
    persistLists();
    renderListManager();
    showToast("Listado vaciado.");
  });

  elements.closeViewer.addEventListener("click", closeViewer);

  elements.viewerAddButton.addEventListener("click", () => {
    if (!currentHymn) return;

    if (!getActiveList()) {
      closeViewer();
      switchView("setlist");
      showToast("Primero crea un listado para agregar esta alabanza.");
      elements.createListButton.focus();
      return;
    }

    addToActiveList(currentHymn.number);
  });

  elements.transposeDown.addEventListener("click", () => changeTranspose(-1));
  elements.transposeUp.addEventListener("click", () => changeTranspose(1));
  elements.transposeReset.addEventListener("click", () => setTranspose(0));

  elements.fontSmaller.addEventListener("click", () => changeFontScale(-0.1));
  elements.fontLarger.addEventListener("click", () => changeFontScale(0.1));
  elements.viewModeButton.addEventListener("click", () => {
    viewMode = viewMode === "pdf" ? "texto" : "pdf";
    writeSetting(STORAGE_KEYS.viewMode, viewMode);
    renderTransposedSheet();
  });
  elements.tipsButton.addEventListener("click", toggleTips);
  elements.editHymnButton.addEventListener("click", () => {
    if (currentHymn && (currentHymn.custom || getAdminPin())) openImporter(currentHymn.number);
  });
  elements.sectionButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-section]");
    if (!button) return;
    markSection(button.dataset.section);
  });

  elements.openImporterButton.addEventListener("click", () => openImporter());
  elements.closeImporterButton.addEventListener("click", closeImporter);
  [elements.importText, elements.importKey].forEach((input) => {
    input.addEventListener("input", () => {
      clearImportError();
      renderImportPreview();
    });
  });
  [elements.importTitle, elements.importArtist].forEach((input) => {
    input.addEventListener("input", clearImportError);
  });
  elements.importText.addEventListener("paste", () => {
    setTimeout(autofillImportFields, 0);
  });
  elements.importTransposeDown.addEventListener("click", () => {
    importerState.previewShift -= 1;
    renderImportPreview();
  });
  elements.importTransposeUp.addEventListener("click", () => {
    importerState.previewShift += 1;
    renderImportPreview();
  });
  elements.saveLocalButton.addEventListener("click", saveImportedHymn);
  elements.publishButton.addEventListener("click", publishImportedHymn);
  elements.adminButton.addEventListener("click", async () => {
    if (getAdminPin()) {
      if (confirm("¿Salir del modo administrador en este dispositivo?")) {
        forgetAdminPin();
        showToast("Saliste del modo administrador.");
      }
      return;
    }
    if (await ensureAdminPin()) showToast("Modo administrador activado en este dispositivo.");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    reconnectLiveIfNeeded();
    if (hymns.length) refreshSharedSongsAndRender();
  });
  elements.deleteCustomHymnButton.addEventListener("click", deleteCustomHymn);
  elements.sendCustomHymnsButton.addEventListener("click", sendCustomHymns);
  elements.restoreHiddenButton.addEventListener("click", restoreHiddenHymns);

  elements.previousHymnButton.addEventListener("click", () => navigateSetlist(-1));
  elements.nextHymnButton.addEventListener("click", () => navigateSetlist(1));

  elements.pageViewport.addEventListener("touchstart", (event) => {
    if (event.touches.length >= 2) {
      startPinch(event);
      swipeStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    swipeStart = pinchState ? null : { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  // Pellizcar con dos dedos para acercar o alejar (teléfono y tablet).
  elements.pageViewport.addEventListener("touchmove", (event) => {
    if (!pinchState || event.touches.length < 2) return;
    event.preventDefault();
    movePinch(event);
  }, { passive: false });

  elements.pageViewport.addEventListener("touchend", (event) => {
    if (pinchState) {
      if (event.touches.length < 2) endPinch();
      swipeStart = null;
      return;
    }
  }, { passive: true });
  elements.pageViewport.addEventListener("touchcancel", () => {
    if (pinchState) endPinch();
  }, { passive: true });
  // Safari (iPhone) tiene su propio zoom de página: se desactiva dentro del visor.
  ["gesturestart", "gesturechange"].forEach((type) => {
    elements.pageViewport.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });

  elements.pageViewport.addEventListener("touchend", (event) => {
    if (!swipeStart || !isViewerListContext()) return;
    // Si la página está ampliada y se puede mover a los lados, deslizar no cambia de alabanza.
    if (elements.pageViewport.scrollWidth > elements.pageViewport.clientWidth + 4) {
      swipeStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.4) return;
    navigateSetlist(deltaX < 0 ? 1 : -1);
  }, { passive: true });

  elements.closeSharedListButton.addEventListener("click", () => closeSharedListModal(true));
  elements.openSharedListButton.addEventListener("click", () => {
    if (!sharedList || sharedList.hymns.length === 0) return;
    closeSharedListModal(false);
    reopenSharedModalAfterViewer = true;
    openViewer(sharedList.hymns[0], { source: "shared", listId: sharedList.id });
  });
  elements.saveSharedListButton.addEventListener("click", importSharedList);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const body = elements.transposedSheet.querySelector(".chord-sheet-body");
      if (body && !elements.viewer.classList.contains("hidden")) layoutSheet(body);
      const preview = elements.importPreview.querySelector(".chord-sheet-body");
      if (preview && !elements.importerModal.classList.contains("hidden")) ChordPro.fitChords(preview);
    }, 120);
  });

  window.addEventListener("online", () => {
    updateConnectionState();
    reconnectLiveIfNeeded();
    if (hymns.length) refreshSharedSongsAndRender();
  });
  window.addEventListener("offline", updateConnectionState);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.classList.remove("hidden");
  });

  elements.installButton.addEventListener("click", installApp);

  elements.updateButton.addEventListener("click", () => {
    if (waitingServiceWorker) {
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (isSheetOpen()) {
      if (event.key === "Escape") closeSheet();
      return;
    }

    if (!elements.importerModal.classList.contains("hidden")) {
      if (event.key === "Escape") closeImporter();
      return;
    }

    if (!elements.sharedListModal.classList.contains("hidden") && event.key === "Escape") {
      closeSharedListModal(true);
      return;
    }

    if (elements.viewer.classList.contains("hidden")) return;

    if (event.key === "Escape") closeViewer();
    if (isViewerListContext() && event.key === "ArrowLeft") navigateSetlist(-1);
    if (isViewerListContext() && event.key === "ArrowRight") navigateSetlist(1);
  });
}

function cleanSavedListsAgainstCatalog() {
  const validNumbers = new Set(hymns.map((hymn) => hymn.number));
  let changed = false;
  // Sin conexión no sabemos qué alabanzas publicadas existen: no se quitan de los listados.
  const keep = (number) =>
    validNumbers.has(number) ||
    (!sharedSongsFromServer && number >= SHARED_FIRST_NUMBER && number < CUSTOM_HYMN_START);

  savedLists.forEach((list) => {
    const cleaned = list.hymns.filter(keep);
    if (cleaned.length !== list.hymns.length) {
      list.hymns = cleaned;
      list.updatedAt = Date.now();
      changed = true;
    }
  });

  if (changed) persistLists();
}

function renderCatalog(allItems) {
  const items = allItems.filter((hymn) => !isHidden(hymn.number));
  const visibleTotal = hymns.filter((hymn) => !isHidden(hymn.number)).length;
  elements.hymnGrid.innerHTML = "";
  elements.emptySearch.classList.toggle("hidden", items.length > 0);
  elements.catalogCount.textContent = items.length === visibleTotal
    ? `${visibleTotal} alabanzas`
    : `${items.length} resultado${items.length === 1 ? "" : "s"}`;
  renderCatalogTools();

  const fragment = document.createDocumentFragment();

  for (const hymn of items) {
    const card = document.createElement("article");
    card.className = "hymn-card";
    if (hymn.custom) card.classList.add("custom");
    card.innerHTML = `
      <span class="hymn-number">${hymn.custom ? "P" : hymn.number}</span>
      <div class="hymn-card-copy">
        <h3>${escapeHtml(hymn.title)}</h3>
        ${hymn.artist || hymn.custom
          ? `<p>${escapeHtml([hymn.artist, hymn.custom ? "Agregada en este dispositivo" : ""].filter(Boolean).join(" · "))}</p>`
          : ""}
      </div>
      ${canDelete(hymn)
        ? `<button class="card-delete" type="button" aria-label="Eliminar ${escapeHtml(hymn.title)}" title="Eliminar">
             <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
           </button>`
        : ""}
      <button class="card-open" type="button" aria-label="Abrir ${escapeHtml(hymn.title)}">›</button>
    `;

    // Toda la tarjeta abre la alabanza (no solo la flecha).
    card.addEventListener("click", () => openViewer(hymn.number));
    card.querySelector(".card-delete")?.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteHymnFromCatalog(hymn);
    });
    card.addEventListener("dblclick", () => {
      if (getActiveList()) addToActiveList(hymn.number);
    });
    fragment.appendChild(card);
  }

  elements.hymnGrid.appendChild(fragment);
}

function renderListManager() {
  renderSavedListsGrid();
  renderActiveList();

  const count = savedLists.length;
  elements.setlistCount.textContent = String(count);
  elements.listLimitText.textContent = count === 0
    ? "No tienes listados guardados."
    : `${count} de ${MAX_LISTS} listados guardados.`;
  elements.createListButton.disabled = count >= MAX_LISTS;
  elements.createListButton.textContent = count >= MAX_LISTS
    ? "Límite alcanzado"
    : "Nuevo listado";
  elements.noListsState.classList.toggle("hidden", count > 0);
  elements.savedListsGrid.classList.toggle("hidden", count === 0);
  elements.listsFilter.classList.toggle("hidden", count === 0);
  elements.newListFab.classList.toggle("hidden", count >= MAX_LISTS);

  const showDetail = listDetailOpen && Boolean(getActiveList());
  if (!showDetail) listDetailOpen = false;
  elements.listsOverview.classList.toggle("hidden", showDetail);
  elements.activeListEditor.classList.toggle("hidden", !showDetail);
  renderListStats();
  renderLiveUi();
}

function renderSavedListsGrid() {
  elements.savedListsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const visible = sortedListsForDisplay().filter((list) => (listFilter === "past" ? isPastList(list) : !isPastList(list)));

  visible.forEach((list) => {
    const button = document.createElement("button");
    button.type = "button";
    const past = isPastList(list);
    button.className = `saved-list-card${past ? " past" : ""}`;
    const time = list.time ? formatTime12(list.time) : "";
    const count = `${list.hymns.length} alabanza${list.hymns.length === 1 ? "" : "s"}`;
    const titles = list.hymns
      .map((number) => hymns.find((item) => item.number === number)?.title)
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");
    button.innerHTML = `
      ${listCardTile(list)}
      <span class="saved-list-copy">
        <strong>${escapeHtml(displayListName(list))}</strong>
        <small class="list-when-label">${escapeHtml([time, count].filter(Boolean).join(" · "))}</small>
        ${titles ? `<span class="saved-list-preview">${escapeHtml(titles)}</span>` : ""}
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    `;
    button.addEventListener("click", () => openListDetail(list.id));
    fragment.appendChild(button);
  });

  elements.savedListsGrid.appendChild(fragment);
  const nothing = savedLists.length > 0 && visible.length === 0;
  elements.listsFilterEmpty.classList.toggle("hidden", !nothing);
  elements.listsFilterEmpty.textContent = listFilter === "past"
    ? "Todavía no hay listados de fechas pasadas."
    : "No hay servicios próximos. Toca “+ Nuevo” para crear uno.";
}

function renderActiveList() {
  const activeList = getActiveList();

  if (!activeList) {
    elements.activeListEditor.classList.add("hidden");
    elements.setlistItems.innerHTML = "";
    return;
  }

  elements.activeListTitle.textContent = displayListName(activeList);
  elements.activeListWhen.textContent = formatListWhen(activeList) || "Sin fecha";
  elements.activeListCount.textContent = String(activeList.hymns.length);
  elements.setlistName.value = activeList.name;
  elements.setlistDate.value = activeList.date || "";
  elements.setlistTime.value = activeList.time || "";
  if (document.activeElement !== elements.setlistNote) elements.setlistNote.value = activeList.note || "";
  renderActiveListNote(activeList);
  elements.saveStatus.textContent = "Guardado en este teléfono.";
  renderListSearch();
  elements.setlistItems.innerHTML = "";
  elements.emptySetlist.classList.toggle("hidden", activeList.hymns.length > 0);
  elements.clearSetlistButton.classList.toggle("hidden", activeList.hymns.length === 0);
  elements.shareListButton.disabled = activeList.hymns.length === 0;
  elements.playListButton.disabled = activeList.hymns.length === 0;

  const fragment = document.createDocumentFragment();

  activeList.hymns.forEach((number, index) => {
    const hymn = hymns.find((item) => item.number === number);
    if (!hymn) return;

    const shift = listShift(activeList, number);
    const selectedKey = hymnKeyLabel(hymn, shift);
    const note = activeList.notes?.[number] || "";
    const row = document.createElement("article");
    row.className = "setlist-row";
    row.innerHTML = `
      <span class="position">${index + 1}</span>
      <button type="button" class="setlist-open" data-action="open">
        <strong>${escapeHtml(hymn.title)}</strong>
        <small>${escapeHtml([hymn.artist, hymn.custom ? "En este teléfono" : `Alabanza ${hymn.number}`].filter(Boolean).join(" · "))}</small>
        ${note ? `<span class="setlist-note">${escapeHtml(note)}</span>` : ""}
      </button>
      <button type="button" class="key-pill${shift !== 0 ? " changed" : ""}" data-action="key" aria-label="Tono ${escapeHtml(selectedKey)}. Cambiar tono">${escapeHtml(selectedKey)}</button>
      <button type="button" class="kebab" data-action="menu" aria-label="Opciones de ${escapeHtml(hymn.title)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>
      </button>
    `;

    row.querySelector('[data-action="open"]').addEventListener("click", () => {
      openViewer(number, { source: "setlist", listId: activeList.id });
    });
    row.querySelector('[data-action="key"]').addEventListener("click", () => openKeySheet(number));
    row.querySelector('[data-action="menu"]').addEventListener("click", () => openRowMenu(number));
    fragment.appendChild(row);
  });

  elements.setlistItems.appendChild(fragment);
}

function renderActiveListNote(list) {
  const note = (list.note || "").trim();
  elements.activeListNote.textContent = note;
  elements.activeListNote.classList.toggle("hidden", !note);
}

function createNewList() {
  if (savedLists.length >= MAX_LISTS) {
    showToast(`Solo puedes guardar ${MAX_LISTS} listados.`);
    return;
  }

  const newList = createListObject("", []);
  newList.date = todayIso();
  newList.time = "";
  newList.autoName = true;
  newList.name = autoListName(newList);
  savedLists.push(newList);
  persistLists();
  switchView("setlist");
  openListDetail(newList.id, { expandDetails: true });

  elements.setlistDate.focus();
  showToast("Nuevo listado creado. Elige la fecha y la hora.");
}

function deleteActiveList() {
  const activeList = getActiveList();
  if (!activeList) return;

  if (!confirm(`¿Deseas eliminar el listado “${displayListName(activeList)}”?`)) return;

  const currentIndex = savedLists.findIndex((list) => list.id === activeList.id);
  savedLists = savedLists.filter((list) => list.id !== activeList.id);

  if (savedLists.length > 0) {
    const nextIndex = Math.min(currentIndex, savedLists.length - 1);
    activeListId = savedLists[nextIndex].id;
  } else {
    activeListId = null;
  }

  listDetailOpen = false;
  persistLists();
  renderListManager();
  updateViewerAddButton();
  showToast("Listado eliminado.");
}

function selectList(listId) {
  openListDetail(listId);
}

function getActiveList() {
  return savedLists.find((list) => list.id === activeListId) || null;
}

function addToActiveList(number) {
  const activeList = getActiveList();
  if (!activeList) {
    showToast("Primero crea un listado.");
    return;
  }

  if (activeList.hymns.includes(number)) {
    showToast(`Esta alabanza ya está en “${displayListName(activeList)}”.`);
    return;
  }

  activeList.hymns.push(number);
  activeList.updatedAt = Date.now();
  persistLists();
  const searchHadFocus = document.activeElement === elements.listSearchInput;
  renderListManager();
  if (searchHadFocus) elements.listSearchInput.focus();
  updateViewerAddButton();
  showToast(`Agregada a “${displayListName(activeList)}”.`);
}

function removeFromActiveList(number) {
  const activeList = getActiveList();
  if (!activeList) return;

  activeList.hymns = activeList.hymns.filter((item) => item !== number);
  if (activeList.keys) delete activeList.keys[number];
  if (activeList.notes) delete activeList.notes[number];
  activeList.updatedAt = Date.now();
  persistLists();
  renderListManager();
  updateViewerAddButton();
}

function moveActiveListItem(index, direction) {
  const activeList = getActiveList();
  if (!activeList) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= activeList.hymns.length) return;

  [activeList.hymns[index], activeList.hymns[targetIndex]] =
    [activeList.hymns[targetIndex], activeList.hymns[index]];

  activeList.updatedAt = Date.now();
  persistLists();
  renderListManager();
}

function openViewer(number, context = { source: "catalog", listId: null }) {
  const hymn = hymns.find((item) => item.number === number);
  if (!hymn) return;

  let resolvedContext = { source: "catalog", listId: null };

  if (context.source === "setlist") {
    const sourceList = savedLists.find(
      (list) => list.id === context.listId && list.hymns.includes(number)
    );
    if (sourceList) resolvedContext = { source: "setlist", listId: sourceList.id };
  }

  if (context.source === "shared" && sharedList?.hymns.includes(number)) {
    resolvedContext = { source: "shared", listId: sharedList.id };
  }

  if (context.source === "live" && liveSession?.state) {
    resolvedContext = { source: "live", listId: "live" };
  }

  viewerContext = resolvedContext;
  currentHymn = hymn;

  const contextList = getViewerList();
  elements.viewerTitle.textContent = hymn.title;
  const artistLabel = hymn.artist ? hymn.artist : "Himnario IBSI";
  const numberLabel = hymn.custom ? "Agregada en este dispositivo" : `Alabanza ${hymn.number}`;
  elements.viewerSubtitle.textContent = contextList
    ? `${displayListName(contextList)} · ${artistLabel} · ${numberLabel}`
    : `${artistLabel} · ${numberLabel}`;
  updateAdminUi();

  elements.viewer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.body.classList.add("viewer-open");
  updateTransposeDisplay();
  renderTransposedSheet();
  updateViewerAddButton();
  updateSetlistNavigation();
  updateViewerNote();
  elements.pageViewport.scrollTo({ top: 0, left: 0 });
  showPinchHintOnce();
  liveBroadcast();
}

function closeViewer() {
  const shouldReopenShared = viewerContext.source === "shared" && reopenSharedModalAfterViewer;

  elements.viewer.classList.add("hidden");
  elements.transposedSheet.replaceChildren();
  document.body.style.overflow = "";
  document.body.classList.remove("viewer-open");
  currentHymn = null;
  viewerContext = { source: "catalog", listId: null };
  swipeStart = null;

  if (shouldReopenShared && sharedList) {
    reopenSharedModalAfterViewer = false;
    openSharedListModal();
  }
}

function getViewerList() {
  if (viewerContext.source === "setlist") {
    return savedLists.find((list) => list.id === viewerContext.listId) || null;
  }

  if (viewerContext.source === "shared") {
    return sharedList;
  }

  if (viewerContext.source === "live") {
    return liveViewerList();
  }

  return null;
}

function isViewerListContext() {
  return Boolean(getViewerList());
}

function updateSetlistNavigation() {
  const list = getViewerList();

  if (!currentHymn || !list) {
    elements.setlistNavigation.classList.add("hidden");
    return;
  }

  const index = list.hymns.indexOf(currentHymn.number);
  if (index < 0) {
    elements.setlistNavigation.classList.add("hidden");
    return;
  }

  elements.setlistNavigation.classList.remove("hidden");
  elements.setlistPosition.textContent = `${index + 1} de ${list.hymns.length}`;

  const previous = index > 0
    ? hymns.find((item) => item.number === list.hymns[index - 1])
    : null;
  const next = index < list.hymns.length - 1
    ? hymns.find((item) => item.number === list.hymns[index + 1])
    : null;

  elements.previousHymnButton.disabled = !previous;
  elements.nextHymnButton.disabled = !next;
  elements.previousHymnName.textContent = previous
    ? `${previous.number}. ${previous.title}`
    : "Inicio del listado";
  elements.nextHymnName.textContent = next
    ? `${next.number}. ${next.title}`
    : "Fin del listado";
}

function navigateSetlist(direction) {
  if (!currentHymn) return;

  const list = getViewerList();
  if (!list) return;

  const currentIndex = list.hymns.indexOf(currentHymn.number);
  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= list.hymns.length) return;

  if (viewerContext.source === "live" && liveSession) liveSession.localKeys = {};
  openViewer(list.hymns[targetIndex], {
    source: viewerContext.source,
    listId: list.id
  });
}

function changeTranspose(delta) {
  if (!currentHymn) return;
  const current = currentShift();
  setTranspose(Math.min(11, Math.max(-11, current + delta)));
}

function setTranspose(value) {
  if (!currentHymn) return;

  const number = currentHymn.number;
  const list = getViewerList();
  if (viewerContext.source === "live" && liveSession) {
    // Solo en este teléfono, hasta que el director cambie de alabanza o de tono.
    liveSession.localKeys = { ...(liveSession.localKeys || {}), [number]: value };
  } else if (list && viewerContext.source === "setlist") {
    list.keys = { ...(list.keys || {}), [number]: value };
    list.updatedAt = Date.now();
    persistLists();
  } else if (list && viewerContext.source === "shared") {
    list.keys = { ...(list.keys || {}), [number]: value };
  } else {
    transposeMap[String(number)] = value;
    saveTransposeMap();
  }
  updateTransposeDisplay();
  renderTransposedSheet();
  renderActiveList();
  liveBroadcast();
}

function getTranspose(number) {
  const value = Number(transposeMap[String(number)] || 0);
  return Number.isFinite(value) ? value : 0;
}

function updateTransposeDisplay() {
  if (!currentHymn) return;

  const shift = currentShift();
  elements.currentKey.textContent = transposeKey(
    currentHymn.originalKey,
    shift,
    currentHymn.preferFlats
  );
  elements.transposeAmount.textContent = formatTransposeAmount(shift);
  elements.transposeDown.disabled = shift <= -11;
  elements.transposeUp.disabled = shift >= 11;
  elements.transposeReset.disabled = shift === 0;
}

function formatTransposeAmount(shift) {
  if (shift === 0) return "Original";
  const sign = shift > 0 ? "+" : "";
  return `${sign}${shift}`;
}

function transposeKey(key, shift, preferFlats) {
  const match = /^([A-G])([#b]?)(.*)$/.exec(key);
  if (!match) return key;

  const [, root, accidental, suffix] = match;
  return `${transposeNote(root, accidental, shift, preferFlats)}${suffix}`;
}

function renderTransposedSheet() {
  if (!currentHymn) return;
  closeTipSheet();

  // Si una original fue corregida, la página del PDF ya no coincide: solo se muestra el texto.
  const hasPdf = !currentHymn.custom && !currentHymn.shared && !currentHymn.fixed;
  const usePdf = viewMode === "pdf" && hasPdf;
  elements.viewModeButton.classList.toggle("hidden", !hasPdf);
  elements.viewModeButton.textContent = usePdf ? "Texto" : "PDF";
  elements.viewModeButton.setAttribute("aria-pressed", String(usePdf));
  elements.tipsButton.classList.toggle("hidden", usePdf || !tipsAvailable());
  elements.tipsButton.setAttribute("aria-pressed", String(tipsActive()));
  elements.viewModeButton.title = usePdf
    ? "Volver a la vista de texto con acordes arriba"
    : "Ver la página original del PDF";
  updateFontButtons();
  applySheetScale(fontScale);
  elements.transposedSheet.classList.toggle("chord-sheet", !usePdf);
  elements.transposedSheet.classList.toggle("pdf-sheet", usePdf);

  if (usePdf) {
    renderPdfSheet();
  } else {
    renderTextSheet();
  }
}

function renderTextSheet() {
  const source = getHymnText(currentHymn);
  if (!source) {
    elements.transposedSheet.textContent = "No se encontró la letra de esta alabanza.";
    return;
  }

  const shift = currentShift();
  const parsed = ChordPro.parse(source);
  const header = document.createElement("header");
  header.className = "cs-header";
  header.innerHTML = `
    <h2>${currentHymn.custom ? "" : `<span>${currentHymn.number}.</span> `}${escapeHtml(currentHymn.title)}</h2>
    ${currentHymn.artist ? `<p>${escapeHtml(currentHymn.artist)}</p>` : ""}
  `;

  const body = ChordPro.render(parsed, {
    transposeChord: (chord) => transposeChordToken(chord, shift, currentHymn.preferFlats)
  });

  elements.transposedSheet.setAttribute(
    "aria-label",
    `Letra y acordes de ${currentHymn.title} en tono ${transposeKey(
      currentHymn.originalKey,
      shift,
      currentHymn.preferFlats
    )}`
  );
  elements.transposedSheet.replaceChildren(header, body);
  ChordPro.fitChords(body);
  if (tipsActive() && window.ChordTips) {
    const key = transposeKey(currentHymn.originalKey, shift, currentHymn.preferFlats);
    ChordTips.decorate(body, key, currentHymn.preferFlats, openTipSheet);
  }
}

function layoutSheet(body) {
  ChordPro.fitChords(body);
  if (window.ChordTips) ChordTips.layout(body);
}

// ---------- Modo Consejos ----------

function tipsAvailable() {
  return Boolean(currentHymn && TIPS_TEST_NUMBERS.includes(currentHymn.number));
}

function tipsActive() {
  return tipsAvailable() && readSetting(STORAGE_KEYS.tips, "0") === "1";
}

function toggleTips() {
  writeSetting(STORAGE_KEYS.tips, tipsActive() ? "0" : "1");
  closeTipSheet();
  renderTransposedSheet();
  if (tipsActive()) showToast("Toca una etiqueta para ver el consejo completo.");
}

function openTipSheet(tips, chordName) {
  closeTipSheet();
  const sheet = document.createElement("section");
  sheet.className = "tip-sheet";
  sheet.id = "tipSheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `Consejos para ${chordName}`);
  const kinds = { antes: "tócalo antes", "en lugar": "en lugar del acorde", encima: "encima del acorde", final: "para terminar" };
  sheet.innerHTML = `
    <div class="tip-sheet-head">
      <h3>Ideas para ${escapeHtml(chordName)}</h3>
      <button class="modal-close" type="button" aria-label="Cerrar">×</button>
    </div>
    ${tips.map((tip) => `
      <div class="tip-option">
        <strong>${escapeHtml(tip.title)}<span class="tip-kind">${escapeHtml(kinds[tip.kind] || "")}</span></strong>
        <span class="tip-how">${escapeHtml(tip.how)}</span>
        <p>${escapeHtml(tip.why)}</p>
      </div>`).join("")}
  `;
  sheet.querySelector(".modal-close").addEventListener("click", closeTipSheet);
  elements.viewer.appendChild(sheet);
}

function closeTipSheet() {
  document.querySelector("#tipSheet")?.remove();
}

function getHymnText(hymn) {
  if (hymn.custom || hymn.shared || hymn.fixed) return hymn.cho || "";
  return hymnTexts[String(hymn.number)] || "";
}

function changeFontScale(delta) {
  fontScale = Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, fontScale + delta)) * 10) / 10;
  writeSetting(STORAGE_KEYS.fontScale, String(fontScale));
  renderTransposedSheet();
}

// ---------- Zoom con dos dedos ----------

let pinchState = null;

function touchDistance(touches) {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
}

function startPinch(event) {
  if (!currentHymn || event.touches.length < 2) return;
  const viewport = elements.pageViewport;
  const rect = viewport.getBoundingClientRect();
  const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
  const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
  pinchState = {
    startDistance: touchDistance(event.touches),
    startScale: fontScale,
    scale: fontScale,
    centerX,
    centerY,
    // Punto del contenido que está bajo los dedos, en proporción, para mantenerlo ahí.
    ratioX: (viewport.scrollLeft + centerX) / Math.max(1, viewport.scrollWidth),
    ratioY: (viewport.scrollTop + centerY) / Math.max(1, viewport.scrollHeight),
    frame: null
  };
}

function movePinch(event) {
  const state = pinchState;
  const ratio = touchDistance(event.touches) / state.startDistance;
  state.scale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, state.startScale * ratio));
  if (state.frame) return;
  state.frame = requestAnimationFrame(() => {
    state.frame = null;
    if (pinchState !== state) return;
    applySheetScale(state.scale);
    const viewport = elements.pageViewport;
    viewport.scrollTop = state.ratioY * viewport.scrollHeight - state.centerY;
    viewport.scrollLeft = state.ratioX * viewport.scrollWidth - state.centerX;
  });
}

function endPinch() {
  const state = pinchState;
  pinchState = null;
  if (!state) return;
  if (state.frame) cancelAnimationFrame(state.frame);
  fontScale = Math.round(state.scale * 20) / 20;
  writeSetting(STORAGE_KEYS.fontScale, String(fontScale));
  applySheetScale(fontScale);
  updateFontButtons();
  const body = elements.transposedSheet.querySelector(".chord-sheet-body");
  if (body) layoutSheet(body);
}

function applySheetScale(scale) {
  elements.transposedSheet.style.setProperty("--sheet-scale", String(scale));
}

function updateFontButtons() {
  elements.fontSmaller.disabled = fontScale <= FONT_SCALE_MIN + 0.001;
  elements.fontLarger.disabled = fontScale >= FONT_SCALE_MAX - 0.001;
}

function showPinchHintOnce() {
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (!isTouch || readSetting(STORAGE_KEYS.pinchHint, "")) return;
  writeSetting(STORAGE_KEYS.pinchHint, "1");
  showToast("Pellizca con dos dedos para acercar o alejar.");
}

function loadHymnLayouts() {
  if (hymnLayouts) return Promise.resolve(hymnLayouts);
  if (!hymnLayoutsPromise) {
    hymnLayoutsPromise = fetch(`hymn_layouts.json?v=${APP_VERSION}`)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo leer el PDF.");
        return response.json();
      })
      .then((data) => {
        hymnLayouts = data;
        return data;
      })
      .catch((error) => {
        hymnLayoutsPromise = null;
        throw error;
      });
  }
  return hymnLayoutsPromise;
}

function renderPdfSheet() {
  if (!hymnLayouts) {
    const requested = currentHymn;
    elements.transposedSheet.textContent = "Cargando la página original…";
    loadHymnLayouts()
      .then(() => {
        if (currentHymn === requested && viewMode === "pdf") renderTransposedSheet();
      })
      .catch(() => {
        elements.transposedSheet.textContent =
          "No se pudo cargar la vista original. Revisa tu conexión e inténtalo de nuevo.";
      });
    return;
  }

  const layout = hymnLayouts[String(currentHymn.number)];
  if (!layout || !Array.isArray(layout.items)) {
    elements.transposedSheet.textContent = "No se encontró el formato de esta alabanza.";
    return;
  }

  const shift = currentShift();
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("hymn-layout-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Letra y acordes de ${currentHymn.title} en tono ${transposeKey(
      currentHymn.originalKey,
      shift,
      currentHymn.preferFlats
    )}`
  );
  svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

  const group = document.createElementNS(svgNamespace, "g");
  group.setAttribute("class", "hymn-content");

  for (const item of layout.items) {
    const textElement = document.createElementNS(svgNamespace, "text");
    const isChordElement = item.isChord || item.isSeparator;
    const text = item.isChord
      ? transposeChordToken(item.text, shift, currentHymn.preferFlats)
      : item.text;

    textElement.setAttribute("x", String(item.x));
    textElement.setAttribute("y", String(item.y));
    textElement.setAttribute("font-size", String(item.fontSize));
    const fontFamily =
      item.fontFamily === "Arial"
        ? "Arial, Helvetica, sans-serif"
        : item.fontFamily === "Courier New"
          ? "'Courier New', Courier, monospace"
          : "'Times New Roman', Times, serif";
    textElement.setAttribute("font-family", fontFamily);
    textElement.setAttribute("font-weight", String(item.fontWeight));
    textElement.setAttribute("font-style", item.fontStyle || "normal");
    if (item.textAnchor) textElement.setAttribute("text-anchor", item.textAnchor);
    if (item.isChord) textElement.setAttribute("data-chord-token", "true");
    textElement.setAttribute("fill", item.color || (isChordElement ? "#075e6a" : "#111111"));
    textElement.setAttribute("text-rendering", "geometricPrecision");
    textElement.textContent = text;
    group.appendChild(textElement);
  }

  svg.appendChild(group);
  elements.transposedSheet.replaceChildren(svg);

  if (currentHymn.number >= 215) {
    resolveNewHymnChordCollisions(group);
  }

  requestAnimationFrame(() => {
    applyContentFitViewBox(svg, group, layout);
  });
}

function resolveNewHymnChordCollisions(group) {
  const chordElements = [...group.querySelectorAll('text[data-chord-token="true"]')];
  const rows = new Map();

  chordElements.forEach((element) => {
    const rowKey = roundValue(Number(element.getAttribute("y")));
    if (!rows.has(rowKey)) rows.set(rowKey, []);
    rows.get(rowKey).push(element);
  });

  rows.forEach((row) => {
    row.sort((first, second) =>
      Number(first.getAttribute("x")) - Number(second.getAttribute("x"))
    );

    for (let index = 0; index < row.length - 1; index += 1) {
      const current = row[index];
      const next = row[index + 1];
      const currentX = Number(current.getAttribute("x"));
      const nextX = Number(next.getAttribute("x"));
      const availableWidth = Math.max(4, nextX - currentX - 6);
      const currentWidth = current.getBBox().width;

      if (currentWidth <= availableWidth) continue;

      const originalSize = Number(current.getAttribute("font-size"));
      const reducedSize = Math.max(
        7,
        Math.floor(originalSize * (availableWidth / currentWidth) * 100) / 100
      );

      current.setAttribute("font-size", String(reducedSize));

      if (current.getBBox().width > availableWidth) {
        current.setAttribute("textLength", String(roundValue(availableWidth)));
        current.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    }
  });
}

function applyContentFitViewBox(svg, group, layout) {
  let box;

  try {
    box = group.getBBox();
  } catch {
    box = { x: 0, y: 0, width: layout.width, height: layout.height };
  }

  if (!box.width || !box.height) {
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    return;
  }

  const isPhone = window.matchMedia("(max-width: 600px)").matches;
  const minimumWidthRatio = isPhone ? 0.68 : 0.76;
  const horizontalPadding = Math.max(9, box.width * 0.025);
  const verticalPadding = Math.max(12, box.height * 0.025);

  const contentWidth = box.width + horizontalPadding * 2;
  const viewWidth = Math.min(
    layout.width,
    Math.max(contentWidth, layout.width * minimumWidthRatio)
  );

  const centerX = box.x + box.width / 2;
  let viewX = centerX - viewWidth / 2;
  viewX = Math.max(0, Math.min(viewX, layout.width - viewWidth));

  const viewY = Math.max(0, box.y - verticalPadding);
  const maximumHeight = Math.max(1, layout.height - viewY);
  const viewHeight = Math.min(
    maximumHeight,
    box.height + verticalPadding * 2
  );

  svg.setAttribute(
    "viewBox",
    `${roundValue(viewX)} ${roundValue(viewY)} ${roundValue(viewWidth)} ${roundValue(viewHeight)}`
  );
}

function roundValue(value) {
  return Math.round(value * 100) / 100;
}

function transposeChordToken(token, shift, preferFlats) {
  if (shift === 0) return token;

  const plain = token
    .replace(/^[([{¡¿]+/, "")
    .replace(/[)\]},.;:!?]+$/, "");

  if (/^[A-G]{2,}$/.test(plain)) {
    return token.replace(/[A-G]/g, (root) => {
      return transposeNote(root, "", shift, preferFlats);
    });
  }

  return token.replace(
    /(^|[-–—/(])([A-G])([#b]?)/g,
    (match, separator, root, accidental) => {
      return `${separator}${transposeNote(root, accidental, shift, preferFlats)}`;
    }
  );
}

function transposeNote(root, accidental, shift, preferFlats) {
  const source = `${root}${accidental}`;
  const index = NOTE_INDEX[source];
  if (index === undefined) return source;

  const nextIndex = (index + shift + 120) % 12;
  const useFlats = accidental === "b" || (accidental !== "#" && preferFlats);
  return (useFlats ? FLAT_NOTES : SHARP_NOTES)[nextIndex];
}

// ---------- Alabanzas agregadas en este dispositivo e importador ----------

function readSetting(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento disponible: la preferencia dura solo esta sesión.
  }
}

function loadCustomHymns() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.customHymns) || "[]");
    return Array.isArray(data) ? data.filter((h) => h && h.number && h.cho) : [];
  } catch {
    return [];
  }
}

function persistCustomHymns() {
  try {
    localStorage.setItem(STORAGE_KEYS.customHymns, JSON.stringify(customHymns));
    return true;
  } catch {
    showToast("No se pudo guardar en este dispositivo.");
    return false;
  }
}

function mergeCustomHymnsIntoCatalog() {
  const fixes = new Map(originalFixes.map((fix) => [fix.number, fix]));
  hymns = originalHymns.map((hymn) => {
    const fix = fixes.get(hymn.number);
    return fix
      ? { ...hymn, title: fix.title, artist: fix.artist, originalKey: fix.originalKey, preferFlats: fix.preferFlats, cho: fix.cho, fixed: true }
      : hymn;
  });
  sharedSongs.forEach((hymn) => hymns.push({ ...hymn, shared: true }));
  customHymns.forEach((hymn) => hymns.push({ ...hymn, custom: true }));
}

// ---------- Alabanzas publicadas para todos (Cloudflare) ----------

function loadSharedSongsCache() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.sharedSongs) || "[]");
    return Array.isArray(data) ? data.filter((s) => s && s.number && s.cho) : [];
  } catch {
    return [];
  }
}

function loadOriginalFixesCache() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.originalFixes) || "[]");
    return Array.isArray(data) ? data.filter((f) => f && f.number && f.cho) : [];
  } catch {
    return [];
  }
}

async function refreshSharedSongs({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SHARED_API}/songs`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const songs = (Array.isArray(data.songs) ? data.songs : []).map((s) => ({
      id: String(s.id || ""),
      number: Number(s.number),
      title: String(s.title || ""),
      artist: String(s.artist || ""),
      originalKey: String(s.originalKey || "C"),
      preferFlats: Boolean(s.preferFlats),
      cho: String(s.cho || "")
    }));
    const fixes = (Array.isArray(data.fixes) ? data.fixes : []).map((f) => ({
      number: Number(f.number),
      title: String(f.title || ""),
      artist: String(f.artist || ""),
      originalKey: String(f.originalKey || "C"),
      preferFlats: Boolean(f.preferFlats),
      cho: String(f.cho || "")
    }));
    const songsChanged = JSON.stringify(songs) !== JSON.stringify(sharedSongs);
    const fixesChanged = JSON.stringify(fixes) !== JSON.stringify(originalFixes);
    if (songsChanged) applyNumberChanges(sharedSongs, songs);
    sharedSongs = songs;
    originalFixes = fixes;
    sharedSongsFromServer = true;
    writeSetting(STORAGE_KEYS.sharedSongs, JSON.stringify(songs));
    writeSetting(STORAGE_KEYS.originalFixes, JSON.stringify(fixes));
    return songsChanged || fixesChanged;
  } catch (error) {
    console.warn("No se pudieron actualizar las alabanzas publicadas:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Cuando se elimina una alabanza, las siguientes cambian de número. Los listados y los
// tonos guardados en este dispositivo se ajustan para que sigan apuntando a la misma canción.
function applyNumberChanges(oldSongs, newSongs) {
  if (!oldSongs.length || !oldSongs.every((s) => s.id)) return;
  const newById = new Map(newSongs.map((s) => [s.id, s.number]));
  const moved = new Map();
  const removed = new Set();
  oldSongs.forEach((s) => {
    if (!newById.has(s.id)) removed.add(s.number);
    else if (newById.get(s.id) !== s.number) moved.set(s.number, newById.get(s.id));
  });
  if (!moved.size && !removed.size) return;

  const remap = (n) => (moved.has(n) ? moved.get(n) : removed.has(n) ? null : n);
  savedLists.forEach((list) => {
    const next = list.hymns.map(remap).filter((n) => n !== null);
    if (next.join() !== list.hymns.join()) {
      const remapObject = (object) => {
        const result = {};
        Object.entries(object || {}).forEach(([key, value]) => {
          const target = remap(Number(key));
          if (target !== null) result[target] = value;
        });
        return result;
      };
      list.hymns = [...new Set(next)];
      list.keys = remapObject(list.keys);
      list.notes = remapObject(list.notes);
      list.updatedAt = Date.now();
    }
  });
  persistLists();

  const nextTranspose = {};
  Object.entries(transposeMap).forEach(([key, value]) => {
    const n = Number(key);
    if (!moved.has(n) && !removed.has(n)) nextTranspose[key] = value;
  });
  moved.forEach((to, from) => {
    if (transposeMap[String(from)] !== undefined) nextTranspose[String(to)] = transposeMap[String(from)];
  });
  transposeMap = nextTranspose;
  saveTransposeMap();
}

async function refreshSharedSongsAndRender() {
  const changed = await refreshSharedSongs();
  if (!changed) return;
  mergeCustomHymnsIntoCatalog();
  refreshCatalog();
  renderListManager();
  if (currentHymn?.shared) {
    const updated = hymns.find((h) => h.shared && h.id === currentHymn.id);
    if (updated) {
      openViewer(updated.number, viewerContext);
    } else {
      closeViewer();
    }
  } else if (currentHymn && !currentHymn.custom && !elements.viewer.classList.contains("hidden")) {
    const updated = hymns.find((h) => h.number === currentHymn.number && !h.custom && !h.shared);
    if (updated && updated.cho !== currentHymn.cho) openViewer(updated.number, viewerContext);
  }
}

function getAdminPin() {
  return readSetting(STORAGE_KEYS.adminPin, "");
}

async function ensureAdminPin() {
  const saved = getAdminPin();
  if (saved) return saved;
  const pin = prompt("Escribe la clave de administrador para publicar para todos:");
  if (!pin) return "";
  try {
    const response = await fetch(`${SHARED_API}/auth`, { headers: { Authorization: `Bearer ${pin.trim()}` } });
    if (response.status === 401) {
      showToast("Clave incorrecta.");
      return "";
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    showToast("Sin conexión. Para publicar necesitas internet.");
    return "";
  }
  writeSetting(STORAGE_KEYS.adminPin, pin.trim());
  updateAdminUi();
  return pin.trim();
}

function forgetAdminPin() {
  try {
    localStorage.removeItem(STORAGE_KEYS.adminPin);
  } catch {
    // nada que borrar
  }
  updateAdminUi();
}

function updateAdminUi() {
  const admin = Boolean(getAdminPin());
  if (hymns.length && admin !== updateAdminUi.lastAdmin) {
    updateAdminUi.lastAdmin = admin;
    refreshCatalog();
  }
  elements.adminButton.textContent = admin ? "Salir de administrador" : "Soy administrador";
  if (currentHymn) {
    elements.editHymnButton.classList.toggle("hidden", !(currentHymn.custom || admin));
  }
}

async function callSharedApi(method, path, body) {
  const pin = await ensureAdminPin();
  if (!pin) return null;
  let response;
  try {
    response = await fetch(`${SHARED_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${pin}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    showToast("Sin conexión. Para publicar necesitas internet.");
    return null;
  }
  if (response.status === 401) {
    forgetAdminPin();
    showToast("La clave de administrador ya no es válida. Vuelve a escribirla.");
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(data.error || "No se pudo completar. Inténtalo de nuevo.");
    return null;
  }
  return data;
}

function nextCustomNumber() {
  return customHymns.reduce((max, hymn) => Math.max(max, hymn.number + 1), CUSTOM_HYMN_START);
}

function openImporter(editNumber = null) {
  const editing = editNumber ? hymns.find((h) => h.number === editNumber) : null;
  const kind = editing ? (editing.shared ? "shared" : editing.custom ? "custom" : "original") : null;
  importerState = {
    editingNumber: editing ? editNumber : null,
    editingId: editing?.shared ? editing.id : null,
    editingKind: kind,
    previewShift: 0
  };
  const forEveryone = kind === "shared" || kind === "original";
  const eyebrow = elements.importerTitle.previousElementSibling;
  if (eyebrow) eyebrow.textContent = editing ? "Editar alabanza" : "Nueva alabanza";

  elements.importerTitle.textContent = editing
    ? (forEveryone ? `Corregir alabanza ${editing.number} (para todos)` : "Editar alabanza")
    : "Agregar alabanza";
  elements.saveLocalButton.classList.toggle("hidden", forEveryone);
  elements.publishButton.textContent = forEveryone ? "Guardar cambios para todos" : "Publicar para todos";
  elements.importTitle.value = editing?.title || "";
  elements.importArtist.value = editing?.artist || "";
  elements.importKey.value = editing?.originalKey || "";
  // Al editar, las divisiones (Estrofa, Coro, Final…) se escriben en el texto para poder cambiarlas.
  elements.importText.value = editing ? ChordPro.withSectionLabels(stripHeader(getHymnText(editing))) : "";
  elements.deleteCustomHymnButton.textContent = kind === "original" ? "Volver a la original" : "Eliminar";
  elements.deleteCustomHymnButton.classList.toggle("hidden", !editing || (kind === "original" && !editing.fixed));
  clearImportError();
  renderImportPreview();

  elements.importerModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  (editing ? elements.importText : elements.importTitle).focus();
}

// Marca la parte donde está el cursor: Estrofa, Coro, Puente…
// - Si el cursor está en una etiqueta (o en la primera línea justo debajo de una), la cambia.
// - Si no, pone la etiqueta en la línea del cursor; si es a mitad de un bloque, lo parte en dos.
// - "Quitar etiqueta" deja la parte separada pero sin nombre (escribe "Sin etiqueta").
// - "Unir con la de arriba" borra el nombre de esa parte y la une con la de arriba.
const SECTION_LABEL_LINE = /^\s*(?:coro|puente|pre-?coro|precoro|intro|introducci[oó]n|final|estribillo|verso|estrofa|interludio|outro|instrumental|solo|tag|coda|nota|sin\s+etiqueta|sin\s+nombre)(?:\s*\d+)?\s*:?\s*(?:\(?x\s*\d+\)?)?\s*$/i;

function markSection(label) {
  const textarea = elements.importText;
  const lines = textarea.value.replace(/\r/g, "").split("\n");
  const caret = textarea.selectionStart ?? 0;
  let row = textarea.value.slice(0, caret).split("\n").length - 1;

  // En una línea vacía: se usa la siguiente línea con texto.
  while (row < lines.length - 1 && !lines[row].trim()) row += 1;

  let labelRow = -1;
  if (SECTION_LABEL_LINE.test(lines[row] || "")) labelRow = row;
  else if (row > 0 && SECTION_LABEL_LINE.test(lines[row - 1])) labelRow = row - 1;
  else if (row > 1 && !lines[row - 1].trim() && SECTION_LABEL_LINE.test(lines[row - 2])) labelRow = row - 2;

  let focusRow;
  if (label === "") {
    // Quitar la división: se borra el nombre de esta parte y se une con la parte de arriba.
    let top;
    if (SECTION_LABEL_LINE.test(lines[row] || "")) {
      top = row;
      lines.splice(row, 1);
    } else {
      let start = row;
      while (start > 0 && lines[start - 1].trim() && !SECTION_LABEL_LINE.test(lines[start - 1])) start -= 1;
      top = start;
      if (start > 0 && SECTION_LABEL_LINE.test(lines[start - 1])) {
        top = start - 1;
        lines.splice(top, 1);
      } else if (start > 1 && !lines[start - 1].trim() && SECTION_LABEL_LINE.test(lines[start - 2])) {
        top = start - 2;
        lines.splice(top, 1);
      }
    }
    // Quitar las líneas vacías que separaban esta parte de la de arriba (y la que quedó tras el nombre).
    while (top < lines.length && !lines[top].trim()) lines.splice(top, 1);
    while (top > 0 && !lines[top - 1].trim()) {
      lines.splice(top - 1, 1);
      top -= 1;
    }
    if (top === 0) showToast("Esta es la primera parte: solo se quitó su nombre.");
    focusRow = Math.min(top, lines.length - 1);
  } else if (labelRow >= 0) {
    lines[labelRow] = label;
    focusRow = labelRow;
  } else {
    const startsBlock = row === 0 || !lines[row - 1].trim();
    const insert = startsBlock ? [label] : ["", label];
    lines.splice(row, 0, ...insert);
    focusRow = row + insert.length - 1;
  }

  textarea.value = lines.join("\n");
  const position = lines.slice(0, focusRow).join("\n").length + (focusRow ? 1 : 0);
  textarea.focus();
  textarea.setSelectionRange(position, position + (lines[focusRow] || "").length);
  clearImportError();
  renderImportPreview();
}

function closeImporter() {
  elements.importerModal.classList.add("hidden");
  if (elements.viewer.classList.contains("hidden")) document.body.style.overflow = "";
}

function stripHeader(cho) {
  return cho.replace(/^\s*\{(?:title|artist|key|flats)\s*:[^}]*\}\s*\n/gim, "").trim();
}

function importBodyAsChordPro() {
  const raw = elements.importText.value;
  if (!raw.trim()) return "";
  return ChordPro.looksLikeChordPro(raw) ? stripHeader(raw) : ChordPro.fromChordsOverLyrics(raw);
}

function importDetectedKey(body) {
  const typed = elements.importKey.value.trim();
  if (typed) return typed.charAt(0).toUpperCase() + typed.slice(1);
  return ChordPro.firstChord(body);
}

function autofillImportFields() {
  // Si la primera línea pegada parece "Título - Artista", se usa para rellenar los campos.
  const lines = elements.importText.value.replace(/\r/g, "").split("\n");
  const first = (lines[0] || "").trim();
  if (!first || ChordPro.isChordLine(first) || elements.importTitle.value.trim()) {
    renderImportPreview();
    return;
  }
  const match = /^(.+?)\s+[-–—]\s+(.+)$/.exec(first);
  if (match && first.length < 90 && /^\s*$/.test(lines[1] || "")) {
    elements.importTitle.value = match[1].trim();
    if (!elements.importArtist.value.trim()) elements.importArtist.value = match[2].trim();
    elements.importText.value = lines.slice(1).join("\n").replace(/^\s*\n/, "");
  }
  renderImportPreview();
}

function renderImportPreview() {
  const body = importBodyAsChordPro();
  const key = importDetectedKey(body);
  const preferFlats = /b/.test(key.slice(1, 2)) || ["F", "Dm"].includes(key);
  const shift = importerState.previewShift;
  elements.importPreviewKey.textContent = key ? transposeKey(key, shift, preferFlats) : "—";

  if (!body) {
    const hint = document.createElement("p");
    hint.className = "importer-hint";
    hint.textContent = "Aquí verás la alabanza con los acordes arriba de cada sílaba.";
    elements.importPreview.replaceChildren(hint);
    return;
  }

  const header = document.createElement("header");
  header.className = "cs-header";
  const title = elements.importTitle.value.trim();
  const artist = elements.importArtist.value.trim();
  header.innerHTML = `${title ? `<h2>${escapeHtml(title)}</h2>` : ""}${artist ? `<p>${escapeHtml(artist)}</p>` : ""}`;

  const rendered = ChordPro.render(ChordPro.parse(body), {
    transposeChord: (chord) => transposeChordToken(chord, shift, preferFlats)
  });
  elements.importPreview.replaceChildren(header, rendered);
  ChordPro.fitChords(rendered);
}

function buildImportedHymn() {
  const title = elements.importTitle.value.trim();
  const body = importBodyAsChordPro();
  if (!title) return { error: "Escribe el título de la alabanza.", field: elements.importTitle };
  if (!body) return { error: "Pega la letra con los acordes.", field: elements.importText };
  if (!/\[[^\]]+\]/.test(body)) {
    return {
      error: "No se encontraron acordes. Revisa que los acordes estén en la línea de arriba de la letra.",
      field: elements.importText
    };
  }

  const artist = elements.importArtist.value.trim();
  const originalKey = importDetectedKey(body) || "C";
  const preferFlats = /^[A-G]b/.test(originalKey) || /\[[A-G]b/.test(body);
  const cho = ChordPro.stringify({ title, artist, key: originalKey, flats: preferFlats }, body);
  return { hymn: { title, artist, originalKey, preferFlats, cho } };
}

function showImportError(message, field) {
  elements.importError.textContent = message;
  elements.importError.classList.remove("hidden");
  field?.focus();
}

function clearImportError() {
  elements.importError.classList.add("hidden");
  elements.importError.textContent = "";
}

async function publishImportedHymn() {
  const result = buildImportedHymn();
  if (result.error) {
    showImportError(result.error, result.field);
    return;
  }

  const { title, artist, originalKey, preferFlats, cho } = result.hymn;
  const payload = { title, artist, key: originalKey, flats: preferFlats, cho };
  const editingShared = importerState.editingKind === "shared";

  if (importerState.editingKind === "original") {
    const number = importerState.editingNumber;
    elements.publishButton.disabled = true;
    const saved = await callSharedApi("PUT", `/fixes/${number}`, payload);
    elements.publishButton.disabled = false;
    if (!saved?.fix) return;
    await refreshSharedSongs();
    mergeCustomHymnsIntoCatalog();
    refreshCatalog();
    closeImporter();
    showToast("Corrección guardada. Les llegará a todos al abrir la app.");
    openViewer(number, viewerContext);
    return;
  }

  elements.publishButton.disabled = true;
  const data = editingShared
    ? await callSharedApi("PUT", `/songs/${importerState.editingId}`, payload)
    : await callSharedApi("POST", "/songs", payload);
  elements.publishButton.disabled = false;
  if (!data?.song) return;

  // Si era una alabanza guardada solo en este dispositivo, ya no hace falta la copia local.
  if (importerState.editingKind === "custom") {
    const oldNumber = importerState.editingNumber;
    customHymns = customHymns.filter((h) => h.number !== oldNumber);
    persistCustomHymns();
    savedLists.forEach((list) => {
      list.hymns = list.hymns.map((n) => (n === oldNumber ? data.song.number : n));
    });
    persistLists();
  }

  await refreshSharedSongs();
  mergeCustomHymnsIntoCatalog();
  refreshCatalog();
  renderListManager();
  closeImporter();
  showToast(editingShared
    ? "Cambios publicados. Les llegará a todos al abrir la app."
    : `Publicada como alabanza ${data.song.number}. Les llegará a todos al abrir la app.`);
  openViewer(data.song.number);
}

function saveImportedHymn() {
  const result = buildImportedHymn();
  if (result.error) {
    showImportError(result.error, result.field);
    return;
  }

  const editing = importerState.editingKind === "custom" ? importerState.editingNumber : null;
  const number = editing || nextCustomNumber();
  const hymn = { number, ...result.hymn };
  const index = customHymns.findIndex((h) => h.number === number);
  if (index >= 0) customHymns[index] = hymn;
  else customHymns.push(hymn);
  if (!persistCustomHymns()) return;

  mergeCustomHymnsIntoCatalog();
  renderCatalog(hymns);
  closeImporter();
  showToast(editing ? "Alabanza actualizada." : "Alabanza guardada en este dispositivo.");
  openViewer(number);
}

async function deleteCustomHymn() {
  const number = importerState.editingNumber;
  if (importerState.editingKind === "original") {
    if (!confirm(`¿Quitar las correcciones de la alabanza ${number} y volver a como era originalmente? Cambia para todos.`)) return;
    const data = await callSharedApi("DELETE", `/fixes/${number}`);
    if (!data) return;
    await refreshSharedSongs();
    mergeCustomHymnsIntoCatalog();
    refreshCatalog();
    closeImporter();
    showToast("Alabanza devuelta a la original.");
    openViewer(number, viewerContext);
    return;
  }
  const hymn = hymns.find((h) => h.number === number && (h.custom || h.shared));
  if (!hymn) return;

  if (hymn.shared) {
    const removed = await deleteSharedHymn(hymn);
    if (removed) closeImporter();
    return;
  }

  if (!confirm(`¿Eliminar “${hymn.title}” de este dispositivo?`)) return;

  customHymns = customHymns.filter((h) => h.number !== number);
  persistCustomHymns();
  mergeCustomHymnsIntoCatalog();
  cleanSavedListsAgainstCatalog();
  refreshCatalog();
  renderListManager();
  closeImporter();
  if (currentHymn?.number === number) closeViewer();
  showToast("Alabanza eliminada.");
}

async function deleteSharedHymn(hymn) {
  const following = hymns.filter((h) => h.shared && h.number > hymn.number).length;
  const shiftNote = following
    ? `\n\nLas ${following} alabanza${following === 1 ? "" : "s"} siguiente${following === 1 ? "" : "s"} bajan un número (la ${hymn.number + 1} pasa a ser la ${hymn.number}).`
    : "";
  if (!confirm(`¿Eliminar “${hymn.number}. ${hymn.title}” POR COMPLETO, para todos?\n\nNo se puede deshacer.${shiftNote}`)) return false;
  if (currentHymn?.id === hymn.id) closeViewer();
  const data = await callSharedApi("DELETE", `/songs/${hymn.id}`);
  if (!data) return false;
  await refreshSharedSongs();
  mergeCustomHymnsIntoCatalog();
  cleanSavedListsAgainstCatalog();
  refreshCatalog();
  renderListManager();
  showToast(following ? "Eliminada. Los números siguientes se recorrieron." : "Alabanza eliminada para todos.");
  return true;
}

// ---------- Eliminar / ocultar alabanzas (en prueba) ----------

function loadHiddenHymns() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.hiddenHymns) || "[]");
    return new Set(Array.isArray(data) ? data.map(Number).filter(Number.isInteger) : []);
  } catch {
    return new Set();
  }
}

function persistHiddenHymns() {
  writeSetting(STORAGE_KEYS.hiddenHymns, JSON.stringify([...hiddenHymns]));
}

function isHidden() {
  // Ya no se ocultan alabanzas por dispositivo (las originales no se eliminan).
  return false;
}

function canDelete(hymn) {
  if (hymn.custom) return true;
  return Boolean(hymn.shared && getAdminPin());
}

function deleteHymnFromCatalog(hymn) {
  if (!canDelete(hymn)) return;
  if (hymn.shared) {
    deleteSharedHymn(hymn);
    return;
  }
  if (!confirm(`¿Eliminar “${hymn.title}” de este dispositivo?\n\nEsta alabanza la agregaste tú y no se puede recuperar.`)) return;
  customHymns = customHymns.filter((h) => h.number !== hymn.number);
  persistCustomHymns();
  mergeCustomHymnsIntoCatalog();
  cleanSavedListsAgainstCatalog();
  renderListManager();
  showToast("Alabanza eliminada.");
  refreshCatalog();
}

function restoreHiddenHymns() {
  const count = hiddenHymns.size;
  if (!count) return;
  hiddenHymns.clear();
  persistHiddenHymns();
  refreshCatalog();
  showToast(`${count} alabanza${count === 1 ? "" : "s"} recuperada${count === 1 ? "" : "s"}.`);
}

function refreshCatalog() {
  // Volver a aplicar la búsqueda que esté escrita.
  elements.searchInput.dispatchEvent(new Event("input"));
}

function renderCatalogTools() {
  const hiddenCount = 0;
  const customCount = customHymns.length;
  elements.restoreHiddenButton.classList.toggle("hidden", hiddenCount === 0);
  elements.restoreHiddenButton.textContent =
    `Mostrar eliminadas (${hiddenCount})`;
  elements.sendCustomHymnsButton.classList.toggle("hidden", customCount === 0);
  elements.customHymnsNote.textContent = customCount
    ? `Tienes ${customCount} alabanza${customCount === 1 ? "" : "s"} guardada${customCount === 1 ? "" : "s"} solo en este teléfono.`
    : "No tienes alabanzas guardadas solo en este teléfono.";
  const mineChip = elements.catalogFilters.querySelector('[data-filter="mias"]');
  mineChip.classList.toggle("hidden", customCount === 0);
  if (customCount === 0 && catalogFilter === "mias") catalogFilter = "all";
  elements.sendCustomHymnsButton.textContent =
    `Enviar mis alabanzas agregadas (${customCount}) a otro teléfono`;
  elements.catalogTools.classList.remove("hidden");
}

// ---------- Mudanza de GitHub Pages a Cloudflare ----------

function showMoveBannerIfOldAddress() {
  if (!OLD_HOSTS.includes(window.location.hostname)) return;
  elements.moveBanner.classList.remove("hidden");
  elements.moveButton.onclick = moveToNewAddress;
}

async function moveToNewAddress() {
  const data = {
    v: 1,
    lists: savedLists,
    active: activeListId,
    tr: transposeMap,
    custom: customHymns,
    hidden: [...hiddenHymns],
    view: viewMode,
    font: fontScale
  };
  let url = PUBLIC_URL;
  try {
    const packed = await compressText(JSON.stringify(data));
    url += packed ? `#migrar=z${packed}` : `#migrar=j${encodeSharePayload(data)}`;
  } catch {
    // Sin datos que pasar: se abre la dirección nueva igual.
  }
  window.location.href = url;
}

async function receiveMigration() {
  const encoded = window.location.hash.replace(/^#migrar=/, "");
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  let data;
  try {
    data = encoded.charAt(0) === "z"
      ? JSON.parse(await decompressText(encoded.slice(1)))
      : decodeSharePayload(encoded.slice(1));
  } catch (error) {
    console.error(error);
    showToast("No se pudieron pasar tus datos de la dirección anterior.");
    return;
  }
  if (!data || data.v !== 1) return;

  let added = 0;
  (Array.isArray(data.lists) ? data.lists : []).forEach((list) => {
    if (!list || !Array.isArray(list.hymns) || savedLists.length >= MAX_LISTS) return;
    const duplicate = savedLists.some(
      (l) => displayListName(l) === displayListName(list) && l.hymns.join() === list.hymns.join()
    );
    if (duplicate) return;
    savedLists.push({
      ...createListObject(String(list.name || "Listado").slice(0, 80), list.hymns.map(Number)),
      updatedAt: Number(list.updatedAt) || Date.now()
    });
    added += 1;
  });
  if (!activeListId && savedLists.length) activeListId = savedLists[0].id;
  persistLists();

  if (data.tr && typeof data.tr === "object") {
    transposeMap = { ...data.tr, ...transposeMap };
    saveTransposeMap();
  }
  (Array.isArray(data.custom) ? data.custom : []).forEach((h) => {
    if (!h || !h.cho || customHymns.some((c) => c.title === h.title && c.cho === h.cho)) return;
    customHymns.push({ ...h, number: nextCustomNumber() });
  });
  persistCustomHymns();
  (Array.isArray(data.hidden) ? data.hidden : []).forEach((n) => hiddenHymns.add(Number(n)));
  persistHiddenHymns();
  if (data.view === "pdf" || data.view === "texto") {
    viewMode = data.view;
    writeSetting(STORAGE_KEYS.viewMode, viewMode);
  }
  if (Number(data.font)) {
    fontScale = Number(data.font);
    writeSetting(STORAGE_KEYS.fontScale, String(fontScale));
  }

  mergeCustomHymnsIntoCatalog();
  renderListManager();
  showToast(added
    ? `Listo: se ${added === 1 ? "pasó 1 listado" : `pasaron ${added} listados`}. Instala la app desde aquí.`
    : "Listo: ya estás en la nueva dirección. Instala la app desde aquí.");
}

// ---------- Pasar alabanzas agregadas a otro teléfono ----------

async function compressText(text) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  buffer.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function decompressText(encoded) {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

async function sendCustomHymns() {
  if (!customHymns.length) return;
  const songs = customHymns.map((h) => ({
    t: h.title, a: h.artist || "", k: h.originalKey, f: h.preferFlats ? 1 : 0, c: h.cho
  }));
  const json = JSON.stringify({ v: 1, s: songs });
  const compressed = await compressText(json).catch(() => null);
  const payload = compressed ? `z${compressed}` : `j${encodeSharePayload({ v: 1, s: songs })}`;

  const base = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? PUBLIC_URL
    : `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#songs=${payload}`;
  const text = `🎶 Himnario IBSI: ${songs.length} alabanza${songs.length === 1 ? "" : "s"} para agregar.\nÁbrelo en el teléfono:`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Himnario IBSI — alabanzas", text, url });
      return;
    }
    await copyShareContent(`${text}\n${url}`);
    showToast("Enlace copiado. Envíatelo por WhatsApp y ábrelo en el teléfono.");
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await copyShareContent(`${text}\n${url}`);
      showToast("Enlace copiado. Envíatelo por WhatsApp y ábrelo en el teléfono.");
    } catch {
      showToast("No fue posible crear el enlace.");
    }
  }
}

async function receiveSharedSongs() {
  const encoded = window.location.hash.replace(/^#songs=/, "");
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

  let songs;
  try {
    const kind = encoded.charAt(0);
    const data = kind === "z"
      ? JSON.parse(await decompressText(encoded.slice(1)))
      : decodeSharePayload(encoded.slice(1));
    songs = (data && data.v === 1 && Array.isArray(data.s) ? data.s : [])
      .filter((s) => s && typeof s.t === "string" && typeof s.c === "string" && s.c.length < 50000);
  } catch (error) {
    console.error(error);
    showToast("El enlace de alabanzas no es válido o está incompleto.");
    return;
  }
  if (!songs.length) {
    showToast("El enlace no trae alabanzas.");
    return;
  }

  const newSongs = songs.filter(
    (s) => !customHymns.some((h) => h.title === s.t && h.cho === s.c)
  );
  if (!newSongs.length) {
    showToast("Ya tienes estas alabanzas en este dispositivo.");
    return;
  }

  const names = newSongs.slice(0, 8).map((s) => `• ${s.t}`).join("\n");
  const more = newSongs.length > 8 ? `\n… y ${newSongs.length - 8} más` : "";
  if (!confirm(`¿Agregar ${newSongs.length} alabanza${newSongs.length === 1 ? "" : "s"} a este dispositivo?\n\n${names}${more}`)) return;

  let next = nextCustomNumber();
  newSongs.forEach((s) => {
    customHymns.push({
      number: next,
      title: s.t.slice(0, 100),
      artist: String(s.a || "").slice(0, 100),
      originalKey: String(s.k || ChordPro.firstChord(s.c) || "C").slice(0, 4),
      preferFlats: Boolean(s.f),
      cho: s.c
    });
    next += 1;
  });
  if (!persistCustomHymns()) return;
  mergeCustomHymnsIntoCatalog();
  refreshCatalog();
  showToast(`${newSongs.length} alabanza${newSongs.length === 1 ? "" : "s"} agregada${newSongs.length === 1 ? "" : "s"}.`);
}

function updateViewerAddButton() {
  if (!currentHymn) return;

  const activeList = getActiveList();

  if (!activeList) {
    elements.viewerAddButton.textContent = "Crear listado";
    elements.viewerAddButton.disabled = false;
    elements.viewerAddButton.title = "Crear un listado antes de agregar la alabanza";
    return;
  }

  const exists = activeList.hymns.includes(currentHymn.number);
  elements.viewerAddButton.textContent = exists ? "Agregada" : "Agregar";
  elements.viewerAddButton.disabled = exists;
  elements.viewerAddButton.title =
    `${exists ? "Ya está en" : "Agregar a"} ${displayListName(activeList)}`;
}

async function shareActiveList() {
  const list = getActiveList();
  if (!list || list.hymns.length === 0) {
    showToast("Agrega al menos una alabanza antes de compartir.");
    return;
  }

  const shareUrl = buildSharedListUrl(list);
  const shareText = buildWhatsAppShareText(list);

  try {
    if (navigator.share) {
      await navigator.share({
        title: `Himnario IBSI — ${displayListName(list)}`,
        text: shareText,
        url: shareUrl
      });
      return;
    }

    await copyShareContent(`${shareText}\n\n${shareUrl}`);
    showToast("Listado copiado. Pégalo en WhatsApp.");
  } catch (error) {
    if (error?.name === "AbortError") return;

    try {
      await copyShareContent(`${shareText}\n\n${shareUrl}`);
      showToast("Listado copiado. Pégalo en WhatsApp.");
    } catch {
      showToast("No fue posible compartir el listado.");
    }
  }
}

function buildSharedListUrl(list) {
  const payload = {
    v: 1,
    n: displayListName(list).slice(0, 80),
    h: list.hymns,
    ...(list.date ? { d: list.date } : {}),
    ...(list.time ? { t: list.time } : {}),
    ...(Object.keys(list.keys || {}).length ? { k: list.keys } : {}),
    ...(Object.keys(list.notes || {}).length ? { o: list.notes } : {}),
    ...(list.note ? { m: list.note.slice(0, 300) } : {})
  };
  const encoded = encodeSharePayload(payload);
  return `${window.location.origin}${window.location.pathname}#list=${encoded}`;
}

function buildWhatsAppShareText(list) {
  const visibleHymns = list.hymns
    .map((number) => hymns.find((item) => item.number === number))
    .filter(Boolean);

  const maximumLines = 30;
  const lines = visibleHymns
    .slice(0, maximumLines)
    .map((hymn, index) => {
      const artist = hymn.artist ? ` — ${hymn.artist}` : "";
      const key = hymnKeyLabel(hymn, listShift(list, hymn.number));
      const note = list.notes?.[hymn.number] ? `\n    📝 ${list.notes[hymn.number]}` : "";
      return `${index + 1}. ${hymn.number}. ${hymn.title}${artist} (${key})${note}`;
    });

  if (visibleHymns.length > maximumLines) {
    lines.push(`… y ${visibleHymns.length - maximumLines} alabanzas más`);
  }

  return [
    "🎶 *Himnario IBSI*",
    `📋 *${displayListName(list)}*`,
    ...(formatListWhen(list) ? [`📅 ${formatListWhen(list)}`] : []),
    ...(list.note ? [`📝 ${list.note}`] : []),
    "",
    ...lines,
    "",
    "Abre el enlace para ver el listado y guardarlo en tu aplicación:"
  ].join("\n");
}

async function copyShareContent(content) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const successful = document.execCommand("copy");
  textarea.remove();

  if (!successful) throw new Error("No se pudo copiar.");
}

function encodeSharePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeSharePayload(encoded) {
  const normalized = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseSharedListFromHash() {
  const match = window.location.hash.match(/^#list=([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  try {
    const payload = decodeSharePayload(match[1]);
    if (!payload || payload.v !== 1 || !Array.isArray(payload.h)) {
      throw new Error("Formato de listado no válido.");
    }

    const allowedNumbers = new Set(hymns.map((hymn) => hymn.number));
    const hymnNumbers = [...new Set(
      payload.h
        .map(Number)
        .filter((number) => Number.isInteger(number) && allowedNumbers.has(number))
    )];

    if (hymnNumbers.length === 0) {
      throw new Error("El listado compartido no contiene alabanzas válidas.");
    }

    return {
      id: `shared-${Date.now()}`,
      name: String(payload.n || "Listado compartido").slice(0, 80),
      hymns: hymnNumbers,
      date: validIsoDate(payload.d),
      time: validTime(payload.t),
      keys: sanitizeListKeys(payload.k, hymnNumbers),
      notes: sanitizeListNotes(payload.o, hymnNumbers),
      note: typeof payload.m === "string" ? payload.m.slice(0, 300) : "",
      shared: true
    };
  } catch (error) {
    console.error(error);
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    showToast("El enlace del listado no es válido.");
    return null;
  }
}

function renderSharedListModal() {
  if (!sharedList) return;

  elements.sharedListTitle.textContent = displayListName(sharedList);
  elements.sharedListSummary.textContent =
    `${sharedList.hymns.length} alabanza${sharedList.hymns.length === 1 ? "" : "s"} en orden.`;
  elements.sharedListItems.innerHTML = "";
  elements.openSharedListButton.disabled = sharedList.hymns.length === 0;
  elements.saveSharedListButton.disabled = savedLists.length >= MAX_LISTS;
  elements.saveSharedListButton.textContent = savedLists.length >= MAX_LISTS
    ? `Límite de ${MAX_LISTS} listados`
    : "Guardar en mis listados";

  const fragment = document.createDocumentFragment();

  sharedList.hymns.forEach((number, index) => {
    const hymn = hymns.find((item) => item.number === number);
    if (!hymn) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "shared-list-item";
    button.innerHTML = `
      <span class="shared-position">${index + 1}</span>
      <span class="shared-list-copy">
        <strong>${hymn.number}. ${escapeHtml(hymn.title)}</strong>
        ${hymn.artist ? `<small>${escapeHtml(hymn.artist)}</small>` : ""}
        ${sharedList.notes?.[number] ? `<small class="setlist-note">${escapeHtml(sharedList.notes[number])}</small>` : ""}
      </span>
      <span class="key-pill small">${escapeHtml(hymnKeyLabel(hymn, listShift(sharedList, number)))}</span>
    `;
    button.addEventListener("click", () => {
      closeSharedListModal(false);
      reopenSharedModalAfterViewer = true;
      openViewer(hymn.number, { source: "shared", listId: sharedList.id });
    });
    fragment.appendChild(button);
  });

  elements.sharedListItems.appendChild(fragment);
}

function openSharedListModal() {
  if (!sharedList) return;
  renderSharedListModal();
  elements.sharedListModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeSharedListModal(clearLink) {
  elements.sharedListModal.classList.add("hidden");
  document.body.style.overflow = "";

  if (clearLink) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    sharedList = null;
    reopenSharedModalAfterViewer = false;
  }
}

function importSharedList() {
  if (!sharedList) return;

  if (savedLists.length >= MAX_LISTS) {
    showToast(`Ya tienes ${MAX_LISTS} listados. Elimina uno para guardar este.`);
    return;
  }

  const imported = createListObject(
    uniqueImportedListName(displayListName(sharedList)),
    sharedList.hymns
  );
  imported.date = sharedList.date || "";
  imported.time = sharedList.time || "";
  imported.autoName = false;
  imported.keys = { ...(sharedList.keys || {}) };
  imported.notes = { ...(sharedList.notes || {}) };
  imported.note = sharedList.note || "";

  savedLists.push(imported);
  persistLists();

  closeSharedListModal(true);
  switchView("setlist");
  openListDetail(imported.id);
  showToast("Listado compartido guardado.");
}

function uniqueImportedListName(baseName) {
  const cleanBase = baseName.trim() || "Listado compartido";
  if (!savedLists.some((list) => normalize(displayListName(list)) === normalize(cleanBase))) {
    return cleanBase;
  }

  const sharedName = `${cleanBase} (compartido)`;
  if (!savedLists.some((list) => normalize(displayListName(list)) === normalize(sharedName))) {
    return sharedName;
  }

  let number = 2;
  while (
    savedLists.some(
      (list) => normalize(displayListName(list)) === normalize(`${sharedName} ${number}`)
    )
  ) {
    number += 1;
  }

  return `${sharedName} ${number}`;
}

function switchView(view) {
  const views = { catalog: elements.catalogView, setlist: elements.setlistView, settings: elements.settingsView };
  if (!views[view]) view = "catalog";
  Object.entries(views).forEach(([name, element]) => element.classList.toggle("active", name === view));
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
}

// ---------- Filtros del catálogo ----------

function matchesCatalogFilter(hymn) {
  if (catalogFilter === "originales") return !hymn.custom && !hymn.shared;
  if (catalogFilter === "nuevas") return Boolean(hymn.shared);
  if (catalogFilter === "mias") return Boolean(hymn.custom);
  return true;
}

// ---------- Tema (Ajustes) ----------

function currentThemeChoice() {
  const saved = readSetting(STORAGE_KEYS.theme, "auto");
  return saved === "light" || saved === "dark" ? saved : "auto";
}

function setTheme(choice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.dataset.theme = choice;
  } else {
    choice = "auto";
    delete document.documentElement.dataset.theme;
  }
  writeSetting(STORAGE_KEYS.theme, choice);
  updateThemeSwitch();
}

function updateThemeSwitch() {
  const choice = currentThemeChoice();
  elements.themeSwitch.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === choice;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function createListObject(name, hymnNumbers) {
  const now = Date.now();
  return {
    id: `list-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || "Listado 1"),
    hymns: [...new Set(hymnNumbers.filter(Number.isInteger))],
    keys: {},
    notes: {},
    note: "",
    createdAt: now,
    updatedAt: now
  };
}

function loadSavedLists() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedLists);

    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const sanitized = parsed.slice(0, MAX_LISTS).map((list, index) => ({
        id: typeof list.id === "string" && list.id ? list.id : `list-restored-${index}`,
        name: typeof list.name === "string" ? list.name : `Listado ${index + 1}`,
        hymns: Array.isArray(list.hymns)
          ? [...new Set(list.hymns.filter(Number.isInteger))]
          : [],
        createdAt: Number(list.createdAt) || Date.now(),
        updatedAt: Number(list.updatedAt) || Date.now(),
        date: validIsoDate(list.date),
        time: validTime(list.time),
        autoName: Boolean(list.autoName),
        note: typeof list.note === "string" ? list.note.slice(0, 300) : ""
      })).map((list, index) => ({
        ...list,
        keys: sanitizeListKeys(parsed[index].keys, list.hymns),
        notes: sanitizeListNotes(parsed[index].notes, list.hymns)
      }));

      const shouldRemoveAutomaticEmptyList =
        !localStorage.getItem(STORAGE_KEYS.emptyDefaultCleaned) &&
        sanitized.length === 1 &&
        sanitized[0].hymns.length === 0 &&
        ["mi listado", "listado 1"].includes(normalize(sanitized[0].name));

      if (shouldRemoveAutomaticEmptyList) {
        localStorage.setItem(STORAGE_KEYS.emptyDefaultCleaned, "true");
        return [];
      }

      return sanitized;
    }
  } catch (error) {
    console.warn("No fue posible leer los listados guardados.", error);
  }

  let legacyHymns = [];
  try {
    const parsedLegacy = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.legacySetlist) || "[]"
    );
    legacyHymns = Array.isArray(parsedLegacy)
      ? parsedLegacy.filter(Number.isInteger)
      : [];
  } catch {
    legacyHymns = [];
  }

  const legacyName =
    localStorage.getItem(STORAGE_KEYS.legacySetlistName) || "Mi listado";

  if (legacyHymns.length === 0 && normalize(legacyName) === "mi listado") {
    return [];
  }

  return [createListObject(legacyName, legacyHymns)];
}

function loadActiveListId(lists) {
  const storedId = localStorage.getItem(STORAGE_KEYS.activeListId);
  return lists.some((list) => list.id === storedId)
    ? storedId
    : lists[0]?.id || null;
}

function persistLists() {
  localStorage.setItem(STORAGE_KEYS.savedLists, JSON.stringify(savedLists));

  if (activeListId) {
    localStorage.setItem(STORAGE_KEYS.activeListId, activeListId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activeListId);
  }
}

function loadTransposeMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.transposeMap) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveTransposeMap() {
  localStorage.setItem(STORAGE_KEYS.transposeMap, JSON.stringify(transposeMap));
}

function nextListName() {
  for (let number = 1; number <= MAX_LISTS; number += 1) {
    const candidate = `Listado ${number}`;
    if (!savedLists.some((list) => displayListName(list) === candidate)) {
      return candidate;
    }
  }
  return `Listado ${savedLists.length + 1}`;
}

// ---------- Fecha y hora de los listados ----------

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function validTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function listDateObject(list) {
  if (!list?.date) return null;
  const [year, month, day] = list.date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTime12(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "a. m." : "p. m.";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// "Alabanzas Domingo" (el día sale de la fecha elegida).
function autoListName(list) {
  const date = listDateObject(list);
  return date ? `Alabanzas ${WEEKDAYS[date.getDay()]}` : "Alabanzas";
}

// "Dom 23 nov 2026 · 10:00 a. m." — se muestra en pequeño debajo del nombre.
function formatListWhen(list) {
  const date = listDateObject(list);
  const parts = [];
  if (date) {
    const sameYear = date.getFullYear() === new Date().getFullYear();
    parts.push(`${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${sameYear ? "" : ` ${date.getFullYear()}`}`);
  }
  if (list?.time) parts.push(formatTime12(list.time));
  return parts.join(" · ");
}

function isPastList(list) {
  return Boolean(list.date) && list.date < todayIso();
}

// Primero los próximos servicios (por fecha y hora), luego los que no tienen fecha y al final los pasados.
function sortedListsForDisplay() {
  const rank = (list) => (!list.date ? 1 : isPastList(list) ? 2 : 0);
  return [...savedLists].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    const keyA = `${a.date || ""} ${a.time || "99:99"}`;
    const keyB = `${b.date || ""} ${b.time || "99:99"}`;
    return rank(a) === 2 ? keyB.localeCompare(keyA) : keyA.localeCompare(keyB);
  });
}

function updateActiveListWhen() {
  const activeList = getActiveList();
  if (!activeList) return;
  activeList.date = validIsoDate(elements.setlistDate.value);
  activeList.time = validTime(elements.setlistTime.value);
  if (activeList.autoName) {
    activeList.name = autoListName(activeList);
    elements.setlistName.value = activeList.name;
  }
  activeList.updatedAt = Date.now();
  persistLists();
  elements.activeListTitle.textContent = displayListName(activeList);
  elements.saveStatus.textContent = "Cambios guardados automáticamente.";
  renderSavedListsGrid();
  updateViewerAddButton();
}

// ---------- Buscar y agregar alabanzas desde el listado ----------

function renderListSearch() {
  const list = getActiveList();
  const query = normalize(elements.listSearchInput.value.trim());
  const box = elements.listSearchResults;
  if (!list || !query) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const matches = hymns.filter((hymn) =>
    String(hymn.number).startsWith(query) ||
    normalize(hymn.title).includes(query) ||
    normalize(hymn.artist || "").includes(query)
  ).slice(0, 8);

  box.classList.remove("hidden");
  if (!matches.length) {
    box.innerHTML = '<p class="list-search-empty">No se encontraron alabanzas.</p>';
    return;
  }
  box.innerHTML = "";
  matches.forEach((hymn) => {
    const added = list.hymns.includes(hymn.number);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `list-search-row${added ? " added" : ""}`;
    row.disabled = added;
    row.innerHTML = `
      <span class="hymn-number">${hymn.custom ? "P" : hymn.number}</span>
      <span class="list-search-copy">
        <strong>${escapeHtml(hymn.title)}</strong>
        ${hymn.artist ? `<small>${escapeHtml(hymn.artist)}</small>` : ""}
      </span>
      <span class="list-search-add">${added ? "✓ En el listado" : "+ Agregar"}</span>
    `;
    row.addEventListener("click", () => {
      addToActiveList(hymn.number);
    });
    box.appendChild(row);
  });
}

function displayListName(list) {
  return list?.name?.trim() || "Listado sin nombre";
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

function updateConnectionState() {
  const online = navigator.onLine;
  elements.connectionState.textContent = online ? "En línea" : "Sin conexión";
  elements.connectionState.classList.toggle("offline", !online);
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showToast("Abre el menú del navegador y elige “Agregar a pantalla de inicio”.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installButton.classList.add("hidden");
}

function showIosInstallHintWhenNeeded() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (isIos && !isStandalone) {
    elements.installButton.classList.remove("hidden");
    elements.installButton.addEventListener(
      "click",
      () => showToast("En Safari: Compartir → Agregar a pantalla de inicio."),
      { once: true }
    );
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("sw.js");

    if (registration.waiting) {
      showUpdateAvailable(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          showUpdateAvailable(newWorker);
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (error) {
    console.error("No se pudo registrar el modo sin conexión:", error);
  }
}

function showUpdateAvailable(worker) {
  waitingServiceWorker = worker;
  elements.updateBanner.classList.remove("hidden");
}
