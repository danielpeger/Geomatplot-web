import * as THREE from "three";
import { point, dPoint } from "./point.js";
import {
  createUniformCurve,
  createCentripetalCurve,
  createChordalCurve,
  createCustomCurve,
} from "./curve.js";
import { circle } from "./circle.js";
import { distance } from "./distance.js";
import { dScalar } from "./dScalar.js";
import { segment } from "./segment.js";
import { pointSequence } from "./pointSequence.js";
import { polygon } from "./polygon.js";
import { text } from "./text.js";
import { createDependencySystem } from "./dependency.js";
import { addImagePlane, createFunctionImage2D } from "./image.js";
import { customValue } from "./customValue.js";

// Sketch of the triangle section in examples/example.m.
// Coordinates are scaled into the viewer's pixel space.
export function draw(scene) {
  const S = 420;
  const at = (x, y) => [(x - 0.5) * S, (y - 0.2) * S];

  const A = put(scene, ...at(0, 0));
  const B = put(scene, ...at(1, 0));
  const C = put(scene, ...at(0.6, 0.55));
  tag(scene, A, "A");
  tag(scene, B, "B");
  tag(scene, C, "C");

  const blue = { color: 0x0000ff, linewidth: 2 };
  segment(scene, A, B, blue);
  segment(scene, B, C, blue);
  segment(scene, C, A, blue);

  const midBC = midpoint(scene, B, C);
  const midCA = midpoint(scene, C, A);
  const midAB = midpoint(scene, A, B);
  segment(scene, A, midBC, { dashed: true });
  segment(scene, B, midCA, { dashed: true });
  segment(scene, C, midAB, { dashed: true });

  const Spt = dPoint(
    scene,
    A,
    B,
    C,
    (a, b, c) => [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3],
    { color: 0x111111, size: 9 }
  );
  tag(scene, Spt, "S");

  through(scene, [A, B], (t, a, b) => perpBisector(a, b, t));
  through(scene, [B, C], (t, b, c) => perpBisector(b, c, t));
  through(scene, [C, A], (t, c, a) => perpBisector(c, a, t));

  const circum = circle(scene, A, B, C, { color: 0xff00ff });
  tag(scene, circum.centerMarker, "K");

  through(scene, [A, B, C], (t, a, b, c) => angleBisector(a, b, c, t));
  through(scene, [B, C, A], (t, b, c, a) => angleBisector(b, c, a, t));
  through(scene, [C, A, B], (t, c, a, b) => angleBisector(c, a, b, t));

  const O = dPoint(scene, A, B, C, (a, b, c) => incenter(a, b, c), {
    color: 0x111111,
    size: 7,
  });
  tag(scene, O, "O");
  const inradius = dScalar(O, A, B, (o, a, b) => distToSegment(o, a, b));
  circle(scene, O, inradius, { color: 0x00bcd4, centerSize: 0 });

  through(scene, [A, B, C], (t, a, b, c) => altitude(a, b, c, t));
  through(scene, [B, C, A], (t, b, c, a) => altitude(b, c, a, t));
  through(scene, [C, A, B], (t, c, a, b) => altitude(c, a, b, t));

  const M = dPoint(scene, A, B, C, (a, b, c) => orthocenter(a, b, c), {
    color: 0x111111,
    size: 7,
  });
  tag(scene, M, "M");
  segment(scene, M, circum.centerMarker, { color: 0xff0000, linewidth: 2 });
}

function put(scene, x, y) {
  return point(scene, x, y, { color: 0x0000ff, size: 8 });
}

function tag(scene, pos, str) {
  text(scene, pos, str, {
    color: 0x222222,
    fontSize: 280,
    offset: { x: 12, y: 12 },
  });
}

function midpoint(scene, P, Q) {
  return dPoint(scene, P, Q, (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2], {
    color: 0x0000ff,
    size: 5,
  });
}

function through(scene, sources, pointAt) {
  const end = (t) =>
    dPoint(scene, ...sources, (...vals) => pointAt(t, ...vals), {
      hidden: true,
      size: 1,
    });
  segment(scene, end(-1), end(1), { dashed: true, color: 0x444444 });
}

const SPAN = 1600;

function perpBisector(a, b, t) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return [mx + (-dy / len) * SPAN * t, my + (dx / len) * SPAN * t];
}

function angleBisector(a, b, c, t) {
  let abx = a.x - b.x;
  let aby = a.y - b.y;
  let cbx = c.x - b.x;
  let cby = c.y - b.y;
  const lab = Math.hypot(abx, aby) || 1;
  const lcb = Math.hypot(cbx, cby) || 1;
  abx /= lab;
  aby /= lab;
  cbx /= lcb;
  cby /= lcb;
  let dx = abx + cbx;
  let dy = aby + cby;
  const len = Math.hypot(dx, dy) || 1;
  return [b.x + (dx / len) * SPAN * t, b.y + (dy / len) * SPAN * t];
}

function altitude(p, a, b, t) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return [p.x + (-dy / len) * SPAN * t, p.y + (dx / len) * SPAN * t];
}

function incenter(a, b, c) {
  const la = Math.hypot(b.x - c.x, b.y - c.y);
  const lb = Math.hypot(a.x - c.x, a.y - c.y);
  const lc = Math.hypot(a.x - b.x, a.y - b.y);
  const sum = la + lb + lc || 1;
  return [
    (la * a.x + lb * b.x + lc * c.x) / sum,
    (la * a.y + lb * b.y + lc * c.y) / sum,
  ];
}

function orthocenter(a, b, c) {
  const altA = [-(c.y - b.y), c.x - b.x];
  const altB = [-(c.y - a.y), c.x - a.x];
  const den = altA[0] * altB[1] - altA[1] * altB[0];
  if (Math.abs(den) < 1e-8) return [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3];
  const t = ((b.x - a.x) * altB[1] - (b.y - a.y) * altB[0]) / den;
  return [a.x + t * altA[0], a.y + t * altA[1]];
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// - @TODO curve --> tMin és tMax állíthatósága 0 és 1 helyett
// - @TODO image --> Legyen megadható akár több curve is
// - @TODO Dependency egységesítése (Tulajdonképpen csak annyi különbözik, hogy mit ad vissza)
// - @TODO Point sequence és poligno callback-el generáltatni (jelenleg a customValue-val helyettesíthető)
// - @TODO HTML beviteli mezőket hazsnálni a dependency rendszerbe (pl. egy numINput field aminek az értékét pl. egy dPoint megkapja)
// - @TODO Valamelyik callback hibával tér vissza, akkor objektum ne jelenjen meg és a tőle függő dolgok se jelenjenek meg
