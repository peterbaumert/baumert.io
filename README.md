# baumert.io

Personal site for Peter Baumert — sysadmin/developer, and remote PTZ camera operator.

Live at [baumert.io](https://baumert.io).

## Stack

Plain static site — no framework, no build step, no dependencies.

- `index.html` — page markup, four tabs: Home, Dev, PTZ, Impressum
- `css/style.css` — "Hybrid Console" design (light console UI, dark monospace footer nav)
- `js/script.js` — tab switching, footer clock, plus fetching and rendering the Dev projects cards described below
- `js/ptz.js` — interactive PTZ desk scene (joystick pan, zoom rocker, draggable camera view) on the PTZ tab, plus fetching and laying out the job cards described below
- `img/ptz/` — desk backdrop photo + gig thumbnail photos used by the PTZ tab
- `ptz-jobs/` — one JSON file per PTZ job card (see below)
- `js/ptz-cards.json` — generated from `ptz-jobs/*.json`, do not edit by hand
- `dev-projects/` — one JSON file per Dev tab project card (see below)
- `js/dev-projects.json` — generated from `dev-projects/*.json`, do not edit by hand

## PTZ job cards

Each card on the PTZ tab is defined by a file in `ptz-jobs/`, e.g.:

```json
{
  "title": "SAP Arena",
  "meta": "2011–present · Mannheim",
  "thumbnail": "saparena.png",
  "description": "LED board operation, advertising spot coordination, and multi-camera remote operation."
}
```

`thumbnail` is a bare filename resolved against `img/ptz/`. There's no position field: `js/ptz.js` scatters cards radially around the field's center (evenly-spaced angle per card, seeded from its title so a given card's spot is stable across reloads, with collision avoidance so cards never overlap).

**Adding a job:** drop a new file in `ptz-jobs/`, open a PR (a GitHub Actions check validates it — required fields present, thumbnail exists), merge. On merge, another workflow runs `scripts/build_ptz_cards.py` and commits the regenerated `js/ptz-cards.json` straight to `main` if it changed; that commit then deploys like any other (see below). The card appears on the next deploy with no further action needed.

To regenerate locally: `python3 scripts/build_ptz_cards.py`.

## Dev project cards

Each card on the Dev tab is defined by a file in `dev-projects/`, e.g.:

```json
{
  "name": "netbox-device-view",
  "description": "NetBox plugin rendering a device's physical ports and interfaces as a visual grid.",
  "repoUrl": "https://github.com/peterbaumert/netbox-device-view",
  "badges": {
    "stars": true,
    "version": true,
    "ci": "test.yml"
  }
}
```

Cards render in filename-sort order — rename files (e.g. `01-foo.json`) to reorder them. Same pipeline as the PTZ cards, just simpler (it's a plain CSS grid, no position/layout logic needed): a PR-time validation workflow, a push-to-`main` build workflow that regenerates and commits `js/dev-projects.json` via `scripts/build_dev_projects.py`, and `js/script.js` fetching it at page load.

**`repoUrl` is optional** — omit it for a private repo (e.g. `AdlerController`) and the card renders with just a name and description, no "view repo" link and no badges (a private repo's page/badges wouldn't resolve for visitors anyway).

**`badges` is optional and per-badge opt-in**, only meaningful when `repoUrl` is set (the build fails if `badges` is present without it):
- `stars`/`version` (`true`/`false`) — derived automatically from `repoUrl` via shields.io's generic GitHub endpoints, no extra info needed.
- `ci` — the target repo's workflow **filename** (e.g. `"test.yml"`, `"ci.yml"`), not its display name. There's no way to derive this automatically since it varies per repo; find it via that repo's Actions tab or `gh api repos/<owner>/<repo>/actions/workflows`.

To regenerate locally: `python3 scripts/build_dev_projects.py`.

## Hosting / deployment

Hosted on **Cloudflare Pages** (project `baumert-io`), connected directly to this GitHub repo via Cloudflare's GitHub App integration — no Cloudflare build command involved, pushes deploy as-is. The GitHub Actions workflows above only regenerate `js/ptz-cards.json`/`js/dev-projects.json` and commit them back to `main`; Cloudflare deploys that commit exactly like any other, unaware anything was generated.

- Push to `main` → deploys to production (`baumert.io`)
- Push to any other branch → deploys a preview at `<branch>.baumert-io.pages.dev`
- Open a PR → Cloudflare's GitHub App comments the preview URL automatically

## Local development

No build tooling required — open `index.html` directly in a browser, or serve the directory with anything static, e.g.:

```bash
python3 -m http.server 8000
```
