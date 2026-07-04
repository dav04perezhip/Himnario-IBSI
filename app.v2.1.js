const MAX_LISTS = 5;

const STORAGE_KEYS = {
  legacySetlist: "ibsi-setlist-v1",
  legacySetlistName: "ibsi-setlist-name-v1",
  savedLists: "ibsi-saved-lists-v2",
  activeListId: "ibsi-active-list-id-v2",
  transposeMap: "ibsi-transpose-v1"
};

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11
};

let hymns = [];
let hymnLayouts = {};
let savedLists = loadSavedLists();
let activeListId = loadActiveListId(savedLists);
let transposeMap = loadTransposeMap();
let currentHymn = null;
let viewerContext = { source: "catalog", listId: null };
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
  savedListsGrid: document.querySelector("#savedListsGrid"),
  activeListEditor: document.querySelector("#activeListEditor"),
  activeListTitle: document.querySelector("#activeListTitle"),
  listLimitText: document.querySelector("#listLimitText"),
  createListButton: document.querySelector("#createListButton"),
  deleteListButton: document.querySelector("#deleteListButton"),
  setlistItems: document.querySelector("#setlistItems"),
  emptySetlist: document.querySelector("#emptySetlist"),
  setlistCount: document.querySelector("#setlistCount"),
  setlistName: document.querySelector("#setlistName"),
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
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#installButton"),
  connectionState: document.querySelector("#connectionState"),
  catalogCount: document.querySelector("#catalogCount"),
  updateBanner: document.querySelector("#updateBanner"),
  updateButton: document.querySelector("#updateButton")
};

init();

async function init() {
  persistLists();
  wireEvents();
  updateConnectionState();

  try {
    const [hymnResponse, layoutResponse] = await Promise.all([
      fetch("hymns.v2.1.json"),
      fetch("hymn_layouts.v2.1.json")
    ]);

    if (!hymnResponse.ok || !layoutResponse.ok) {
      throw new Error("No se pudo leer el catálogo.");
    }

    hymns = await hymnResponse.json();
    hymnLayouts = await layoutResponse.json();
    renderCatalog(hymns);
    renderListManager();

    const requestedHymn = Number(new URLSearchParams(window.location.search).get("hymn"));
    if (Number.isInteger(requestedHymn) && hymns.some((item) => item.number === requestedHymn)) {
      openViewer(requestedHymn);
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
      return String(hymn.number).includes(query) || normalize(hymn.title).includes(query);
    });
    renderCatalog(filtered);
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.createListButton.addEventListener("click", createNewList);
  elements.deleteListButton.addEventListener("click", deleteActiveList);

  elements.setlistName.addEventListener("input", () => {
    const activeList = getActiveList();
    if (!activeList) return;

    activeList.name = elements.setlistName.value;
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
      activeList.name = "Listado sin nombre";
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
    if (currentHymn) addToActiveList(currentHymn.number);
  });

  elements.transposeDown.addEventListener("click", () => changeTranspose(-1));
  elements.transposeUp.addEventListener("click", () => changeTranspose(1));
  elements.transposeReset.addEventListener("click", () => setTranspose(0));

  elements.previousHymnButton.addEventListener("click", () => navigateSetlist(-1));
  elements.nextHymnButton.addEventListener("click", () => navigateSetlist(1));

  elements.pageViewport.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    swipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  elements.pageViewport.addEventListener("touchend", (event) => {
    if (!swipeStart || viewerContext.source !== "setlist") return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.4) return;
    navigateSetlist(deltaX < 0 ? 1 : -1);
  }, { passive: true });

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
    if (elements.viewer.classList.contains("hidden")) return;

    if (event.key === "Escape") closeViewer();
    if (viewerContext.source === "setlist" && event.key === "ArrowLeft") navigateSetlist(-1);
    if (viewerContext.source === "setlist" && event.key === "ArrowRight") navigateSetlist(1);
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
    card.addEventListener("dblclick", () => addToActiveList(hymn.number));
    fragment.appendChild(card);
  }

  elements.hymnGrid.appendChild(fragment);
}

function renderListManager() {
  renderSavedListsGrid();
  renderActiveList();
  elements.setlistCount.textContent = String(savedLists.length);
  elements.listLimitText.textContent = `${savedLists.length} de ${MAX_LISTS} listados guardados.`;
  elements.createListButton.disabled = savedLists.length >= MAX_LISTS;
  elements.createListButton.textContent = savedLists.length >= MAX_LISTS
    ? "Límite alcanzado"
    : "Nuevo listado";
}

