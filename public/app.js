const STORAGE_KEY = "mini-notes-items";

const elements = {
  charCount: document.getElementById("char-count"),
  emptyState: document.getElementById("empty-state"),
  noteCount: document.getElementById("note-count"),
  noteInput: document.getElementById("note-input"),
  notesList: document.getElementById("notes-list"),
  runtimeStatus: document.getElementById("runtime-status"),
  saveNote: document.getElementById("save-note"),
  summarizeNotes: document.getElementById("summarize-notes"),
  summaryOutput: document.getElementById("summary-output"),
};

let notes = loadNotes();
let annaHost = null;

function loadNotes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotes() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function updateCharCount() {
  const value = elements.noteInput.value.trim();
  elements.charCount.textContent = `${value.length} / 160`;
}

function renderNotes() {
  elements.noteCount.textContent = String(notes.length);
  elements.emptyState.hidden = notes.length > 0;
  elements.notesList.innerHTML = notes
    .map(
      (note) => `
        <li>
          <div>
            <strong>${escapeHtml(note.content)}</strong>
            <span class="note-meta">${formatTimestamp(note.createdAt)}</span>
          </div>
          <button class="delete-button" data-id="${note.id}" type="button">Delete</button>
        </li>
      `
    )
    .join("");
}

function setSummary(text, isEmpty = false) {
  elements.summaryOutput.textContent = text;
  elements.summaryOutput.classList.toggle("empty", isEmpty);
}

function setRuntimeStatus(text) {
  elements.runtimeStatus.textContent = text;
}

function createNote() {
  const content = elements.noteInput.value.trim();
  if (!content) {
    return;
  }

  notes.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    content,
    createdAt: new Date().toISOString(),
  });

  persistNotes();
  renderNotes();
  elements.noteInput.value = "";
  updateCharCount();
}

function deleteNote(noteId) {
  notes = notes.filter((note) => note.id !== noteId);
  persistNotes();
  renderNotes();
}

async function invokeAnnaTool(payload) {
  if (annaHost?.tools?.call) {
    return annaHost.tools.call("mini-notes-summarizer", {
      name: payload.action,
      arguments: payload.payload,
    });
  }

  if (annaHost?.tools?.invoke) {
    return annaHost.tools.invoke("mini-notes-summarizer", payload);
  }

  if (window.anna?.tools?.invoke) {
    return window.anna.tools.invoke("mini-notes-summarizer", payload);
  }

  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    throw new Error("Local summarize request failed");
  }

  return response.json();
}

async function summarizeNotes() {
  elements.summarizeNotes.disabled = true;

  if (notes.length === 0) {
    setSummary("当前没有可总结的笔记。", true);
    elements.summarizeNotes.disabled = false;
    return;
  }

  try {
    const result = await invokeAnnaTool({
      action: "summarize",
      payload: { notes },
    });
    setSummary(result.summary || "未返回总结内容。");
  } catch (error) {
    setSummary(`总结失败：${error.message}`, true);
  } finally {
    elements.summarizeNotes.disabled = false;
  }
}

async function connectAnnaRuntime() {
  if (!window.AnnaAppRuntime?.connect) {
    setRuntimeStatus("Runtime: standalone local mode");
    return;
  }

  try {
    annaHost = await window.AnnaAppRuntime.connect();
    setRuntimeStatus("Runtime: connected via AnnaAppRuntime.connect()");
  } catch (error) {
    annaHost = null;
    setRuntimeStatus(`Runtime: connect failed, fallback enabled`);
    console.error("Anna runtime connect failed", error);
  }
}

elements.noteInput.addEventListener("input", updateCharCount);
elements.saveNote.addEventListener("click", createNote);
elements.summarizeNotes.addEventListener("click", summarizeNotes);

elements.notesList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const noteId = target.dataset.id;
  if (noteId) {
    deleteNote(noteId);
  }
});

renderNotes();
updateCharCount();
connectAnnaRuntime();
