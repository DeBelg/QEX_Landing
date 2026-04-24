# QEX Global — Landing Page

A static, mobile-first landing page powered by [Vite](https://vitejs.dev) and
[anime.js](https://animejs.com). Particle backgrounds are rendered on
`<canvas>` for smooth 60 fps on phones.

## Views

| ID | Name           | Background                                          |
| -- | -------------- | --------------------------------------------------- |
| A  | LandingCatcher | White (light) / black (dark) with quantum atom      |
| B  | About          | Black with horizontal wave of shaded spheres (calm) |
| C  | Threat         | Black with horizontal waves (faster, sharper)       |
| D  | Team           | Black with 6 mini-electron cards (2 cols × 3 rows)  |
| E  | Subscribe      | Black with email subscribe form                     |

The footer links to the Privacy Policy (`privacy.html`) and Terms &
Conditions (`terms.html`).

## Stack

- **Vite 5** — dev server + bundling
- **anime.js 3** — hero & micro-interactions
- **Vanilla JS + Canvas 2D** — particle effects (no WebGL dependency)
- **CSS custom properties** — single source of truth for the palette

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # outputs to dist/
npm run preview
```

## Project layout

```
.
├── index.html              # Main landing page (Views A–E + footer)
├── privacy.html            # GDPR-compliant privacy policy
├── terms.html              # Terms & Conditions
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js             # App entry — mounts effects, animations, form
│   ├── styles/
│   │   ├── main.css        # Global + per-view styles
│   │   └── legal.css       # Privacy/Terms layout
│   └── lib/
│       ├── canvas-utils.js # DPR-aware sizing + RAF loop helpers
│       ├── sphere.js       # Shared shaded-sphere drawing (3D bead look)
│       ├── atom-fx.js      # View A — quantum atom particle field
│       ├── waves-fx.js     # Views B & C — horizontal travelling waves
│       └── electron-fx.js  # View D — mini-atom for team cards
├── vite.config.js          # Multi-page input (index/privacy/terms)
├── LICENSE.md              # Proprietary — all rights reserved
└── README.md
```

## Performance & accessibility

- All canvas effects are **paused when off-screen** (IntersectionObserver) and
  when the tab is hidden (`visibilitychange`).
- Device pixel ratio capped at **2** to keep fill-rate sane on Retina mobiles.
- Particle counts scale down on screens narrower than 480 px.
- `prefers-reduced-motion` disables animation entirely.
- View A swaps to a **light surface** when the OS reports
  `prefers-color-scheme: light`; otherwise everything stays dark.
- Form errors are spoken via `aria-live="polite"`.

## License

Proprietary — All rights reserved. See [LICENSE.md](./LICENSE.md). Use of this
work in any form requires prior written permission from
[Michiel Degruytere](https://michiel.degruytere.com).
