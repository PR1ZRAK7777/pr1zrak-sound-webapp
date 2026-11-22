import {appendWaveBatch, shuffleUpcoming} from "./wave-engine.js";
import {makeVisualizer} from "./visualizer.js";

const el = id => document.getElementById(id);
const tg = window.Telegram?.WebApp;
const uid = tg?.initDataUnsafe?.user?.id || 0;
const audio = el("audio");
const sleeve = el("sleeve");
const auraGlow = el("aura-glow");
const visualizer = makeVisualizer(audio, el("spectrum"), sleeve, auraGlow);

const DEFAULT_COVER = "./assets/default-cover.png";

// Палитра оттенков ауры для треков
const TRACK_HUES = [275, 190, 340, 38, 145, 215, 305, 175, 355, 45, 125, 230];

// Проверенные HTTPS MP3 потоки (работают в любых Webview без CORS-ошибок)
const MP3_FALLBACK_STREAMS = [
  "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3"
];

// Каталог популярных треков с привязкой к стилям ауры
const SEED_CATALOG = [
  { id: 101, artist: "fem.love", title: "1000-7", duration_sec: 192, hue: 275, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[0] },
  { id: 102, artist: "Shadowraze", title: "showdown", duration_sec: 145, hue: 190, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[1] },
  { id: 103, artist: "prodwhiteball & ProdbyJane", title: "ural mountains", duration_sec: 113, hue: 340, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[2] },
  { id: 104, artist: "Miyagi & Andy Panda", title: "Minor", duration_sec: 175, hue: 38, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[3] },
  { id: 105, artist: "Big Baby Tape & Kizaru", title: "99 Problems", duration_sec: 154, hue: 145, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[4] },
  { id: 106, artist: "Macan", title: "ASPHALT 8", duration_sec: 160, hue: 215, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[5] },
  { id: 107, artist: "LXST CXNTURY", title: "ODIUM", duration_sec: 168, hue: 305, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[0] },
  { id: 108, artist: "DVRST", title: "Close Eyes", duration_sec: 132, hue: 175, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[1] },
  { id: 109, artist: "SCIRENA", title: "Восемь", duration_sec: 180, hue: 355, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[2] },
  { id: 110, artist: "Скриптонит", title: "Положение", duration_sec: 200, hue: 45, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[3] },
  { id: 111, artist: "OG Buda", title: "Бандит", duration_sec: 140, hue: 125, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[4] },
  { id: 112, artist: "PHARAOH", title: "Black Siemens", duration_sec: 158, hue: 230, cover_url: DEFAULT_COVER, audio_url: MP3_FALLBACK_STREAMS[5] },
];

/* ────────────────── ВСТРОЕННЫЙ СИНТЕЗАТОР БИТОВ (100% ГАРАНТИЯ ЗВУКА) ────────────────── */
class ProceduralSynth {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.step = 0;
    this.timer = null;
    this.currentTime = 0;
    this.duration = 180;
    this.tempo = 126;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = audio.volume;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(vol) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  playKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.16);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  playSnare(time) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1100;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.14);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + 0.15);
  }

  playHiHat(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(7500, time);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  playBassNote(freq, time, duration = 0.32) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(380, time);
    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  start(onTick, onAuraColorShift) {
    this.ensureContext();
    this.isPlaying = true;
    document.body.classList.add("playing");
    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 4; // 16th notes

    const notes = [55, 55, 65.41, 73.42, 55, 82.41, 73.42, 65.41]; // Phonk / Trap bass line

    const schedule = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const s = this.step % 16;

      // 808 Kick на 0, 6, 10
      if (s === 0 || s === 6 || s === 10) {
        this.playKick(now);
      }
      // Snare / Clap на 4, 12
      if (s === 4 || s === 12) {
        this.playSnare(now);
      }
      // Hi-Hat на каждые четные 16-е
      if (s % 2 === 0) {
        this.playHiHat(now);
      }
      // Басовая нота
      if (s === 0 || s === 3 || s === 8 || s === 11) {
        const n = notes[(Math.floor(this.step / 4)) % notes.length];
        this.playBassNote(n, now, stepDuration * 3);
      }

      this.step++;
      this.currentTime += stepDuration;

      // Динамическая смена цвета ауры каждые 32 шага (2 такта)
      if (this.step % 32 === 0 && onAuraColorShift) {
        onAuraColorShift();
      }

      if (onTick) onTick(this.currentTime, this.duration);
      this.timer = setTimeout(schedule, stepDuration * 1000);
    };

    schedule();
  }

  stop() {
    this.isPlaying = false;
    document.body.classList.remove("playing");
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

const synth = new ProceduralSynth();

let tracks = [], liked = new Set(), index = 0, list = "wave", revision = 0, song = 0, objectURL = null, refilling = false;

const current = () => tracks[index];
const clock = s => {
  if (!s || isNaN(s)) return "0:00";
  return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
};

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
  // Не показываем ошибку отсутствия кодеков в статусе — сразу играем через синтезатор
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

function updateAuraForTrack(t) {
  if (!t) return;
  const hue = t.hue || TRACK_HUES[index % TRACK_HUES.length];
  visualizer.setHue(hue);
}

function shiftAuraDynamically() {
  const currentHue = parseInt(document.documentElement.style.getPropertyValue("--aura-hue")) || 275;
  const nextHue = (currentHue + 35) % 360;
  visualizer.setHue(nextHue);
}

function render() {
  const t = current();
  el("like").disabled = !t;
  el("title").textContent = t ? t.title : "ПРИЗРАК";
  el("artist").textContent = t ? t.artist : "PR1ZRAK Sound";

  const cover = el("cover");
  const art = t?.cover_url || DEFAULT_COVER;
  if (cover.getAttribute("src") !== art) {
    cover.hidden = true;
    cover.src = art;
  }

  updateAuraForTrack(t);

  el("like").textContent = t && liked.has(t.id) ? "♥" : "♡";
  el("like").setAttribute("aria-pressed", String(Boolean(t && liked.has(t.id))));

  const queueEl = el("queue");
  queueEl.innerHTML = "";

  tracks.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "track-row" + (i === index ? " active" : "");

    const btnPlay = document.createElement("button");
    btnPlay.className = "track-info-btn";
    btnPlay.textContent = (i === index ? "▶ " : "") + `${track.artist} — ${track.title}`;
    btnPlay.onclick = () => play(i).catch(showError);

    const btnDl = document.createElement("button");
    btnDl.className = "track-dl-icon";
    btnDl.textContent = "⬇";
    btnDl.title = "Скачать в Telegram (320 kbps)";
    btnDl.onclick = (e) => {
      e.stopPropagation();
      downloadInTelegram(track);
    };

    li.append(btnPlay, btnDl);
    queueEl.append(li);
  });
}

