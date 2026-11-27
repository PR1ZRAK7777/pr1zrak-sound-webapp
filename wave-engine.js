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
export const WAVE_BATCH_SIZE = 20;

const ARTIST_SPLIT_RE = /\s*(?:&|,|;|\/|\||\bx\b|×|\+|feat\.?|\bft\.?|featuring|при\s+уч\.?|\bvs\.?)\s*/i;
const TITLE_FEATURE_RE = /[\(\[](?:feat\.?|ft\.?|featuring|prod\.?(?:\s+by)?)\s+([^\)\]]+)[\)\]]/gi;

const TASTE_CLUSTERS = {
  deadinside_hyper_glitch: new Set([
    "fem.love", "type_0", "onda andar", "shadowraze", "zxcursed", "lxner", "quiizzzmeow",
    "kurffew", "dekma", "sqwore", "rizza", "midix", "lida", "cmh", "kai angel", "9mice",
    "viperr", "prodwhiteball", "prodbyjane", "sewerslvt", "machine girl", "goreshit",
    "crystal castles", "100 gecs", "glaive", "ericdoa", "osquinn", "odetari", "kets4eki",
    "asteria", "6arelyhuman", "lumi athena", "cold carti", "aquakey",
    "emoslut666", "voidvoice717", "emosl4t696", "desely", "akiko!", "dj zup raiii",
  ]),
  alt_emo_rock_rus: new Set([
    "пошлая молли", "кишлак", "три дня дождя", "нервы", "френдзона", "мукка", "pyrokinesis",
    "mzlff", "полматери", "aikko", "playingtheangel", "gspd", "dead blonde",
    "валентин стрыкало", "король и шут", "земфира", "сплин", "кино", "порнофильмы",
    "дора", "апфс", "автостопом по фазе сна", "найтивыход", "электрофорез",
    "rsac", "агата кристи", "монеточка",
  ]),
  ru_trap: new Set([
    "big baby tape", "kizaru", "og buda", "mayot", "soda luv", "платина",
    "friendly thug 52 ngg", "alblak 52", "obladaet", "pharaoh", "boulevard depo", "yanix",
    "toxi$", "aarne", "bushido zho", "lovv66", "scally milano", "heronwater", "163onmyneck",
    "seemee", "thrill pill", "lizer", "flesh", "gone.fludd", "saluki", "markul",
    "скриптонит", "feduk", "lsp", "лсп", "jeembo", "tveth", "thomas mraz", "rocket",
    "uglystephan", "baby melo", "mnogoznaal", "yasmi", "badcurt", "raskol",
  ]),
  phonk_drift: new Set([
    "dvrst", "lxst cxntury", "kordhell", "interworld", "moondeity", "kaito shoma",
    "pharmacist", "ghostface playa", "hensonn", "playaphonk", "mc orsen", "sxmpra",
    "freddie dredd", "$uicideboy$", "haarper", "my!lane", "bones", "n5rmind",
  ]),
  melancholy_indie: new Set([
    "lil peep", "xxxtentacion", "juice wrld", "joji", "cigarettes after sex", "mac demarco",
    "arctic monkeys", "the neighbourhood", "молчат дома", "перемотка", "буерак",
    "salvia palth", "ssshhhiiittt!", "lana del rey",
  ]),
  ru_lyrical_rap: new Set([
    "miyagi", "andy panda", "эндшпиль", "баста", "oxxxymiron", "macan", "jah khalib",
    "хаски", "atl", "гуф", "каста", "ноггано", "каспийский груз",
  ]),
  ru_pop_dance: new Set([
    "anna asti", "instasamka", "zivert", "клава кока", "егор крид", "jony", "artik & asti",
    "моя мишель", "дима билан", "сергей лазарев", "полина гагарина", "мари краймбрери",
  ]),
  ru_hype_shock: new Set([
    "morgenshtern", "моргенштерн", "slava marlow", "элджей", "eldzhey", "face",
    "big russian boss", "тимати",
  ]),
  rock_metal: new Set([
    "linkin park", "rammstein", "nirvana", "system of a down", "metallica", "slipknot",
    "bring me the horizon", "three days grace", "skillet", "evanescence", "imagine dragons",
    "green day",
  ]),
  global_trap_rnb: new Set([
    "the weeknd", "travis scott", "playboi carti", "yeat", "ken carson", "destroy lonely",
    "drake", "kendrick lamar", "kanye west", "billie eilish", "eminem",
    "tyler, the creator", "frank ocean",
  ]),
};

