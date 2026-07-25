# baumert.io

Personal site for Peter Baumert — sysadmin/developer, and remote PTZ camera operator.

Live at [baumert.io](https://baumert.io).

## Stack

Plain static site — no framework, no build step, no dependencies.

- `index.html` — page markup, four tabs: Home, Dev, PTZ, Impressum
- `css/style.css` — "Hybrid Console" design (light console UI, dark monospace footer nav)
- `js/script.js` — tab switching, footer clock
- `js/ptz.js` — interactive PTZ desk scene (joystick pan, zoom rocker, draggable camera view) on the PTZ tab, plus fetching and laying out the job cards described below
- `img/ptz/` — desk backdrop photo + gig thumbnail photos used by the PTZ tab
- `ptz-jobs/` — one JSON file per PTZ job card (see below)
- `js/ptz-cards.json` — generated from `ptz-jobs/*.json`, do not edit by hand

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

`thumbnail` is a bare filename resolved against `img/ptz/`. Cards render in filename-sort order — rename files (e.g. `01-foo.json`) to reorder them. There's no position field: `js/ptz.js` measures each card's real rendered height in the browser and packs them into columns automatically, so cards can vary in height freely.

**Adding a job:** drop a new file in `ptz-jobs/`, open a PR (a GitHub Actions check validates it — required fields present, thumbnail exists), merge. On merge, another workflow runs `scripts/build_ptz_cards.py` and commits the regenerated `js/ptz-cards.json` straight to `main` if it changed; that commit then deploys like any other (see below). The card appears on the next deploy with no further action needed.

To regenerate locally: `python3 scripts/build_ptz_cards.py`.

## Hosting / deployment

Hosted on **Cloudflare Pages** (project `baumert-io`), connected directly to this GitHub repo via Cloudflare's GitHub App integration — no Cloudflare build command involved, pushes deploy as-is. The GitHub Actions workflows above only regenerate `js/ptz-cards.json` and commit it back to `main`; Cloudflare deploys that commit exactly like any other, unaware anything was generated.

- Push to `main` → deploys to production (`baumert.io`)
- Push to any other branch → deploys a preview at `<branch>.baumert-io.pages.dev`
- Open a PR → Cloudflare's GitHub App comments the preview URL automatically

## Local development

No build tooling required — open `index.html` directly in a browser, or serve the directory with anything static, e.g.:

```bash
python3 -m http.server 8000
```
