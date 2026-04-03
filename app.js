// ── CONFIG ──────────────────────────────────────────────────────────
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPJgB9p0FKquzNqoZFyvtyvxxfzC1DT3EI2exZRAy5-_CvMWqJn7cw662Zj0h2v5ab/exec";

const COUNTDOWN_SECONDS = 10;
const DATA_FILES = ["questions.csv", "questions.tsv", "questions.xlsx"];
const QUESTIONS_AMOUNT = 5;
const TMP_INIT_DATA = "user=%7B%22id%22%3A7728607533%2C%22first_name%22%3A%22Kamil%22%2C%22last_name%22%3A%22Iwaszko%22%2C%22language_code%22%3A%22pl%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FO4RrGWEH3wR_u5yQWebWgybzkR_UfS3kguAn-P2lmmP4c5LeVmDb7oEi4-u5kvlt.svg%22%7D&chat_instance=-6341672468787578078&chat_type=sender&auth_date=1775057988&signature=PNq2-Gyd8xZ2hyH6Bsj5dkS4YZqnJT2lxil1g5xHbvLVKISKoPmI7PXLAIB0f5ukP5esZV4kXv5G11Ez2p7gDA&hash=4eb7b4771035f591d1165c8883e1cc1ce351963641b8f5cb84e2d652fe7df132";

const MIN_REWARD_SCORE  = 75;
const QUIZ_DAYS         = [3, 5];

// ── LocalStorage keys ────────────────────────────────────────────────
const LS_GAME_USERNAME = "kwiz_game_username";
const LS_LAST_RESULT   = "last_quiz_result";
const LS_LAST_CORRECT  = "last_quiz_correct";
const LS_LAST_SCORE    = "last_quiz_score";
const LS_LAST_DAY      = "last_quiz_day";

const getQuizKey        = (day) => `quiz_completed_${day}`;
const getStoredUsername = ()    => localStorage.getItem(LS_GAME_USERNAME) || "";
const storeUsername     = (n)   => localStorage.setItem(LS_GAME_USERNAME, n.trim());

// ── Telegram ─────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.enableClosingConfirmation();

// ── DOM ───────────────────────────────────────────────────────────────
const DOM = {
  screens: {
    alreadyDone : document.getElementById("screen-already-done"),
    quiz        : document.getElementById("screen-quiz"),
    noQuiz      : document.getElementById("screen-no-quiz"),
    success     : document.getElementById("screen-success"),
  },
  overlay       : document.getElementById("overlay-loading"),
  quizContainer : document.getElementById("quiz-container"),
  submitBtn     : document.getElementById("btn-submit"),
  countdowns: {
    noQuiz  : document.getElementById("countdown-no-quiz"),
    success : document.getElementById("countdown-success"),
  },
  errorToast   : document.getElementById("error-toast"),
  errorMsg     : document.getElementById("error-msg"),
  nextQuizDate : document.getElementById("next-quiz-date"),

  // Reward block
  rewardContainer : document.getElementById("reward-login-container"),
  rewardInput     : document.getElementById("reward-login-input"),
  rewardSendBtn   : document.getElementById("reward-login-send-btn"),
  rewardStatusMsg : document.getElementById("reward-status-msg"),

  // No-reward info
  noRewardInfo : document.getElementById("no-reward-info"),
  noRewardText : document.getElementById("no-reward-text"),

  // Already-done footer (whole bar)
  alreadyDoneFooter         : document.getElementById("already-done-footer"),
  alreadyFooterBadge        : document.getElementById("already-footer-username-badge"),
  alreadyFooterUsernameText : document.getElementById("already-footer-username-text"),

  // Quiz footer (whole bar)
  quizFooter             : document.getElementById("quiz-footer"),
  quizFooterBadge        : document.getElementById("quiz-footer-username-badge"),
  quizFooterUsernameText : document.getElementById("quiz-footer-username-text"),

  // Close / score
  btnCloseAlreadyDone : document.getElementById("btn-close-already-done"),
  completedScore      : document.getElementById("completed-score"),

  // Edit modal
  editModal     : document.getElementById("edit-username-modal"),
  editInput     : document.getElementById("edit-username-input"),
  editStatusMsg : document.getElementById("edit-status-msg"),
  editSaveBtn   : document.getElementById("edit-modal-save"),
  editCancelBtn : document.getElementById("edit-modal-cancel"),
};

