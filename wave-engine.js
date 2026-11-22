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

export function shuffleUpcoming(queue, index) {
  if (!Array.isArray(queue) || queue.length <= 1) return;
  const startIndex = Math.max(-1, Math.min(index, queue.length - 2));
  for (let i = queue.length - 1; i > startIndex + 1; i--) {
    const j = startIndex + 1 + Math.floor(Math.random() * (i - startIndex));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
}
