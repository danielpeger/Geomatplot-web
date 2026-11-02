# Geomatplot-web proof of concept

A small, layered web port of the MATLAB Geomatplot library: a public API, a
pure TypeScript geometry layer with a dependency graph, and a presentation
layer with two swappable renderers (native WebGPU and Canvas 2D). It follows
the decisions in `thesis/main.tex`, section "A proof of concept architektúrális
döntései".

## Commands

Requires Node.js 20+ (tested with Node 24.14, npm 11.9).

```sh
npm install        # pinned: culori (runtime); typescript, vite, vitest and type packages (dev)
npm run dev        # builds the library, then starts the dev server on demo/demo.html
npm run build:watch # optional, second terminal: rebuild dist/geomatplot.js on src/ changes
npm test           # headless unit tests (Vitest, Node environment)
npm run typecheck  # tsc --noEmit (src/, test/)
npm run build      # type check, ES module + script builds and .d.ts files into dist/
npm pack --dry-run # list what would be published (dist/, package.json, README, LICENSE)
```

## Demos

Both demo pages live in `demo/` and show the same figure: a triangle, the
midpoint of one side, a dashed segment from it to the opposite vertex, and the
circle centred at the midpoint. Drag a coloured point to move it, drag empty
space to pan, and use the mouse wheel to zoom. Hovering highlights points,
segments and circles. To switch renderer, swap the commented
`Geomatplot.use(...)` line.

- `demo/demo.html`: the ES module demo, served by `npm run dev`. It imports the
  built package by name, `import { Geomatplot, WebGPURenderer, Canvas2DRenderer }
  from 'geomatplot'`, like a project that installed it from npm. Nothing is
  loaded from `src/`.
- `demo/demo-iife.html`: the script-tag demo, a single file for `file://` (see
  below).

`'geomatplot'` resolves through the package's own `"exports"` (a package
self-reference), to `dist/geomatplot.js` for Vite and to `dist/types/` for
TypeScript; culori comes from `node_modules`. No alias or `paths` entry is
needed. So `dist/` must exist: `npm run dev` builds first, which makes
`npm install && npm run dev` work on a fresh clone. While the dev server runs,
`npm run build:watch` keeps `dist/geomatplot.js` current; reload the page to
pick up changes.

## Usage

```js
Geomatplot.use(WebGPURenderer); // one line per page; or Canvas2DRenderer

const g = new Geomatplot(canvas);
const A = g.Point([0, 0]);
const B = g.Point([3, 1], { color: 'red' });
const s = g.Segment(A, B);
const M = g.Midpoint(A, B);
const c = g.Circle(A, B, { width: 2 }); // centre + boundary point
```

Style is an optional last argument and always a plain object:
`{ color, width, dash, size, visible }`. `color` is any CSS colour parsed by
[culori](https://culorijs.org/): names, hex, `rgb()`, `hsl()`, `hwb()`, `lab()`,
`oklch()`, `color(display-p3 ...)` or `transparent`; colours outside sRGB are
clamped, and an invalid colour throws. `dash` is `[on, off]` in pixels (or
`true`), `size` is the point radius in pixels. The API is provisional.

The ES module build imports culori as a dependency; the script build bundles it.

With the script build, the global `Geomatplot` is the plot class, and the
renderers hang off it: `Geomatplot.use(Geomatplot.WebGPURenderer)`.

## Script-tag demo (no dev server)

`demo/demo-iife.html` uses the library the way a user would: a plain
`<script src="../dist/geomatplot.iife.js">` that loads the package build output
directly, and an inline script with API calls. There are no modules, no Vite
and no bundler at runtime.

```sh
npm run build
open demo/demo-iife.html   # or double-click it; file:// works
```

Run `npm run build` again after changing the library. Opened from `file://`,
Chrome runs both WebGPU and Canvas 2D, because `file://` counts as a secure
context.

## Distribution

The library ships as one npm package, `geomatplot` (not published yet). It
contains an ES module build, a single-file script build and TypeScript
declarations.

Script tag from a CDN (pin a version in real pages):

```html
<script src="https://cdn.jsdelivr.net/npm/geomatplot@0.1.0"></script>
<!-- or: https://unpkg.com/geomatplot@0.1.0 -->
<script>
  Geomatplot.use(Geomatplot.WebGPURenderer);
  const g = new Geomatplot(document.getElementById('c'));
</script>
```

The bare package URL serves `dist/geomatplot.iife.js` (the `jsdelivr` and
`unpkg` fields). The explicit path also works:
`https://cdn.jsdelivr.net/npm/geomatplot@0.1.0/dist/geomatplot.iife.js`.

npm with a bundler or native ES modules (types are included):

```sh
npm install geomatplot
```

```js
import { Geomatplot, WebGPURenderer } from 'geomatplot';
Geomatplot.use(WebGPURenderer);
```

Download: take `dist/geomatplot.iife.js` from `npm run build` (or from the CDN
URL above), put it where your page can reach it and load it with a plain
`<script src="...">`, as `demo/demo-iife.html` does.

## Where each layer lives

| Layer | Path |
| --- | --- |
| Public API (`Geomatplot`, `Point`, `Segment`, `Midpoint`, `Circle`, style) | `src/api/` |
| Geometry layer: objects, dependency graph, read-only shapes, `drag` | `src/geometry/` |
| Presentation: per-plot wiring | `src/presentation/plotPresentation.ts` |
| Interaction handler and CPU hit test | `src/presentation/interaction/` |
| View (visible region, pixel/plot transform) | `src/presentation/view/` |
| Interaction state (hovered, dragged) | `src/presentation/state/` |
| Frame scheduler (`requestAnimationFrame`, coalesced) | `src/presentation/scheduler/` |
| Draw list (types, style record, builder) | `src/presentation/drawlist/` |
| Renderer contract | `src/renderers/renderer.ts` |
| WebGPU renderer | `src/renderers/webgpu/` |
| Canvas 2D renderer | `src/renderers/canvas2d/` |
| Library entries (ES module, script build) | `src/index.ts`, `src/browser.ts` |
| ES module demo page (imports `'geomatplot'`) | `demo/demo.html` |
| Script-tag demo page | `demo/demo-iife.html` |
| Declaration build config | `tsconfig.build.json` |
| Tests | `test/` |

The geometry layer imports nothing from the DOM or the GPU. The presentation
layer sees only `GeometryReader` (`src/geometry/shapes.ts`): the read-only
element list with computed shapes, a change subscription and `drag`. Renderers
see only the draw list (`src/presentation/drawlist/types.ts`).

The redraw path is: change, scheduler, draw list, renderer. Geometry changes,
View changes and highlight changes only mark the plot dirty. The page-wide
scheduler renders each dirty plot at most once per animation frame, redrawing
the whole plot. A drag recomputes only the transitive dependents of the dragged
point, in creation order. Inputs always exist before the elements built from
them, so creation order is a topological order and also keeps the order the
construction was written in.

## Notes

- If the selected renderer cannot start (for example WebGPU is missing), the
  canvas shows an error message. There is no automatic fallback.
- The WebGPU renderer draws all items with a single instanced pipeline.
  Segments are capsules, circles are rings and points are discs, each with
  analytic antialiasing, in draw-list order.
- The `Geomatplot.use(...)` call must come before the first `new Geomatplot(...)`.