// ════════════════════════════════════════════════════════════════════
// PLASMA BALL
// ════════════════════════════════════════════════════════════════════
function plasmaBall(canvasId = "plasma") {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height, hw = W / 2, hh = H / 2, R = hw;
  const img  = ctx.createImageData(W, H);
  const data = img.data;
  const dist = new Float32Array(W * H);
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - hw, dy = y - hh;
      const r  = Math.sqrt(dx * dx + dy * dy);
      dist[y * W + x] = r;
      mask[y * W + x] = Math.max(0, 1 - Math.pow(r / R, 3));
    }
  }
  const phaseOffsets = Array.from({ length: 5 }, () => Math.random() * 10);
  const palette = (t) => {
    t = (t % 1 + 1) % 1;
    let r, g, b;
    if      (t < 0.33) { const s = t / 0.33;        r = 99  + 40*s; g = 102 - 20*s; b = 241; }
    else if (t < 0.66) { const s = (t-0.33) / 0.33; r = 139 - 80*s; g = 82  +140*s; b = 241 - 40*s; }
    else               { const s = (t-0.66) / 0.34; r = 59  + 40*s; g = 222 -120*s; b = 201 + 40*s; }
    return [r|0, g|0, b|0];
  };
  const draw = (time) => {
    const t = time * 0.001;
    for (let y = 0; y < H; y++) {
      const ny = y / H * 4;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (mask[i] < 0.01) { data[i*4+3] = 0; continue; }
        const nx = x / W * 4;
        let v = 0;
        v += Math.sin(nx * 2.3 + t * 1.1 + phaseOffsets[0]);
        v += Math.cos(ny * 2.1 - t * 0.9 + phaseOffsets[1]);
        v += Math.sin((nx * 1.4 - ny * 1.8 + t * 0.7) * 1.3 + phaseOffsets[2]);
        v += Math.sin(dist[i] * 0.06 - t * 1.5 + phaseOffsets[3]) * 1.2;
        v += Math.cos(nx * 1.1 + Math.sin(ny * 0.8 + t * 0.6 + phaseOffsets[4])) * 0.9;
        v = (v * 0.1 + 0.5) % 1;
        if (v < 0) v += 1;
        const [r, g, b] = palette(v + t * 0.05);
        const a   = mask[i];
        const idx = i * 4;
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a*255|0;
      }
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

// ════════════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════════════
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const getCurrentDayOfWeek = () => {
  const d = new Date();
  return d.getDay() === 0 ? 7 : d.getDay();
};

const getNextQuizDate = () => {
  const today   = getCurrentDayOfWeek();
  const future  = QUIZ_DAYS.find(d => d > today);
  const nextDay = future !== undefined ? future : QUIZ_DAYS[0];
  const days    = nextDay > today ? nextDay - today : 7 - today + nextDay;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const formatDate = (date) => date.toLocaleDateString('pl-PL', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const showScreen = (el) => {
  Object.values(DOM.screens).forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
  window.scrollTo(0, 0);
};

const triggerPulse = (el) => {
  el.classList.remove("pulse-ring");
  void el.offsetWidth;
  el.classList.add("pulse-ring");
};

const startCountdown = (el, callback) => {
  const endTime = Date.now() + COUNTDOWN_SECONDS * 1000;
  let lastSec   = null;
  const iv = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (remaining !== lastSec) {
      el.textContent = remaining;
      triggerPulse(el);
      lastSec = remaining;
    }
    if (remaining <= 0) { clearInterval(iv); callback(); }
  }, 100);
};

const closeMiniApp = () => tg?.close();

const showError = (msg) => {
  DOM.errorMsg.textContent = msg;
  DOM.errorToast.classList.remove("hidden");
};

// ════════════════════════════════════════════════════════════════════
// USERNAME UI
// Footers are only shown when a username is stored in localStorage.
// ════════════════════════════════════════════════════════════════════
const refreshUsernameUI = () => {
  const name = getStoredUsername();

  // ── Already-done screen footer ──
  if (name) {
    DOM.alreadyFooterUsernameText.textContent = name;
    DOM.alreadyDoneFooter.style.display       = "";          // show bar
    DOM.alreadyFooterBadge.style.display      = "inline-flex";
  } else {
    DOM.alreadyDoneFooter.style.display  = "none";           // hide bar
    DOM.alreadyFooterBadge.style.display = "none";
  }

  // ── Quiz screen footer ──
  if (name) {
    DOM.quizFooterUsernameText.textContent = name;
    DOM.quizFooter.style.display           = "";             // show bar
    DOM.quizFooterBadge.style.display      = "inline-flex";
  } else {
    DOM.quizFooter.style.display      = "none";              // hide bar
    DOM.quizFooterBadge.style.display = "none";
  }
};

// ════════════════════════════════════════════════════════════════════
// REWARD STATUS MSG
// ════════════════════════════════════════════════════════════════════
const showRewardStatus = (msg, type = "success") => {
  DOM.rewardStatusMsg.textContent = msg;
  DOM.rewardStatusMsg.className   = "text-xs mt-2 text-center font-medium";
  if      (type === "success") DOM.rewardStatusMsg.classList.add("text-emerald-400");
  else if (type === "error")   DOM.rewardStatusMsg.classList.add("text-red-400");
  else                         DOM.rewardStatusMsg.classList.add("text-white/50");
  DOM.rewardStatusMsg.classList.remove("hidden");
};

// ════════════════════════════════════════════════════════════════════
// FETCH HELPERS
// ════════════════════════════════════════════════════════════════════
const fetchWithRetry = async (url, options, retries = 2) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
    return res;
  } catch (err) {
    if (retries <= 0) throw err;
    return fetchWithRetry(url, options, retries - 1);
  }
};

