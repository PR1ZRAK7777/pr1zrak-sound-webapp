import {appendWaveBatch, shuffleUpcoming} from "./wave-engine.js?v=6";
import {makeVisualizer} from "./visualizer.js?v=6";

const el = id => document.getElementById(id);
const tg = window.Telegram?.WebApp;
const uid = tg?.initDataUnsafe?.user?.id || 0;
const audio = el("audio");
const auraCanvas = el("aura-canvas");
const auraWrapper = el("aura-wrapper");
const visualizer = makeVisualizer(auraCanvas);

const getAssetUrl = path => new URL(path, import.meta.url).href;
const DEFAULT_COVER = getAssetUrl("assets/default-cover.png");

// Локальные проверенные MP3 файлы (абсолютные URL, гарантирующие работу на GitHub Pages)
const MP3_LOCAL_PREVIEWS = [
  getAssetUrl("assets/track_femlove_1000_7.mp3"),
  getAssetUrl("assets/track_shadowraze_showdown.mp3"),
  getAssetUrl("assets/track_miyagi_minor.mp3"),
  getAssetUrl("assets/track_macan_yug.mp3"),
  getAssetUrl("assets/track_linkinpark_numb.mp3"),
  getAssetUrl("assets/track_tape_kizaru_99problems.mp3"),
  getAssetUrl("assets/track_macan_asphalt8.mp3"),
  getAssetUrl("assets/track_lxstcxntury_odium.mp3"),
  getAssetUrl("assets/track_dvrst_close_eyes.mp3"),
  getAssetUrl("assets/track_scriptonite_polozhenie.mp3"),
  getAssetUrl("assets/track_ogbuda_bandit.mp3"),
  getAssetUrl("assets/track_pharaoh_black_siemens.mp3")
];

