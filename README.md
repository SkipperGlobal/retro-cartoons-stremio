# Cartoon Network catalog addon for Stremio

A self-hosted Stremio addon that adds a **Cartoon Network** row (series + movies)
to your Board and Discover tabs. It is a **catalog-only** addon: it pulls the list
of CN shows from TMDB and hands Stremio real **IMDb IDs**, so Cinemeta fills in the
detail pages and whatever stream addon you already use (Torrentio, Comet, your
debrid setup, etc.) provides playback. Nothing is scraped or hosted here, which is
why it stays reliable while stream-bundling addons come and go.

## Why this over the ready-made one

The community `stremio-cartoon-network` addon bundles its own scraped streams. It
works until the author's server dies or the source breaks. This one only provides
the catalog and leans on your existing stream stack, so it keeps working and you
control it.

## 1. Get a free TMDB key

1. Make an account at https://www.themoviedb.org
2. Go to https://www.themoviedb.org/settings/api
3. Copy either the **API Key (v3)** or the **API Read Access Token (v4)**. Either
   works, the addon auto-detects which one you pasted.

## 2. Run it

```bash
cp .env.example .env
# paste your key into TMDB_API_KEY in .env
npm install
TMDB_API_KEY=your_key_here npm start
```

You'll see:

```
[cn-addon] Manifest: http://127.0.0.1:7000/manifest.json
```

(If you use a `.env` file instead of inline env vars, run it with
`node --env-file=.env server.js` on Node 20+, or `export $(cat .env | xargs) && npm start`.)

## 3. Install into Stremio

- Local test on the same machine: open
  `http://127.0.0.1:7000/manifest.json` in the Stremio search/addon box, or paste
  it into **Addons -> Add addon**.
- Then open the **Discover** tab: you'll see **Cartoon Network** (series) and
  **Cartoon Network Movies**, each with a genre filter dropdown.

`127.0.0.1` only works on the machine running the server. To use it on your phone
or a streaming stick, deploy it somewhere with a public HTTPS URL (next section)
and install that URL instead.

## 4. Deploy for real (public HTTPS)

Any Node host works. Set the `TMDB_API_KEY` env var in the host's dashboard, deploy
this folder, then install `https://your-app-url/manifest.json` in Stremio.

- **Render / Railway / Fly.io**: point at this repo, build command `npm install`,
  start command `npm start`. Add `TMDB_API_KEY` as an env var.
- **Beamup** (the free Stremio community host, same infra the CN addon uses):
  ```bash
  npm i -g beamup-cli   # or: npx beamup
  beamup
  ```
  Follow the prompts, set `TMDB_API_KEY` in the generated config.

## Config knobs (all optional, env vars)

| Var             | Default | What it does                                              |
| --------------- | ------- | --------------------------------------------------------- |
| `TMDB_API_KEY`  | (none)  | Required. TMDB v3 key or v4 read token.                   |
| `PORT`          | 7000    | Port to listen on.                                        |
| `TMDB_LANG`     | en-US   | Title/overview language.                                  |
| `CN_NETWORK_ID` | 56      | TMDB TV network id driving the series row.                |
| `CN_COMPANY_ID` | 7899    | TMDB company id (CN Studios) driving the movies row.      |

If the **movies** row ever looks empty or off, it's the company id. Search the
studio on TMDB, grab the numeric id from the URL, and set `CN_COMPANY_ID`. Same
trick works to repurpose this whole addon for any other network: change
`CN_NETWORK_ID` and the manifest name, and you've got a Nickelodeon / Adult Swim /
Disney Channel catalog with zero other edits.

## How it works (short version)

- `manifest.json` declares two catalogs (`series`, `movie`) with genre + skip.
- On each catalog request it hits TMDB `discover` filtered by network/company,
  paginates via `skip`, and for each result resolves the IMDb id via
  `external_ids` (cached 30 days) so streams resolve.
- Results and IMDb lookups are cached in memory (6h for catalog pages) to stay
  fast and well under TMDB rate limits.