const CLUSTER_AFFINITY = new Map([
  ["deadinside_hyper_glitch|alt_emo_rock_rus", 0.7],
  ["deadinside_hyper_glitch|phonk_drift", 0.65],
  ["deadinside_hyper_glitch|melancholy_indie", 0.6],
  ["deadinside_hyper_glitch|ru_trap", 0.35],
  ["alt_emo_rock_rus|melancholy_indie", 0.65],
  ["alt_emo_rock_rus|rock_metal", 0.45],
  ["alt_emo_rock_rus|ru_trap", 0.25],
  ["ru_trap|global_trap_rnb", 0.65],
  ["ru_trap|phonk_drift", 0.5],
  ["ru_trap|ru_lyrical_rap", 0.35],
  ["phonk_drift|global_trap_rnb", 0.4],
  ["melancholy_indie|rock_metal", 0.35],
  ["melancholy_indie|global_trap_rnb", 0.3],
  ["ru_pop_dance|ru_lyrical_rap", 0.25],
  ["ru_pop_dance|ru_hype_shock", 0.35],
]);

const RELATED_ARTISTS = new Map();
for (const [art, neighbors] of Object.entries({
  "fem.love": ["shadowraze", "zxcursed", "type_0", "onda andar", "пошлая молли", "кишлак", "три дня дождя", "sqwore"],
  "type_0": ["onda andar", "fem.love", "prodwhiteball", "prodbyjane", "sqwore", "kai angel", "9mice", "crystal castles", "sewerslvt"],
  "prodwhiteball": ["prodbyjane", "type_0", "onda andar", "fem.love", "kai angel", "9mice", "sqwore", "rizza"],
  "пошлая молли": ["кишлак", "три дня дождя", "нервы", "френдзона", "мукка", "mzlff", "полматери", "fem.love", "dead blonde"],
  "big baby tape": ["kizaru", "og buda", "mayot", "pharaoh", "obladaet", "boulevard depo", "friendly thug 52 ngg", "alblak 52", "aarne"],
  "kizaru": ["big baby tape", "og buda", "pharaoh", "obladaet", "boulevard depo", "friendly thug 52 ngg", "yanix"],
  "og buda": ["big baby tape", "kizaru", "mayot", "soda luv", "платина", "lovv66", "163onmyneck", "seemee", "heronwater"],
  "pharaoh": ["boulevard depo", "jeembo", "tveth", "mnogoznaal", "big baby tape", "kizaru", "скриптонит"],
  "dvrst": ["lxst cxntury", "kordhell", "interworld", "moondeity", "hensonn", "ghostface playa"],
  "shadowraze": ["zxcursed", "fem.love", "lxner", "quiizzzmeow", "kurffew", "dvrst", "kordhell"],
  "miyagi": ["andy panda", "эндшпиль", "скриптонит", "баста", "macan"],
  "macan": ["miyagi", "баста", "xcho", "jah khalib"],
  "linkin park": ["rammstein", "three days grace", "bring me the horizon", "skillet", "evanescence", "imagine dragons"],
})) {
  if (!RELATED_ARTISTS.has(art)) RELATED_ARTISTS.set(art, new Set());
  for (const n of neighbors) {
    RELATED_ARTISTS.get(art).add(n);
    if (!RELATED_ARTISTS.has(n)) RELATED_ARTISTS.set(n, new Set());
    RELATED_ARTISTS.get(n).add(art);
  }
}

const STYLE_KEYWORDS = {
  phonk: new Set(["phonk", "фонк", "drift", "cowbell", "memphis"]),
  breakcore: new Set(["breakcore", "glitch", "sewerslvt", "hyperpop", "nightcore", "1000"]),
  emo_alt: new Set(["emo", "punk", "панк", "рок", "rock", "dead", "sad", "pain", "любовь", "боль"]),
  trap: new Set(["trap", "plugg", "slatt", "bandana", "drill", "hood", "flex", "drip"]),
  lofi: new Set(["lofi", "chill", "park", "ambient", "wave", "night"]),
};

const cleanArtistToken = text => String(text || "").trim().toLowerCase().replace(/^[\s~*_•@]+|[\s~*_•]+$/g, "").replace(/\s+/g, " ");

