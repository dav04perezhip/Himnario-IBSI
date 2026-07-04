const STORAGE_KEYS = {
  setlist: "ibsi-setlist-v1",
  setlistName: "ibsi-setlist-name-v1",
  transposeMap: "ibsi-transpose-v1"
};

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11
};

const SINGLE_CHORD = String.raw`[A-G](?:#|b)?(?:(?:m|M|maj|min|dim|aug|sus|add)(?:\+?\d+)?)?(?:\+?\d+)?(?:\([^\s-]+\))?(?:\/[A-G](?:#|b)?)?`;
const CHORD_SEQUENCE_RE = new RegExp(`^${SINGLE_CHORD}(?:[-–—]${SINGLE_CHORD})*$`);
const SEPARATOR_RE = /^[-–—]+$/;

let hymns = [];
let hymnLayouts = {};
let setlist = loadSetlist();
let transposeMap = loadTransposeMap();
let currentHymn = null;
let zoom = 1;
let deferredInstallPrompt = null;
let waitingServiceWorker = null;

const elements = {
  hymnGrid: document.querySelector("#hymnGrid"),
  searchInput: document.querySelector("#searchInput"),
  emptySearch: document.querySelector("#emptySearch"),
  tabs: [...document.querySelectorAll(".tab")],
  catalogView: document.querySelector("#catalogView"),
  setlistView: document.querySelector("#setlistView"),
  setlistItems: document.querySelector("#setlistItems"),
  emptySetlist: document.querySelector("#emptySetlist"),
  setlistCount: document.querySelector("#setlistCount"),
  setlistName: document.querySelector("#setlistName"),
  clearSetlistButton: document.querySelector("#clearSetlistButton"),
  viewer: document.querySelector("#viewer"),
  viewerTitle: document.querySelector("#viewerTitle"),
  viewerSubtitle: document.querySelector("#viewerSubtitle"),
  transposedSheet: document.querySelector("#transposedSheet"),
  closeViewer: document.querySelector("#closeViewer"),
  viewerAddButton: document.querySelector("#viewerAddButton"),
  pageViewport: document.querySelector("#pageViewport"),
  transposeToolbar: document.querySelector("#transposeToolbar"),
  transposeDown: document.querySelector("#transposeDown"),
  transposeUp: document.querySelector("#transposeUp"),
  transposeReset: document.querySelector("#transposeReset"),
  currentKey: document.querySelector("#currentKey"),
  transposeAmount: document.querySelector("#transposeAmount"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomReset: document.querySelector("#zoomReset"),
  zoomLabel: document.querySelector("#zoomLabel"),
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#installButton"),
  connectionState: document.querySelector("#connectionState"),
  catalogCount: document.querySelector("#catalogCount"),
  updateBanner: document.querySelector("#updateBanner"),
  updateButton: document.querySelector("#updateButton")
};

init();

async function init() {
  elements.setlistName.value = localStorage.getItem(STORAGE_KEYS.setlistName) || "";
  wireEvents();
  updateConnectionState();

  try {
    const [hymnResponse, layoutResponse] = await Promise.all([
      fetch("hymns.v2.0.json"),
      fetch("hymn_layouts.v2.0.json")
    ]);

    if (!hymnResponse.ok || !layoutResponse.ok) {
      throw new Error("No se pudo leer el catálogo.");
    }

    hymns = await hymnResponse.json();
    hymnLayouts = await layoutResponse.json();
    renderCatalog(hymns);
    renderSetlist();

    const requestedHymn = Number(new URLSearchParams(window.location.search).get("hymn"));
    if (Number.isInteger(requestedHymn) && hymns.some((item) => item.number === requestedHymn)) {
      openViewer(requestedHymn);
    }
  } catch (error) {
    console.error(error);
    showToast("No se pudieron cargar las alabanzas. Recarga la página con Ctrl + F5.");
  }

  registerServiceWorker();
  showIosInstallHintWhenNeeded();
}

function wireEvents() {
  elements.searchInput.addEventListener("input", () => {
    const query = normalize(elements.searchInput.value.trim());
    const filtered = hymns.filter((hymn) => {
      return String(hymn.number).includes(query) || normalize(hymn.title).includes(query);
    });
    renderCatalog(filtered);
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.setlistName.addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEYS.setlistName, elements.setlistName.value);
  });

  elements.clearSetlistButton.addEventListener("click", () => {
    if (!confirm("¿Deseas vaciar todo el listado?")) return;
    setlist = [];
    saveSetlist();
    renderSetlist();
    showToast("Listado vaciado.");
  });

  elements.closeViewer.addEventListener("click", closeViewer);
  elements.viewer.addEventListener("click", (event) => {
    if (event.target === elements.viewer) closeViewer();
  });

  elements.viewerAddButton.addEventListener("click", () => {
    if (currentHymn) addToSetlist(currentHymn.number);
  });

  elements.transposeDown.addEventListener("click", () => changeTranspose(-1));
  elements.transposeUp.addEventListener("click", () => changeTranspose(1));
  elements.transposeReset.addEventListener("click", () => setTranspose(0));

  elements.zoomIn.addEventListener("click", () => setZoom(zoom + 0.25));
  elements.zoomOut.addEventListener("click", () => setZoom(zoom - 0.25));
  elements.zoomReset.addEventListener("click", () => setZoom(1));

  window.addEventListener("online", updateConnectionState);
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
    if (event.key === "Escape" && !elements.viewer.classList.contains("hidden")) {
      closeViewer();
    }
  });
}

