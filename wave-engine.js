/**
 * Append wave tracks to queue without duplicates and avoiding recent repetitions.
 * @param {Array} queue - Current track queue
 * @param {number} index - Current playing index
 * @param {Array} batch - Candidate tracks to append
 * @param {Set|Array} [recentPlayed] - Set or Array of track IDs recently played
 */
export function appendWaveBatch(queue, index, batch, recentPlayed = new Set()) {
  const recentList = recentPlayed instanceof Set ? Array.from(recentPlayed) : Array.from(recentPlayed || []);
  const recentSet = new Set(recentList);
  const upcomingIds = new Set(queue.slice(index + 1).map(track => track.id));
  const currentId = queue[index]?.id;

  const freshAdditions = [];
  const recentAdditions = [];

  for (const track of batch) {
    if (!track || !track.id) continue;
    if (upcomingIds.has(track.id)) continue;
    if (track.id === currentId) continue;

    upcomingIds.add(track.id);
    if (recentSet.has(track.id)) {
      recentAdditions.push(track);
    } else {
      freshAdditions.push(track);
    }
  }

  // Sort recent additions: tracks played longest ago (lower index in recentList) come first!
  recentAdditions.sort((a, b) => recentList.indexOf(a.id) - recentList.indexOf(b.id));

  // Prioritize completely fresh tracks over recently played ones
  const additions = [...freshAdditions, ...recentAdditions];

  // If additions are empty and upcoming queue is empty, pick a candidate that is not currently playing
  if (additions.length === 0 && batch.length > 0 && queue.slice(index + 1).length === 0) {
    const fallback = batch.find(t => t && t.id && t.id !== currentId);
    if (fallback) additions.push(fallback);
  }

  queue.push(...additions);
}

export const WAVE_MIN_TRACKS = 15;
export const WAVE_REFRESH_INTERVAL = 5;

export function discoveryContext(catalog, history = [], recent = [], liked = []) {
  const ids = new Set([...history, ...recent, ...liked]);
  const artists = new Set(catalog.filter(t => ids.has(t.id))
    .map(t => (t.artist || "").trim().toLowerCase()).filter(Boolean));
  return {active: new Set(liked).size >= WAVE_MIN_TRACKS, artists, ids};
}

export function waveProgress(library) {
  const count = new Set(library.map(t => `${t.artist.trim().toLowerCase()}\n${t.title.trim().toLowerCase()}`)).size;
  return {count, remaining: Math.max(0, WAVE_MIN_TRACKS - count), unlocked: count >= WAVE_MIN_TRACKS};
}

const trackKey = t => `${(t.artist || "").trim().toLowerCase()}\n${(t.title || "").trim().toLowerCase()}`;
const artistKey = t => (t.artist || "").trim().toLowerCase();
const tasteTags = t => new Set([t.genre, t.genres, ...(t.tags || []), ...(t.aliases || [])]
  .flat().filter(Boolean).join(" ").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);

export function buildPersonalizedBatch(catalog, library, recentPlayed = [], excluded = [], limit = 5, random = Math.random) {
  const favoriteKeys = new Set(library.map(trackKey));
  const artistWeights = new Map();
  const tags = new Set();
  const byKey = new Map(catalog.map(t => [trackKey(t), t]));
  for (const favorite of library) {
    const artist = artistKey(favorite);
    artistWeights.set(artist, (artistWeights.get(artist) || 0) + 1);
    for (const tag of tasteTags(byKey.get(trackKey(favorite)) || favorite)) tags.add(tag);
  }
  const recent = new Set(recentPlayed);
  const forbidden = new Set(excluded.map(trackKey));
  const unique = new Map();
  for (const t of [...catalog, ...library]) {
    if (!t || !t.audio_url || t.is_preview || t.duration_sec < 60 || forbidden.has(trackKey(t))) continue;
    const previous = unique.get(trackKey(t));
    unique.set(trackKey(t), {...previous, ...t});
  }
  const preferred = [], discovery = [];
  for (const track of unique.values()) {
    const favorite = favoriteKeys.has(trackKey(track));
    const artistWeight = artistWeights.get(artistKey(track)) || 0;
    const shared = [...tasteTags(track)].filter(tag => tags.has(tag)).length;
    const source = favorite ? "library" : artistWeight || shared ? "recommendation" : "discovery";
    const ranked = {...track, source, rank: (favorite ? 8 : 0) + artistWeight * 2 + shared + random() * 4 - (recent.has(track.id) ? 20 : 0)};
    (source === "discovery" ? discovery : preferred).push(ranked);
  }
  preferred.sort((a, b) => b.rank - a.rank);
  discovery.sort((a, b) => b.rank - a.rank);
  const result = [];
  // Four familiar/related tracks and one discovery per five, where available.
  for (let i = 0; i < limit && (preferred.length || discovery.length); i++) {
    const pool = i % 5 === 2 ? (discovery.length ? discovery : preferred) : (preferred.length ? preferred : discovery);
    const previousArtist = artistKey(result.at(-1) || excluded.at(-1) || {});
    const next = pool.findIndex(t => artistKey(t) !== previousArtist);
    const {rank, ...track} = pool.splice(next < 0 ? 0 : next, 1)[0];
    result.push(track);
  }
  return result;
}

export function recordWaveCompletion(state, library) {
  state.completed = (state.completed || 0) + 1;
  if (state.completed < WAVE_REFRESH_INTERVAL) return false;
  state.completed = 0;
  state.library = [...library];
  return true;
}

export function replaceWaveTail(queue, index, batch, keepNext = 2) {
  // Preserve the playing track and two already announced songs.
  const protectedTracks = queue.slice(0, index + 1 + keepNext);
  const keys = new Set(protectedTracks.slice(index).map(trackKey));
  queue.splice(index + 1 + keepNext);
  for (const track of batch) {
    if (!keys.has(trackKey(track))) { queue.push(track); keys.add(trackKey(track)); }
  }
}

export function shuffleUpcoming(queue, index, familiarIds = new Set()) {
  if (!Array.isArray(queue) || queue.length <= 1) return;
  const startIndex = Math.max(-1, Math.min(index, queue.length - 1));
  const artist = t => (t?.artist || "").trim().toLowerCase();
  const familiar = t => familiarIds.has(t.id) || t.source === "library";
  const groups = new Map();
  for (const track of queue.slice(startIndex + 1)) {
    const key = artist(track);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(track);
  }
  let previous = artist(queue[startIndex]);
  let wantFamiliar = !familiar(queue[startIndex] || {});
  const ordered = [];
  while (groups.size) {
    const candidates = [...groups].filter(([key]) => key !== previous);
    const choices = candidates.length ? candidates : [...groups];
    // Prefer the largest artist bucket to avoid stranding repeated artists at the end.
    choices.sort((a, b) => b[1].length - a[1].length);
    const maximum = choices[0][1].length;
    const balanced = choices.filter(([, items]) => items.length === maximum);
    const preferred = balanced.filter(([, items]) => items.some(t => familiar(t) === wantFamiliar));
    const options = preferred.length ? preferred : balanced;
    const [key, items] = options[Math.floor(Math.random() * options.length)];
    let position = items.findIndex(t => familiar(t) === wantFamiliar);
    if (position < 0) position = Math.floor(Math.random() * items.length);
    const track = items.splice(position, 1)[0];
    ordered.push(track);
    previous = key;
    wantFamiliar = !familiar(track);
    if (!items.length) groups.delete(key);
  }
  queue.splice(startIndex + 1, queue.length - startIndex - 1, ...ordered);
}
