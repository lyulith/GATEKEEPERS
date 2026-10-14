/* =====================================================
   DUAL TIMER — app.js
   Gatekeeper: up to 4 configurable countdown cycles
   Overload: existing single-duration looping timer
   ===================================================== */

// ── State ──────────────────────────────────────────────
const state = {
  running: false,
  paused: false,
  intervalId: null,
  lastTick: null,

  timers: [
    {
      id: 1,
      label: 'GATEKEEPER',
      mode: 'countdown',
      elapsed: 0,
      duration: 50,
      remaining: 50,
      sound: 'beep',
      finished: false,
      lastWarnSecond: -1,

      // Gatekeeper cycle configuration
      cycles: [50, 45, 40, 35],
      activeCycle: 0,
    },
    {
      id: 2,
      label: 'OVERLOAD',
      mode: 'countdown',
      elapsed: 0,
      duration: 25,
      remaining: 25,
      sound: 'beep',
      finished: false,
      lastWarnSecond: -1,
    },
  ],
};

// ── DOM refs ───────────────────────────────────────────
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const settingsBtn = document.getElementById('settingsBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const saveSettings = document.getElementById('saveSettings');

const timerDisplay1 = document.getElementById('timerDisplay1');
const timerDisplay2 = document.getElementById('timerDisplay2');
const timerStatus1 = document.getElementById('timerStatus1');
const timerStatus2 = document.getElementById('timerStatus2');
const timerLabel1 = document.getElementById('timerLabel1');
const timerLabel2 = document.getElementById('timerLabel2');
const timerCard1 = document.getElementById('timerCard1');
const timerCard2 = document.getElementById('timerCard2');

const name1Input = document.getElementById('name1Input');
const name2Input = document.getElementById('name2Input');

const mode1Count = document.getElementById('mode1Count');
const mode1Down = document.getElementById('mode1Down');
const mode2Count = document.getElementById('mode2Count');
const mode2Down = document.getElementById('mode2Down');

const countdown1Row = document.getElementById('countdown1Row');
const countdown2Row = document.getElementById('countdown2Row');

const sound1 = document.getElementById('sound1');
const sound2 = document.getElementById('sound2');

const h1 = document.getElementById('h1');
const m1 = document.getElementById('m1');
const s1 = document.getElementById('s1');

const h2 = document.getElementById('h2');
const m2 = document.getElementById('m2');
const s2 = document.getElementById('s2');

// The HTML must provide these four optional cycle fields.
// Each is a group of hours/minutes/seconds inputs.
// See the HTML changes below.
const cycleInputs = [
  {
    h: document.getElementById('h1'),
    m: document.getElementById('m1'),
    s: document.getElementById('s1'),
  },
  {
    h: document.getElementById('h1c2'),
    m: document.getElementById('m1c2'),
    s: document.getElementById('s1c2'),
  },
  {
    h: document.getElementById('h1c3'),
    m: document.getElementById('m1c3'),
    s: document.getElementById('s1c3'),
  },
  {
    h: document.getElementById('h1c4'),
    m: document.getElementById('m1c4'),
    s: document.getElementById('s1c4'),
  },
];

const cycles1Count = document.getElementById('cycles1Count');

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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001, ctx.currentTime + 0.4
      );

      osc.start();
      osc.stop(ctx.currentTime + 0.4);

    } else if (type === 'chime') {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.15;

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(
          0.001, start + 0.5
        );

        osc.start(start);
        osc.stop(start + 0.5);
      });

    } else if (type === 'alarm') {
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.25;

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, start);
        osc.frequency.setValueAtTime(660, start + 0.1);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(
          0.001, start + 0.2
        );

        osc.start(start);
        osc.stop(start + 0.22);
      }
    }
  } catch (e) {
    // Silent fail if audio is unavailable.
  }
}

// Gatekeeper warning: deep resonant thud
function playWarnGatekeeper() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      80, ctx.currentTime + 0.18
    );
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001, ctx.currentTime + 0.35
    );

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

// Overload warning: two fast high pips
function playWarnOverload() {
  try {
    const ctx = getAudioCtx();

    [0, 0.12].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, start);
      osc.frequency.exponentialRampToValueAtTime(
        1600, start + 0.07
      );
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(
        0.001, start + 0.1
      );

      osc.start(start);
      osc.stop(start + 0.11);
    });
  } catch (e) {}
}

// ── Formatting ─────────────────────────────────────────
function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  const pad = n => String(n).padStart(2, '0');

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatMs(ms) {
  return formatTime(Math.floor(ms / 1000));
}

function readDuration(hours, minutes, seconds) {
  return (
    (parseInt(hours.value, 10) || 0) * 3600 +
    (parseInt(minutes.value, 10) || 0) * 60 +
    (parseInt(seconds.value, 10) || 0)
  );
}

