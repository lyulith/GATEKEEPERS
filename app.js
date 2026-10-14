/* =====================================================
   DUAL TIMER — app.js
   ===================================================== */

// ── State ──────────────────────────────────────────────
const state = {
  running: false,
  paused:  false,
  intervalId: null,

  timers: [
    {
      id: 1,
      label:      'GATEKEEPER',
      mode:       'countdown',
      elapsed:    0,
      duration:   50,
      remaining:  50,
      sound:      'beep',
      finished:   false,
      lastWarnSecond: -1,   // tracks which warn second already fired
    },
    {
      id: 2,
      label:      'OVERLOAD',
      mode:       'countdown',
      elapsed:    0,
      duration:   25,
      remaining:  25,
      sound:      'beep',
      finished:   false,
      lastWarnSecond: -1,
    },
  ],

  lastTick: null,
};

// ── DOM refs ───────────────────────────────────────────
const startBtn       = document.getElementById('startBtn');
const resetBtn       = document.getElementById('resetBtn');
const settingsBtn    = document.getElementById('settingsBtn');
const modalOverlay   = document.getElementById('modalOverlay');
const modalClose     = document.getElementById('modalClose');
const saveSettings   = document.getElementById('saveSettings');

const timerDisplay1  = document.getElementById('timerDisplay1');
const timerDisplay2  = document.getElementById('timerDisplay2');
const timerStatus1   = document.getElementById('timerStatus1');
const timerStatus2   = document.getElementById('timerStatus2');
const timerLabel1    = document.getElementById('timerLabel1');
const timerLabel2    = document.getElementById('timerLabel2');
const timerCard1     = document.getElementById('timerCard1');
const timerCard2     = document.getElementById('timerCard2');

const name1Input     = document.getElementById('name1Input');
const name2Input     = document.getElementById('name2Input');
const mode1Count     = document.getElementById('mode1Count');
const mode1Down      = document.getElementById('mode1Down');
const mode2Count     = document.getElementById('mode2Count');
const mode2Down      = document.getElementById('mode2Down');
const countdown1Row  = document.getElementById('countdown1Row');
const countdown2Row  = document.getElementById('countdown2Row');
const sound1         = document.getElementById('sound1');
const sound2         = document.getElementById('sound2');

const h1 = document.getElementById('h1');
const m1 = document.getElementById('m1');
const s1 = document.getElementById('s1');
const h2 = document.getElementById('h2');
const m2 = document.getElementById('m2');
const s2 = document.getElementById('s2');

// ── Audio ──────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  if (type === 'none') return;
  try {
    const ctx = getAudioCtx();
    if (type === 'beep') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'chime') {
      [523, 659, 784].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } else if (type === 'alarm') {
      for (let i = 0; i < 3; i++) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime + i * 0.25);
        osc.frequency.setValueAtTime(660, ctx.currentTime + i * 0.25 + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.2);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.22);
      }
    }
  } catch (e) { /* silent fail */ }
}

// Warning tick — Gatekeeper: deep resonant thud (low sine)
function playWarnGatekeeper() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);          // low, heavy
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* silent fail */ }
}

// Warning tick — Overload: sharp rising ping (high square)
function playWarnOverload() {
  try {
    const ctx  = getAudioCtx();
    // double-click: two fast high pips
    [0, 0.12].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + offset + 0.07);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.1);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.11);
    });
  } catch (e) { /* silent fail */ }
}

// ── Formatting ─────────────────────────────────────────
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatMs(ms) {
  return formatTime(Math.floor(ms / 1000));
}

// ── Render ─────────────────────────────────────────────
const displays = [timerDisplay1, timerDisplay2];
const statuses = [timerStatus1,  timerStatus2];
const labels   = [timerLabel1,   timerLabel2];
const cards    = [timerCard1,    timerCard2];

