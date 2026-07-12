const fetch = require("node-fetch");

const TMDB_KEY = process.env.TMDB_API_KEY || "";
const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const LANG = process.env.TMDB_LANG || "en-US";
const DATE_GTE = process.env.CN_DATE_GTE || "1990-01-01";
const DATE_LTE = process.env.CN_DATE_LTE || "2010-12-31";

const USE_BEARER = TMDB_KEY.startsWith("ey");
const authHeaders = () => (USE_BEARER ? { Authorization: `Bearer ${TMDB_KEY}` } : {});
const withKey = (url) => (USE_BEARER ? url : url + (url.includes("?") ? "&" : "?") + "api_key=" + TMDB_KEY);

// --- tiny TTL cache ---
const cache = new Map();
const cacheGet = (k) => {
  const h = cache.get(k);
  if (!h) return null;
  if (Date.now() > h.exp) { cache.delete(k); return null; }
  return h.val;
};
const cacheSet = (k, v, ttl) => cache.set(k, { val: v, exp: Date.now() + ttl });

async function tmdb(path) {
  const res = await fetch(withKey(`${BASE}${path}`), { headers: authHeaders() });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  return res.json();
}

// IMDb id for a TMDB tv id, cached hard (never changes).
async function imdbForTv(tmdbId) {
  const key = `ext:tv:${tmdbId}`;
  const c = cacheGet(key);
  if (c !== null) return c;
  let id = null;
  try {
    const d = await tmdb(`/tv/${tmdbId}/external_ids`);
    id = d.imdb_id || null;
  } catch (e) {}
  cacheSet(key, id, 30 * 24 * 60 * 60 * 1000);
  return id;
}

function tvMetaFromItem(item, imdb) {
  const y = (item.first_air_date || "").slice(0, 4);
  return {
    id: imdb,
    type: "series",
    name: item.name,
    poster: item.poster_path ? `${IMG}/w500${item.poster_path}` : undefined,
    posterShape: "poster",
    background: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : undefined,
    description: item.overview || undefined,
    releaseInfo: y || undefined,
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
  };
}

// Browse one network's animated shows in a date window, paginated by skip.
async function getNetwork(networkId, { skip, gte, lte } = {}) {
  if (!TMDB_KEY) return [];
  const page = Math.floor((skip || 0) / 20) + 1;
  const params = new URLSearchParams({
    with_networks: String(networkId),
    with_genres: "16",
    "first_air_date.gte": gte || DATE_GTE,
    "first_air_date.lte": lte || DATE_LTE,
    sort_by: "popularity.desc",
    include_adult: "false",
    page: String(page),
    language: LANG,
  });
  const key = `net:${params.toString()}`;
  let results = cacheGet(key);
  if (!results) {
    const data = await tmdb(`/discover/tv?${params.toString()}`);
    results = data.results || [];
    cacheSet(key, results, 6 * 60 * 60 * 1000);
  }
  const metas = await Promise.all(
    results.map(async (item) => {
      const imdb = await imdbForTv(item.id);
      return imdb ? tvMetaFromItem(item, imdb) : null;
    })
  );
  return metas.filter(Boolean);
}

// --- curated list (deep cuts / guaranteed inclusions) ---
async function resolveEntry(entry) {
  const kind = entry.type === "movie" ? "movie" : "tv";
  const stremioType = kind === "tv" ? "series" : "movie";
  const key = `classic:${kind}:${entry.t}:${entry.y}`;
  const c = cacheGet(key);
  if (c !== null) return c;
  let out = null;
  try {
    let imdb = entry.imdb || null;
    let item = null;
    if (imdb) {
      const f = await tmdb(`/find/${imdb}?external_source=imdb_id&language=${LANG}`);
      const arr = kind === "tv" ? f.tv_results : f.movie_results;
      item = (arr && arr[0]) || null;
    } else {
      const yp = kind === "tv"
        ? (entry.y ? `&first_air_date_year=${entry.y}` : "")
        : (entry.y ? `&primary_release_year=${entry.y}` : "");
      let s = await tmdb(`/search/${kind}?query=${encodeURIComponent(entry.t)}${yp}&language=${LANG}`);
      item = (s.results && s.results[0]) || null;
      if (!item && entry.y) {
        // retry without the year constraint in case our year is slightly off
        s = await tmdb(`/search/${kind}?query=${encodeURIComponent(entry.t)}&language=${LANG}`);
        item = (s.results && s.results[0]) || null;
      }
      if (item) {
        const ext = await tmdb(`/${kind}/${item.id}/external_ids`);
        imdb = ext.imdb_id || null;
      }
    }
    if (imdb) {
      out = {
        id: imdb,
        type: stremioType,
        name: entry.t,
        poster: item && item.poster_path ? `${IMG}/w500${item.poster_path}` : undefined,
        posterShape: "poster",
        background: item && item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : undefined,
        description: (item && item.overview) || undefined,
        releaseInfo: String(entry.y),
      };
    }
  } catch (e) {}
  cacheSet(key, out, 30 * 24 * 60 * 60 * 1000);
  return out;
}

async function resolveList(list, { skip } = {}) {
  if (!TMDB_KEY) return [];
  const sorted = list.slice().sort((a, b) => a.y - b.y);
  const start = skip || 0;
  const slice = sorted.slice(start, start + 20);
  const metas = await Promise.all(slice.map(resolveEntry));
  return metas.filter(Boolean);
}

module.exports = { getNetwork, resolveList, hasKey: () => !!TMDB_KEY };
