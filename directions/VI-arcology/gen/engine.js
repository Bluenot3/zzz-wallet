/* Arcology isometric city engine — pure functions, no DOM. Shared by every Arcology board.
   Grid coords (gx right-down, gy left-down) project to screen with a 2:1 isometric matrix.
   Tower height is money: each district's tallest tower is proportional to that asset's value. */
const AR = (function () {
  function hx(c) { if (c.indexOf('rgb') === 0) return c.match(/[\d.]+/g).slice(0, 3).map(Number); c = c.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; }
  function mix(a, b, t) {
    if (a.indexOf('rgba(') === 0 || b.indexOf('rgba(') === 0) {
      const pa = a.match(/[\d.]+/g).map(Number), pb = b.match(/[\d.]+/g).map(Number);
      return 'rgba(' + pa.map((v, i) => (i < 3 ? Math.round(v + (pb[i] - v) * t) : (v + (pb[i] - v) * t).toFixed(3))).join(',') + ')';
    }
    const A = hx(a), B = hx(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  }
  const PAL = {
    top: ['#FCFDFD', '#2C364B'], left: ['#E4E8EC', '#1E2639'], right: ['#C8CFD8', '#151B2B'],
    ground: ['#EEF1F3', '#161D2E'], road: ['#DDE2E7', '#0F1522'], plaza: ['#F6F7F8', '#1A2236'],
    plinthTop: ['#E7D5AF', '#5A4A31'], plinthL: ['#D7C095', '#4A3D29'], plinthR: ['#BDA374', '#3B3121'],
    water: ['#C3DCF0', '#0F2A52'], waterHi: ['#E6F1FA', '#2A4C86'],
    tree: ['#E7ECE4', '#283145'], treeDark: ['#CDD5CA', '#1B2232'],
    beam: ['#97A2B0', '#46526E'], pillar: ['#B3BCC7', '#2E3854'], station: ['#FFFFFF', '#2B3550'],
    shadow: ['rgba(30,46,70,0.17)', 'rgba(30,46,70,0)'], light: ['rgba(242,194,48,0)', 'rgba(255,214,102,0.95)']
  };
  /* Dusk: warm low sun on the model. Used as the middle stop when build({ dusk: true }). */
  const DUSK = {
    top: '#FBE4D2', left: '#EAC8B4', right: '#A99CB2', ground: '#EAD4C5', road: '#D9C1B5', plaza: '#F3DFD2',
    plinthTop: '#E5C091', plinthL: '#D0A775', plinthR: '#A9855A', water: '#C8B5D2', waterHi: '#F4DDE2',
    tree: '#E3D3C3', treeDark: '#C3B1A7', beam: '#9B8B9A', pillar: '#B6A3AE', station: '#FFF6EE',
    shadow: 'rgba(84,44,74,0.24)', light: 'rgba(255,196,92,0.8)'
  };
  const ASSET = {
    USD: { name: 'USD', glyph: '$', glass: '#9EB2C8', glow: '#EEF4FF', cap: '#4F5D70', line: '#5E6B7D' },
    USDC: { name: 'USDC', glyph: 'C', glass: '#7FB1F2', glow: '#5CA8FF', cap: '#2F7DF0', line: '#3D8BFF' },
    BTC: { name: 'BTC', glyph: 'B', glass: '#F0B27C', glow: '#FFAB4F', cap: '#E9801F', line: '#F28C28' },
    ETH: { name: 'ETH', glyph: 'E', glass: '#B9A6F2', glow: '#AE90FF', cap: '#7E5DEB', line: '#8C6CF2' }
  };
  /* City plan on a 10x10 grid. Quadrants: USDC back, USD right, BTC left, ETH front. Towers: [x, y, w, d, share-of-tallest]. */
  const PLAN = {
    N: 10,
    roads: [[0, 4.6, 10, 0.8], [4.6, 0, 0.8, 10]],
    plaza: [4.35, 4.35, 1.3, 1.3],
    water: [[0.5, 8.3, 2.4, 1.1]],
    districts: {
      USDC: [[1.0, 1.0, 1.6, 1.6, 1], [3.0, 0.8, 1.0, 1.0, 0.62], [0.9, 3.0, 1.1, 1.0, 0.48], [3.0, 2.8, 1.0, 1.1, 0.36]],
      USD: [[6.2, 1.6, 2.0, 2.0, 1], [8.5, 0.7, 1.0, 1.0, 0.55], [5.9, 0.4, 1.4, 0.8, 0.34], [8.6, 2.7, 0.9, 1.3, 0.46]],
      BTC: [[1.4, 6.0, 1.6, 1.6, 1], [3.3, 5.9, 1.0, 1.0, 0.6], [3.4, 7.5, 1.0, 1.2, 0.42]],
      ETH: [[6.4, 6.4, 1.4, 1.4, 1], [8.2, 6.1, 1.0, 1.0, 0.62]]
    },
    fillers: [[0.3, 0.3, 0.5, 0.5, 6], [2.2, 3.4, 0.5, 0.5, 9], [0.4, 2.0, 0.4, 0.7, 5], [7.6, 0.4, 0.6, 0.6, 7], [5.9, 3.9, 0.5, 0.5, 6],
      [0.4, 5.7, 0.6, 0.5, 6], [3.3, 9.0, 0.7, 0.5, 5], [5.8, 5.8, 0.4, 0.4, 8], [9.0, 4.0, 0.5, 0.4, 5], [8.6, 7.6, 0.6, 0.6, 7]],
    trees: [[5.9, 8.6, 0.24], [6.6, 9.1, 0.28], [7.4, 8.7, 0.22], [8.1, 9.2, 0.26], [8.9, 8.6, 0.23], [7.0, 8.0, 0.2],
      [2.3, 5.5, 0.2], [0.5, 4.2, 0.2], [4.2, 4.2, 0.18], [5.8, 4.2, 0.18], [4.2, 5.8, 0.18], [5.8, 5.8, 0.18],
      [9.3, 5.6, 0.2], [2.6, 0.4, 0.2], [4.1, 2.2, 0.2], [3.0, 9.5, 0.2]],
    track: { z: 16, pts: [[9.72, 0.6], [9.72, 9.72], [0.6, 9.72]], stations: [{ id: 'op', at: [9.72, 5.0], name: 'Operating Plaza' }, { id: 'pf', at: [0.9, 9.72], name: 'Pioneer Fund' }] }
  };
  function proj(o) { return function (gx, gy, z) { return [o.ox + (gx - gy) * o.tw / 2, o.oy + (gx + gy) * o.tw / 4 - (z || 0)]; }; }
  function poly(pts) { return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' Z'; }
  function box(P, x, y, w, d, z0, h) {
    const A = [x, y], B = [x + w, y], C = [x + w, y + d], D = [x, y + d];
    const t = (q, z) => P(q[0], q[1], z);
    return {
      top: poly([t(A, z0 + h), t(B, z0 + h), t(C, z0 + h), t(D, z0 + h)]),
      left: poly([t(D, z0), t(C, z0), t(C, z0 + h), t(D, z0 + h)]),
      right: poly([t(B, z0), t(C, z0), t(C, z0 + h), t(B, z0 + h)]),
      apex: t([x + w / 2, y + d / 2], z0 + h)
    };
  }
  function bands(P, x, y, w, d, h, side, step, bh) {
    // ribbon windows on one face; side 'L' face gy = y+d, 'R' face gx = x+w
    let s = '';
    const ins = 0.12;
    for (let z = 7; z < h - 5; z += step) {
      const z1 = z, z2 = Math.min(z + bh, h - 4);
      let a, b;
      if (side === 'L') { a = [x + w * ins, y + d]; b = [x + w * (1 - ins), y + d]; }
      else { a = [x + w, y + d * ins]; b = [x + w, y + d * (1 - ins)]; }
      s += poly([P(a[0], a[1], z1), P(b[0], b[1], z1), P(b[0], b[1], z2), P(a[0], a[1], z2)]) + ' ';
    }
    return s;
  }
  /* o: { ox, oy, tw, values:{USD,..}, f (height factor), t (0 day..1 night), hScale (px per $), plinth (px) } */
  function build(o) {
    const P = proj(o), N = PLAN.N, t = o.t || 0, f = o.f == null ? 1 : o.f;
    const C = {}; Object.keys(PAL).forEach((k) => { C[k] = !o.dusk ? mix(PAL[k][0], PAL[k][1], t) : t <= 0.5 ? mix(PAL[k][0], DUSK[k], t * 2) : mix(DUSK[k], PAL[k][1], (t - 0.5) * 2); });
    const dk = o.dusk ? Math.max(0, 1 - Math.abs(t - 0.5) * 2) : 0;
    const items = [], shadows = [], glows = [], lights = [];
    const th = o.plinth || 16;
    // plinth
    const g0 = P(0, 0, 0), g1 = P(N, 0, 0), g2 = P(N, N, 0), g3 = P(0, N, 0);
    items.push({ d: poly([g3, g2, [g2[0], g2[1] + th], [g3[0], g3[1] + th]]), fill: C.plinthL });
    items.push({ d: poly([g1, g2, [g2[0], g2[1] + th], [g1[0], g1[1] + th]]), fill: C.plinthR });
    items.push({ d: poly([g0, g1, g2, g3]), fill: C.ground });
    const rect = (r, fill, z) => items.push({ d: poly([P(r[0], r[1], z || 0), P(r[0] + r[2], r[1], z || 0), P(r[0] + r[2], r[1] + r[3], z || 0), P(r[0], r[1] + r[3], z || 0)]), fill: fill });
    PLAN.roads.forEach((r) => rect(r, C.road));
    PLAN.water.forEach((r) => { rect(r, C.water); rect([r[0] + 0.25, r[1] + 0.3, r[2] * 0.45, 0.12], C.waterHi); });
    rect(PLAN.plaza, C.plaza);
    // street lights (night) along the two roads
    for (let i = 0.5; i < N; i += 1.15) {
      [[i, 4.52], [i, 5.48], [4.52, i], [5.48, i]].forEach((q) => {
        if (q[0] > 4.3 && q[0] < 5.7 && q[1] > 4.3 && q[1] < 5.7) return;
        const s = P(q[0], q[1], 3);
        lights.push({ x: s[0].toFixed(1), y: s[1].toFixed(1) });
      });
    }
    const groundCount = items.length;
    // objects: towers, fillers, trees — painter's order by depth
    const objs = [];
    const vmax = o.hScale;
    Object.keys(PLAN.districts).forEach((k) => {
      const a = ASSET[k], H = (o.values[k] || 0) * vmax * f;
      PLAN.districts[k].forEach((tw, i) => {
        const h = Math.max(6, H * tw[4]);
        objs.push({ depth: tw[0] + tw[2] / 2 + tw[1] + tw[3] / 2, kind: 'tower', k: k, i: i, x: tw[0], y: tw[1], w: tw[2], d: tw[3], h: h, a: a });
      });
    });
    PLAN.fillers.forEach((b) => objs.push({ depth: b[0] + b[2] / 2 + b[1] + b[3] / 2, kind: 'block', x: b[0], y: b[1], w: b[2], d: b[3], h: b[4] }));
    PLAN.trees.forEach((tr) => objs.push({ depth: tr[0] + tr[1], kind: 'tree', x: tr[0], y: tr[1], r: tr[2] }));
    objs.sort((p, q) => p.depth - q.depth);
    const apex = {};
    objs.forEach((ob) => {
      if (ob.kind === 'tree') {
        const c = P(ob.x, ob.y, 0), R = ob.r * o.tw * 0.55;
        shadows.push({ d: 'M' + (c[0] + R * 0.2).toFixed(1) + ' ' + c[1].toFixed(1) + ' a' + (R * 1.5).toFixed(1) + ' ' + (R * 0.55).toFixed(1) + ' 0 1 0 ' + (R * 2.4).toFixed(1) + ' 0 a' + (R * 1.5).toFixed(1) + ' ' + (R * 0.55).toFixed(1) + ' 0 1 0 ' + (-R * 2.4).toFixed(1) + ' 0 Z' });
        const cy = c[1] - R * 1.3;
        items.push({ d: 'M' + (c[0] - R).toFixed(1) + ' ' + cy.toFixed(1) + ' a' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 1 0 ' + (2 * R).toFixed(1) + ' 0 a' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 1 0 ' + (-2 * R).toFixed(1) + ' 0 Z', fill: C.tree });
        items.push({ d: 'M' + (c[0] + R * 0.1).toFixed(1) + ' ' + (cy + R * 0.1).toFixed(1) + ' a' + (R * 0.9).toFixed(1) + ' ' + (R * 0.9).toFixed(1) + ' 0 0 1 ' + (-R * 1.0).toFixed(1) + ' ' + (R * 0.8).toFixed(1) + ' a' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 0 0 ' + (R * 1.9).toFixed(1) + ' ' + (-R * 0.9).toFixed(1) + ' Z', fill: C.treeDark, op: 0.7 });
        return;
      }
      const bx = box(P, ob.x, ob.y, ob.w, ob.d, 0, ob.h);
      const sl = ob.h * 0.018 * (1 + dk * 1.4);
      shadows.push({ d: poly([P(ob.x, ob.y + ob.d, 0), P(ob.x + ob.w, ob.y + ob.d, 0), P(ob.x + ob.w + sl, ob.y + ob.d - sl, 0), P(ob.x + ob.w + sl, ob.y - sl, 0), P(ob.x + sl, ob.y - sl, 0), P(ob.x, ob.y, 0)]) });
      items.push({ d: bx.left, fill: C.left });
      items.push({ d: bx.right, fill: C.right });
      items.push({ d: bx.top, fill: C.top });
      if (ob.kind === 'tower') {
        const a = ob.a;
        const glassL = mix(a.glass, a.glow, t), glassR = mix(mix(a.glass, '#5D6B80', 0.25), a.glow, t);
        const wl = bands(P, ob.x, ob.y, ob.w, ob.d, ob.h, 'L', 7, 2.6), wr = bands(P, ob.x, ob.y, ob.w, ob.d, ob.h, 'R', 7, 2.6);
        glows.push({ d: wl, fill: glassL, op: (0.82 + 0.18 * t).toFixed(2) });
        glows.push({ d: wr, fill: glassR, op: (0.72 + 0.28 * t).toFixed(2) });
        const capL = poly([P(ob.x, ob.y + ob.d, ob.h - 3), P(ob.x + ob.w, ob.y + ob.d, ob.h - 3), P(ob.x + ob.w, ob.y + ob.d, ob.h), P(ob.x, ob.y + ob.d, ob.h)]);
        const capR = poly([P(ob.x + ob.w, ob.y, ob.h - 3), P(ob.x + ob.w, ob.y + ob.d, ob.h - 3), P(ob.x + ob.w, ob.y + ob.d, ob.h), P(ob.x + ob.w, ob.y, ob.h)]);
        glows.push({ d: capL + ' ' + capR, fill: mix(a.cap, a.glow, t), op: '1' });
        // windows must paint after their own faces but before nearer objects: flush glow paths into items now
        while (glows.length) items.push(Object.assign({ win: true }, glows.shift()));
        if (ob.i === 0) apex[ob.k] = { x: bx.apex[0], y: bx.apex[1], h: ob.h };
      }
    });
    // elevated transit: pillars + beam + stations (front edges, so always in front of the city)
    const tz = PLAN.track.z, tp = PLAN.track.pts;
    const along = [];
    for (let s = 0; s < tp.length - 1; s++) {
      const a = tp[s], b = tp[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let u = 0; u <= L; u += 1.6) along.push([a[0] + (b[0] - a[0]) * u / L, a[1] + (b[1] - a[1]) * u / L]);
    }
    const front = [];
    along.forEach((q) => { const s0 = P(q[0], q[1], 0), s1 = P(q[0], q[1], tz); front.push({ d: 'M' + s0[0].toFixed(1) + ' ' + s0[1].toFixed(1) + ' L' + s1[0].toFixed(1) + ' ' + s1[1].toFixed(1), stroke: C.pillar, w: '2' }); });
    const beam = tp.map((q) => P(q[0], q[1], tz));
    const beamD = 'M' + beam.map((s) => s[0].toFixed(1) + ' ' + s[1].toFixed(1)).join(' L');
    front.push({ d: beamD, stroke: C.beam, w: '4' });
    front.push({ d: beamD, stroke: mix('#FFFFFF', '#F2C230', t), w: '1' });
    const stations = PLAN.track.stations.map((st) => { const s = P(st.at[0], st.at[1], tz + 2); return { id: st.id, name: st.name, x: s[0], y: s[1] }; });
    return { ground: items.slice(0, groundCount), items: items.slice(groundCount), shadows: shadows, front: front, lights: lights, stations: stations, beam: beamD, apex: apex, colors: C,
      clip: poly([g0, g1, g2, g3]), bounds: { top: g0[1], bottom: g2[1] + th, left: g3[0], right: g1[0] } };
  }
  return { build: build, mix: mix, PAL: PAL, DUSK: DUSK, ASSET: ASSET, PLAN: PLAN };
})();
/* One book of record (illustrative data): monthly reserve anchors and today's positions. */
const AR_BOOK = {
  total: 248390.12,
  values: { USD: 118400.00, USDC: 64250.00, BTC: 48970.31, ETH: 16769.81 },
  d24: { USD: 0, USDC: 0.02, BTC: 2.31, ETH: 1.58 },
  months: [['Mar', 'Mar 28', 198400], ['Apr', 'Apr 28', 206800], ['May', 'May 28', 219500], ['Jun', 'Jun 28', 213900], ['Jul', 'Jul 28', 231200], ['Aug', 'Aug 28', 240100], ['Sep', 'Sep 28', 248390.12]]
};
function arMoney(v, dp) { dp = dp == null ? 2 : dp; return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
function arK(v) { return '$' + (v / 1000).toFixed(1) + 'K'; }
/* Tween helper for components: animates numeric keys of this.state toward targets. */
function arTween(cmp, key, to, ms, fromDefault) {
  const from = (cmp.state || {})[key] != null ? cmp.state[key] : (fromDefault != null ? fromDefault : to);
  if (cmp['_tw_' + key]) cancelAnimationFrame(cmp['_tw_' + key]);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || from === to) { const s = {}; s[key] = to; cmp.setState(s); return; }
  const t0 = performance.now();
  const step = (now) => {
    const u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const s = {}; s[key] = from + (to - from) * e; cmp.setState(s);
    if (u < 1) cmp['_tw_' + key] = requestAnimationFrame(step);
  };
  cmp['_tw_' + key] = requestAnimationFrame(step);
}