function renderTimer(i) {
  const t = state.timers[i];
  const display = displays[i];
  const status  = statuses[i];
  const label   = labels[i];
  const card    = cards[i];

  // label
  label.textContent = t.label;

  // time value
  if (t.mode === 'countup') {
    display.textContent = formatMs(t.elapsed);
  } else {
    display.textContent = formatTime(Math.max(0, t.remaining));
  }

  // card running class — always 'running' while the whole session is running (looping countdown)
  card.classList.toggle('running', state.running && !state.paused);

  // warning pulse for last 5 seconds
  const isWarning = state.running && !state.paused
    && t.mode === 'countdown'
    && t.remaining <= 5 && t.remaining > 0;
  card.classList.toggle('warning', isWarning);

  // no finished flash needed (loops restart automatically)
  display.classList.remove('finished');

  // status text
  if (state.running && !state.paused) {
    status.textContent = 'RUNNING';
    status.className = 'timer-status';
  } else if (state.paused) {
    status.textContent = 'PAUSED';
    status.className = 'timer-status';
  } else {
    status.textContent = 'READY';
    status.className = 'timer-status';
  }
}

function renderAll() {
  state.timers.forEach((_, i) => renderTimer(i));

  // start button state
  const btnText = startBtn.querySelector('.btn-text');
  const btnIcon = startBtn.querySelector('.btn-icon');
  if (!state.running) {
    btnText.textContent = 'START';
    btnIcon.textContent = '▶';
    startBtn.className = 'btn btn-start stopped';
  } else if (state.paused) {
    btnText.textContent = 'RESUME';
    btnIcon.textContent = '▶';
    startBtn.className = 'btn btn-start paused';
  } else {
    btnText.textContent = 'PAUSE';
    btnIcon.textContent = '⏸';
    startBtn.className = 'btn btn-start running';
  }
}

// ── Timer tick ─────────────────────────────────────────
function tick() {
  const now   = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;

  state.timers.forEach((t, i) => {
    if (t.mode === 'countup') {
      t.elapsed += delta;
    } else {
      // countdown — auto-restart (loop) when it hits zero
      t.remaining -= delta / 1000;
      if (t.remaining <= 0) {
        playSound(t.sound);
        vibrateDevice();
        // reset and keep going — loop!
        t.remaining = t.duration + t.remaining; // carry over overshoot
        if (t.remaining <= 0) t.remaining = t.duration; // safety
        t.lastWarnSecond = -1; // reset warn tracker on each new loop
      }

      // ── Last-5-second warning cues ──
      if (t.remaining <= 5 && t.remaining > 0) {
        const wholeSecond = Math.ceil(t.remaining); // 5,4,3,2,1
        if (wholeSecond !== t.lastWarnSecond) {
          t.lastWarnSecond = wholeSecond;
          if (i === 0) playWarnGatekeeper();
          else         playWarnOverload();
        }
      } else if (t.remaining > 5) {
        t.lastWarnSecond = -1; // reset when back above 5s (after loop)
      }
    }

    renderTimer(i);
  });
}

function vibrateDevice() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

// ── Controls ───────────────────────────────────────────
startBtn.addEventListener('click', () => {
  // Resume audio context on first interaction
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  if (!state.running) {
    // ── START
    state.running = true;
    state.paused  = false;
    state.timers.forEach(t => { t.finished = false; });
    state.lastTick = Date.now();
    state.intervalId = setInterval(tick, 50);
    renderAll();

  } else if (!state.paused) {
    // ── PAUSE
    state.paused = true;
    clearInterval(state.intervalId);
    state.intervalId = null;
    renderAll();

  } else {
    // ── RESUME
    state.paused   = false;
    state.lastTick = Date.now();
    state.intervalId = setInterval(tick, 50);
    renderAll();
  }
});

resetBtn.addEventListener('click', () => {
  clearInterval(state.intervalId);
  state.running    = false;
  state.paused     = false;
  state.intervalId = null;

  state.timers.forEach(t => {
    t.elapsed   = 0;
    t.remaining = t.duration;
    t.finished  = false;
  });

  renderAll();
});

