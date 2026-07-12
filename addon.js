const { addonBuilder } = require("stremio-addon-sdk");
const { getNetwork, resolveList } = require("./tmdb");
const C = require("./classics");

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
  version: "7.0.0",
  name: "Retro Cartoons",
  description:
    "The complete golden-age cartoon vault: everything Cartoon Network aired " +
    "(originals, Hanna-Barbera, Looney Tunes & WB, DC & Marvel, 80s action, " +
    "Toonami/anime), plus Scooby / CN / classic cartoon movies and live " +
    "network browse rows. Catalog only, keyed by IMDb IDs so your own stream " +
    "addons handle playback.",
  resources: ["catalog"],
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

module.exports = builder.getInterface();
