/** Keep songs already waiting in their original order, including on a slow refill. */
export function appendWaveBatch(queue, index, batch) {
  const pending = new Set(queue.slice(index + 1).map(track => track.id));
  const additions = [];
  for (const track of batch) {
    if (!pending.has(track.id)) {
      pending.add(track.id);
      additions.push(track);
    }
  }
  // At a catalog boundary prefer another recording before repeating the current one.
  const currentId = queue[index]?.id;
  additions.sort((a, b) => Number(a.id === currentId) - Number(b.id === currentId));
  queue.push(...additions);
}

export function shuffleUpcoming(queue, index) {
  for (let i = queue.length - 1; i > index + 1; i--) {
    const j = index + 1 + Math.floor(Math.random() * (i - index));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
}
