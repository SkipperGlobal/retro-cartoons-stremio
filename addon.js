const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const { getNetwork, resolveList } = require("./tmdb");
const C = require("./classics");
const DUBLIST = require("./dubs");
const DUBS = Object.fromEntries(DUBLIST.map((d) => [d.imdb, d.slug]));

// Build a comprehensive de-duplicated "Full Vault" series list from all series
// categories, sorted oldest-first at request time by the resolver.
function dedupe(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const e of list) {
      const k = e.t.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(e); }
    }
  }
  return out;
}
const VAULT = dedupe([
  C.cn_originals, C.hanna_barbera, C.looney_wb, C.dc_marvel,
  C.action_80s, C.extra_classics, C.toonami,
]);

// Curated rows. type per row.
const CURATED = [
  { id: "cn-vault", name: "Cartoon Network - Full Vault", type: "series", list: VAULT },
  { id: "cn-originals", name: "Cartoon Network Originals", type: "series", list: C.cn_originals },
  { id: "hanna-barbera", name: "Hanna-Barbera Classics", type: "series", list: C.hanna_barbera },
  { id: "looney-wb", name: "Looney Tunes & Warner Bros", type: "series", list: C.looney_wb },
  { id: "dc-marvel", name: "DC & Marvel Heroes", type: "series", list: C.dc_marvel },
  { id: "action-80s", name: "80s Action Legends", type: "series", list: C.action_80s },
  { id: "toonami", name: "Toonami & Anime", type: "series", list: C.toonami },
  { id: "saturday-morning", name: "Saturday Morning Classics", type: "series", list: C.saturday_morning },
  { id: "disney-afternoon", name: "The Disney Afternoon", type: "series", list: C.disney_afternoon },
  { id: "european", name: "European Classics", type: "series", list: C.european },
  { id: "ex-yu", name: "Ex-Yu Classics", type: "series", list: C.ex_yu },
  { id: "dubs-sr", name: "🇷🇸 Sinhronizovani Crtaći", type: "series", list: DUBLIST },
  { id: "scooby-movies", name: "Scooby-Doo Movies", type: "movie", list: C.scooby_movies },
  { id: "cn-movies", name: "Cartoon Network Movies", type: "movie", list: C.cn_movies },
  { id: "classic-movies", name: "Classic Cartoon Movies", type: "movie", list: C.classic_movies },
];

// Live network browse rows.
const NETWORKS = [
  { id: "net-cn", name: "Cartoon Network (Discover)", network: 56, gte: "1990-01-01", lte: "2013-12-31" },
  { id: "net-boomerang", name: "Boomerang (Discover)", network: 5459, gte: "1955-01-01", lte: "2015-12-31" },
  { id: "net-foxkids", name: "Fox Kids (Discover)", network: 2686, gte: "1988-01-01", lte: "2010-12-31" },
  { id: "net-nick", name: "Nickelodeon (Discover)", network: 13, gte: "1990-01-01", lte: "2013-12-31" },
];

const manifest = {
  id: "community.retro.cartoons",
  version: "10.0.0",
  name: "Retro Cartoons",
  description:
    "The complete golden-age cartoon vault: everything Cartoon Network aired " +
    "(originals, Hanna-Barbera, Looney Tunes & WB, DC & Marvel, 80s action, " +
    "Toonami/anime), plus Scooby / CN / classic cartoon movies and live " +
    "network browse rows. Catalog only, keyed by IMDb IDs so your own stream " +
    "addons handle playback.",
  resources: ["catalog", "stream"],
  types: ["series", "movie"],
  idPrefixes: ["tt"],
  catalogs: [
    ...CURATED.map((c) => ({
      type: c.type, id: c.id, name: c.name,
      extra: [{ name: "skip", isRequired: false }],
    })),
    ...NETWORKS.map((n) => ({
      type: "series", id: n.id, name: n.name,
      extra: [{ name: "skip", isRequired: false }],
    })),
  ],
  behaviorHints: { configurable: false, configurationRequired: false },
};

const builder = new addonBuilder(manifest);
const CURATED_BY_ID = Object.fromEntries(CURATED.map((c) => [c.id, c.list]));
const NET_BY_ID = Object.fromEntries(NETWORKS.map((n) => [n.id, n]));

builder.defineCatalogHandler(async ({ id, extra }) => {
  const skip = extra && extra.skip ? Number(extra.skip) : 0;
  try {
    let metas = [];
    if (CURATED_BY_ID[id]) {
      metas = await resolveList(CURATED_BY_ID[id], { skip });
    } else if (NET_BY_ID[id]) {
      const n = NET_BY_ID[id];
      metas = await getNetwork(n.network, { skip, gte: n.gte, lte: n.lte });
    }
    return { metas, cacheMaxAge: 6 * 60 * 60 };
  } catch (e) {
    console.error("[cn-addon] catalog error:", e.message);
    return { metas: [] };
  }
});

// --- Serbian-dub streams from staricrtaci.com (own site) ---
const OG_VIDEO = [
  /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+\.m3u8[^"']*)["'][^>]+property=["']og:video["']/i,
];

builder.defineStreamHandler(async ({ id }) => {
  const [imdb, season, episode] = id.split(":");
  const slug = DUBS[imdb];
  if (!slug || !season || !episode) return { streams: [] };
  const pageUrl = `https://staricrtaci.com/kratkometrazni/${slug}/season-${season}/episode-${episode}/`;
  try {
    const res = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return { streams: [] };
    const html = await res.text();
    let m = null;
    for (const re of OG_VIDEO) { m = html.match(re); if (m) break; }
    if (!m) return { streams: [] };
    const url = m[1].replace(/&amp;/g, "&");
    return {
      streams: [
        {
          name: "Stari crtaći",
          title: "🇷🇸 Srpska sinhronizacija",
          url,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
              request: { Referer: "https://staricrtaci.com/", "User-Agent": "Mozilla/5.0" },
            },
          },
        },
      ],
    };
  } catch (e) {
    console.error("[dubs] error:", e.message);
    return { streams: [] };
  }
});

module.exports = builder.getInterface();
