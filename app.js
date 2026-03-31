
// ── CONFIG ──────────────────────────────────────────────────────────
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPJgB9p0FKquzNqoZFyvtyvxxfzC1DT3EI2exZRAy5-_CvMWqJn7cw662Zj0h2v5ab/exec";
const COUNTDOWN_SECONDS = 5;
const DATA_FILES = ["questions.csv", "questions.tsv", "questions.xlsx"];

// ── TELEGRAM ────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation(); // prevent accidental closing
}

// ── DOM refs ────────────────────────────────────────────────────────
const screenAlreadyDone = document.getElementById("screen-already-done");
const screenQuiz        = document.getElementById("screen-quiz");
const screenSuccess     = document.getElementById("screen-success");
const overlay           = document.getElementById("overlay-loading");
const quizContainer     = document.getElementById("quiz-container");
const submitBtn         = document.getElementById("btn-submit");
const countdownAlready  = document.getElementById("countdown-already");
const countdownSuccess  = document.getElementById("countdown-success");
const errorToast        = document.getElementById("error-toast");
const errorMsg          = document.getElementById("error-msg");

// ── HELPERS ─────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `quiz_completed_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function showScreen(el) {
  [screenAlreadyDone, screenQuiz, screenSuccess].forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
}

function startCountdown(el, cb) {
  let sec = COUNTDOWN_SECONDS;
  el.textContent = sec;
  const iv = setInterval(() => {
    sec--;
    el.textContent = sec;
    if (sec <= 0) {
      clearInterval(iv);
      cb();
    }
  }, 1000);
}

function closeMiniApp() {
  if (tg) tg.close();
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorToast.classList.remove("hidden");
  setTimeout(() => errorToast.classList.add("hidden"), 4000);
}

// ── RETRY LOGIC ─────────────────────────────────────────────────────
async function fetchWithRetry(url, options, retries = 2) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return res;
  } catch (err) {
    if (retries === 0) throw err;
    return fetchWithRetry(url, options, retries - 1);
  }
}

// ── FILE LOADING (unchanged) ────────────────────────────────────────
async function loadDataFile() {
  for (const file of DATA_FILES) {
    try {
      const resp = await fetch(file);
      if (resp.ok) return { response: resp, filename: file };
    } catch (_) {}
  }
  throw new Error("Nie znaleziono pliku kwizu 'questions'.");
}

async function parseDataFile(response, filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "xlsx" || ext === "xls") return parseXLSX(await response.arrayBuffer());
  const text = await response.text();
  if (ext === "tsv") return parseDSV(text, "\t");
  return parseCSVText(text);
}

// ── PARSERS (unchanged) ─────────────────────────────────────────────
function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
    .map(row => row.map(cell => String(cell).trim()));
}

function parseDSV(text, delimiter) {
  return text.trim().split("\n").map(line =>
    line.split(delimiter).map(cell => cell.replace(/^"|"$/g, "").trim())
  );
}

function parseCSVText(text) {
  return text.trim().split("\n").map(parseCSVRow);
}

function parseCSVRow(line) {
  const result = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(current.trim()); current = ""; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── QUESTIONS ───────────────────────────────────────────────────────
function rowsToQuestions(rows) {
  const questions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const options = row.slice(2).filter(o => o !== "");
    questions.push({ id: row[0], question: row[1], options });
  }
  return questions;
}

// ── RENDER QUIZ (UPDATED: shuffle answers) ──────────────────────────
let quizData = [];

function renderQuiz(questions) {
  quizData = questions;
  quizContainer.innerHTML = "";

  questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "bg-white/10 border border-white/20 rounded-2xl p-5 space-y-3";

    const title = document.createElement("h3");
    title.className = "text-lg font-semibold text-white";
    title.textContent = `${q.id}. ${q.question}`;
    card.appendChild(title);

    // attach index BEFORE shuffle
    const optionsWithIndex = q.options.map((opt, i) => ({
      text: opt,
      index: i + 1 // 1-based index
    }));

    const shuffledOptions = shuffle(optionsWithIndex);

    shuffledOptions.forEach((optObj) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/10";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = `q${q.id}`;
      cb.value = optObj.index; // store index instead of text
      cb.className = "hidden";

      const box = document.createElement("span");
      box.className = "w-6 h-6 border-2 border-white/40 rounded-md";

      const text = document.createElement("span");
      text.className = "text-white";
      text.textContent = optObj.text; // still show text

      cb.addEventListener("change", () => {
        box.classList.toggle("bg-indigo-500", cb.checked);
      });

      label.append(cb, box, text);
      card.appendChild(label);
    });

    quizContainer.appendChild(card);
  });
}
// ── VALIDATION (NEW) ────────────────────────────────────────────────
function allQuestionsAnswered() {
  return quizData.every(q =>
    document.querySelectorAll(`input[name="q${q.id}"]:checked`).length > 0
  );
}

// ── BUILD RESULT ────────────────────────────────────────────────────
function buildResultString() {
  const parts = [];
  quizData.forEach(q => {
    const checked = document.querySelectorAll(`input[name="q${q.id}"]:checked`);

    const answers = Array.from(checked)
      .map(cb => Number(cb.value)) // already index
      .sort((a, b) => a - b); // optional: keep order clean

    parts.push(`${q.id},${answers.join(",")}`);
  });
  return parts.join(":");
}

// ── SUBMIT ──────────────────────────────────────────────────────────
async function handleSubmit() {
  // Disable button immediately
  submitBtn.disabled = true;
  submitBtn.classList.add("opacity-50", "cursor-not-allowed");

  // Require all questions to be answered
  const unanswered = quizData.some(q => 
    document.querySelectorAll(`input[name="q${q.id}"]:checked`).length === 0
  );
  if (unanswered) {
    showError("Please answer all questions before submitting.");
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
    return;
  }

  // Build result string
  const resultString = buildResultString();

  // Show loading overlay
  overlay.classList.remove("hidden");

  const payload = `results=${encodeURIComponent(resultString)}&initData=${encodeURIComponent(tg ? tg.initData : "dev_mode_no_telegram")}`;

  try {
    const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: payload // plain text only, no headers
    });

    // Get plain text response
    const text = await res.text();

    if (text.startsWith("Error")) {
      throw new Error(text);
    }

    // Save completion to localStorage
    localStorage.setItem(todayKey(), "true");

    overlay.classList.add("hidden");
    showScreen(screenSuccess);
    startCountdown(countdownSuccess, closeMiniApp);

  } catch (err) {
    overlay.classList.add("hidden");
    showError(err.message || "Network error. Please try again.");
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

// ── INIT ────────────────────────────────────────────────────────────
async function init() {  
  if (localStorage.getItem(todayKey())) {
    showScreen(screenAlreadyDone);
    startCountdown(countdownAlready, closeMiniApp);
    return;
  }

  try {
    const { response, filename } = await loadDataFile();
    const rows = await parseDataFile(response, filename);
    const questions = rowsToQuestions(rows);

    if (!questions.length) throw new Error("No questions found.");

    renderQuiz(questions);
    showScreen(screenQuiz);

  } catch (err) {
    showError(err.message);
  }
}

// ── EVENTS ──────────────────────────────────────────────────────────
submitBtn.addEventListener("click", handleSubmit);
document.addEventListener("DOMContentLoaded", init);
