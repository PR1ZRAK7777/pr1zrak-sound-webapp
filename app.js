import {createAppearance} from "./appearance.js?v=27";
import {API_BASE, checkPlayerAccess, fetchPlayerAudio, playerHeaders} from "./player-access.js?v=27";
import {appendWaveBatch, discoveryContext, waveProgress, WAVE_MIN_TRACKS, buildPersonalizedBatch, recordWaveCompletion, replaceWaveTail, shuffleUpcoming as shuffleQueue} from "./wave-engine.js?v=27";
import {makeVisualizer} from "./visualizer.js?v=27";
import {mergeLibrary, decodeHandoff, createLibraryStore} from "./library-storage.js?v=27";

const el = id => document.getElementById(id);
const tg = window.Telegram?.WebApp;
const uid = tg?.initDataUnsafe?.user?.id || 0;
const USE_BOT_API = document.documentElement.dataset.botApi === "true";
const audio = el("audio");
const auraCanvas = el("aura-canvas");
const auraWrapper = el("aura-wrapper");
const visualizer = makeVisualizer(auraCanvas);
const appearance = createAppearance(visualizer);

const getAssetUrl = path => path.endsWith(".mp3") && API_BASE
  ? API_BASE + "/api/assets/" + path.split("/").pop() : new URL(path, import.meta.url).href;
let accessGranted = false;
let accessChecking = null;
async function validateAccess() {
  if (accessChecking) return accessChecking;
  accessChecking = (async () => {
    const result = await checkPlayerAccess();
    accessGranted = result.allowed;
    document.body.classList.toggle("access-locked", !accessGranted);
    document.querySelector("main").inert = !accessGranted;
    el("access-gate").hidden = accessGranted;
    el("access-buy").hidden = result.reason !== "vip";
    el("access-retry").hidden = accessGranted;
    el("access-message").textContent = result.reason === "vip"
      ? "Плеер, личная коллекция и персональная Волна доступны с VIP. Открой свой музыкальный мир."
      : result.reason === "telegram" || result.reason === "expired" ? "Откройте новую ссылку через /wave в нашем боте — пропуск отсутствует или истёк."
      : "Сейчас не удалось проверить доступ. Повторите попытку немного позже.";
    if (!accessGranted) {
      stopCurrentAudio(false);
      audioBufferCache.clear();
      document.body.classList.remove("playing");
      updatePlayIcon(false);
      visualizer.setPlaying(false);
    }
    return accessGranted;
  })();
  try { return await accessChecking; } finally { accessChecking = null; }
}
el("access-retry").onclick = async () => {
  const button = el("access-retry");
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = "Проверяю…";
  el("access-message").textContent = "Проверяем ваш доступ на сервере…";
  try { await init(); }
  catch (_) { el("access-message").textContent = "Не удалось проверить доступ. Попробуйте ещё раз."; }
  finally {
    button.disabled = false;
    button.textContent = "Проверить доступ";
  }
};
setInterval(() => { if (accessGranted) validateAccess().catch(showError); }, 30000);
window.addEventListener("focus", () => { if (accessGranted) validateAccess().catch(showError); });

const DEFAULT_COVER = getAssetUrl("assets/default-cover.png");
const SEARCH_RELEASES = [{
  id: "type-0-park-music",
  artist: "type_0",
  title: "park music =)))))",
  duration_sec: 135,
  aliases: ["onda andar", "онда андар", "онда андер", "типа 0", "тип 0"],
  audio_url: getAssetUrl("assets/track_type_0_park_music.mp3"),
}];