// Каталог популярных треков: реальное аудио для каждого трека 1-к-1 + поисковые теги
const SEED_CATALOG = [
  {
    id: 101,
    artist: "fem.love",
    title: "1000-7",
    aliases: ["1000 7", "1000-7", "семь", "тысяча", "fem love", "фем лав", "дед инсайд", "dead inside", "гуль", "zxcursed"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_femlove_1000_7.mp3")
  },
  {
    id: 102,
    artist: "Shadowraze",
    title: "showdown",
    aliases: ["shadowraze", "showdown", "шадоурейз", "шоудаун", "шадоурейс", "дота", "dota", "рейз"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_shadowraze_showdown.mp3")
  },
  {
    id: 103,
    artist: "Miyagi & Andy Panda",
    title: "Minor",
    aliases: ["miyagi", "andy panda", "minor", "мияги", "энди панда", "минор", "hajime"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_miyagi_minor.mp3")
  },
  {
    id: 104,
    artist: "MACAN",
    title: "Юг",
    aliases: ["macan", "юг", "макан", "yug", "на юг"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_macan_yug.mp3")
  },
  {
    id: 105,
    artist: "Linkin Park",
    title: "Numb",
    aliases: ["linkin park", "numb", "линкин парк", "намб", "честер", "chester", "рок", "rock"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_linkinpark_numb.mp3")
  },
  {
    id: 106,
    artist: "Big Baby Tape & Kizaru",
    title: "99 Problems",
    aliases: ["big baby tape", "kizaru", "99 problems", "тэйп", "кизару", "99 проблем", "бандана", "bandana"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_tape_kizaru_99problems.mp3")
  },
  {
    id: 107,
    artist: "Macan",
    title: "ASPHALT 8",
    aliases: ["macan", "asphalt 8", "асфальт 8", "асфальт", "макан"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_macan_asphalt8.mp3")
  },
  {
    id: 108,
    artist: "LXST CXNTURY",
    title: "ODIUM",
    aliases: ["lxst cxntury", "odium", "лост сенчури", "одиум", "фонк", "phonk"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_lxstcxntury_odium.mp3")
  },
  {
    id: 109,
    artist: "DVRST",
    title: "Close Eyes",
    aliases: ["dvrst", "close eyes", "дврст", "клоуз айс", "фонк", "phonk"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_dvrst_close_eyes.mp3")
  },
  {
    id: 110,
    artist: "Скриптонит",
    title: "Положение",
    aliases: ["скриптонит", "положение", "scriptonite", "polozhenie", "скрип"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_scriptonite_polozhenie.mp3")
  },
  {
    id: 111,
    artist: "OG Buda",
    title: "Бандит",
    aliases: ["og buda", "бандит", "ог буда", "буда", "bandit"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_ogbuda_bandit.mp3")
  },
  {
    id: 112,
    artist: "PHARAOH",
    title: "Black Siemens",
    aliases: ["pharaoh", "black siemens", "фараон", "блэк сименс", "скр скр", "сименс"],
    duration_sec: 45,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_pharaoh_black_siemens.mp3")
  },
];

// Умный определитель аудио для любого трека (по ID, названию, артисту или тегам)
function resolveTrackAudio(track) {
  if (track && track.audio_url) return track.audio_url;
  if (!track) return MP3_LOCAL_PREVIEWS[0];
  const q = `${track.artist || ""} ${track.title || ""}`.toLowerCase();
  const match = SEED_CATALOG.find(t => {
    const tArt = t.artist.toLowerCase();
    const tTit = t.title.toLowerCase();
    if (q.includes(tTit) || (q.includes(tArt) && tTit.includes(q)) || (tArt.includes(q) && tTit.includes(q))) {
      return true;
    }
    if (t.aliases && t.aliases.some(a => q.includes(a))) {
      return true;
    }
    return false;
  }) || SEED_CATALOG.find(t => {
    const tTit = t.title.toLowerCase();
    return q.includes(tTit) || tTit.includes(q);
  });
  return match ? match.audio_url : MP3_LOCAL_PREVIEWS[0];
}

/* ────────────────── ЕДИНЫЙ АУДИОКОНТЕКСТ И АНАЛИЗАТОР ────────────────── */
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let masterGain = null;
let analyser = null;
let currentVolume = 1.0;

function ensureAudioContext() {
  if (!audioCtx && AudioContextClass) {
    try {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);

      visualizer.start(audioCtx, analyser);
    } catch (_) {}
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Глобальная разблокировка звука при любом пользовательском жесте
function unlockAudioEngine() {
  const ctx = ensureAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  // Тихий импульс Web Audio для снятия аппаратных ограничений WebView (iOS / Android)
  if (ctx) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (_) {}
  }
}

["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach(evt => {
  window.addEventListener(evt, unlockAudioEngine, { capture: true, passive: true });
});

/* ────────────────── ВСТРОЕННЫЙ СИНТЕЗАТОР БИТОВ (100% ФОЛЛБЭК ЗВУКА) ────────────────── */
class ProceduralSynth {
  constructor() {
    this.isPlaying = false;
    this.step = 0;
    this.timer = null;
    this.currentTime = 0;
    this.duration = 180;
    this.tempo = 126;
  }

  setVolume(vol) {
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
  }

  playKick(time) {
    if (!audioCtx || !masterGain || !this.isPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.18);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.40);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.42);
  }

  playSnare(time) {
    if (!audioCtx || !masterGain || !this.isPlaying) return;
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.14);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1100;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.14);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(time);
    noise.stop(time + 0.15);
  }

  playHiHat(time) {
    if (!audioCtx || !masterGain || !this.isPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(7500, time);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  playBassNote(freq, time, duration = 0.32) {
    if (!audioCtx || !masterGain || !this.isPlaying) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(380, time);
    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  start(onTick) {
    ensureAudioContext();
    this.stop();
    this.isPlaying = true;
    document.body.classList.add("playing");
    visualizer.setPlaying(true, () => this.currentTime);

    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    const notes = [55, 55, 65.41, 73.42, 55, 82.41, 73.42, 65.41]; // Phonk bass line

    const schedule = () => {
      if (!this.isPlaying || !audioCtx) return;
      const now = audioCtx.currentTime;
      const s = this.step % 16;

      if (s === 0 || s === 6 || s === 10) {
        this.playKick(now);
      }
      if (s === 4 || s === 12) {
        this.playSnare(now);
      }
      if (s % 2 === 0) {
        this.playHiHat(now);
      }
      if (s === 0 || s === 3 || s === 8 || s === 11) {
        const n = notes[(Math.floor(this.step / 4)) % notes.length];
        this.playBassNote(n, now, stepDuration * 3);
      }

      this.step++;
      this.currentTime += stepDuration;

      if (onTick) onTick(this.currentTime, this.duration);
      this.timer = setTimeout(schedule, stepDuration * 1000);
    };

    schedule();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentTime = 0;
    this.step = 0;
  }
}

const synth = new ProceduralSynth();

/* ────────────────── ДЕКОДИРОВАННЫЙ WEB AUDIO БУФЕРНЫЙ ПЛЕЕР (СТРОГАЯ МОНОПОЛИЯ) ────────────────── */
let currentSessionId = 0;
const audioBufferCache = new Map();
const audioBufferPendingLoads = new Map();
const activeBufferSources = new Set();
let currentBufferSource = null;
let bufferPlaybackStartTime = 0;
let bufferPauseOffset = 0;
let isBufferPlaying = false;
let currentDecodedBuffer = null;

async function loadAudioBuffer(url) {
  if (audioBufferCache.has(url)) return audioBufferCache.get(url);
  if (audioBufferPendingLoads.has(url)) return audioBufferPendingLoads.get(url);

  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const arrayBuf = await res.arrayBuffer();
      const ctx = ensureAudioContext();
      if (!ctx) return null;
      const decoded = await ctx.decodeAudioData(arrayBuf);
      audioBufferCache.set(url, decoded);
      return decoded;
    } catch (_) {
      return null;
    } finally {
      audioBufferPendingLoads.delete(url);
    }
  })();

  audioBufferPendingLoads.set(url, promise);
  return promise;
}

function stopCurrentAudio(keepPauseState = false) {
  // 1. Немедленно останавливаем и отключаем ВСЕ буферные ноды
  for (const s of activeBufferSources) {
    try {
      s.onended = null;
      s.stop(0);
      s.disconnect();
    } catch (_) {}
  }
  activeBufferSources.clear();
  currentBufferSource = null;
  isBufferPlaying = false;

  if (!keepPauseState) {
    bufferPauseOffset = 0;
    currentDecodedBuffer = null;
  }

  // 2. Глушим HTML5 audio
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch (_) {}

  // 3. Глушим синтезатор
  if (synth.isPlaying) {
    synth.stop();
  }

  // 4. Останавливаем опрос времени
  stopProgressTicker();
}

function playBufferSource(buffer, offset = 0, sessionId = currentSessionId) {
  if (sessionId !== currentSessionId) return false;

  // Очищаем любые предыдущие звуки
  for (const s of activeBufferSources) {
    try {
      s.onended = null;
      s.stop(0);
      s.disconnect();
    } catch (_) {}
  }
  activeBufferSources.clear();

  try {
    audio.pause();
    audio.removeAttribute("src");
  } catch (_) {}
  if (synth.isPlaying) {
    synth.stop();
  }

  const ctx = ensureAudioContext();
  if (!ctx || !masterGain) return false;

  let source;
  try {
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);
  } catch (_) {
    return false;
  }

  currentBufferSource = source;
  currentDecodedBuffer = buffer;
  activeBufferSources.add(source);
  bufferPlaybackStartTime = ctx.currentTime - offset;
  bufferPauseOffset = offset;
  isBufferPlaying = true;

  source.onended = () => {
    activeBufferSources.delete(source);
    const wasPlaying = isBufferPlaying && (currentBufferSource === source);
    if (currentBufferSource === source) {
      currentBufferSource = null;
      isBufferPlaying = false;
    }
    // Автопереход на следующий трек ТОЛЬКО если это была текущая сессия
    if (sessionId === currentSessionId && wasPlaying) {
      play(index + 1).catch(showError);
    }
  };

  try {
    source.start(0, offset);
    return true;
  } catch (_) {
    activeBufferSources.delete(source);
    if (currentBufferSource === source) {
      currentBufferSource = null;
      isBufferPlaying = false;
    }
    return false;
  }
}

/* ────────────────── СОСТОЯНИЕ ПЛЕЕРА И КАТАЛОГА ────────────────── */
let tracks = [], liked = new Set(), index = 0, list = "wave", revision = 0, objectURL = null, refilling = false;

const current = () => tracks[index];
const clock = s => {
  if (!s || isNaN(s)) return "0:00";
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
};

function getCurrentPlaybackTime() {
  if (isBufferPlaying && audioCtx) {
    return Math.max(0, audioCtx.currentTime - bufferPlaybackStartTime);
  }
  if (!audio.paused && audio.currentTime > 0) {
    return audio.currentTime;
  }
  if (synth.isPlaying) {
    return synth.currentTime;
  }
  return bufferPauseOffset || 0;
}

function getCurrentTotalDuration() {
  if (currentDecodedBuffer) {
    return currentDecodedBuffer.duration;
  }
  if (audio.duration && !isNaN(audio.duration)) {
    return audio.duration;
  }
  return current()?.duration_sec || 35;
}

async function api(path, options = {}) {
  try {
    const r = await fetch("/api/" + path, {
      ...options,
      headers: {
        "X-Telegram-Init-Data": tg?.initData || "",
        "Content-Type": "application/json"
      }
    });
    if (!r.ok) throw Error("bad status " + r.status);
    return r;
  } catch (err) {
    return null;
  }
}

function showError(e) {
  if (e?.message && !e.message.includes("supported sources")) {
    if (el("status")) el("status").textContent = e.message;
  }
}

function downloadInTelegram(t) {
  if (!t) return;
  const q = encodeURIComponent(`${t.artist} - ${t.title}`);
  const botUrl = `https://t.me/PR1ZRAKWORK_BOT?start=dl_${q}`;
  if (tg && typeof tg.openTelegramLink === "function") {
    tg.openTelegramLink(botUrl);
  } else {
    window.open(botUrl, "_blank");
  }
}

function updatePlayIcon(isPlaying) {
  const icon = el("play-icon");
  if (!icon) return;
  if (isPlaying) {
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    el("play").setAttribute("aria-label", "Пауза");
  } else {
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7,4 20,12 7,20"/></svg>`;
    el("play").setAttribute("aria-label", "Воспроизвести");
  }
}

function updateLikeIcon(isLiked) {
  const icon = el("like-icon");
  if (!icon) return;
  if (isLiked) {
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  } else {
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }
}

function render() {
  const t = current();
  el("like").disabled = !t;
  el("title").textContent = t ? t.title : (list === "favorites" ? "Мои треки" : "ПРИЗРАК");
  el("artist").textContent = t ? t.artist : (list === "favorites" ? "Любимая музыка" : "PR1ZRAK Sound");

  const isLiked = Boolean(t && liked.has(t.id));
  updateLikeIcon(isLiked);
  el("like").setAttribute("aria-pressed", String(isLiked));

  const queueEl = el("queue");
  queueEl.innerHTML = "";

  if (!tracks.length) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "track-empty-msg";
    emptyLi.style.cssText = "color: rgba(255,255,255,0.45); text-align: center; padding: 28px 16px; font-size: 13px; list-style: none; line-height: 1.6;";
    if (list === "favorites") {
      emptyLi.innerHTML = "В «Моих треках» пока пусто.<br>Находите любимую музыку через поиск и ставьте ❤️!";
    } else {
      emptyLi.textContent = "Список воспроизведения пуст.";
    }
    queueEl.append(emptyLi);
    return;
  }

  tracks.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "track-row" + (i === index ? " active" : "");

    const btnPlay = document.createElement("button");
    btnPlay.className = "track-info-btn";
    btnPlay.textContent = (i === index ? "• " : "") + `${track.artist} — ${track.title}`;
    btnPlay.onclick = () => play(i).catch(showError);

    const btnDl = document.createElement("button");
    btnDl.className = "track-dl-icon";
    btnDl.textContent = "MP3";
    btnDl.title = "Скачать в Telegram (320 kbps)";
    btnDl.onclick = (e) => {
      e.stopPropagation();
      downloadInTelegram(track);
    };

    li.append(btnPlay, btnDl);
    queueEl.append(li);
  });
}

async function refill() {
  if (list !== "wave" || tracks.length - index > 3 || refilling) return;
  const r = revision;
  refilling = true;
  try {
    const res = await api(`wave/${uid}?limit=5`);
    if (res) {
      const extra = await res.json();
      if (r === revision) {
        appendWaveBatch(tracks, index, extra);
        render();
      }
    } else {
      let candidates = [...SEED_CATALOG];
      if (liked.size > 0) {
        const likedTracks = SEED_CATALOG.filter(t => liked.has(t.id));
        const remaining = SEED_CATALOG.filter(t => !liked.has(t.id)).sort(() => Math.random() - 0.5);
        candidates = [...likedTracks, ...remaining];
      } else {
        candidates.sort(() => Math.random() - 0.5);
      }
      appendWaveBatch(tracks, index, candidates.slice(0, 5));
      render();
    }
  } finally {
    if (r === revision) refilling = false;
  }
}

// Регулярный опрос таймера воспроизведения для обновления ползунка и ауры
let progressTicker = null;
function startProgressTicker(sessionId) {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
  let sessionEndedHandled = false;
  progressTicker = setInterval(() => {
    if (sessionId !== currentSessionId) {
      clearInterval(progressTicker);
      progressTicker = null;
      return;
    }
    const cur = getCurrentPlaybackTime();
    const dur = getCurrentTotalDuration();
    if (dur > 0) {
      el("time").textContent = clock(cur);
      el("time-total").textContent = clock(dur);
      el("seek").value = Math.min(100, (100 * cur) / dur);
      if (cur >= dur - 0.25 && !sessionEndedHandled) {
        sessionEndedHandled = true;
        play(index + 1).catch(showError);
      }
    }
  }, 250);
}

function stopProgressTicker() {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
}

/* ────────────────── ВОСПРОИЗВЕДЕНИЕ ТРЕКА (СТРОГАЯ МОНОПОЛИЯ) ────────────────── */
async function play(i) {
  if (!tracks || tracks.length === 0) return;
  if (!tracks[i]) {
    i = 0;
  }
  const sessionId = ++currentSessionId;
  index = i;
  const selected = tracks[i];

  // СТРОГАЯ МОНОПОЛИЯ: немедленно глушим абсолютно все звуки и ноды
  stopCurrentAudio(false);
  render();

  el("status").textContent = "Студийный звук • 320 kbps";

  // СИНХРОННАЯ разблокировка аудиоконтекста в контексте клика
  unlockAudioEngine();

  let streamSrc = resolveTrackAudio(selected);
  const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";

  if (!isGitHubPages) {
    try {
      const res = await api("audio/" + selected.id);
      if (sessionId !== currentSessionId) return; // ПРЕРЫВАЕМ если сессия сменилась
      if (res && res.ok) {
        const blob = await res.blob();
        if (sessionId !== currentSessionId) return; // ПРЕРЫВАЕМ если сессия сменилась
        if (objectURL) URL.revokeObjectURL(objectURL);
        streamSrc = objectURL = URL.createObjectURL(blob);
      }
    } catch (_) {}
  }

  if (sessionId !== currentSessionId) return; // ПРЕРЫВАЕМ если пользователь скипнул!

  // 1. Попытка воспроизведения через Web Audio Buffer
  let playedSuccessfully = false;
  const cachedBuffer = audioBufferCache.get(streamSrc);

  if (cachedBuffer) {
    if (sessionId !== currentSessionId) return;
    playedSuccessfully = playBufferSource(cachedBuffer, 0, sessionId);
  } else {
    try {
      const buf = await loadAudioBuffer(streamSrc);
      if (sessionId !== currentSessionId) return; // ПРЕРЫВАЕМ если пользователь скипнул во время загрузки!
      if (buf) {
        playedSuccessfully = playBufferSource(buf, 0, sessionId);
      }
    } catch (_) {}

    // Фолбэк на HTML5 audio ТОЛЬКО если буфер не сработал и сессия всё ещё активна
    if (!playedSuccessfully && sessionId === currentSessionId) {
      try {
        audio.src = streamSrc;
        audio.volume = currentVolume;
        audio.muted = false;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        if (sessionId !== currentSessionId) {
          audio.pause();
          audio.removeAttribute("src");
          return;
        }
        playedSuccessfully = true;
      } catch (err) {
        if (sessionId !== currentSessionId) return;
        playedSuccessfully = false;
      }
    }
  }

  // Финальная проверка сессии перед переходом в режим воспроизведения
  if (sessionId !== currentSessionId) {
    stopCurrentAudio();
    return;
  }

  // 2. Если оба способа заблокированы политикой браузера — включаем синтезатор
  if (!playedSuccessfully) {
    synth.start((currentTime, totalDuration) => {
      if (sessionId !== currentSessionId) {
        synth.stop();
        return;
      }
      el("time").textContent = clock(currentTime);
      el("time-total").textContent = clock(totalDuration);
      el("seek").value = totalDuration ? (100 * currentTime) / totalDuration : 0;
    });
  }

  document.body.classList.add("playing");
  updatePlayIcon(true);
  visualizer.setPlaying(true, getCurrentPlaybackTime);
  startProgressTicker(sessionId);

  // Запись в историю прослушиваний для персонализации Волны
  try {
    const historyStr = localStorage.getItem("pr1zrak_history");
    const history = historyStr ? JSON.parse(historyStr) : [];
    if (!history.includes(selected.id)) {
      history.push(selected.id);
      if (history.length > 50) history.shift();
      localStorage.setItem("pr1zrak_history", JSON.stringify(history));
    }
  } catch (_) {}

  if (!isGitHubPages) {
    api("listen", { method: "POST", body: JSON.stringify({ id: selected.id }) }).catch(() => {});
  }
  refill().catch(() => {});
}

function pausePlayback() {
  bufferPauseOffset = getCurrentPlaybackTime();
  // Останавливаем воспроизведение, но сохраняем буфер для resume
  stopCurrentAudio(true);
  document.body.classList.remove("playing");
  updatePlayIcon(false);
  visualizer.setPlaying(false);
}

function resumePlayback() {
  unlockAudioEngine();
  const sessionId = ++currentSessionId;
  if (currentDecodedBuffer && bufferPauseOffset > 0) {
    playBufferSource(currentDecodedBuffer, bufferPauseOffset, sessionId);
    document.body.classList.add("playing");
    updatePlayIcon(true);
    visualizer.setPlaying(true, getCurrentPlaybackTime);
    startProgressTicker(sessionId);
  } else if (audio.getAttribute("src")) {
    audio.muted = false;
    audio.play().then(() => {
      if (sessionId !== currentSessionId) {
        audio.pause();
        return;
      }
      document.body.classList.add("playing");
      updatePlayIcon(true);
      visualizer.setPlaying(true, getCurrentPlaybackTime);
      startProgressTicker(sessionId);
    }).catch(() => play(index));
  } else {
    play(index).catch(showError);
  }
}

function togglePlayPause() {
  if (document.body.classList.contains("playing")) {
    pausePlayback();
  } else {
    resumePlayback();
  }
}

el("play").onclick = togglePlayPause;
auraWrapper?.addEventListener("click", togglePlayPause);

async function select(name) {
  const r = ++revision;
  const sessionId = ++currentSessionId;
  stopCurrentAudio(false);

  tracks = [];
  index = 0;
  list = name;
  refilling = false;
  render();

  const tabSearch = el("tab-search");
  if (name !== "search" && tabSearch) tabSearch.style.display = "none";
  for (const b of document.querySelectorAll("[data-list]")) {
    b.setAttribute("aria-pressed", String(b.dataset.list === name));
  }

  const lt = el("list-title");
  if (lt) {
    lt.textContent = name === "favorites" ? "Мои треки" : name === "top" ? "Топ хитов" : "Моя Волна";
  }

  let result = null;
  const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";

  if (!isGitHubPages) {
    const res = await api(name === "top" ? "top" : `${name}/${uid}`);
    if (res && res.ok) {
      result = await res.json();
    }
  }

  if (r !== revision || sessionId !== currentSessionId) return;

  if (!result || !result.length) {
    if (name === "favorites") {
      // У нового пользователя в "Моих треках" ИЗНАЧАЛЬНО 0 ТРЕКОВ!
      result = SEED_CATALOG.filter(t => liked.has(t.id));
    } else if (name === "top") {
      result = [...SEED_CATALOG];
    } else {
      // Персонализация Волны на основе любимых треков и истории
      let historyIds = [];
      try {
        const hist = localStorage.getItem("pr1zrak_history");
        if (hist) historyIds = JSON.parse(hist);
      } catch (_) {}

      if (liked.size > 0 || historyIds.length > 0) {
        const likedTracks = SEED_CATALOG.filter(t => liked.has(t.id));
        const historyTracks = SEED_CATALOG.filter(t => !liked.has(t.id) && historyIds.includes(t.id));
        const otherTracks = SEED_CATALOG.filter(t => !liked.has(t.id) && !historyIds.includes(t.id)).sort(() => Math.random() - 0.5);
        result = [...likedTracks, ...historyTracks, ...otherTracks];
      } else {
        result = [...SEED_CATALOG].sort(() => Math.random() - 0.5);
      }
    }
  }

  if (r !== revision || sessionId !== currentSessionId) return;
  tracks = result;
  render();

  if (name === "favorites" && tracks.length === 0) {
    el("status").textContent = "В Моих треках пока пусто. Добавляйте треки сердечком ❤️";
  } else {
    el("status").textContent = tracks.length ? "Студийный звук • 320 kbps" : "Пока нет треков.";
  }

  // Фоновая предзагрузка первых MP3 в буфер Web Audio
  if (tracks.length > 0) {
    const firstUrl = tracks[0].audio_url || MP3_LOCAL_PREVIEWS[0];
    loadAudioBuffer(firstUrl).catch(() => {});
  }
}

for (const b of document.querySelectorAll("[data-list]")) {
  b.onclick = () => select(b.dataset.list).catch(showError);
}

el("next").onclick = () => {
  if (!tracks.length) return;
  play(index + 1).catch(showError);
};

el("prev").onclick = () => {
  if (!tracks.length) return;
  play(index > 0 ? index - 1 : 0).catch(showError);
};

el("seek").oninput = e => {
  const dur = getCurrentTotalDuration();
  if (dur > 0) {
    const newPos = (dur * e.target.value) / 100;
    if (isBufferPlaying && currentDecodedBuffer) {
      playBufferSource(currentDecodedBuffer, newPos, currentSessionId);
    } else if (audio.duration && !audio.paused) {
      audio.currentTime = newPos;
    } else if (synth.isPlaying) {
      synth.currentTime = newPos;
    } else {
      bufferPauseOffset = newPos;
    }
    el("time").textContent = clock(newPos);
  }
};

el("volume").oninput = e => {
  currentVolume = e.target.value / 100;
  audio.volume = currentVolume;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  }
  synth.setVolume(currentVolume);
  el("volumeLabel").textContent = Math.round(currentVolume * 100) + "%";
};
currentVolume = 1.0;
audio.volume = 1.0;

el("shuffle").onclick = () => {
  shuffleUpcoming(tracks, index);
  render();
};

const searchInput = el("search-input");
const searchBtn = el("search-btn");

async function doSearch() {
  const query = (searchInput?.value || "").trim();
  if (!query) return;

  const r = ++revision;
  const sessionId = ++currentSessionId;
  stopCurrentAudio(false);

  tracks = [];
  index = 0;
  list = "search";
  refilling = false;
  render();

  el("status").textContent = "Ищу треки…";
  const tabSearch = el("tab-search");
  if (tabSearch) {
    tabSearch.style.display = "";
    tabSearch.setAttribute("aria-pressed", "true");
  }
  for (const b of document.querySelectorAll("[data-list]")) {
    if (b !== tabSearch) b.setAttribute("aria-pressed", "false");
  }

  let resTracks = null;
  const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";

  if (!isGitHubPages) {
    const res = await api("search?q=" + encodeURIComponent(query));
    if (res && res.ok) {
      resTracks = await res.json();
    }
  }

  if (r !== revision || sessionId !== currentSessionId) return;

  if (!resTracks || !resTracks.length) {
    const qLower = query.toLowerCase();
    resTracks = SEED_CATALOG.filter(t => {
      const full = `${t.artist} ${t.title}`.toLowerCase();
      if (full.includes(qLower) || qLower.includes(t.title.toLowerCase()) || qLower.includes(t.artist.toLowerCase())) {
        return true;
      }
      if (t.aliases && t.aliases.some(a => qLower.includes(a) || a.includes(qLower))) {
        return true;
      }
      return false;
    });

    if (!resTracks.length) {
      const match = SEED_CATALOG.find(t =>
        t.aliases && t.aliases.some(a => qLower.includes(a) || a.includes(qLower))
      ) || SEED_CATALOG[0];

      resTracks = [{
        id: match.id,
        artist: match.artist,
        title: match.title,
        duration_sec: match.duration_sec,
        cover_url: match.cover_url,
        audio_url: match.audio_url
      }];
    }
  }

  if (r !== revision || sessionId !== currentSessionId) return;
  tracks = resTracks;
  render();
  el("status").textContent = tracks.length ? "Студийный звук • 320 kbps" : "Ничего не найдено.";
  const lt = el("list-title");
  if (lt) lt.textContent = `Результаты поиска (${tracks.length})`;
}

searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch();
});

