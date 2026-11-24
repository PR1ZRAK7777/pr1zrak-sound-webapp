// The bot hands off metadata at launch; CloudStorage keeps it between devices.
const PREFIX = "pr1zrak_track_";
const FALLBACK = "pr1zrak_library_v1";
const identity = t => `${t.artist.trim().toLocaleLowerCase()}\n${t.title.trim().toLocaleLowerCase()}`;

export function mergeLibrary(existing, incoming) {
  const tracks = new Map();
  for (const t of [...existing, ...incoming]) {
    if (!t || !["string", "number"].includes(typeof t.id) ||
        typeof t.artist !== "string" || typeof t.title !== "string" || !t.title.trim()) continue;
    const previous = tracks.get(identity(t));
    const merged = {...previous, ...t};
    const aliases = new Set([...(previous?.libraryIds || []), ...(t.libraryIds || [])]);
    if (previous && previous.id !== t.id) aliases.add(previous.id);
    aliases.delete(t.id);
    if (aliases.size) merged.libraryIds = [...aliases];
    if (previous?.audio_url && !previous.is_preview && !t.audio_url) merged.audio_url = previous.audio_url;
    if (String(t.id).startsWith("bot-")) {
      if (previous?.is_preview && !t.audio_url) delete merged.audio_url;
      merged.is_preview = false;
    }
    tracks.set(identity(t), merged);
  }
  return [...tracks.values()];
}

export function decodeHandoff(hash, userId) {
  const encoded = new URLSearchParams(hash.replace(/^#/, "")).get("library");
  if (!encoded) return [];
  if (encoded.length > 64000) throw Error("Слишком большая ссылка импорта");
  const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
  if (payload.v !== 1 || !userId || payload.u !== userId || !Array.isArray(payload.t))
    throw Error("Откройте ссылку импорта в своём чате с ботом");
  return mergeLibrary([], payload.t.filter(row => Array.isArray(row) &&
    /^bot-\d+$/.test(row[0]) && typeof row[1] === "string" && typeof row[2] === "string" &&
    Number.isFinite(row[3]) && row[3] >= 0).map(([id, artist, title, duration_sec, audio_url]) => {
      const track = {id, artist: artist.slice(0, 256), title: title.slice(0, 256), duration_sec};
      try {
        const url = new URL(audio_url);
        if (url.protocol === "https:" && url.hostname !== "api.telegram.org" &&
            /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) track.audio_url = url.href;
      } catch (_) {}
      return track;
    }));
}

export function createLibraryStore(cloud, local, userId) {
  const fallbackKey = `${FALLBACK}_${userId || "browser"}`;
  const pendingKey = fallbackKey + "_pending";
  const key = id => PREFIX + String(id).replace(/[^A-Za-z0-9_-]/g, "_");
  const call = (method, ...args) => new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(Error("Telegram CloudStorage не отвечает")); }, 8000);
    try {
      cloud[method](...args, (error, result) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        error ? reject(Error(String(error))) : resolve(result);
      });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
  function cache(tracks) { try { local.setItem(fallbackKey, JSON.stringify(tracks)); } catch (_) {} }
  function pending() {
    try { return JSON.parse(local.getItem(pendingKey) || "{}"); } catch (_) { return {}; }
  }
  let writeQueue = Promise.resolve();
  function flush(operations) {
    const next = writeQueue.then(() => flushNow(operations), () => flushNow(operations));
    writeQueue = next;
    return next;
  }
  async function flushNow(operations) {
    if (!cloud) return false;
    for (const [id, track] of Object.entries(operations)) {
      if (track === null) await call("removeItem", key(id));
      else await call("setItem", key(id), JSON.stringify(track));
    }
    const remaining = pending();
    for (const [id, track] of Object.entries(operations)) {
      if (JSON.stringify(remaining[id]) === JSON.stringify(track)) delete remaining[id];
    }
    if (Object.keys(remaining).length) local.setItem(pendingKey, JSON.stringify(remaining));
    else local.removeItem(pendingKey);
    return true;
  }
  return {
    async load() {
      let saved = [];
      try { saved = JSON.parse(local.getItem(fallbackKey) || "[]"); } catch (_) {}
      if (!cloud) return {tracks: mergeLibrary([], saved), synced: false};
      try {
        const keys = (await call("getKeys")).filter(k => k.startsWith(PREFIX));
        const tracks = [];
        for (let i = 0; i < keys.length; i += 100) {
          const values = await call("getItems", keys.slice(i, i + 100));
          for (const value of Object.values(values)) {
            try { tracks.push(JSON.parse(value)); } catch (_) {}
          }
        }
        const operations = pending();
        const deleted = new Set(Object.entries(operations).filter(([, t]) => t === null).map(([id]) => id));
        const result = mergeLibrary(tracks.filter(t => !deleted.has(String(t.id))), Object.values(operations).filter(Boolean));
        cache(result);
        saved = result;
        await flush(operations);
        return {tracks: result, synced: true};
      } catch (error) { return {tracks: mergeLibrary([], saved), synced: false, error}; }
    },
    async save(tracks, removed = []) {
      // Never report cloud success if Telegram rejected a write.
      const operations = pending();
      for (const id of removed) operations[String(id)] = null;
      for (const track of tracks) operations[String(track.id)] = track;
      local.setItem(pendingKey, JSON.stringify(operations));
      return flush(operations);
    },
    cache,
  };
}