// ── Settings modal ─────────────────────────────────────
settingsBtn.addEventListener('click', openSettings);
modalClose.addEventListener('click',  closeSettings);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeSettings();
});

function openSettings() {
  const [t1, t2] = state.timers;

  name1Input.value = t1.label !== 'GATEKEEPER' ? t1.label : '';
  name2Input.value = t2.label !== 'OVERLOAD'   ? t2.label : '';

  setModeUI(1, t1.mode);
  setModeUI(2, t2.mode);

  const dur1 = t1.duration;
  h1.value = Math.floor(dur1 / 3600);
  m1.value = Math.floor((dur1 % 3600) / 60);
  s1.value = dur1 % 60;

  const dur2 = t2.duration;
  h2.value = Math.floor(dur2 / 3600);
  m2.value = Math.floor((dur2 % 3600) / 60);
  s2.value = dur2 % 60;

  sound1.value = t1.sound;
  sound2.value = t2.sound;

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function setModeUI(num, mode) {
  const countBtn = document.getElementById(`mode${num}Count`);
  const downBtn  = document.getElementById(`mode${num}Down`);
  const cdRow    = document.getElementById(`countdown${num}Row`);

  if (mode === 'countup') {
    countBtn.classList.add('active');
    downBtn.classList.remove('active');
    cdRow.style.display = 'none';
  } else {
    downBtn.classList.add('active');
    countBtn.classList.remove('active');
    cdRow.style.display = 'flex';
  }
}

// Mode toggles
[mode1Count, mode1Down, mode2Count, mode2Down].forEach(btn => {
  btn.addEventListener('click', () => {
    const num  = btn.dataset.timer;
    const mode = btn.dataset.mode;
    setModeUI(num, mode);
  });
});

saveSettings.addEventListener('click', () => {
  const [t1, t2] = state.timers;

  t1.label = name1Input.value.trim().toUpperCase() || 'GATEKEEPER';
  t2.label = name2Input.value.trim().toUpperCase() || 'OVERLOAD';

  t1.mode  = mode1Down.classList.contains('active') ? 'countdown' : 'countup';
  t2.mode  = mode2Down.classList.contains('active') ? 'countdown' : 'countup';

  t1.duration  = (parseInt(h1.value) || 0) * 3600 + (parseInt(m1.value) || 0) * 60 + (parseInt(s1.value) || 0);
  t2.duration  = (parseInt(h2.value) || 0) * 3600 + (parseInt(m2.value) || 0) * 60 + (parseInt(s2.value) || 0);
  if (t1.duration < 1) t1.duration = 50;
  if (t2.duration < 1) t2.duration = 25;

  t1.sound = sound1.value;
  t2.sound = sound2.value;

  // reset timers to new config
  clearInterval(state.intervalId);
  state.running    = false;
  state.paused     = false;
  state.intervalId = null;

  t1.elapsed   = 0; t1.remaining = t1.duration; t1.finished = false;
  t2.elapsed   = 0; t2.remaining = t2.duration; t2.finished = false;

  closeSettings();
  renderAll();
});

// ── Image injection API (called later when images are ready) ──
// Usage: setTimerImage(1, 'img/robot1.png')
//        setTimerImage(2, 'img/robot2.png')
window.setTimerImage = function(timerNum, src) {
  const card = timerNum === 1 ? timerCard1 : timerCard2;
  const robotDiv = card.querySelector('.robot-icon');

  const img = document.createElement('img');
  img.src = src;
  img.alt = `Timer ${timerNum} Robot`;
  img.className = 'robot-image';
  img.onerror = () => { /* fallback: keep CSS robot */ };

  robotDiv.innerHTML = '';
  robotDiv.appendChild(img);
};

// ── Wake Lock (keep screen on while running) ───────────
let wakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not critical */ }
  }
}
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible' && state.running) {
    await requestWakeLock();
  }
});
startBtn.addEventListener('click', () => {
  if (state.running) requestWakeLock();
});

// ── Init ───────────────────────────────────────────────
renderAll();
