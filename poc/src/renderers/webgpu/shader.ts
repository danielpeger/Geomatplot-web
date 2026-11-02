/**
 * One instanced quad per draw item; the fragment shader evaluates a signed
 * distance per kind (0 segment, 1 circle ring, 2 point disc) for analytic
 * antialiasing. Everything is in CSS pixels; `frame.ratio` maps to device pixels.
 */
export const SHADER: string = /* wgsl */ `
struct Frame {
  size: vec2f,
  ratio: f32,
  _pad: f32,
};
@group(0) @binding(0) var<uniform> frame: Frame;

struct Instance {
  @location(0) geom: vec4f,   // segment: a.xy, b.xy | ring/disc: center.xy, radius, 0
  @location(1) color: vec4f,  // stroke colour, or disc fill
  @location(2) color2: vec4f, // disc outline colour
  @location(3) params: vec4f, // kind, width, dash on, dash off
};

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) px: vec2f,
  @location(1) @interpolate(flat) geom: vec4f,
  @location(2) @interpolate(flat) color: vec4f,
  @location(3) @interpolate(flat) color2: vec4f,
  @location(4) @interpolate(flat) params: vec4f,
};

const PI = 3.141592653589793;

@vertex
fn vs(@builtin(vertex_index) vi: u32, inst: Instance) -> Varyings {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let c = corners[vi];
  let kind = u32(inst.params.x + 0.5);
  let aa = 1.5 / frame.ratio;
  var p: vec2f;
  if (kind == 0u) {
    let a = inst.geom.xy;
    let b = inst.geom.zw;
    let len = length(b - a);
    var d = vec2f(1.0, 0.0);
    if (len > 1e-6) { d = (b - a) / len; }
    let n = vec2f(-d.y, d.x);
    let hw = inst.params.y * 0.5 + aa;
    p = (a + b) * 0.5 + d * c.x * (len * 0.5 + hw) + n * c.y * hw;
  } else if (kind == 1u) {
    p = inst.geom.xy + c * (inst.geom.z + inst.params.y * 0.5 + aa);
  } else {
    p = inst.geom.xy + c * (inst.geom.z + aa);
  }

  var out: Varyings;
  out.position = vec4f(p.x / frame.size.x * 2.0 - 1.0, 1.0 - p.y / frame.size.y * 2.0, 0.0, 1.0);
  out.px = p;
  out.geom = inst.geom;
  out.color = inst.color;
  out.color2 = inst.color2;
  out.params = inst.params;
  return out;
}

fn coverage(sd: f32) -> f32 {
  return clamp(0.5 - sd * frame.ratio, 0.0, 1.0);
}

fn dashMask(t: f32, on: f32, off: f32) -> f32 {
  if (on <= 0.0 || off <= 0.0) { return 1.0; }
  let period = on + off;
  let m = t - floor(t / period) * period;
  return select(0.0, 1.0, m <= on);
}

@fragment
fn fs(v: Varyings) -> @location(0) vec4f {
  let kind = u32(v.params.x + 0.5);
  var color = v.color;
  var alpha: f32;
  if (kind == 0u) {
    let a = v.geom.xy;
    let ab = v.geom.zw - a;
    let l2 = dot(ab, ab);
    var h = 0.0;
    if (l2 > 1e-12) { h = clamp(dot(v.px - a, ab) / l2, 0.0, 1.0); }
    let dist = length(v.px - a - ab * h);
    alpha = coverage(dist - v.params.y * 0.5) * dashMask(h * sqrt(l2), v.params.z, v.params.w);
  } else if (kind == 1u) {
    let rel = v.px - v.geom.xy;
    let dist = abs(length(rel) - v.geom.z);
    let arc = (atan2(rel.y, rel.x) + PI) * v.geom.z;
    alpha = coverage(dist - v.params.y * 0.5) * dashMask(arc, v.params.z, v.params.w);
  } else {
    let d = length(v.px - v.geom.xy) - v.geom.z;
    alpha = coverage(d);
    color = mix(v.color2, v.color, coverage(d + v.params.y));
  }
  let a = color.a * alpha;
  if (a <= 0.0) { discard; }
  return vec4f(color.rgb * a, a);
}
`;