const parseResponse = async (res) => {
  const text = await res.text();
  try { return { type: "json", data: JSON.parse(text) }; }
  catch { return { type: "text", data: text }; }
};

// ════════════════════════════════════════════════════════════════════
// SEND USERNAME TO GAS
// ════════════════════════════════════════════════════════════════════
const sendUsernameToGAS = async (username) => {
  const initData = tg?.initData || TMP_INIT_DATA;
  const payload  = `action=submitUsername&username=${encodeURIComponent(username)}&initData=${encodeURIComponent(initData)}`;
  const res      = await fetchWithRetry(GOOGLE_APPS_SCRIPT_URL, { method: "POST", body: payload });
  const parsed   = await parseResponse(res);
  const isOk     =
    (parsed.type === "json" && parsed.data?.ok === true) ||
    (parsed.type === "text" && parsed.data === "ok");
  if (!isOk && parsed.type === "text" && parsed.data.startsWith("Error")) {
    throw new Error(parsed.data);
  }
  return true;
};

// ════════════════════════════════════════════════════════════════════
// REWARD SEND HANDLER
// ════════════════════════════════════════════════════════════════════
const handleRewardSend = async () => {
  const username = DOM.rewardInput.value.trim();
  if (!username) {
    showRewardStatus("Proszę wpisać nazwę użytkownika.", "error");
    DOM.rewardInput.focus();
    return;
  }
  DOM.rewardSendBtn.disabled = true;
  DOM.rewardInput.disabled   = true;
  showRewardStatus("Wysyłanie…", "loading");
  try {
    await sendUsernameToGAS(username);
    storeUsername(username);
    refreshUsernameUI();
    DOM.rewardSendBtn.classList.add("sent");
    DOM.rewardSendBtn.textContent = "✔ Wysłano";
    showRewardStatus("Nazwa użytkownika została zapisana!", "success");
    setTimeout(() => DOM.rewardContainer.classList.add("hidden"), 1500);
  } catch {
    showRewardStatus("Błąd połączenia. Spróbuj ponownie.", "error");
    DOM.rewardSendBtn.disabled = false;
    DOM.rewardInput.disabled   = false;
  }
};

