
// ── CONFIG ──────────────────────────────────────────────────────────
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxPJgB9p0FKquzNqoZFyvtyvxxfzC1DT3EI2exZRAy5-_CvMWqJn7cw662Zj0h2v5ab/exec";
const COUNTDOWN_SECONDS = 10;
const DATA_FILES = ["questions.csv", "questions.tsv", "questions.xlsx"];
const QUESTIONS_AMOUNT = 5;

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
const screenNoQuiz      = document.getElementById("screen-no-quiz");
const screenSuccess     = document.getElementById("screen-success");
const overlay           = document.getElementById("overlay-loading");
const quizContainer     = document.getElementById("quiz-container");
const submitBtn         = document.getElementById("btn-submit");
const countdownAlready  = document.getElementById("countdown-already");
const countdownNoQuiz   = document.getElementById("countdown-no-quiz");
const countdownSuccess  = document.getElementById("countdown-success");
const errorToast        = document.getElementById("error-toast");
const errorMsg          = document.getElementById("error-msg");

// ── HELPERS ─────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `quiz_completed_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function showScreen(el) {
  [screenAlreadyDone, screenQuiz, screenSuccess, screenNoQuiz]
    .forEach(s => s.classList.add("hidden"));
  el.classList.remove("hidden");
}

function triggerPulse(el) {
  el.classList.remove("pulse-ring");
  void el.offsetWidth; // force reflow (important!)
  el.classList.add("pulse-ring");
}

function startCountdown(el, cb) {
  const end = Date.now() + COUNTDOWN_SECONDS * 1000;
  let lastSec = null;

  const iv = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));

    if (remaining !== lastSec) {
      el.textContent = remaining;
      triggerPulse(el); // pulse sync
      lastSec = remaining;
    }

    if (remaining <= 0) {
      clearInterval(iv);
      cb();
    }
  }, 100);
}

function closeMiniApp() {
  if (tg) tg.close();
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorToast.classList.remove("hidden");
  //setTimeout(() => errorToast.classList.add("hidden"), 20000);
}

// ── RETRY LOGIC ─────────────────────────────────────────────────────
async function fetchWithRetry(url, options, retries = 2) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Błąd serwera: (${res.status})`);
    return res;
  } catch (err) {
    if (retries === 0) throw err;
    return fetchWithRetry(url, options, retries - 1);
  }
}
// ── PLASMA CANVAS ─────────────────────────────────────────────────────
function plasmaBall(){
    var c=document.getElementById('plasma');
    var ctx=c.getContext('2d');
    var W=c.width, H=c.height, hw=W/2, hh=H/2, R=hw;
    var img=ctx.createImageData(W,H);
    var d=img.data;

    // pre-compute distance & mask
    var dist=new Float32Array(W*H);
    var mask=new Float32Array(W*H);
    for(var y=0;y<H;y++) for(var x=0;x<W;x++){
      var dx=x-hw, dy=y-hh;
      var r=Math.sqrt(dx*dx+dy*dy);
      dist[y*W+x]=r;
      mask[y*W+x]=Math.max(0, 1 - Math.pow(r/R, 3));
    }

    function palette(t){
      // indigo → violet → cyan loop
      t=t%1; if(t<0) t+=1;
      var r,g,b;
      if(t<0.33){var s=t/0.33;       r=99+s*40;  g=102-s*20; b=241;}
      else if(t<0.66){var s=(t-.33)/.33; r=139-s*80; g=82+s*140; b=241-s*40;}
      else{var s=(t-.66)/.34;           r=59+s*40;  g=222-s*120;b=201+s*40;}
      return [r|0,g|0,b|0];
    }

    var sin=Math.sin, cos=Math.cos;

    function draw(time){
      var t=time*0.001;
      for(var y=0;y<H;y++){
        var ny=y/H*4;
        for(var x=0;x<W;x++){
          var i=y*W+x;
          if(mask[i]<0.01){d[i*4+3]=0;continue;}
          var nx=x/W*4;

          var v=0;
          v+=sin(nx*2.3+t*1.1)+cos(ny*2.1-t*0.9);
          v+=sin((nx*1.4-ny*1.8+t*0.7)*1.3);
          v+=sin(dist[i]*0.06-t*1.5)*1.2;
          v+=cos(nx*1.1+sin(ny*0.8+t*0.6))*0.9;
          v+=sin((nx+ny)*1.5+t*1.2)*0.7;

          v=v*0.1+0.5;
          v=v-Math.floor(v);

          var rgb=palette(v+t*0.05);
          var a=mask[i];
          var idx=i*4;
          d[idx]=rgb[0];
          d[idx+1]=rgb[1];
          d[idx+2]=rgb[2];
          d[idx+3]=(a*255)|0;
        }
      }
      ctx.putImageData(img,0,0);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}
// ── FILE LOADING ────────────────────────────────────────
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

// ── PARSERS ─────────────────────────────────────────────
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
    const options = row.slice(2).map((o, idx) => ({
      text: o,
      originalIndex: idx + 1 // <-- store original CSV index
    })).filter(o => o.text !== "");
    questions.push({ id: row[0], question: row[1], options });
  }
  return questions;
}

// ── SHUFFLE ─────────────────────────────────────────────────────────
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ── RENDER QUIZ ──────────────────────────
let quizData = [];

function renderQuiz(questions) {
  quizData = questions;
  quizContainer.innerHTML = "";

  questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "bg-white/10 border border-white/20 rounded-2xl p-5 space-y-3";

    const title = document.createElement("h3");
    title.className = "text-lg font-semibold text-white";
    
    // show only 1..N instead of real ID
    title.textContent = `${q.displayId}. ${q.question}`;
    //title.textContent = `${q.id}. ${q.question}`;
    
    card.appendChild(title);

    /*// attach index BEFORE shuffle
    const optionsWithIndex = q.options.map((opt, i) => ({
      text: opt,
      index: i + 1 // 1-based index
    }));

    const shuffledOptions = shuffle(optionsWithIndex);
    */
    const shuffledOptions = shuffle(q.options); // shuffle the option objects
    
    shuffledOptions.forEach((optObj) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/10";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = `q${q.id}`;
      cb.value = optObj.originalIndex; // store index instead of text
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
// ── VALIDATION ────────────────────────────────────────────────
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
    showError("Proszę odpowiedz na wszystkie pytania przed wysłaniem odpowiedzi.");
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
    showError(err.message || "Błąd połączenia. Spróbuj ponownie później.");
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

    //if (!questions.length) throw new Error("Nie znaleziono pytań w pliku.");
    if (questions.length < QUESTIONS_AMOUNT) {
      showScreen(screenNoQuiz);
      plasmaBall();
      startCountdown(countdownNoQuiz, closeMiniApp);
      return;
    }
    
    // shuffle + take only N questions
    const selected = shuffle(questions).slice(0, QUESTIONS_AMOUNT);
    
    // add display index (1..N)
    const indexed = selected.map((q, i) => ({
      ...q,
      displayId: i + 1
    }));
    
    renderQuiz(indexed);
    //renderQuiz(questions);
    showScreen(screenQuiz);

  } catch (err) {
    showError(err.message);
  }
}

// ── EVENTS ──────────────────────────────────────────────────────────
submitBtn.addEventListener("click", handleSubmit);
errorMsg.addEventListener("click", () => {errorToast.classList.add("hidden");});
document.addEventListener("DOMContentLoaded", init);