// Каталог популярных треков: реальное аудио 1-к-1 с точной реальной длительностью
const SEED_CATALOG = [
  {
    id: 101,
    artist: "fem.love",
    title: "1000-7",
    aliases: ["1000 7", "1000-7", "семь", "тысяча", "fem love", "фем лав", "дед инсайд", "dead inside", "гуль", "zxcursed"],
    duration_sec: 117,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_femlove_1000_7.mp3")
  },
  {
    id: 102,
    artist: "Shadowraze",
    title: "showdown",
    aliases: ["shadowraze", "showdown", "шадоурейз", "шоудаун", "шадоурейс", "дота", "dota", "рейз"],
    duration_sec: 120,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_shadowraze_showdown.mp3")
  },
  {
    id: 103,
    artist: "Miyagi & Andy Panda",
    title: "Minor",
    aliases: ["miyagi", "andy panda", "minor", "мияги", "энди панда", "минор", "hajime"],
    duration_sec: 182,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_miyagi_minor.mp3")
  },
  {
    id: 104,
    artist: "MACAN",
    title: "Юг",
    aliases: ["macan", "юг", "макан", "yug", "на юг"],
    duration_sec: 178,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_macan_yug.mp3")
  },
  {
    id: 105,
    artist: "Linkin Park",
    title: "Numb",
    aliases: ["linkin park", "numb", "линкин парк", "намб", "честер", "chester", "рок", "rock"],
    duration_sec: 188,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_linkinpark_numb.mp3")
  },
  {
    id: 106,
    artist: "Big Baby Tape & Kizaru",
    title: "99 Problems",
    aliases: ["big baby tape", "kizaru", "99 problems", "тэйп", "кизару", "99 проблем", "бандана", "bandana"],
    duration_sec: 159,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_tape_kizaru_99problems.mp3")
  },
  {
    id: 107,
    artist: "Macan",
    title: "ASPHALT 8",
    aliases: ["macan", "asphalt 8", "асфальт 8", "асфальт", "макан"],
    duration_sec: 125,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_macan_asphalt8.mp3")
  },
  {
    id: 108,
    artist: "LXST CXNTURY",
    title: "ODIUM",
    aliases: ["lxst cxntury", "odium", "лост сенчури", "одиум", "фонк", "phonk"],
    duration_sec: 167,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_lxstcxntury_odium.mp3")
  },
  {
    id: 109,
    artist: "DVRST",
    title: "Close Eyes",
    aliases: ["dvrst", "close eyes", "дврст", "клоуз айс", "фонк", "phonk"],
    duration_sec: 132,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_dvrst_close_eyes.mp3")
  },
  {
    id: 110,
    artist: "Скриптонит",
    title: "Положение",
    aliases: ["скриптонит", "положение", "scriptonite", "polozhenie", "скрип"],
    duration_sec: 283,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_scriptonite_polozhenie.mp3")
  },
  {
    id: 111,
    artist: "OG Buda",
    title: "Бандит",
    aliases: ["og buda", "бандит", "ог буда", "буда", "bandit"],
    duration_sec: 225,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_ogbuda_bandit.mp3")
  },
  {
    id: 112,
    artist: "PHARAOH",
    title: "Black Siemens",
    aliases: ["pharaoh", "black siemens", "фараон", "блэк сименс", "скр скр", "сименс"],
    duration_sec: 195,
    cover_url: DEFAULT_COVER,
    audio_url: getAssetUrl("assets/track_pharaoh_black_siemens.mp3")
  },
];

// Умный определитель аудио для любого трека (по ID, названию, артисту или тегам)
function resolveTrackAudio(track) {
  if (track && track.audio_url) {
    try {
      const url = new URL(track.audio_url, location.href);
      if (API_BASE && url.hostname === "pr1zrak7777.github.io" && /\/assets\/[^/]+\.mp3$/.test(url.pathname))
        return getAssetUrl("assets/" + url.pathname.split("/").pop());
    } catch (_) {}
    return track.audio_url;
  }
  if (API_BASE && /^bot-\d+$/.test(String(track?.id)))
    return API_BASE + "/api/audio/" + String(track.id).slice(4);
  const normalize = value => String(value || "").trim().toLowerCase();
  return SEED_CATALOG.find(t =>
    normalize(t.artist) === normalize(track?.artist) &&
    normalize(t.title) === normalize(track?.title)
  )?.audio_url;
}