// ════════════════════════════════════════════════════════════════════
// EDIT USERNAME MODAL
// ════════════════════════════════════════════════════════════════════
const openEditModal = () => {
  DOM.editInput.value           = getStoredUsername();
  DOM.editStatusMsg.classList.add("hidden");
  DOM.editSaveBtn.disabled      = false;
  DOM.editSaveBtn.textContent   = "Zapisz";
  DOM.editInput.disabled        = false;
  DOM.editModal.classList.add("open");
  setTimeout(() => DOM.editInput.focus(), 100);
};

const closeEditModal = () => DOM.editModal.classList.remove("open");

const handleEditSave = async () => {
  const username = DOM.editInput.value.trim();
  if (!username) {
    DOM.editStatusMsg.textContent = "Proszę wpisać nazwę użytkownika.";
    DOM.editStatusMsg.className   = "text-xs mb-3 text-center font-medium text-red-400";
    DOM.editStatusMsg.classList.remove("hidden");
    DOM.editInput.focus();
    return;
  }
  DOM.editSaveBtn.disabled      = true;
  DOM.editInput.disabled        = true;
  DOM.editStatusMsg.textContent = "Wysyłanie…";
  DOM.editStatusMsg.className   = "text-xs mb-3 text-center font-medium text-white/50";
  DOM.editStatusMsg.classList.remove("hidden");
  try {
    await sendUsernameToGAS(username);
    storeUsername(username);
    refreshUsernameUI();
    DOM.editStatusMsg.textContent = "✔ Zmieniono!";
    DOM.editStatusMsg.className   = "text-xs mb-3 text-center font-medium text-emerald-400";
    DOM.editSaveBtn.textContent   = "✔ Zapisano";
    setTimeout(closeEditModal, 1200);
  } catch {
    DOM.editStatusMsg.textContent = "Błąd połączenia. Spróbuj ponownie.";
    DOM.editStatusMsg.className   = "text-xs mb-3 text-center font-medium text-red-400";
    DOM.editSaveBtn.disabled      = false;
    DOM.editInput.disabled        = false;
    DOM.editSaveBtn.textContent   = "Zapisz";
  }
};

// ════════════════════════════════════════════════════════════════════
// DATA FILE LOADING & PARSING
// ════════════════════════════════════════════════════════════════════
const loadDataFile = async () => {
  for (const file of DATA_FILES) {
    try {
      const resp = await fetch(file);
      if (resp.ok) return { resp, file };
    } catch {}
  }
  throw new Error("Nie znaleziono pliku kwizu 'questions'.");
};