export function extractArtists(artist, title = "") {
  const tokens = [];
  const seen = new Set();
  const add = raw => {
    const tok = cleanArtistToken(raw);
    if (tok && tok.length >= 2 && !seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  };
  const rawArtist = String(artist || "").trim();
  if (rawArtist) {
    for (const part of rawArtist.split(ARTIST_SPLIT_RE)) add(part);
    add(rawArtist);
  }
  const titleStr = String(title || "");
  for (const match of titleStr.matchAll(TITLE_FEATURE_RE)) {
    for (const part of String(match[1] || "").split(ARTIST_SPLIT_RE)) add(part);
  }
  return tokens;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CLUSTER_PATTERNS = Object.fromEntries(
  Object.entries(TASTE_CLUSTERS).map(([cluster, members]) => [
    cluster,
    [...members]
      .filter(m => m.length >= 4)
      .map(m => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(m)}(?![\\p{L}\\p{N}_])`, "iu")),
  ])
);

function artistClusters(tokens) {
  const found = new Set();
  for (const token of tokens) {
    for (const [cluster, members] of Object.entries(TASTE_CLUSTERS)) {
      if (members.has(token)) {
        found.add(cluster);
        continue;
      }
      if (CLUSTER_PATTERNS[cluster].some(pat => pat.test(token))) {
        found.add(cluster);
      }
    }
  }
  return found;
}

function clusterPairAffinity(c1, c2) {
  if (c1 === c2) return 1;
  return CLUSTER_AFFINITY.get(`${c1}|${c2}`) ?? CLUSTER_AFFINITY.get(`${c2}|${c1}`) ?? 0;
}

export function discoveryContext(catalog, history = [], recent = [], liked = []) {
  const ids = new Set([...history, ...recent, ...liked]);
  const artists = new Set(catalog.filter(t => ids.has(t.id))
    .flatMap(t => extractArtists(t.artist, t.title)));
  return {active: new Set(liked).size >= WAVE_MIN_TRACKS, artists, ids};
}

export function waveProgress(library) {
  const count = new Set(library.map(t => `${t.artist.trim().toLowerCase()}\n${t.title.trim().toLowerCase()}`)).size;
  return {count, remaining: Math.max(0, WAVE_MIN_TRACKS - count), unlocked: count >= WAVE_MIN_TRACKS};
}

const trackKey = t => `${(t.artist || "").trim().toLowerCase()}\n${(t.title || "").trim().toLowerCase()}`;
const primaryArtistKey = t => extractArtists(t?.artist, t?.title)[0] || (t?.artist || "").trim().toLowerCase();
const tasteTags = t => {
  const words = [t.genre, t.genres, ...(t.tags || []), ...(t.aliases || []), t.artist, t.title]
    .flat().filter(Boolean).join(" ").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const tags = new Set();
  for (const w of words) {
    if (t.genre || t.genres || t.tags?.length || t.aliases?.length) tags.add(w);
    for (const [style, kws] of Object.entries(STYLE_KEYWORDS)) {
      if (kws.has(w)) tags.add(style);
    }
  }
  return tags;
};

export function inferTasteProfile(catalog, library, extraListened = []) {
  const artistWeights = new Map();
  const clusterWeights = new Map();
  const tags = new Set();
  const byKey = new Map(catalog.map(t => [trackKey(t), t]));

  const absorb = (item, weight) => {
    const full = byKey.get(trackKey(item)) || item;
    const tokens = extractArtists(full.artist, full.title);
    tokens.forEach((tok, i) => {
      const w = i < tokens.length - 1 || tokens.length === 1 ? weight : weight * 0.5;
      artistWeights.set(tok, (artistWeights.get(tok) || 0) + w);
    });
    for (const cl of artistClusters(tokens)) {
      clusterWeights.set(cl, (clusterWeights.get(cl) || 0) + weight);
    }
    for (const tag of tasteTags(full)) tags.add(tag);
  };

  library.forEach((favorite, idx) => {
    const weight = 1 + Math.max(0, 0.8 - idx * 0.03);
    absorb(favorite, weight);
  });

  for (const listened of extraListened || []) {
    if (listened && (listened.artist || listened.title)) absorb(listened, 0.7);
  }

  const relatedWeights = new Map();
  for (const [art, w] of artistWeights.entries()) {
    for (const rel of RELATED_ARTISTS.get(art) || []) {
      if (!artistWeights.has(rel)) {
        relatedWeights.set(rel, (relatedWeights.get(rel) || 0) + w);
      }
    }
  }

  return {artistWeights, relatedWeights, clusterWeights, tags};
}

function artistTokenSet(track) {
  const tokens = extractArtists(track?.artist, track?.title);
  return new Set(tokens.length > 1 ? tokens.slice(0, -1) : tokens);
}

export function buildPersonalizedBatch(catalog, library, recentPlayed = [], excluded = [], limit = WAVE_BATCH_SIZE, random = Math.random, extraListened = []) {
  const favoriteKeys = new Set(library.map(trackKey));
  const profile = inferTasteProfile(catalog, library, extraListened);
  const recent = new Set(recentPlayed);
  const forbidden = new Set(excluded.map(trackKey));
  const unique = new Map();
  for (const t of [...catalog, ...library]) {
    if (!t || !t.audio_url || t.is_preview || forbidden.has(trackKey(t))) continue;
    const dur = Number(t.duration_sec || 0);
    const isBot = String(t.id || "").startsWith("bot-");
    if ((dur > 0 && dur < 60) || dur > 1200 || (!isBot && dur < 60)) continue;
    const key = trackKey(t);
    const previous = unique.get(key);
    const merged = {...previous, ...t};
    if (previous?.source && !t.source) merged.source = previous.source;
    if (previous?.audio_url && !t.audio_url) merged.audio_url = previous.audio_url;
    if (previous?.id && String(previous.id).startsWith("bot-") && !String(t.id || "").startsWith("bot-")) {
      merged.id = previous.id;
    }
    unique.set(key, merged);
  }

  const recPool = [], libraryPool = [], discoveryPool = [];
  for (const track of unique.values()) {
    const favorite = favoriteKeys.has(trackKey(track));
    const tokens = extractArtists(track.artist, track.title);
    const artistWeight = Math.max(0, ...tokens.map(tok => profile.artistWeights.get(tok) || 0));
    const relatedWeight = Math.max(0, ...tokens.map(tok => profile.relatedWeights.get(tok) || 0));
    const clusters = artistClusters(tokens);
    let directCluster = 0;
    for (const cl of clusters) directCluster += profile.clusterWeights.get(cl) || 0;
    let adjCluster = 0;
    if (clusters.size && profile.clusterWeights.size && directCluster === 0) {
      for (const [uc, uw] of profile.clusterWeights.entries()) {
        for (const tc of clusters) {
          adjCluster = Math.max(adjCluster, uw * clusterPairAffinity(uc, tc));
        }
      }
    }
    const shared = [...tasteTags(track)].filter(tag => profile.tags.has(tag)).length;
    const backendRec = track.source === "recommendation";
    const strongTaste = artistWeight > 0 || relatedWeight > 0 || directCluster > 0 || adjCluster >= 0.8 || shared > 0 || backendRec;
    const source = favorite ? "library" : strongTaste ? "recommendation" : "discovery";

    let tasteScore = Math.min(14, artistWeight * 2.5)
      + Math.min(9, relatedWeight * 1.6)
      + Math.min(9, directCluster * 1.4)
      + Math.min(5, adjCluster * 1.1)
      + Math.min(4, shared * 1.2)
      + (backendRec ? 6 : 0);

    // Avoid pushing unrelated scenes (e.g. Morgenshtern/pop) when user has a clear taste profile
    if (profile.clusterWeights.size && clusters.size && artistWeight === 0 && relatedWeight === 0 && directCluster === 0 && adjCluster === 0 && !backendRec) {
      tasteScore -= 12;
    }

    const poolBoost = source === "recommendation" ? 2.5 : 0;
    const rank = poolBoost + tasteScore + random() * 3.5 - (recent.has(track.id) ? 25 : 0);
    const ranked = {...track, source, tasteScore, rank};
    if (source === "library") libraryPool.push(ranked);
    else if (source === "recommendation") recPool.push(ranked);
    else discoveryPool.push(ranked);
  }

  recPool.sort((a, b) => b.rank - a.rank);
  libraryPool.sort((a, b) => b.rank - a.rank);
  discoveryPool.sort((a, b) => b.rank - a.rank);

  const result = [];
  // Prioritize taste recommendations (60%), familiar library (20%), and clean discovery (20%).
  for (let i = 0; i < limit && (recPool.length || libraryPool.length || discoveryPool.length); i++) {
    const canPickCleanDiscovery = discoveryPool.length && (discoveryPool[0].tasteScore > -8 || (!recPool.length && !libraryPool.length));
    const pickDiscovery = i % 5 === 2 && canPickCleanDiscovery;
    let pool;
    if (pickDiscovery) {
      pool = discoveryPool;
    } else if (i % 5 === 3 && libraryPool.length) {
      pool = libraryPool;
    } else if (recPool.length) {
      pool = recPool;
    } else if (libraryPool.length) {
      pool = libraryPool;
    } else {
      pool = discoveryPool;
    }

    const prevTrack = result.at(-1) || excluded.at(-1) || {};
    const prevTokens = artistTokenSet(prevTrack);
    const previousArtist = primaryArtistKey(prevTrack);
    let next = pool.findIndex(t => {
      const tokSet = artistTokenSet(t);
      if (!tokSet.size || !prevTokens.size) return primaryArtistKey(t) !== previousArtist;
      for (const tok of tokSet) if (prevTokens.has(tok)) return false;
      return true;
    });
    if (next < 0) next = pool.findIndex(t => primaryArtistKey(t) !== previousArtist);
    const {rank, tasteScore: _ts, ...track} = pool.splice(next < 0 ? 0 : next, 1)[0];
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
