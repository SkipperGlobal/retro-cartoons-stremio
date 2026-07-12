const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const { hasKey } = require("./tmdb");

const PORT = process.env.PORT || 7000;

if (!hasKey()) {
  console.warn(
    "\n[cn-addon] WARNING: TMDB_API_KEY is not set. The addon will install but " +
      "every catalog will be empty until you set it.\n"
  );
}

serveHTTP(addonInterface, { port: PORT });

console.log(`\n[cn-addon] Manifest: http://127.0.0.1:${PORT}/manifest.json\n`);