const parseDataFile = async (resp, file) => {
  const ext = file.split(".").pop().toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    const buffer = await resp.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: "array" });
    const sheet  = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
      .map(row => row.map(cell => String(cell).trim()));
  }
  const text = await resp.text();
  if (ext === "tsv") {
    return text.trim().split("\n").map(line =>
      line.split("\t").map(c => c.replace(/^"|"$/g, "").trim()));
  }
  // CSV
  return text.trim().split("\n").map(line => {
    const result = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i+1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if      (ch === '"')  inQuotes = true;
        else if (ch === ",")  { result.push(current.trim()); current = ""; }
        else                  current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
};

const parseRowsToQuestions = (rows) =>
  rows.slice(1).reduce((acc, row) => {
    if (!row || row.length < 3) return acc;
    const options = row.slice(2)
      .map((o, idx) => ({ text: o, originalIndex: idx + 1 }))
      .filter(o => o.text !== "");
    acc.push({ id: row[0], question: row[1], options });
    return acc;
  }, []);

const loadQuestions = async () => {
  const { resp, file } = await loadDataFile();
  const rows = await parseDataFile(resp, file);
  return parseRowsToQuestions(rows);
};

// ════════════════════════════════════════════════════════════════════
// DISPLAY COMPLETED QUIZ
// ════════════════════════════════════════════════════════════════════
const displayCompletedQuiz = async () => {
  const result      = JSON.parse(localStorage.getItem(LS_LAST_RESULT)  || "[]");
  const correctData = JSON.parse(localStorage.getItem(LS_LAST_CORRECT) || "[]");
  const totalScore  = Number(localStorage.getItem(LS_LAST_SCORE) || 0);

  DOM.completedScore.textContent = `${totalScore}%`;

  const hasUsername     = !!getStoredUsername();
  const qualifiesReward = totalScore >= MIN_REWARD_SCORE;

  DOM.rewardContainer.classList.toggle("hidden", !(qualifiesReward && !hasUsername));

  if (!qualifiesReward) {
    DOM.noRewardInfo.classList.remove("hidden");
    DOM.noRewardText.textContent =
      `Wynik od ${MIN_REWARD_SCORE}% do 100% kwalifikuje do nagrody.`;
  } else {
    DOM.noRewardInfo.classList.add("hidden");
  }

  refreshUsernameUI();

  const container = document.getElementById("completed-quiz-container");
  container.innerHTML = "";

  if (!result.length || !correctData.length) {
    container.innerHTML = `<p class="text-white/60 text-center">Brak danych do wyświetlenia.</p>`;
    return;
  }

  const questions = await loadQuestions();
  const map = {};
  questions.forEach(q => { map[q.id] = q; });

  const dateEl = document.createElement("div");
  dateEl.className   = "text-white/60 text-center text-sm";
  dateEl.textContent = `Quiz z dnia: ${formatDate(new Date())}`;
  container.appendChild(dateEl);

  result.forEach(q => {
    const correctQ = correctData.find(c => Number(c.id) === Number(q.id));
    const question  = map[q.id];
    if (!correctQ || !question) return;

    const card = document.createElement("div");
    card.className = "bg-white/10 border border-white/20 rounded-2xl p-5 space-y-3";

    const title = document.createElement("h3");
    title.className   = "text-lg font-semibold text-white";
    title.textContent = question.question;
    card.appendChild(title);

    question.options.forEach(opt => {
      const isCorrect  = correctQ.correct.includes(opt.originalIndex);
      const isSelected = q.selected.includes(opt.originalIndex);

      const el = document.createElement("div");
      el.className = "answer-card";
      if      (isCorrect && isSelected) el.classList.add("selected-correct");
      else if (isCorrect)               el.classList.add("correct");
      else if (isSelected)              el.classList.add("selected-incorrect");

      let label = "";
      if      (isCorrect && isSelected) label = " ✔";
      else if (isCorrect)               label = " (poprawna)";
      else if (isSelected)              label = " ✖";

      el.textContent = opt.text + label;
      card.appendChild(el);
    });

    container.appendChild(card);
  });
};

// ════════════════════════════════════════════════════════════════════
// RENDER QUIZ
// ════════════════════════════════════════════════════════════════════
let quizData = [];

const renderQuiz = (questions) => {
  quizData = questions;
  DOM.quizContainer.innerHTML = "";

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "bg-white/10 border border-white/20 rounded-2xl p-5 space-y-3";

    const title = document.createElement("h3");
    title.className   = "text-lg font-semibold text-white";
    title.textContent = `${idx + 1}. ${q.question}`;
    card.appendChild(title);

    shuffle(q.options).forEach(opt => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/10";

      const cb     = document.createElement("input");
      cb.type      = "checkbox";
      cb.name      = `q${q.id}`;
      cb.value     = opt.originalIndex;
      cb.className = "hidden";

      const box = document.createElement("span");
      box.className = "w-6 h-6 flex-shrink-0 border-2 border-white/40 rounded-md transition-colors";

      const text = document.createElement("span");
      text.className   = "text-white";
      text.textContent = opt.text;

      cb.addEventListener("change", () =>
        box.classList.toggle("bg-indigo-500", cb.checked));

      label.append(cb, box, text);
      card.appendChild(label);
    });

    DOM.quizContainer.appendChild(card);
  });
};

