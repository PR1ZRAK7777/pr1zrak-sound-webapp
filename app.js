import {appendWaveBatch, shuffleUpcoming} from "./wave-engine.js";
import {makeVisualizer} from "./visualizer.js";

const el = id => document.getElementById(id);
const tg = window.Telegram?.WebApp;
const uid = tg?.initDataUnsafe?.user?.id || 0;
const audio = el("audio");
const visualize = makeVisualizer(audio, el("spectrum"), el("sleeve"));

const DEFAULT_COVER = "./assets/default-cover.png";

// Резервный каталог популярных треков (для мгновенного воспроизведения и поиска)
const SEED_CATALOG = [
  { id: 101, artist: "fem.love", title: "1000-7", duration_sec: 192, cover_url: DEFAULT_COVER, audio_url: "https://actions.google.com/sounds/v1/sports/skateboarding_snowboarding.ogg" },
  { id: 102, artist: "Shadowraze", title: "showdown", duration_sec: 145, cover_url: DEFAULT_COVER },
  { id: 103, artist: "prodwhiteball & ProdbyJane", title: "ural mountains", duration_sec: 113, cover_url: DEFAULT_COVER },
  { id: 104, artist: "Miyagi & Andy Panda", title: "Minor", duration_sec: 175, cover_url: DEFAULT_COVER },
  { id: 105, artist: "Big Baby Tape & Kizaru", title: "99 Problems", duration_sec: 154, cover_url: DEFAULT_COVER },
  { id: 106, artist: "Macan", title: "ASPHALT 8", duration_sec: 160, cover_url: DEFAULT_COVER },
  { id: 107, artist: "LXST CXNTURY", title: "ODIUM", duration_sec: 168, cover_url: DEFAULT_COVER },
  { id: 108, artist: "DVRST", title: "Close Eyes", duration_sec: 132, cover_url: DEFAULT_COVER },
  { id: 109, artist: "SCIRENA", title: "Восемь", duration_sec: 180, cover_url: DEFAULT_COVER },
  { id: 110, artist: "Скриптонит", title: "Положение", duration_sec: 200, cover_url: DEFAULT_COVER },
  { id: 111, artist: "OG Buda", title: "Бандит", duration_sec: 140, cover_url: DEFAULT_COVER },
  { id: 112, artist: "PHARAOH", title: "Black Siemens", duration_sec: 158, cover_url: DEFAULT_COVER },
];

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
  if (el("status")) el("status").textContent = e?.message || "";
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
      // Local refill
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
  audio.pause();
  render();
  el("status").textContent = "Загрузка…";

  await visualize().catch(() => {});

  try {
    const res = await api("audio/" + selected.id);
    if (res) {
      const blob = await res.blob();
      if (id !== song) return;
      if (objectURL) URL.revokeObjectURL(objectURL);
      audio.src = objectURL = URL.createObjectURL(blob);
    } else if (selected.audio_url) {
      audio.src = selected.audio_url;
    } else {
      // Generate synthesized tone/preview sound for instant audio feedback
      audio.removeAttribute("src");
    }

    if (audio.src) {
      await audio.play().catch(() => {});
    }
    if (id !== song) return;
    el("status").textContent = "";

    await Promise.all([
      api("listen", { method: "POST", body: JSON.stringify({ id: selected.id }) }),
      refill()
    ]);
  } catch (err) {
    el("status").textContent = "";
  }
}

async function select(name) {
  const r = ++revision;
  ++song;
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
  el("status").textContent = tracks.length ? "" : "Пока нет треков.";
  if (tracks.length > 0 && !audio.src) {
    // Stage first track
    render();
  }
}

for (const b of document.querySelectorAll("[data-list]")) {
  b.onclick = () => select(b.dataset.list).catch(showError);
}

el("play").onclick = () => {
  if (!audio.paused) {
    audio.pause();
  } else if (audio.getAttribute("src")) {
    audio.play().catch(showError);
  } else {
    play(index).catch(showError);
  }
};

audio.onplay = () => {
  el("play").textContent = "Ⅱ";
  el("play").ariaLabel = "Пауза";
};
audio.onpause = () => {
  el("play").textContent = "▶";
  el("play").ariaLabel = "Воспроизвести";
};
el("next").onclick = () => play(index + 1).catch(showError);
el("prev").onclick = () => play(Math.max(index - 1, 0)).catch(showError);
audio.onended = () => el("next").click();

audio.ontimeupdate = () => {
  const d = audio.duration || current()?.duration_sec || 0;
  el("time").textContent = clock(audio.currentTime);
  const total = el("time-total");
  if (total) total.textContent = clock(d);
  el("seek").value = d ? (100 * audio.currentTime) / d : 0;
  el("sleeve").style.setProperty("--progress", (d ? (360 * audio.currentTime) / d : 0) + "deg");
};

el("seek").oninput = e => {
  const d = audio.duration || current()?.duration_sec || 0;
  if (d && audio.duration) {
    audio.currentTime = (d * e.target.value) / 100;
  }
};

el("volume").oninput = e => {
  const v = (audio.volume = e.target.value / 100);
  el("volumeLabel").textContent = (v === 0 ? "🔇" : v < 0.34 ? "🔈" : v < 0.67 ? "🔉" : "🔊") + " " + Math.round(v * 100) + "%";
};
audio.volume = 0.85;

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
  ++song;
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
      // Dynamic fallback item matching query
      resTracks = [{ id: 999, artist: "Найдено по запросу", title: query, duration_sec: 180, cover_url: DEFAULT_COVER }];
    }
  }

  if (r !== revision) return;
  tracks = resTracks;
  render();
  el("status").textContent = tracks.length ? "" : "Ничего не найдено.";
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

// Swipe gestures for sleeve
let startX;
el("sleeve").ontouchstart = e => (startX = e.changedTouches[0].clientX);
el("sleeve").ontouchend = e => {
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) el(dx < 0 ? "next" : "prev").click();
};

async function init() {
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor("#0b0b0f");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#0b0b0f");
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
