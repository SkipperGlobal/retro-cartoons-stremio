// Serbian-dub shows on staricrtaci.com. Single source of truth: drives BOTH the
// "Sinhronizovani Crtaci" catalog row AND the stream lookup, so the ID always
// matches. Each: t=title, y=year, imdb (for Stremio/Cinemeta), slug (site path).
// Add one line per show that has a Serbian dub on the site.
module.exports = [
  { t: "Teenage Mutant Ninja Turtles", y: 1987, type: "series", imdb: "tt0092633", slug: "teenage-mutant-ninja-turtles" },
  { t: "SpongeBob SquarePants", y: 1999, type: "series", imdb: "tt0206512", slug: "spongebob-squarepants" },
];