function writeDuration(inputs, duration) {
  inputs.h.value = Math.floor(duration / 3600);
  inputs.m.value = Math.floor((duration % 3600) / 60);
  inputs.s.value = duration % 60;
}

// ── Render ─────────────────────────────────────────────
const displays = [timerDisplay1, timerDisplay2];
const statuses = [timerStatus1, timerStatus2];
const labels = [timerLabel1, timerLabel2];
const cards = [timerCard1, timerCard2];

function renderTimer(i) {
  const t = state.timers[i];
  const display = displays[i];
  const status = statuses[i];
  const label = labels[i];
  const card = cards[i];

  label.textContent = t.label;

  display.textContent = t.mode === 'countup'
    ? formatMs(t.elapsed)
    : formatTime(t.remaining);

  card.classList.toggle(
    'running',
    state.running && !state.paused
  );

  // Last five seconds: existing warning class + white/red display styling.
  const isWarning =
    state.running &&
    !state.paused &&
    t.mode === 'countdown' &&
    t.remaining <= 5 &&
    t.remaining > 0;

  card.classList.toggle('warning', isWarning);
  display.classList.toggle('warning', isWarning);
  display.classList.remove('finished');

  if (state.running && !state.paused) {
    status.textContent = 'RUNNING';
  } else if (state.paused) {
    status.textContent = 'PAUSED';
  } else {
    status.textContent = 'READY';
  }

  status.className = 'timer-status';

  // Optional cycle indicator, if added to the HTML.
  const cycleStatus = document.getElementById(`timerCycle${i + 1}`);

  if (cycleStatus) {
    cycleStatus.textContent = i === 0 && t.mode === 'countdown'
      ? `CYCLE ${t.activeCycle + 1} / ${t.cycles.length}`
      : '';
  }
}