function renderSavedListsGrid() {
  elements.savedListsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  savedLists.forEach((list) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `saved-list-card${list.id === activeListId ? " active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(displayListName(list))}</strong>
        <span>${list.hymns.length} alabanza${list.hymns.length === 1 ? "" : "s"}</span>
      </span>
      <span class="edit-indicator">${list.id === activeListId ? "Abierto" : "Editar"}</span>
    `;
    button.addEventListener("click", () => selectList(list.id));
    fragment.appendChild(button);
  });

  elements.savedListsGrid.appendChild(fragment);
}

function renderActiveList() {
  const activeList = getActiveList();

  if (!activeList) {
    elements.activeListEditor.classList.add("hidden");
    return;
  }

  elements.activeListEditor.classList.remove("hidden");
  elements.activeListTitle.textContent = displayListName(activeList);
  elements.setlistName.value = activeList.name;
  elements.saveStatus.textContent = "Guardado automáticamente en este dispositivo.";
  elements.setlistItems.innerHTML = "";
  elements.emptySetlist.classList.toggle("hidden", activeList.hymns.length > 0);
  elements.clearSetlistButton.classList.toggle("hidden", activeList.hymns.length === 0);
  elements.deleteListButton.disabled = savedLists.length <= 1;

  const fragment = document.createDocumentFragment();

  activeList.hymns.forEach((number, index) => {
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
        <button type="button" data-action="down" aria-label="Bajar" ${index === activeList.hymns.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" data-action="remove" class="remove" aria-label="Quitar">Quitar</button>
      </div>
    `;

    row.querySelector('[data-action="open"]').addEventListener("click", () => {
      openViewer(number, { source: "setlist", listId: activeList.id });
    });
    row.querySelector('[data-action="up"]').addEventListener("click", () => moveActiveListItem(index, -1));
    row.querySelector('[data-action="down"]').addEventListener("click", () => moveActiveListItem(index, 1));
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeFromActiveList(number));
    fragment.appendChild(row);
  });

  elements.setlistItems.appendChild(fragment);
}

function createNewList() {
  if (savedLists.length >= MAX_LISTS) {
    showToast(`Solo puedes guardar ${MAX_LISTS} listados.`);
    return;
  }

  const newList = createListObject(nextListName(), []);
  savedLists.push(newList);
  activeListId = newList.id;
  persistLists();
  renderListManager();
  switchView("setlist");

  elements.setlistName.focus();
  elements.setlistName.select();
  showToast("Nuevo listado creado.");
}

function deleteActiveList() {
  const activeList = getActiveList();
  if (!activeList) return;

  if (savedLists.length <= 1) {
    showToast("Debe quedar al menos un listado. Puedes vaciarlo o cambiarle el nombre.");
    return;
  }

  if (!confirm(`¿Deseas eliminar el listado “${displayListName(activeList)}”?`)) return;

  const currentIndex = savedLists.findIndex((list) => list.id === activeList.id);
  savedLists = savedLists.filter((list) => list.id !== activeList.id);
  const nextIndex = Math.min(currentIndex, savedLists.length - 1);
  activeListId = savedLists[nextIndex].id;
  persistLists();
  renderListManager();
  showToast("Listado eliminado.");
}

function selectList(listId) {
  if (!savedLists.some((list) => list.id === listId)) return;
  activeListId = listId;
  persistLists();
  renderListManager();
}

function getActiveList() {
  return savedLists.find((list) => list.id === activeListId) || savedLists[0] || null;
}

function addToActiveList(number) {
  const activeList = getActiveList();
  if (!activeList) return;

  if (activeList.hymns.includes(number)) {
    showToast(`Esta alabanza ya está en “${displayListName(activeList)}”.`);
    return;
  }

  activeList.hymns.push(number);
  activeList.updatedAt = Date.now();
  persistLists();
  renderListManager();
  updateViewerAddButton();
  showToast(`Agregada a “${displayListName(activeList)}”.`);
}

function removeFromActiveList(number) {
  const activeList = getActiveList();
  if (!activeList) return;

  activeList.hymns = activeList.hymns.filter((item) => item !== number);
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

  const sourceList = context.source === "setlist"
    ? savedLists.find((list) => list.id === context.listId && list.hymns.includes(number))
    : null;

  viewerContext = sourceList
    ? { source: "setlist", listId: sourceList.id }
    : { source: "catalog", listId: null };

  currentHymn = hymn;
  elements.viewerTitle.textContent = hymn.title;
  elements.viewerSubtitle.textContent = viewerContext.source === "setlist"
    ? `${displayListName(sourceList)} · Alabanza ${hymn.number}`
    : `Himnario IBSI · Alabanza ${hymn.number}`;

  elements.viewer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  updateTransposeDisplay();
  renderTransposedSheet();
  updateViewerAddButton();
  updateSetlistNavigation();
  elements.pageViewport.scrollTo({ top: 0, left: 0 });
}

function closeViewer() {
  elements.viewer.classList.add("hidden");
  elements.transposedSheet.replaceChildren();
  document.body.style.overflow = "";
  currentHymn = null;
  viewerContext = { source: "catalog", listId: null };
  swipeStart = null;
}

function updateSetlistNavigation() {
  if (!currentHymn || viewerContext.source !== "setlist") {
    elements.setlistNavigation.classList.add("hidden");
    return;
  }

  const list = savedLists.find((item) => item.id === viewerContext.listId);
  if (!list) {
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
  if (!currentHymn || viewerContext.source !== "setlist") return;

  const list = savedLists.find((item) => item.id === viewerContext.listId);
  if (!list) return;

  const currentIndex = list.hymns.indexOf(currentHymn.number);
  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= list.hymns.length) return;

  openViewer(list.hymns[targetIndex], {
    source: "setlist",
    listId: list.id
  });
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
  renderActiveList();
}

function getTranspose(number) {
  const value = Number(transposeMap[String(number)] || 0);
  return Number.isFinite(value) ? value : 0;
}

function updateTransposeDisplay() {
  if (!currentHymn) return;

  const shift = getTranspose(currentHymn.number);
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
  svg.setAttribute(
    "aria-label",
    `Letra y acordes de ${currentHymn.title} en tono ${transposeKey(
      currentHymn.originalKey,
      shift,
      currentHymn.preferFlats
    )}`
  );
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
    textElement.setAttribute(
      "font-family",
      item.fontFamily === "Arial"
        ? "Arial, Helvetica, sans-serif"
        : "'Times New Roman', Times, serif"
    );
    textElement.setAttribute("font-weight", String(item.fontWeight));
    textElement.setAttribute("font-style", item.fontStyle || "normal");
    textElement.setAttribute("fill", isChordElement ? "#075e6a" : "#111111");
    textElement.setAttribute("text-rendering", "geometricPrecision");
    textElement.textContent = text;
    svg.appendChild(textElement);
  }

  elements.transposedSheet.replaceChildren(svg);
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

function updateViewerAddButton() {
  if (!currentHymn) return;

  const activeList = getActiveList();
  const exists = Boolean(activeList && activeList.hymns.includes(currentHymn.number));
  elements.viewerAddButton.textContent = exists ? "Agregada" : "Agregar";
  elements.viewerAddButton.disabled = exists;
  elements.viewerAddButton.title = activeList
    ? `${exists ? "Ya está en" : "Agregar a"} ${displayListName(activeList)}`
    : "";
}

function switchView(view) {
  const showCatalog = view === "catalog";
  elements.catalogView.classList.toggle("active", showCatalog);
  elements.setlistView.classList.toggle("active", !showCatalog);
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
}

function createListObject(name, hymnNumbers) {
  const now = Date.now();
  return {
    id: `list-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || "Mi listado"),
    hymns: [...new Set(hymnNumbers.filter(Number.isInteger))],
    createdAt: now,
    updatedAt: now
  };
}

function loadSavedLists() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.savedLists) || "null");

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, MAX_LISTS).map((list, index) => ({
        id: typeof list.id === "string" && list.id ? list.id : `list-restored-${index}`,
        name: typeof list.name === "string" ? list.name : `Listado ${index + 1}`,
        hymns: Array.isArray(list.hymns)
          ? [...new Set(list.hymns.filter(Number.isInteger))]
          : [],
        createdAt: Number(list.createdAt) || Date.now(),
        updatedAt: Number(list.updatedAt) || Date.now()
      }));
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
  }, 2400);
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