const allQuestionsAnswered = () =>
  quizData.every(q =>
    document.querySelectorAll(`input[name="q${q.id}"]:checked`).length > 0);

const buildResultString = () =>
  quizData.map(q => {
    const answers = Array.from(
      document.querySelectorAll(`input[name="q${q.id}"]:checked`)
    ).map(cb => Number(cb.value)).sort((a, b) => a - b);
    return `${q.id},${answers.join(",")}`;
  }).join(":");

// ════════════════════════════════════════════════════════════════════
// QUIZ SUBMISSION
// ════════════════════════════════════════════════════════════════════
const handleSubmit = async () => {
  DOM.submitBtn.disabled = true;

  if (!allQuestionsAnswered()) {
    showError("Proszę odpowiedz na wszystkie pytania przed wysłaniem odpowiedzi.");
    DOM.submitBtn.disabled = false;
    return;
  }

  const currentDay     = getCurrentDayOfWeek();
  const storedUsername = getStoredUsername();

  const payload = [
    `action=submitQuiz`,
    `results=${encodeURIComponent(buildResultString())}`,
    `initData=${encodeURIComponent(tg?.initData || TMP_INIT_DATA)}`,
    storedUsername ? `username=${encodeURIComponent(storedUsername)}` : ""
  ].filter(Boolean).join("&");

  DOM.overlay.classList.remove("hidden");

  try {
    const res    = await fetch(GOOGLE_APPS_SCRIPT_URL, { method: "POST", body: payload });
    const parsed = await parseResponse(res);

    if (parsed.type === "text") {
      if (parsed.data.startsWith("Error")) throw new Error(parsed.data);
      if (parsed.data === "Already submitted today") {
        localStorage.setItem(getQuizKey(currentDay), "true");
        showScreen(DOM.screens.alreadyDone);
        await displayCompletedQuiz();
        return;
      }
      throw new Error("Nieznana odpowiedź serwera");
    }

    const data = parsed.data;
    if (typeof data.score === "undefined") throw new Error("Nieprawidłowa odpowiedź serwera");

    if (data.username && !getStoredUsername()) {
      storeUsername(data.username);
    }

    const results = quizData.map(q => ({
      id      : q.id,
      selected: Array.from(
        document.querySelectorAll(`input[name="q${q.id}"]:checked`)
      ).map(cb => Number(cb.value))
    }));

    localStorage.setItem(getQuizKey(currentDay), "true");
    localStorage.setItem(LS_LAST_RESULT,  JSON.stringify(results));
    localStorage.setItem(LS_LAST_CORRECT, JSON.stringify(data.scored));
    localStorage.setItem(LS_LAST_SCORE,   data.score);
    localStorage.setItem(LS_LAST_DAY,     currentDay);

    showScreen(DOM.screens.alreadyDone);
    await displayCompletedQuiz();

  } catch (err) {
    showError(err.message || "Błąd połączenia. Spróbuj ponownie później.");
  } finally {
    DOM.overlay.classList.add("hidden");
    DOM.submitBtn.disabled = false;
  }
};