/* ────────────────── ЕДИНЫЙ АУДИОКОНТЕКСТ И АНАЛИЗАТОР ────────────────── */
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let masterGain = null;
let mediaElementSource = null;
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
      audio.crossOrigin = "anonymous";
      mediaElementSource = audioCtx.createMediaElementSource(audio);
      mediaElementSource.connect(masterGain);

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

      if (this.currentTime >= this.duration) {
        this.stop();
        if (onTick) onTick(this.duration, this.duration);
        return;
      }

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
      const res = await fetchPlayerAudio(url);
      if (!res.ok) throw new Error("fetch failed");
      const arrayBuf = await res.arrayBuffer();
      const ctx = ensureAudioContext();
      if (!ctx) return null;
      const decoded = await new Promise((resolve, reject) => {
        try {
          const r = ctx.decodeAudioData(arrayBuf, resolve, reject);
          if (r && typeof r.then === "function") {
            r.then(resolve, reject);
          }
        } catch (e) {
          reject(e);
        }
      });
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

  // 2. Глушим HTML5 audio (при паузе сохраняем src для быстрого resumePlayback)
  try {
    audio.onended = null;
    audio.pause();
    if (!keepPauseState) {
      audio.removeAttribute("src");
      audio.load();
    }
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
    audio.onended = null;
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

  const maxOffset = Math.max(0, (buffer.duration || 0) - 0.05);
  const safeOffset = Math.max(0, Math.min(offset, maxOffset));

  currentBufferSource = source;
  currentDecodedBuffer = buffer;
  activeBufferSources.add(source);
  bufferPlaybackStartTime = ctx.currentTime - safeOffset;
  bufferPauseOffset = safeOffset;
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
      handleTrackEnd();
    }
  };

  try {
    source.start(0, safeOffset);
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
let libraryTracks = [];
let waveSession = {completed: 0, library: []};
let lastCompletedWaveSession = -1;
const libraryStore = createLibraryStore(tg?.CloudStorage, localStorage, uid);
const savedTrack = t => t && libraryTracks.find(saved =>
  saved.artist.trim().toLowerCase() === t.artist.trim().toLowerCase() &&
  saved.title.trim().toLowerCase() === t.title.trim().toLowerCase());
let repeatMode = "off"; // "off" | "all" | "one"
let isShuffle = false;
const recentPlayed = new Set();
const knownWaveTracks = new Map([...SEED_CATALOG, ...SEARCH_RELEASES].map(t => [t.id, t]));
function waveContext() {
  let history = [];
  try { history = JSON.parse(localStorage.getItem("pr1zrak_history") || "[]"); } catch (_) {}
  if (!Array.isArray(history)) history = [];
  for (const t of [...tracks, ...libraryTracks]) knownWaveTracks.set(t.id, t);
  const context = discoveryContext([...knownWaveTracks.values()], history, recentPlayed, liked);
  try {
    const saved = JSON.parse(localStorage.getItem("pr1zrak_listened_artists") || "[]");
    if (Array.isArray(saved)) for (const artist of saved) context.artists.add(artist);
    if (context.ids.size) localStorage.setItem("pr1zrak_listened_artists", JSON.stringify([...context.artists]));
  } catch (_) {}
  return context;
}
function shuffleUpcoming(queue, position) {
  shuffleQueue(queue, position, waveContext().ids);
}

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
  return current()?.duration_sec || 180;
}