function renderAll() {
  state.timers.forEach((_, i) => renderTimer(i));

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

// ── Gatekeeper cycle handling ──────────────────────────
function advanceGatekeeperCycle(t) {
  const nextCycle = (t.activeCycle + 1) % t.cycles.length;

  t.activeCycle = nextCycle;
  t.duration = t.cycles[nextCycle];
  t.remaining = t.duration;
  t.lastWarnSecond = -1;
}

// ── Timer tick ─────────────────────────────────────────
function tick() {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;

  state.timers.forEach((t, i) => {
    if (t.mode === 'countup') {
      t.elapsed += delta;
    } else {
      t.remaining -= delta / 1000;

      if (t.remaining <= 0) {
        playSound(t.sound);
        vibrateDevice();

        if (i === 0 && t.cycles && t.cycles.length > 0) {
          // Gatekeeper: advance through configured cycles,
          // then automatically restart from cycle 1.
          advanceGatekeeperCycle(t);
        } else {
          // Overload: preserve existing looping behavior,
          // including carrying forward any timing overshoot.
          t.remaining = t.duration + t.remaining;
          if (t.remaining <= 0) t.remaining = t.duration;
          t.lastWarnSecond = -1;
        }
      }

      // Last-five-second warning cues.
      if (t.remaining <= 5 && t.remaining > 0) {
        const wholeSecond = Math.ceil(t.remaining);

        if (wholeSecond !== t.lastWarnSecond) {
          t.lastWarnSecond = wholeSecond;

          if (i === 0) {
            playWarnGatekeeper();
          } else {
            playWarnOverload();
          }
        }
      } else if (t.remaining > 5) {
        t.lastWarnSecond = -1;
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
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (!state.running) {
    state.running = true;
    state.paused = false;
    state.timers.forEach(t => { t.finished = false; });
    state.lastTick = Date.now();
    state.intervalId = setInterval(tick, 50);
    renderAll();

  } else if (!state.paused) {
    state.paused = true;
    clearInterval(state.intervalId);
    state.intervalId = null;
    renderAll();

  } else {
    state.paused = false;
    state.lastTick = Date.now();
    state.intervalId = setInterval(tick, 50);
    renderAll();
  }
});

resetBtn.addEventListener('click', () => {
  clearInterval(state.intervalId);

  state.running = false;
  state.paused = false;
  state.intervalId = null;

  state.timers.forEach((t, i) => {
    t.elapsed = 0;
    t.finished = false;
    t.lastWarnSecond = -1;

    if (i === 0 && t.cycles) {
      t.activeCycle = 0;
      t.duration = t.cycles[0];
    }

    t.remaining = t.duration;
  });

  renderAll();
});

// ── Settings modal ─────────────────────────────────────
settingsBtn.addEventListener('click', openSettings);
modalClose.addEventListener('click', closeSettings);

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeSettings();
});

function openSettings() {
  const [t1, t2] = state.timers;

  name1Input.value = t1.label !== 'GATEKEEPER' ? t1.label : '';
  name2Input.value = t2.label !== 'OVERLOAD' ? t2.label : '';

  setModeUI(1, t1.mode);
  setModeUI(2, t2.mode);

 // Gatekeeper cycle settings.
cycleInputs.forEach((inputs, index) => {
  if (inputs.h && inputs.m && inputs.s) {
    const defaultCycles = [50, 45, 40, 35];
    const duration = t1.cycles[index] ?? defaultCycles[index];

    writeDuration(inputs, duration);
  }
});

// Restore the selected number of cycles.
if (cycles1Count) {
  cycles1Count.value = String(t1.cycles.length);
}

  // Preserve Overload's existing settings.
  writeDuration({ h: h2, m: m2, s: s2 }, t2.duration);

  // Keep the original Gatekeeper fields populated as a fallback.
  writeDuration({ h: h1, m: m1, s: s1 }, t1.cycles[0]);

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
  const downBtn = document.getElementById(`mode${num}Down`);
  const cdRow = document.getElementById(`countdown${num}Row`);

  if (mode === 'countup') {
    countBtn.classList.add('active');
    downBtn.classList.remove('active');
    cdRow.style.display = 'none';
  } else {
    downBtn.classList.add('active');
    countBtn.classList.remove('active');
    cdRow.style.display = 'flex';
  }

  // Optional wrapper for the four Gatekeeper cycle fields.
  const cyclesPanel = document.getElementById('gatekeeperCycles');

  if (num === 1 && cyclesPanel) {
    cyclesPanel.style.display = mode === 'countdown' ? 'block' : 'none';
  }
}

[mode1Count, mode1Down, mode2Count, mode2Down].forEach(btn => {
  btn.addEventListener('click', () => {
    setModeUI(btn.dataset.timer, btn.dataset.mode);
  });
});

saveSettings.addEventListener('click', () => {
  const [t1, t2] = state.timers;

  t1.label = name1Input.value.trim().toUpperCase() || 'GATEKEEPER';
  t2.label = name2Input.value.trim().toUpperCase() || 'OVERLOAD';

  t1.mode = mode1Down.classList.contains('active')
    ? 'countdown'
    : 'countup';

  t2.mode = mode2Down.classList.contains('active')
    ? 'countdown'
    : 'countup';

  // Save Gatekeeper cycles in order.
  // A blank or zero cycle is ignored; remaining cycles loop normally.
  const configuredCycles = cycleInputs
    .filter(inputs => inputs.h && inputs.m && inputs.s)
    .map(inputs => readDuration(inputs.h, inputs.m, inputs.s))
    .filter(duration => duration > 0);

  if (configuredCycles.length > 0) {
    t1.cycles = configuredCycles;
  } else {
    const fallback = readDuration(h1, m1, s1);
    t1.cycles = [fallback > 0 ? fallback : 50];
  }

  // Preserve Overload's single-duration behavior.
  t2.duration = readDuration(h2, m2, s2);
  if (t2.duration < 1) t2.duration = 25;

  t1.sound = sound1.value;
  t2.sound = sound2.value;

  // Stop and reset both timers after saving settings.
  clearInterval(state.intervalId);

  state.running = false;
  state.paused = false;
  state.intervalId = null;

  t1.activeCycle = 0;
  t1.duration = t1.cycles[0];
  t1.elapsed = 0;
  t1.remaining = t1.duration;
  t1.finished = false;
  t1.lastWarnSecond = -1;

  t2.elapsed = 0;
  t2.remaining = t2.duration;
  t2.finished = false;
  t2.lastWarnSecond = -1;

  closeSettings();
  renderAll();
});

// ── Image injection API ────────────────────────────────
window.setTimerImage = function(timerNum, src) {
  const card = timerNum === 1 ? timerCard1 : timerCard2;
  const robotDiv = card.querySelector('.robot-icon');

  const img = document.createElement('img');
  img.src = src;
  img.alt = `Timer ${timerNum} Robot`;
  img.className = 'robot-image';
  img.onerror = () => {};

  robotDiv.innerHTML = '';
  robotDiv.appendChild(img);
};

// ── Wake Lock ──────────────────────────────────────────
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
}

document.addEventListener('visibilitychange', async () => {
  if (
    wakeLock !== null &&
    document.visibilityState === 'visible' &&
    state.running
  ) {
    await requestWakeLock();
  }
});

startBtn.addEventListener('click', () => {
  if (state.running) requestWakeLock();
});

// ── Init ───────────────────────────────────────────────
renderAll();