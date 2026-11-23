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

export function discoveryContext(catalog, history = [], recent = [], liked = []) {
  const ids = new Set([...history, ...recent, ...liked]);
  const artists = new Set(catalog.filter(t => ids.has(t.id))
    .map(t => (t.artist || "").trim().toLowerCase()).filter(Boolean));
  return {active: new Set(liked).size >= 30, artists, ids};
}

export function waveProgress(library) {
  const count = new Set(library.map(t => `${t.artist.trim().toLowerCase()}\n${t.title.trim().toLowerCase()}`)).size;
  return {count, remaining: Math.max(0, 30 - count), unlocked: count >= 30};
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