// ════════════════════════════════════════════════════════════════════
// SCHEDULER HELPERS
// ════════════════════════════════════════════════════════════════════
const shouldShowLastQuiz = (lastQuizDay, currentDay) => {
  const sorted    = [...QUIZ_DAYS].sort((a, b) => a - b);
  const nextIdx   = sorted.findIndex(d => d > lastQuizDay);
  const nextDay   = nextIdx === -1 ? sorted[0] : sorted[nextIdx];
  const daysUntilNext = nextDay > lastQuizDay
    ? nextDay - lastQuizDay
    : 7 - lastQuizDay + nextDay;
  const daysSinceLast = currentDay > lastQuizDay
    ? currentDay - lastQuizDay
    : 7 - lastQuizDay + currentDay;
  return daysSinceLast < daysUntilNext;
};

// ════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════
const init = async () => {
  const currentDay  = getCurrentDayOfWeek();
  const lastQuizDay = Number(localStorage.getItem(LS_LAST_DAY) || 0);

  DOM.nextQuizDate.textContent = formatDate(getNextQuizDate());
  refreshUsernameUI();

  // 1. Quiz day
  if (QUIZ_DAYS.includes(currentDay)) {
    if (localStorage.getItem(getQuizKey(currentDay))) {
      showScreen(DOM.screens.alreadyDone);
      await displayCompletedQuiz();
      return;
    }
    try {
      const questions = await loadQuestions();
      if (questions.length < QUESTIONS_AMOUNT) throw new Error("Za mało pytań w pliku");
      const selected = shuffle(questions).slice(0, QUESTIONS_AMOUNT);
      renderQuiz(selected);
      showScreen(DOM.screens.quiz);
    } catch (err) {
      showError(err.message || "Nie udało się załadować quizu");
      showScreen(DOM.screens.noQuiz);
      plasmaBall();
      startCountdown(DOM.countdowns.noQuiz, closeMiniApp);
    }
    return;
  }

  // 2. Not a quiz day — show last quiz if recent
  if (lastQuizDay && QUIZ_DAYS.includes(lastQuizDay)) {
    if (shouldShowLastQuiz(lastQuizDay, currentDay)) {
      showScreen(DOM.screens.alreadyDone);
      await displayCompletedQuiz();
      return;
    }
  }

  // 3. No quiz, no recent results
  showScreen(DOM.screens.noQuiz);
  plasmaBall();
  startCountdown(DOM.countdowns.noQuiz, closeMiniApp);
};

// ════════════════════════════════════════════════════════════════════
// WAVE ANIMATION
// ════════════════════════════════════════════════════════════════════
const initWave = () => {
  document.querySelectorAll(".wave-word").forEach(wordEl => {
    wordEl.innerHTML = wordEl.textContent.split("")
      .map(l => `<span>${l}</span>`).join("");
    const letters     = wordEl.querySelectorAll("span");
    const animateWave = () => {
      letters.forEach((letter, i) => {
        setTimeout(() => {
          letter.style.transform = "translateY(-4px)";
          setTimeout(() => (letter.style.transform = "translateY(0)"), 300);
        }, i * 100);
      });
    };
    animateWave();
    setInterval(animateWave, 3000 + Math.random() * 2000);
  });
};

// ════════════════════════════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════════════════════════════
DOM.submitBtn.addEventListener("click", handleSubmit);
DOM.errorToast.addEventListener("click", () => DOM.errorToast.classList.add("hidden"));
DOM.btnCloseAlreadyDone.addEventListener("click", closeMiniApp);
DOM.rewardSendBtn.addEventListener("click", handleRewardSend);
DOM.rewardInput.addEventListener("keydown", e => { if (e.key === "Enter") handleRewardSend(); });

// Badge → open edit modal
DOM.alreadyFooterBadge.addEventListener("click", openEditModal);
DOM.quizFooterBadge.addEventListener("click", openEditModal);

// Edit modal
DOM.editCancelBtn.addEventListener("click", closeEditModal);
DOM.editSaveBtn.addEventListener("click", handleEditSave);
DOM.editInput.addEventListener("keydown", e => { if (e.key === "Enter") handleEditSave(); });
DOM.editModal.addEventListener("click", e => {
  if (e.target === DOM.editModal) closeEditModal();
});

// ════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  init();
  initWave();
});