async function api(path, options = {}) {
  try {
    const r = await fetch(API_BASE + "/api/" + path, {
      ...options,
      headers: {
        ...playerHeaders(),
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
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  } else {
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }
}

function updateRepeatIcon(mode) {
  const icon = el("repeat-icon");
  const btn = el("repeat");
  if (!icon || !btn) return;

  btn.setAttribute("data-mode", mode);

  if (mode === "off") {
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Повтор выключен");
    btn.setAttribute("title", "Режим повтора: выкл");
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  } else if (mode === "all") {
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Повтор всего списка");
    btn.setAttribute("title", "Режим повтора: весь список");
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  } else if (mode === "one") {
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Повтор текущего трека");
    btn.setAttribute("title", "Режим повтора: один трек (1)");
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15.5" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" text-anchor="middle" fill="currentColor" stroke="none">1</text></svg>`;
  }
}

function updateShuffleIcon(active) {
  const btn = el("shuffle");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(active));
  btn.setAttribute("title", active ? "Случайный порядок включен" : "Перемешать треки");
}

function render() {
  const progress = waveProgress(libraryTracks);
  const locked = list === "wave" && !progress.unlocked;
  el("wave-locked").hidden = !locked;
  el("wave-progress").value = Math.min(WAVE_MIN_TRACKS, progress.count);
  el("wave-progress-text").textContent = `Собрано ${progress.count}/${WAVE_MIN_TRACKS} треков для обучения Волны. Осталось ${progress.remaining}.`;
  el("queue").hidden = locked;
  el("list-title").hidden = locked;
  const t = current();
  appearance.setCover(t?.cover_url || DEFAULT_COVER);
  el("like").disabled = !t;
  el("title").textContent = t ? t.title : (list === "favorites" ? "Мои треки" : "ПРИЗРАК");
  el("artist").textContent = t ? t.artist : (list === "favorites" ? "Любимая музыка" : "PR1ZRAK Sound");

  const isLiked = Boolean(savedTrack(t));
  updateLikeIcon(isLiked);
  el("like").setAttribute("aria-pressed", String(isLiked));

  updateRepeatIcon(repeatMode);
  updateShuffleIcon(isShuffle);

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
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");
    li.title = `Воспроизвести ${track.artist} — ${track.title}`;

    const infoSpan = document.createElement("span");
    infoSpan.className = "track-info-btn";
    infoSpan.textContent = (i === index ? "• " : "") + `${track.artist} — ${track.title}`;
    infoSpan.setAttribute("aria-label", li.title);

    const trackDur = document.createElement("span");
    trackDur.className = "track-duration-text";
    trackDur.textContent = track.is_preview ? `${clock(track.full_duration_sec || 180)} (превью)` : clock(track.duration_sec);

    const download = document.createElement("button");
    download.className = "track-download";
    download.textContent = "↓";
    download.setAttribute("aria-label", `Скачать ${track.artist} — ${track.title}`);
    download.onclick = e => { e.stopPropagation(); triggerDirectDownload(track).catch(showError); };
    download.onkeydown = e => e.stopPropagation();
    li.append(infoSpan, trackDur, download);

    // Клик по любому месту строки трека мгновенно запускает воспроизведение
    li.onclick = () => play(i).catch(showError);
    li.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play(i).catch(showError);
      }
    };

    queueEl.append(li);
  });
}

function waveCatalog() {
  return [...SEED_CATALOG, ...SEARCH_RELEASES, ...libraryTracks.map(t => ({...t, audio_url: resolveTrackAudio(t)}))];
}

async function refill(refreshTaste = false) {
  if (list !== "wave" || (!refreshTaste && tracks.length - index > 1) || refilling) return;
  const r = revision;
  refilling = true;
  try {
    const res = USE_BOT_API ? await api(`wave/${uid}?limit=5`) : null;
    const remote = res ? await res.json() : [];
    if (r !== revision) return;
    const protectedTracks = refreshTaste ? tracks.slice(index, index + 3) : tracks.slice(index);
    const candidates = buildPersonalizedBatch([...waveCatalog(), ...remote], waveSession.library,
      recentPlayed, protectedTracks, 5);
    if (refreshTaste) replaceWaveTail(tracks, index, candidates);
    else appendWaveBatch(tracks, index, candidates, recentPlayed);
    render();
  } finally {
    if (r === revision) refilling = false;
  }
}

// Регулярный опрос таймера воспроизведения для плавного обновления ползунка и таймкодов
let progressTicker = null;
function startProgressTicker(sessionId) {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
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
  if (!await validateAccess()) return;
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

  document.body.classList.remove("playing");
  updatePlayIcon(false);
  visualizer.setPlaying(false);
  el("status").textContent = "Загружаю аудио…";

  // СИНХРОННАЯ разблокировка аудиоконтекста в контексте клика
  unlockAudioEngine();

  let streamSrc = resolveTrackAudio(selected);
  if (streamSrc && API_BASE && streamSrc.startsWith(API_BASE + "/api/")) {
    const response = await fetchPlayerAudio(streamSrc);
    if (!response.ok) { await validateAccess(); return; }
    const blob = await response.blob();
    if (sessionId !== currentSessionId) return;
    if (objectURL) URL.revokeObjectURL(objectURL);
    streamSrc = objectURL = URL.createObjectURL(blob);
  }
  const isGitHubPages = !USE_BOT_API;

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
  if (!streamSrc) {
    el("status").textContent = "Для трека нет публичного MP3. Аудиофайл доступен в чате бота.";
    return;
  }

  // 1. Попытка воспроизведения через Web Audio Buffer
  let playedSuccessfully = false;
  let buf = audioBufferCache.get(streamSrc);

  if (!buf) {
    try {
      buf = await loadAudioBuffer(streamSrc);
    } catch (_) {}
  }

  if (sessionId !== currentSessionId) return; // ПРЕРЫВАЕМ если пользователь скипнул во время загрузки!

  if (buf) {
    playedSuccessfully = playBufferSource(buf, 0, sessionId);
  }

  // 2. Фолбэк на HTML5 audio ТОЛЬКО если буфер не сработал и сессия всё ещё активна
  if (!playedSuccessfully && sessionId === currentSessionId) {
    try {
      audio.onended = () => {
        if (sessionId === currentSessionId) {
          handleTrackEnd();
        }
      };
      audio.src = streamSrc;
      audio.volume = mediaElementSource ? 1 : currentVolume;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      if (sessionId !== currentSessionId) return;
      playedSuccessfully = true;
    } catch (err) {
      if (sessionId !== currentSessionId) return;
      playedSuccessfully = false;
    }
  }

  // Финальная проверка сессии перед переходом в режим воспроизведения
  if (sessionId !== currentSessionId) return;

  if (!playedSuccessfully) {
    stopCurrentAudio();
    el("status").textContent = "Не удалось воспроизвести трек.";
    return;
  }

  if (selected && selected.is_preview) {
    el("status").textContent = "Превью 30 секунд • Полную версию можно найти в боте";
  } else {
    el("status").textContent = "";
  }
  document.body.classList.add("playing");
  updatePlayIcon(true);
  visualizer.setPlaying(true, getCurrentPlaybackTime);
  startProgressTicker(sessionId);

  // Анти-повтор: фиксация недавних треков
  if (selected && selected.id) {
    recentPlayed.delete(selected.id);
    recentPlayed.add(selected.id);
    if (recentPlayed.size > 1000) {
      const oldest = recentPlayed.values().next().value;
      recentPlayed.delete(oldest);
    }
  }

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
  waveContext();

  if (!isGitHubPages) {
    api("listen", { method: "POST", body: JSON.stringify({ id: selected.id }) }).catch(() => {});
  }
  refill().catch(() => {});
}

function handleTrackEnd() {
  if (list === "wave" && lastCompletedWaveSession !== currentSessionId) {
    lastCompletedWaveSession = currentSessionId;
    if (recordWaveCompletion(waveSession, libraryTracks)) {
      const endedSession = currentSessionId;
      refill(true).then(() => {
        if (endedSession === currentSessionId) handleTrackEnd();
      }).catch(showError);
      return;
    }
  }
  if (repeatMode === "one") {
    // Зацикливание текущего трека на повтор с 0:00 при завершении
    play(index).catch(showError);
  } else if (index + 1 < tracks.length) {
    play(index + 1).catch(showError);
  } else if (repeatMode === "all") {
    // Повтор всего списка по кругу
    if (isShuffle && tracks.length > 1) {
      shuffleUpcoming(tracks, -1);
    }
    play(0).catch(showError);
  } else if (list === "wave") {
    const sessionId = currentSessionId;
    refill().then(() => {
      if (sessionId !== currentSessionId) return;
      if (index + 1 < tracks.length) {
        play(index + 1).catch(showError);
      } else {
        pausePlayback();
      }
    }).catch(() => {
      if (sessionId === currentSessionId) pausePlayback();
    });
  } else {
    // Окончание списка воспроизведения
    pausePlayback();
    el("seek").value = 0;
    el("time").textContent = "0:00";
  }
}

function pausePlayback() {
  ++currentSessionId;
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
  if (currentDecodedBuffer && bufferPauseOffset >= 0) {
    playBufferSource(currentDecodedBuffer, bufferPauseOffset, sessionId);
    document.body.classList.add("playing");
    updatePlayIcon(true);
    visualizer.setPlaying(true, getCurrentPlaybackTime);
    startProgressTicker(sessionId);
  } else if (audio.getAttribute("src")) {
    audio.onended = () => {
      if (sessionId === currentSessionId) {
        handleTrackEnd();
      }
    };
    audio.muted = false;
    audio.play().then(() => {
      if (sessionId !== currentSessionId) return;
      document.body.classList.add("playing");
      updatePlayIcon(true);
      visualizer.setPlaying(true, getCurrentPlaybackTime);
      startProgressTicker(sessionId);
    }).catch(() => {
      if (sessionId === currentSessionId) play(index).catch(showError);
    });
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
  if (name === "wave") {
    waveSession = {completed: 0, library: [...libraryTracks]};
    lastCompletedWaveSession = -1;
  }
  render();

  if (name === "wave" && !waveProgress(libraryTracks).unlocked) {
    el("status").textContent = "Соберите 15 любимых треков, чтобы открыть Волну";
    return;
  }

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
  const isGitHubPages = !USE_BOT_API;

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
      result = [...libraryTracks];
    } else if (name === "top") {
      result = [...SEED_CATALOG];
    } else {
      result = buildPersonalizedBatch(waveCatalog(), waveSession.library, recentPlayed, [], 5);
    }
  }

  if (r !== revision || sessionId !== currentSessionId) return;
  tracks = result;
  if (isShuffle && tracks.length > 1) {
    shuffleUpcoming(tracks, -1);
    index = 0;
  }
  render();

  if (name === "favorites" && tracks.length === 0) {
    el("status").textContent = "В Моих треках пока пусто. Добавляйте треки сердечком ❤️";
  } else {
    el("status").textContent = tracks.length ? "Студийный звук • 320 kbps" : "Пока нет треков.";
  }

  // Фоновая предзагрузка первых MP3 в буфер Web Audio
  const firstUrl = resolveTrackAudio(tracks[0]);
  if (firstUrl) loadAudioBuffer(firstUrl).catch(() => {});
}

for (const b of document.querySelectorAll("[data-list]")) {
  b.onclick = () => select(b.dataset.list).catch(showError);
}

el("next").onclick = () => {
  if (!tracks.length) return;
  if (index + 1 < tracks.length) {
    play(index + 1).catch(showError);
  } else if (repeatMode === "all") {
    play(0).catch(showError);
  } else if (list === "wave") {
    const sessionId = currentSessionId;
    refill().then(() => {
      if (sessionId !== currentSessionId) return;
      if (index + 1 < tracks.length) {
        play(index + 1).catch(showError);
      }
    }).catch(showError);
  }
};

el("prev").onclick = () => {
  if (!tracks.length) return;
  const curTime = getCurrentPlaybackTime();
  if (curTime > 3) {
    if (isBufferPlaying && currentDecodedBuffer) {
      playBufferSource(currentDecodedBuffer, 0, currentSessionId);
    } else if (audio.duration && !audio.paused) {
      audio.currentTime = 0;
    } else if (synth.isPlaying) {
      synth.currentTime = 0;
    } else {
      bufferPauseOffset = 0;
    }
    el("time").textContent = "0:00";
    el("seek").value = 0;
    return;
  }
  if (index > 0) {
    play(index - 1).catch(showError);
  } else if (repeatMode === "all") {
    play(tracks.length - 1).catch(showError);
  } else {
    play(0).catch(showError);
  }
};

el("shuffle").onclick = () => {
  isShuffle = !isShuffle;
  updateShuffleIcon(isShuffle);
  if (isShuffle) {
    const isPlaying = document.body.classList.contains("playing");
    shuffleUpcoming(tracks, isPlaying ? index : -1);
    if (!isPlaying) index = 0;
  }
  render();
};

const repeatBtn = el("repeat");
if (repeatBtn) {
  repeatBtn.onclick = () => {
    if (repeatMode === "off") {
      repeatMode = "all";
    } else if (repeatMode === "all") {
      repeatMode = "one";
    } else {
      repeatMode = "off";
    }
    updateRepeatIcon(repeatMode);
  };
}

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
  audio.volume = mediaElementSource ? 1 : currentVolume;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
  }
  synth.setVolume(currentVolume);
  visualizer.setVolume(currentVolume);
  try { localStorage.setItem("pr1zrak_volume", String(currentVolume)); } catch (_) {}
};
try { currentVolume = Math.max(0, Math.min(1, Number(localStorage.getItem("pr1zrak_volume") ?? 1) || 0)); } catch (_) {}
audio.volume = mediaElementSource ? 1 : currentVolume;
el("volume").value = currentVolume * 100;
visualizer.setVolume(currentVolume);
el("volume-toggle").onclick = () => {
  const open = document.querySelector(".top-volume").classList.toggle("open");
  el("volume-toggle").setAttribute("aria-expanded", String(open));
};
document.addEventListener("pointerdown", e => {
  if (!e.target.closest(".top-volume")) {
    document.querySelector(".top-volume").classList.remove("open");
    el("volume-toggle").setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    document.querySelector(".top-volume").classList.remove("open");
    el("volume-toggle").setAttribute("aria-expanded", "false");
    if (document.activeElement === el("volume")) el("volume").blur();
  }
});


const searchInput = el("search-input");
const searchBtn = el("search-btn");

async function doSearch() {
  const query = (searchInput?.value || "").trim();
  if (!query) return;

  const r = ++revision;
  const sessionId = ++currentSessionId;
  stopCurrentAudio(false);
  document.body.classList.remove("playing");
  updatePlayIcon(false);
  visualizer.setPlaying(false);
  el("seek").value = 0;
  el("time").textContent = "0:00";
  el("time-total").textContent = "0:00";

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
  const isGitHubPages = !USE_BOT_API;

  if (!isGitHubPages) {
    try {
      const res = await api("search?q=" + encodeURIComponent(query));
      if (res && res.ok) {
        resTracks = await res.json();
      }
    } catch (_) {}
  }

  if (r !== revision || sessionId !== currentSessionId) return;

  // 1. Поиск по локальным студийным трекам и спец-релизам
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const localMatches = [...SEARCH_RELEASES, ...SEED_CATALOG].filter(t => {
    const haystack = [t.artist, t.title, ...(t.aliases || [])].join(" ").toLowerCase();
    const catalogWords = haystack.match(/[\p{L}\p{N}]+/gu) || [];
    return words.length > 0 && words.every(term =>
      catalogWords.some(word => word === term || (term.length >= 3 && word.startsWith(term)))
    );
  });

  // 2. Глобальный поиск музыки по всему миру (любая песня) через открытый Music API с CORS
  let globalTracks = [];
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=30`;
    const itRes = await fetch(itunesUrl);
    if (itRes.ok) {
      const itData = await itRes.json();
      if (itData && itData.results && itData.results.length) {
        globalTracks = itData.results
          .filter(r => r.previewUrl)
          .map(r => ({
            id: "global-" + r.trackId,
            artist: r.artistName || "Артист",
            title: r.trackName || query,
            is_preview: true,
            full_duration_sec: Math.round((r.trackTimeMillis || 30000) / 1000),
            duration_sec: 29,
            cover_url: (r.artworkUrl100 || "").replace("100x100bb", "600x600bb") || DEFAULT_COVER,
            audio_url: r.previewUrl
          }));
      }
    }
  } catch (_) {}

  if (r !== revision || sessionId !== currentSessionId) return;

  // Объединяем: локальные студийные треки с наивысшим приоритетом + все результаты глобального поиска
  const seen = new Set();
  const merged = [];
  for (const t of [...(resTracks || []), ...localMatches, ...libraryTracks.filter(t =>
    words.every(w => `${t.artist} ${t.title}`.toLowerCase().includes(w))), ...globalTracks]) {
    const key = (String(t.artist || "") + " - " + String(t.title || "")).trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(t);
    }
  }

  tracks = merged;
  render();
  el("status").textContent = tracks.length ? "" : "В каталоге плеера ничего не найдено.";
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
    const saved = savedTrack(t);
    const was = Boolean(saved);
    const isGitHubPages = !USE_BOT_API;
    if (!isGitHubPages) {
      const response = await api("like", {
        method: was ? "DELETE" : "POST",
        body: JSON.stringify({ id: t.id })
      });
      if (!response) throw Error("Не удалось сохранить трек на сервере");
    }
    const before = libraryTracks;
    const updated = was ? libraryTracks.filter(track => track.id !== saved.id) : mergeLibrary(libraryTracks, [t]);
    const removed = before.filter(track => !updated.some(item => item.id === track.id)).map(track => track.id);
    libraryTracks = updated;
    libraryStore.cache(libraryTracks);
    try {
      await libraryStore.save(was ? [] : [t], removed);
    } catch (_) { showToast("Сохранено на устройстве. Облако недоступно — повторите позже."); }
    liked = new Set(libraryTracks.map(track => track.id));

    try {
      localStorage.setItem(`pr1zrak_favs_${uid}`, JSON.stringify([...liked]));
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

function showToast(text, duration = 2500) {
  const toast = el("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

function openDownloadModal() {
  const t = current();
  if (!t) {
    showToast("⚠️ Сначала выберите трек");
    return;
  }
  const modal = el("dl-modal");
  const desc = el("modal-track-desc");
  if (desc) desc.textContent = `${t.artist} — ${t.title}`;
  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeDownloadModal() {
  const modal = el("dl-modal");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
}

async function triggerDirectDownload(track = null) {
  if (!await validateAccess()) return;
  const t = track?.id ? track : current();
  if (!t) return;
  closeDownloadModal();

  const audioUrl = resolveTrackAudio(t);
  if (t.is_preview) {
    showToast("Это превью. Полную версию можно найти в боте.");
    return;
  }
  if (!audioUrl && !Number.isInteger(t.id)) {
    showToast("Для этого трека нет публичного MP3. Аудиофайл доступен в чате бота.", 4500);
    return;
  }

  showToast("⏳ Сохраняю аудиофайл...");
  const extension = audioUrl ? new URL(audioUrl, location.href).pathname.match(/\.(mp3|m4a|ogg|wav)$/i)?.[0] || ".mp3" : ".mp3";
  const cleanFilename = `${t.artist} - ${t.title}`.replace(/[\\/:*?"<>|#]/g, "_").trim() + extension;
  if (audioUrl?.startsWith("https://") && !audioUrl.startsWith(API_BASE + "/api/") && tg?.downloadFile && tg.isVersionAtLeast?.("8.0") &&
      ["android", "ios", "tdesktop", "macos"].includes(tg.platform)) {
    try {
      tg.downloadFile({url: audioUrl, file_name: cleanFilename}, accepted =>
        showToast(accepted ? "Загрузка передана Telegram на устройстве" : "Скачивание отменено"));
      return;
    } catch (_) { /* Older clients use the browser download below. */ }
  }

  try {
    const response = audioUrl ? await fetchPlayerAudio(audioUrl) : await api("audio/" + t.id);
    if (!response.ok) throw new Error("fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    showToast("Загрузка передана устройству");
  } catch (_) {
    showToast("Не удалось скачать файл. Проверьте соединение и повторите.", 4500);
  }
}

function encodeTelegramTrackQuery(artist, title) {
  const cleanArtist = (artist || "").split(/[&,/]| feat| ft\./i)[0].replace(/[#&?\\/|<>*:"~`]/g, " ").trim();
  const cleanTitle = (title || "").replace(/[#&?\\/|<>*:"~`]/g, " ").trim();
  let query = `${cleanArtist} ${cleanTitle}`.replace(/\s+/g, " ").trim();
  if (!query) query = "музыка";

  let b64 = "";
  try {
    const utf8Str = unescape(encodeURIComponent(query));
    // 36 bytes in base64 is 48 chars + 'b_' = 50 chars <= 64 chars limit
    const sliced = utf8Str.slice(0, 36);
    b64 = btoa(sliced).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (_) {
    b64 = query.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  }
  return "b_" + (b64 || "music");
}

function triggerTelegramDownload() {
  const t = current();
  if (!t) return;
  closeDownloadModal();

  const code = encodeTelegramTrackQuery(t.artist, t.title);
  const deepLink = `https://t.me/PR1ZRAKWORK_BOT?start=${code}`;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(deepLink);
  } else {
    window.open(deepLink, "_blank");
  }
}

const dlBtn = el("download-tg");
if (dlBtn) dlBtn.onclick = () => triggerDirectDownload().catch(showError);

el("modal-close")?.addEventListener("click", closeDownloadModal);
el("dl-modal")?.addEventListener("click", e => {
  if (e.target === el("dl-modal")) closeDownloadModal();
});
el("btn-dl-device")?.addEventListener("click", triggerDirectDownload);
el("btn-dl-telegram")?.addEventListener("click", triggerTelegramDownload);

async function importLaunchTracks() {
  try {
    const imported = decodeHandoff(window.location.hash, uid);
    if (imported.length) {
      const before = libraryTracks;
      libraryTracks = mergeLibrary(libraryTracks, imported);
      libraryStore.cache(libraryTracks);
      const removed = before.filter(t => !libraryTracks.some(item => item.id === t.id)).map(t => t.id);
      const synced = await libraryStore.save(imported, removed);
      if (synced) {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        fragment.delete("library");
        history.replaceState(null, "", window.location.pathname + window.location.search + (fragment.size ? "#" + fragment : ""));
      }
      showToast(synced ? `Сохранено в Telegram: ${imported.length} треков` : "Треки сохранены на устройстве");
    }
  } catch (error) { showToast(error.message || "Не удалось сохранить импорт в облаке", 5000); }
  liked = new Set(libraryTracks.map(t => t.id));

}

async function init() {
  tg?.ready();
  tg?.expand();
  if (!await validateAccess()) return;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor("#000000");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#000000");
  }

  const saved = await libraryStore.load();
  libraryTracks = saved.tracks;
  if (saved.error) showToast("Облако недоступно. Загружена копия с устройства.", 4000);
  // Preserve the previous player's locally saved catalog favorites on upgrade.
  try {
    const migrationKey = `pr1zrak_legacy_migrated_${uid}`;
    if (!localStorage.getItem(migrationKey)) {
      const legacy = JSON.parse(localStorage.getItem("pr1zrak_favs") || "[]");
      const restored = [...SEED_CATALOG, ...SEARCH_RELEASES].filter(t => legacy.includes(t.id));
      if (restored.length && !libraryTracks.length) {
        libraryTracks = mergeLibrary(libraryTracks, restored);
        libraryStore.cache(libraryTracks);
        await libraryStore.save(restored);
      }
      localStorage.setItem(migrationKey, "1");
    }
  } catch (_) { /* Pending cloud writes will retry on the next launch. */ }
  await importLaunchTracks();

  const isGitHubPages = !USE_BOT_API;
  if (!isGitHubPages) {
    const res = await api("favorites/" + uid);
    if (res && res.ok) {
      const favs = await res.json();
      libraryTracks = favs;
      liked = new Set(favs.map(t => t.id));
    }
  }

  await select("wave");
  // Фоновая предзагрузка первых буферов аудио в Web Audio для мгновенного старта
  SEED_CATALOG.slice(0, 4).forEach(t => loadAudioBuffer(t.audio_url).catch(() => {}));
}

window.addEventListener("hashchange", async () => {
  await importLaunchTracks();
  if (list === "favorites" || list === "wave") await select(list);
  else render();
});
init().catch(showError);
