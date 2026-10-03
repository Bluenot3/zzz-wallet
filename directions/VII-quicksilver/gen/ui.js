/* Quicksilver shared UI layer: one book of record, scene presets, and a projection that matches the engine's camera exactly. */
const QS_BOOK = {
  total: 248390.12, today: 1377.42, todayPct: 0.56,
  assets: [
    { k: 'USD', name: 'US dollar', value: 118400, d24: 0, ui: '#C9CED6', tint: [0.80, 0.81, 0.83], sub: 'Operating ··4417' },
    { k: 'USDC', name: 'USD Coin', value: 64250, d24: 0.02, ui: '#86AEFF', tint: [0.52, 0.68, 0.98], sub: '64,250 USDC' },
    { k: 'BTC', name: 'Bitcoin', value: 48970.31, d24: 2.31, ui: '#F2B04C', tint: [0.98, 0.72, 0.34], sub: '0.5125 BTC at $95,551.82' },
    { k: 'ETH', name: 'Ether', value: 16769.81, d24: 1.58, ui: '#B7A2FF', tint: [0.70, 0.58, 0.98], sub: '4.402 ETH at $3,809.59' }
  ],
  /* Worst case from the Instrument Panel: BTC −50%, ETH −60%, stablecoins hold. */
  shock: { BTC: 0.5, ETH: 0.6 }
};
QS_BOOK.shockLoss = QS_BOOK.assets.reduce((s, a) => s + a.value * (QS_BOOK.shock[a.k] || 0), 0);
QS_BOOK.shockTotal = QS_BOOK.total - QS_BOOK.shockLoss;

const QS_SCENE = {
  phone: {
    camera: { pos: [0, 2.3, 7.4], target: [0, 0.4, -0.3], fov: 44 },
    scene: { wallZ: 2.6, cove: 1.25, light: [0.3, 4.4, 1.8], k: 0.2, exposure: 1.4 },
    wallRect: [-1.8, 1.3, 3.6, 1.8], unitR: 0.62, lift: 0.75,
    at: { USD: [0, 0.15], USDC: [-0.78, -0.62], BTC: [0.8, -0.55], ETH: [0.52, 0.86] }
  },
  pour: {
    camera: { pos: [0, 2.6, 8.7], target: [0, 0.32, -0.3], fov: 44 },
    scene: { wallZ: 2.6, cove: 1.25, light: [0.3, 4.4, 1.8], k: 0.2, exposure: 1.4 },
    wallRect: [-1.95, 1.3, 3.9, 1.95], unitR: 0.62, lift: 0.75, at: {}
  },
  spec: {
    camera: { pos: [0, 1.25, 4.3], target: [0.05, 0.42, 0], fov: 34 },
    scene: { wallZ: 2.4, cove: 1.1, light: [0.2, 4.2, 1.8], k: 0.2, exposure: 1.4 },
    wallRect: [-1.7, 1.15, 3.4, 1.133], unitR: 0.62, lift: 0.55, at: {},
    pair: [{ x: -0.52, z: 0, r: 0.55, tint: [0.80, 0.81, 0.83] }, { x: 0.6, z: 0.06, r: 0.42, tint: [0.98, 0.72, 0.34] }]
  },
  desk: {
    camera: { pos: [1.45, 2.2, 7.3], target: [1.45, 0.62, -0.3], fov: 34 },
    scene: { wallZ: 2.6, cove: 1.25, light: [0.3, 4.6, 1.9], k: 0.2, exposure: 1.4 },
    wallRect: [-2.55, 1.32, 4.6, 1.533], unitR: 0.62, lift: 0.7, align: 'left',
    at: { USD: [0, 0.15], USDC: [-0.78, -0.62], BTC: [0.8, -0.55], ETH: [0.52, 0.86] }
  }
};