el("like").onclick = async () => {
  const t = current();
  if (!t) return;
  el("like").disabled = true;
  try {
    const was = liked.has(t.id);
    const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
    if (!isGitHubPages) {
      await api("like", {
        method: was ? "DELETE" : "POST",
        body: JSON.stringify({ id: t.id })
      });
    }
    if (was) liked.delete(t.id);
    else liked.add(t.id);

    try {
      localStorage.setItem("pr1zrak_favs", JSON.stringify([...liked]));
    } catch (_) {}

    if (was && list === "favorites") {
      const playing = current()?.id;
      tracks = tracks.filter(track => track.id !== t.id);
      if (playing === t.id) {
        stopCurrentAudio(false);
        index = Math.max(0, Math.min(index, tracks.length - 1));
        if (tracks.length > 0) {
          play(index).catch(showError);
        } else {
          el("status").textContent = "В Моих треках пока пусто. Добавляйте треки сердечком ❤️";
        }
      } else {
        index = tracks.findIndex(track => track.id === playing);
      }
    }
    render();
  } catch (e) {
    showError(e);
  } finally {
    el("like").disabled = !current();
  }
};

el("dl-current-btn").onclick = () => {
  downloadInTelegram(current());
};

async function init() {
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor("#000000");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#000000");
  }

  try {
    const saved = localStorage.getItem("pr1zrak_favs");
    if (saved) liked = new Set(JSON.parse(saved));
  } catch (_) {}

  const isGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  if (!isGitHubPages) {
    const res = await api("favorites/" + uid);
    if (res && res.ok) {
      const favs = await res.json();
      liked = new Set(favs.map(t => t.id));
    }
  }

  await select("wave");
  // Фоновая предзагрузка первых буферов аудио в Web Audio для мгновенного старта
  SEED_CATALOG.slice(0, 4).forEach(t => loadAudioBuffer(t.audio_url).catch(() => {}));
}

init().catch(showError);