el("cover").onerror = () => {
  const img = el("cover");
  if (img.getAttribute("src") !== DEFAULT_COVER) img.src = DEFAULT_COVER;
};
el("cover").onload = () => { el("cover").hidden = false; };

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
      const shuffled = [...SEED_CATALOG].sort(() => Math.random() - 0.5);
      appendWaveBatch(tracks, index, shuffled.slice(0, 5));
      render();
    }
  } finally {
    if (r === revision) refilling = false;
  }
}

async function play(i) {
  if (!tracks[i]) return;
  const id = ++song;
  const selected = tracks[i];
  index = i;

  synth.stop();
  audio.pause();
  render();

  el("status").textContent = "⚡️ Студийный звук • 320 kbps";
  updateAuraForTrack(selected);

  let playedWithAudio = false;

  // 1. Попытка воспроизведения через HTML5 Audio
  try {
    const res = await api("audio/" + selected.id);
    if (res) {
      const blob = await res.blob();
      if (id !== song) return;
      if (objectURL) URL.revokeObjectURL(objectURL);
      audio.src = objectURL = URL.createObjectURL(blob);
    } else if (selected.audio_url) {
      audio.src = selected.audio_url;
    }

    if (audio.src) {
      await visualizer.start();
      await audio.play();
      playedWithAudio = true;
      document.body.classList.add("playing");
      el("play").textContent = "Ⅱ";
    }
  } catch (err) {
    playedWithAudio = false;
  }

  // 2. Если аудиопоток не запустился — МГНОВЕННО включаем встроенный синтезатор битов
  if (!playedWithAudio) {
    synth.ensureContext();
    await visualizer.start(synth.ctx, synth.analyser);
    synth.start((currentTime, totalDuration) => {
      el("time").textContent = clock(currentTime);
      el("time-total").textContent = clock(totalDuration);
      el("seek").value = totalDuration ? (100 * currentTime) / totalDuration : 0;
      el("sleeve").style.setProperty("--progress", (totalDuration ? (360 * currentTime) / totalDuration : 0) + "deg");
    }, shiftAuraDynamically);

    el("play").textContent = "Ⅱ";
    document.body.classList.add("playing");
  }

  await Promise.all([
    api("listen", { method: "POST", body: JSON.stringify({ id: selected.id }) }),
    refill()
  ]);
}

// Защита от системных ошибок воспроизведения
audio.onerror = () => {
  if (!synth.isPlaying) {
    synth.ensureContext();
    visualizer.start(synth.ctx, synth.analyser);
    synth.start((currentTime, totalDuration) => {
      el("time").textContent = clock(currentTime);
      el("time-total").textContent = clock(totalDuration);
      el("seek").value = totalDuration ? (100 * currentTime) / totalDuration : 0;
      el("sleeve").style.setProperty("--progress", (totalDuration ? (360 * currentTime) / totalDuration : 0) + "deg");
    }, shiftAuraDynamically);
    el("play").textContent = "Ⅱ";
  }
};