function qsRadius(v, unitR) { return unitR * Math.cbrt(Math.max(v, 0) / 118400); }
function qsSq(r) { return Math.min(0.9, Math.max(0.7, 0.94 - 0.28 * r)); }
function qsDrops(S, opt) {
  opt = opt || {};
  return QS_BOOK.assets.map((a) => {
    const f = opt.shocked ? 1 - (QS_BOOK.shock[a.k] || 0) : 1;
    return { x: S.at[a.k][0], z: S.at[a.k][1], r: qsRadius(a.value * f, S.unitR), tint: a.tint,
      lift: opt.lift === a.k ? S.lift : 0, sel: opt.lift === a.k, spike: opt.shocked && QS_BOOK.shock[a.k] ? 1 : 0 };
  });
}
function qsProject(S, p, w, h) {
  const c = S.camera, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nz = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const f = nz(sub(c.target, c.pos)), r = nz([f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]), u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const tn = Math.tan(c.fov * Math.PI / 360), d = sub(p, c.pos), z = dot(d, f), asp = w / h;
  return { x: (dot(d, r) / (z * tn * asp) + 1) / 2 * w, y: (1 - dot(d, u) / (z * tn)) / 2 * h, s: h / 2 / (z * tn) };
}
/* Screen circle for a resting (or lifted) droplet: centre and radius in CSS px. */
function qsDropScreen(S, k, w, h, lifted, shocked) {
  const a = QS_BOOK.assets.find((x) => x.k === k), f = shocked ? 1 - (QS_BOOK.shock[k] || 0) : 1;
  const r = qsRadius(a.value * f, S.unitR), sq = lifted ? 0.97 : qsSq(r), y = r * sq + (lifted ? S.lift : 0);
  const c = qsProject(S, [S.at[k][0], y, S.at[k][1]], w, h);
  return { x: c.x, y: c.y, r: r * c.s, ry: r * sq * c.s };
}
function qsMoney(v, dp) { dp = dp == null ? 2 : dp; return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
function qsSplit(v) { const w = Math.floor(v + 1e-9); return { whole: '$' + w.toLocaleString('en-US'), cents: '.' + String(Math.round((v - w) * 100)).padStart(2, '0') }; }
function qsWall(v, label) { const s = qsSplit(v); return { big: s.whole, small: s.cents, label: label }; }
/* Pour (send): payees, guardrails, and where the three bodies of metal sit on the floor. */
const QS_PAY = {
  balance: 118400, limit: 50000, from: 'Operating ··4417',
  payees: [
    { id: 'pf', name: 'Pioneer Fund', verified: true, note: 'Verified, arrives instantly' },
    { id: 'qa', name: 'Qubit Agents', verified: true, note: 'Verified, arrives instantly' },
    { id: 'nl', name: 'Northline Labs', verified: false, note: 'Not verified yet' }
  ],
  src: [-0.78, 0.02], vessel: [0.98, -0.3], vesselR: 0.4
};
function qsPourCheck(amount, payee) {
  if (!payee.verified) return { ok: false, why: payee.name + ' is not verified yet. Verify them before pouring.' };
  if (!(amount > 0)) return { ok: false, why: 'Measure an amount to pour.' };
  if (amount > QS_PAY.balance) return { ok: false, why: 'More than Operating holds (' + qsMoney(QS_PAY.balance) + ').' };
  if (amount > QS_PAY.limit) return { ok: false, why: 'Over today’s ' + qsMoney(QS_PAY.limit, 0) + ' limit. A co-signer has to approve this.' };
  return { ok: true, why: 'Within today’s ' + qsMoney(QS_PAY.limit, 0) + ' limit. ' + payee.name + ' is verified.' };
}
/* Source pool, measured droplet (drawn out of the source), and what has arrived in the vessel. */
function qsPourDrops(S, amount, received, mx) {
  const a = Math.max(0, Math.min(amount, QS_PAY.balance));
  const rs = qsRadius(QS_PAY.balance - a - received, S.unitR), rm = a > 0 ? qsRadius(a, S.unitR) : 0, rv = received > 0 ? qsRadius(received, S.unitR) : 0;
  const restX = QS_PAY.src[0] + rs + rm - 0.05;
  return [
    { x: QS_PAY.src[0], z: QS_PAY.src[1], r: rs, tint: QS_BOOK.assets[0].tint },
    { x: mx != null ? mx : restX, z: 0.32, r: rm, tint: [0.84, 0.85, 0.87] },
    { x: QS_PAY.vessel[0], z: QS_PAY.vessel[1], r: rv, tint: [0.84, 0.85, 0.87] }
  ];
}
