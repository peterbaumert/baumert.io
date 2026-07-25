# baumert.io

Personal site for Peter Baumert — sysadmin/developer, and remote PTZ camera operator.

Live at [baumert.io](https://baumert.io).

## Stack

Plain static site — no framework, no build step, no dependencies.

- `index.html` — page markup, four tabs: Home, Dev, PTZ, Impressum
- `css/style.css` — "Hybrid Console" design (light console UI, dark monospace footer nav)
- `js/script.js` — tab switching, footer clock
- `js/ptz.js` — interactive PTZ desk scene (joystick pan, zoom rocker, draggable camera view) on the PTZ tab
- `img/ptz/` — desk backdrop photo + gig thumbnail photos used by the PTZ tab

## Hosting / deployment

Hosted on **Cloudflare Pages** (project `baumert-io`), connected directly to this GitHub repo via Cloudflare's GitHub App integration — no CI workflow or build command involved, pushes deploy as-is.

- Push to `main` → deploys to production (`baumert.io`)
- Push to any other branch → deploys a preview at `<branch>.baumert-io.pages.dev`
- Open a PR → Cloudflare's GitHub App comments the preview URL automatically

## Local development

No build tooling required — open `index.html` directly in a browser, or serve the directory with anything static, e.g.:

```bash
python3 -m http.server 8000
```