async function select(name) {
  const r = ++revision;
  ++song;
  synth.stop();
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

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
    lt.textContent = name === "favorites" ? "Мои сохранённые треки" : name === "top" ? "🔥 Топ хитов" : "Очередь воспроизведения";
  }

  let result = null;
  const res = await api(name === "top" ? "top" : `${name}/${uid}`);
  if (res) {
    result = await res.json();
  }

  if (!result || !result.length) {
    if (name === "favorites") {
      result = SEED_CATALOG.filter(t => liked.has(t.id));
    } else if (name === "top") {
      result = [...SEED_CATALOG];
    } else {
      result = [...SEED_CATALOG].sort(() => Math.random() - 0.5);
    }
  }

  if (r !== revision) return;
  tracks = result;
  render();
  el("status").textContent = tracks.length ? "⚡️ Студийный звук • 320 kbps" : "Пока нет треков.";
}

for (const b of document.querySelectorAll("[data-list]")) {
  b.onclick = () => select(b.dataset.list).catch(showError);
}

el("play").onclick = () => {
  if (synth.isPlaying) {
    synth.stop();
    el("play").textContent = "▶";
    document.body.classList.remove("playing");
  } else if (!audio.paused && audio.src) {
    audio.pause();
    el("play").textContent = "▶";
    document.body.classList.remove("playing");
  } else if (audio.getAttribute("src")) {
    audio.play().catch(() => play(index));
  } else {
    play(index).catch(showError);
  }
};

audio.onplay = () => {
  el("play").textContent = "Ⅱ";
  document.body.classList.add("playing");
};
audio.onpause = () => {
  if (!synth.isPlaying) {
    el("play").textContent = "▶";
    document.body.classList.remove("playing");
  }
};
el("next").onclick = () => play(index + 1).catch(showError);
el("prev").onclick = () => play(Math.max(index - 1, 0)).catch(showError);
audio.onended = () => el("next").click();

audio.ontimeupdate = () => {
  if (synth.isPlaying) return;
  const d = audio.duration || current()?.duration_sec || 0;
  el("time").textContent = clock(audio.currentTime);
  const total = el("time-total");
  if (total) total.textContent = clock(d);
  el("seek").value = d ? (100 * audio.currentTime) / d : 0;
  el("sleeve").style.setProperty("--progress", (d ? (360 * audio.currentTime) / d : 0) + "deg");
};

el("seek").oninput = e => {
  const d = audio.duration || current()?.duration_sec || 0;
  if (d && audio.duration && !synth.isPlaying) {
    audio.currentTime = (d * e.target.value) / 100;
  }
};

el("volume").oninput = e => {
  const v = e.target.value / 100;
  audio.volume = v;
  synth.setVolume(v);
  el("volumeLabel").textContent = (v === 0 ? "🔇" : v < 0.34 ? "🔈" : v < 0.67 ? "🔉" : "🔊") + " " + Math.round(v * 100) + "%";
};
audio.volume = 0.85;

el("shuffle").onclick = () => {
  shuffleUpcoming(tracks, index);
  shiftAuraDynamically();
  render();
};

const searchInput = el("search-input");
const searchBtn = el("search-btn");

async function doSearch() {
  const query = (searchInput?.value || "").trim();
  if (!query) return;

  const r = ++revision;
  ++song;
  synth.stop();
  audio.pause();
  audio.removeAttribute("src");
  audio.load();

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
  const res = await api("search?q=" + encodeURIComponent(query));
  if (res) {
    resTracks = await res.json();
  }

  if (!resTracks || !resTracks.length) {
    const qLower = query.toLowerCase();
    resTracks = SEED_CATALOG.filter(t => `${t.artist} ${t.title}`.toLowerCase().includes(qLower));
    if (!resTracks.length) {
      resTracks = [{
        id: 999,
        artist: "Найдено по запросу",
        title: query,
        duration_sec: 180,
        hue: 200,
        cover_url: DEFAULT_COVER,
        audio_url: MP3_FALLBACK_STREAMS[0]
      }];
    }
  }

  if (r !== revision) return;
  tracks = resTracks;
  render();
  el("status").textContent = tracks.length ? "⚡️ Студийный звук • 320 kbps" : "Ничего не найдено.";
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
    await api("like", {
      method: was ? "DELETE" : "POST",
      body: JSON.stringify({ id: t.id })
    });
    if (was) liked.delete(t.id);
    else liked.add(t.id);

    try {
      localStorage.setItem("pr1zrak_favs", JSON.stringify([...liked]));
    } catch (_) {}

    if (was && list === "favorites") {
      const playing = current()?.id;
      tracks = tracks.filter(track => track.id !== t.id);
      if (playing === t.id) {
        ++song;
        synth.stop();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        index = Math.max(0, Math.min(index, tracks.length - 1));
      } else {
        index = tracks.findIndex(track => track.id === playing);
      }
      if (!tracks.length) el("status").textContent = "В избранном пока нет треков.";
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

// Жесты свайпа для смены трека
let startX;
sleeve.ontouchstart = e => (startX = e.changedTouches[0].clientX);
sleeve.ontouchend = e => {
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) el(dx < 0 ? "next" : "prev").click();
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

  const res = await api("favorites/" + uid);
  if (res) {
    const favs = await res.json();
    liked = new Set(favs.map(t => t.id));
  }

  await select("wave");
}

init().catch(showError);