function renderCatalog(items) {
  elements.hymnGrid.innerHTML = "";
  elements.emptySearch.classList.toggle("hidden", items.length > 0);
  elements.catalogCount.textContent = items.length === hymns.length
    ? `${hymns.length} alabanzas disponibles. Busca por número o nombre.`
    : `${items.length} resultado${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}.`;

  const fragment = document.createDocumentFragment();
  for (const hymn of items) {
    const card = document.createElement("article");
    card.className = "hymn-card";
    card.innerHTML = `
      <span class="hymn-number">${hymn.number}</span>
      <h3>${escapeHtml(hymn.title)}</h3>
      <button class="card-open" type="button" aria-label="Abrir ${escapeHtml(hymn.title)}">›</button>
    `;
    card.querySelector(".card-open").addEventListener("click", () => openViewer(hymn.number));
    card.addEventListener("dblclick", () => addToSetlist(hymn.number));
    fragment.appendChild(card);
  }
  elements.hymnGrid.appendChild(fragment);
}

function openViewer(number) {
  const hymn = hymns.find((item) => item.number === number);
  if (!hymn) return;

  currentHymn = hymn;
  elements.viewerTitle.textContent = hymn.title;
  elements.viewerSubtitle.textContent = `Himnario IBSI · Alabanza ${hymn.number} · Cambia el tono con − y +`;
  elements.viewer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  updateTransposeDisplay();
  renderTransposedSheet();
  setZoom(1);
  updateViewerAddButton();
}

function closeViewer() {
  elements.viewer.classList.add("hidden");
  elements.transposedSheet.replaceChildren();
  document.body.style.overflow = "";
  currentHymn = null;
}

function changeTranspose(delta) {
  if (!currentHymn) return;
  const current = getTranspose(currentHymn.number);
  setTranspose(Math.min(11, Math.max(-11, current + delta)));
}

function setTranspose(value) {
  if (!currentHymn) return;
  transposeMap[String(currentHymn.number)] = value;
  saveTransposeMap();
  updateTransposeDisplay();
  renderTransposedSheet();
  renderSetlist();
}

function getTranspose(number) {
  const value = Number(transposeMap[String(number)] || 0);
  return Number.isFinite(value) ? value : 0;
}

function updateTransposeDisplay() {
  if (!currentHymn) return;
  const shift = getTranspose(currentHymn.number);
  elements.currentKey.textContent = transposeKey(currentHymn.originalKey, shift, currentHymn.preferFlats);
  elements.transposeAmount.textContent = formatTransposeAmount(shift);
  elements.transposeDown.disabled = shift <= -11;
  elements.transposeUp.disabled = shift >= 11;
  elements.transposeReset.disabled = shift === 0;
}

function formatTransposeAmount(shift) {
  if (shift === 0) return "Tono original";
  const sign = shift > 0 ? "+" : "";
  const unit = Math.abs(shift) === 1 ? "semitono" : "semitonos";
  return `${sign}${shift} ${unit}`;
}

function transposeKey(key, shift, preferFlats) {
  const match = /^([A-G])([#b]?)(.*)$/.exec(key);
  if (!match) return key;
  const [, root, accidental, suffix] = match;
  return `${transposeNote(root, accidental, shift, preferFlats)}${suffix}`;
}

function renderTransposedSheet() {
  if (!currentHymn) return;

  const layout = hymnLayouts[String(currentHymn.number)];
  if (!layout || !Array.isArray(layout.items)) {
    elements.transposedSheet.textContent = "No se encontró el formato de esta alabanza.";
    return;
  }

  const shift = getTranspose(currentHymn.number);
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("hymn-layout-svg");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Letra y acordes de ${currentHymn.title} en tono ${transposeKey(currentHymn.originalKey, shift, currentHymn.preferFlats)}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  const background = document.createElementNS(svgNamespace, "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(layout.width));
  background.setAttribute("height", String(layout.height));
  background.setAttribute("fill", "#ffffff");
  svg.appendChild(background);

  for (const item of layout.items) {
    const textElement = document.createElementNS(svgNamespace, "text");
    const isChordElement = item.isChord || item.isSeparator;
    const text = item.isChord
      ? transposeChordToken(item.text, shift, currentHymn.preferFlats)
      : item.text;

    textElement.setAttribute("x", String(item.x));
    textElement.setAttribute("y", String(item.y));
    textElement.setAttribute("font-size", String(item.fontSize));
    textElement.setAttribute("font-family", item.fontFamily === "Arial"
      ? "Arial, Helvetica, sans-serif"
      : "'Times New Roman', Times, serif");
    textElement.setAttribute("font-weight", String(item.fontWeight));
    textElement.setAttribute("font-style", item.fontStyle || "normal");
    textElement.setAttribute("fill", isChordElement ? "#075e6a" : "#111111");
    textElement.setAttribute("text-rendering", "geometricPrecision");
    textElement.textContent = text;
    svg.appendChild(textElement);
  }

  elements.transposedSheet.replaceChildren(svg);
  setZoom(zoom);
}

function transposeChordToken(token, shift, preferFlats) {
  if (shift === 0) return token;

  const plain = token
    .replace(/^[([{¡¿]+/, "")
    .replace(/[)\]},.;:!?]+$/, "");

  // The source occasionally writes a repeated chord without a space, e.g. EE or BB.
  if (/^[A-G]{2,}$/.test(plain)) {
    let index = 0;
    return token.replace(/[A-G]/g, (root) => {
      index += 1;
      return transposeNote(root, "", shift, preferFlats);
    });
  }

  // Transpose the main root and roots after separators, slash basses or parentheses.
  return token.replace(/(^|[-–—/(])([A-G])([#b]?)/g, (match, separator, root, accidental) => {
    return `${separator}${transposeNote(root, accidental, shift, preferFlats)}`;
  });
}

function transposeNote(root, accidental, shift, preferFlats) {
  const source = `${root}${accidental}`;
  const index = NOTE_INDEX[source];
  if (index === undefined) return source;
  const nextIndex = (index + shift + 120) % 12;
  const useFlats = accidental === "b" || (accidental !== "#" && preferFlats);
  return (useFlats ? FLAT_NOTES : SHARP_NOTES)[nextIndex];
}

function stripTokenPunctuation(token) {
  return token
    .replace(/^[([{¡¿]+/, "")
    .replace(/[)\]},.;:!?]+$/, "");
}

function setZoom(nextZoom) {
  zoom = Math.min(2.5, Math.max(0.75, nextZoom));
  elements.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

  const layout = hymnLayouts[String(currentHymn?.number)];
  const baseWidth = layout?.width || 612;
  elements.transposedSheet.style.width = `${Math.round(baseWidth * zoom)}px`;

  elements.pageViewport.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function addToSetlist(number) {
  if (setlist.includes(number)) {
    showToast("Esta alabanza ya está en tu listado.");
    return;
  }
  setlist.push(number);
  saveSetlist();
  renderSetlist();
  updateViewerAddButton();
  showToast("Alabanza agregada al listado.");
}

function removeFromSetlist(number) {
  setlist = setlist.filter((item) => item !== number);
  saveSetlist();
  renderSetlist();
  updateViewerAddButton();
}

function moveSetlistItem(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= setlist.length) return;
  [setlist[index], setlist[targetIndex]] = [setlist[targetIndex], setlist[index]];
  saveSetlist();
  renderSetlist();
}

function renderSetlist() {
  elements.setlistItems.innerHTML = "";
  elements.setlistCount.textContent = String(setlist.length);
  elements.emptySetlist.classList.toggle("hidden", setlist.length > 0);
  elements.clearSetlistButton.classList.toggle("hidden", setlist.length === 0);

  setlist.forEach((number, index) => {
    const hymn = hymns.find((item) => item.number === number);
    if (!hymn) return;

    const selectedKey = transposeKey(hymn.originalKey, getTranspose(number), hymn.preferFlats);
    const row = document.createElement("article");
    row.className = "setlist-row";
    row.innerHTML = `
      <span class="position">${index + 1}</span>
      <div class="setlist-title-block">
        <h3>${hymn.number}. ${escapeHtml(hymn.title)}</h3>
        <p class="setlist-key">Tono: ${escapeHtml(selectedKey)}</p>
      </div>
      <div class="row-actions">
        <button type="button" data-action="open" aria-label="Abrir">Ver</button>
        <button type="button" data-action="up" aria-label="Subir" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-action="down" aria-label="Bajar" ${index === setlist.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" data-action="remove" class="remove" aria-label="Quitar">Quitar</button>
      </div>
    `;

    row.querySelector('[data-action="open"]').addEventListener("click", () => openViewer(number));
    row.querySelector('[data-action="up"]').addEventListener("click", () => moveSetlistItem(index, -1));
    row.querySelector('[data-action="down"]').addEventListener("click", () => moveSetlistItem(index, 1));
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeFromSetlist(number));
    elements.setlistItems.appendChild(row);
  });
}

function updateViewerAddButton() {
  if (!currentHymn) return;
  const exists = setlist.includes(currentHymn.number);
  elements.viewerAddButton.textContent = exists ? "Agregada" : "Agregar";
  elements.viewerAddButton.disabled = exists;
}

function switchView(view) {
  const showCatalog = view === "catalog";
  elements.catalogView.classList.toggle("active", showCatalog);
  elements.setlistView.classList.toggle("active", !showCatalog);
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
}

function loadSetlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.setlist) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function saveSetlist() {
  localStorage.setItem(STORAGE_KEYS.setlist, JSON.stringify(setlist));
}

function loadTransposeMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.transposeMap) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveTransposeMap() {
  localStorage.setItem(STORAGE_KEYS.transposeMap, JSON.stringify(transposeMap));
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
  showToast.timeoutId = setTimeout(() => elements.toast.classList.add("hidden"), 2200);
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
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (isIos && !isStandalone) {
    elements.installButton.classList.remove("hidden");
    elements.installButton.addEventListener("click", () => {
      showToast("En Safari: Compartir → Agregar a pantalla de inicio.");
    }, { once: true });
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
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
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
