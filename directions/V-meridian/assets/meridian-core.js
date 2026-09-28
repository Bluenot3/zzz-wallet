/*!
 * ZEN Meridian Core — real-time armillary renderer (WebGL 1)
 * Direction V synthesis: Zenith's anodized-titanium/thin-film armillary engine,
 * with a two-frequency engraved guilloché bezel (Sovereign) and a cooler
 * precision-steel specular grade (Treasury) layered into the same shaders.
 * Photon inlays, dispersive glass orb, emissive ZEN mark, bloom.
 * API: MeridianCore.mount(canvas, opts) -> { set(params), destroy(), ready }
 */
(function () {
  'use strict';
  if (window.MeridianCore) return;

  var MARK = 'M0 31L12 31L22 21L10 21L10 9L44 9L0 53L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L100 33L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z';

  /* ---------------- math (column-major) ---------------- */
  function M() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function rx(a) { var m = M(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function ry(a) { var m = M(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rz(a) { var m = M(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function tr(x, y, z) { var m = M(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function sc(s) { var m = M(); m[0] = m[5] = m[10] = s; return m; }
  function persp(fovy, asp, n, f) {
    var m = new Float32Array(16), t = 1 / Math.tan(fovy / 2);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

  /* ---------------- geometry ---------------- */
  function band(R, hT, hW, cr, segs, cs) {
    var prof = [], cx = hT - cr, cz = hW - cr;
    var C = [[cx, cz, 0], [-cx, cz, 90], [-cx, -cz, 180], [cx, -cz, 270]];
    for (var i = 0; i < 4; i++) for (var k = 0; k <= cs; k++) {
      var a = (C[i][2] + 90 * k / cs) * Math.PI / 180, nx = Math.cos(a), nz = Math.sin(a);
      prof.push([C[i][0] + cr * nx, C[i][1] + cr * nz, nx, nz]);
    }
    var P = prof.length, pos = [], nrm = [], uv = [], pf = [], idx = [];
    for (var j = 0; j <= segs; j++) {
      var th = j / segs * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      for (var p = 0; p < P; p++) {
        var q = prof[p], r = R + q[0];
        pos.push(r * ct, r * st, q[1]);
        nrm.push(q[2] * ct, q[2] * st, q[3]);
        uv.push(j / segs);
        pf.push(q[0] / hT, q[1] / hW, q[2], q[3]);
      }
    }
    for (j = 0; j < segs; j++) for (p = 0; p < P; p++) {
      var a0 = j * P + p, b0 = j * P + (p + 1) % P, c0 = (j + 1) * P + p, d0 = (j + 1) * P + (p + 1) % P;
      idx.push(a0, c0, b0, b0, c0, d0);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), pf: new Float32Array(pf), idx: new Uint16Array(idx) };
  }
  function sphere(r, ws, hs) {
    var pos = [], nrm = [], idx = [];
    for (var y = 0; y <= hs; y++) for (var x = 0; x <= ws; x++) {
      var u = x / ws, v = y / hs, th = u * Math.PI * 2, ph = v * Math.PI;
      var nx = Math.cos(th) * Math.sin(ph), ny = Math.cos(ph), nz = Math.sin(th) * Math.sin(ph);
      pos.push(nx * r, ny * r, nz * r); nrm.push(nx, ny, nz);
    }
    for (y = 0; y < hs; y++) for (x = 0; x < ws; x++) {
      var a = y * (ws + 1) + x, b = a + ws + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  /* ---------------- shaders ---------------- */
  var ENV = [
    'float sbox(vec3 d, vec3 c, vec3 up, vec2 sz, float rough){',
    '  float cd = dot(d, c); if (cd <= 0.0) return 0.0;',
    '  vec3 t = normalize(cross(up, c)); vec3 b = cross(c, t);',
    '  vec2 p = vec2(dot(d, t), dot(d, b)) / cd;',
    '  vec2 q = abs(p) - sz; float e = 0.012 + rough * 0.28;',
    '  float m = 1.0 - smoothstep(-e, e, max(q.x, q.y));',
    '  return m * (0.72 + 0.28 * (1.0 - clamp(length(p / sz) * 0.6, 0.0, 1.0)));',
    '}',
    'vec3 envMap(vec3 d, float rough){',
    '  vec3 col = mix(vec3(0.006, 0.006, 0.009), vec3(0.075, 0.078, 0.095), smoothstep(-0.5, 1.0, d.y));',
    '  col += vec3(0.05, 0.055, 0.07) * smoothstep(0.2, 1.0, d.z * 0.6 + d.y * 0.5);',
    '  col += sbox(d, normalize(vec3(-0.34, 0.86, 0.38)), vec3(0.0, 0.0, 1.0), vec2(0.62, 0.16), rough) * vec3(3.1, 3.15, 3.3);',
    '  col += sbox(d, normalize(vec3(0.96, 0.12, -0.26)), vec3(0.0, 1.0, 0.0), vec2(0.05, 0.75), rough) * vec3(1.05, 2.1, 2.6);',
    '  col += sbox(d, normalize(vec3(-0.92, -0.22, 0.18)), vec3(0.0, 1.0, 0.0), vec2(0.07, 0.5), rough) * vec3(2.3, 1.35, 0.75);',
    '  col += sbox(d, normalize(vec3(0.18, 0.05, 1.0)), vec3(0.0, 1.0, 0.0), vec2(0.55, 0.32), rough) * vec3(0.10, 0.10, 0.12);',
    '  col += sbox(d, normalize(vec3(0.5, -0.8, 0.3)), vec3(0.0, 0.0, 1.0), vec2(0.4, 0.05), rough) * vec3(0.35, 0.28, 0.55);',
    '  col += vec3(0.18, 0.26, 0.40) * (1.0 - smoothstep(0.0, 0.025 + rough * 0.2, abs(d.y + 0.04))) * 0.5;',
    '  return col;',
    '}',
    'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
    'vec3 thinFilm(float cosI, float d){',
    '  float n = 2.35; float s2 = (1.0 - cosI * cosI) / (n * n); float cosT = sqrt(max(0.0, 1.0 - s2));',
    '  float opd = 2.0 * n * d * cosT; vec3 lam = vec3(640.0, 545.0, 465.0);',
    '  return 0.5 + 0.5 * cos(6.2831853 * opd / lam + 3.1415926);',
    '}',
    'float hash(float n){ return fract(sin(n) * 43758.5453123); }'
  ].join('\n');

  var RING_VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute float aU; attribute vec4 aPf;',
    'uniform mat4 uModel; uniform mat4 uVP;',
    'varying vec3 vW; varying vec3 vN; varying float vU; varying vec4 vPf;',
    'void main(){ vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aNrm; vU = aU; vPf = aPf; gl_Position = uVP * w; }'
  ].join('\n');

  var RING_FS = [
    '#ifdef GL_OES_standard_derivatives',
    '#extension GL_OES_standard_derivatives : enable',
    '#endif',
    'precision highp float;',
    ENV,
    'uniform vec3 uCam; uniform float uTime; uniform float uFilm; uniform float uFilmAmt; uniform vec3 uPhoton;',
    'uniform float uShare; uniform float uStart; uniform float uTicks; uniform float uTicks2; uniform float uEmOnly; uniform float uFlash; uniform float uEnergy; uniform float uPulseSpd; uniform float uSeed;',
    'varying vec3 vW; varying vec3 vN; varying float vU; varying vec4 vPf;',
    'float aaw(float x){',
    '#ifdef GL_OES_standard_derivatives',
    '  return max(fwidth(x), 1e-4);',
    '#else',
    '  return 0.01;',
    '#endif',
    '}',
    'void main(){',
    '  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);',
    '  float cosI = clamp(dot(N, V), 0.0, 1.0);',
    '  float outer = smoothstep(0.6, 0.9, vPf.z);',
    '  float inner = smoothstep(0.6, 0.9, -vPf.z);',
    '  float axial = smoothstep(0.6, 0.9, abs(vPf.w));',
    '  // photon channel (outer + inner face), allocation arc',
    '  float chW = 0.20; float cy = abs(vPf.y);',
    '  float chan = (outer + inner) * (1.0 - smoothstep(chW - aaw(cy) * 1.2, chW + aaw(cy) * 1.2, cy));',
    '  float lip = (outer + inner) * (1.0 - smoothstep(0.0, aaw(cy) * 1.5, abs(cy - chW - 0.04)));',
    '  float u = fract(vU - uStart);',
    '  float fe = aaw(vU) * 1.5;',
    '  float arc = smoothstep(0.0, fe, u) * (1.0 - smoothstep(uShare - fe, uShare, u));',
    '  float head = fract(uTime * uPulseSpd + uSeed);',
    '  float dp = u / max(uShare, 0.001) - head; dp -= floor(dp + 0.5);',
    '  float pulse = exp(-dp * dp * 900.0) * 2.4 + exp(-dp * dp * 60.0) * 0.5;',
    '  float emis = chan * arc * (0.85 + pulse) * uEnergy;',
    '  // engraved meridian ticks on axial faces',
    '  float tick = 0.0;',
    '  if (uTicks > 0.5) {',
    '    float a = vU * uTicks; float f = abs(fract(a + 0.5) - 0.5);',
    '    float maj = 1.0 - step(0.5, mod(floor(a + 0.5), 10.0));',
    '    float mid = 1.0 - step(0.5, mod(floor(a + 0.5), 5.0));',
    '    float len = maj > 0.5 ? 0.95 : (mid > 0.5 ? 0.62 : 0.4);',
    '    float rr = vPf.x * 0.5 + 0.5;',
    '    float onF = axial * step(1.0 - len, rr);',
    '    float w = aaw(a);',
    '    tick = onF * (1.0 - smoothstep(0.06 * (1.0 + maj), 0.06 * (1.0 + maj) + w * 1.2, f));',
    '  }',
    '  // fine engraved guilloché rosette — a second, finer tick frequency cut into the same axial band',
    '  if (uTicks2 > 0.5) {',
    '    float a2 = vU * uTicks2; float f2 = abs(fract(a2 + 0.5) - 0.5);',
    '    float rr2 = vPf.x * 0.5 + 0.5;',
    '    float onF2 = axial * smoothstep(0.30, 0.46, rr2) * (1.0 - smoothstep(0.86, 0.97, rr2));',
    '    float w2 = aaw(a2);',
    '    float tick2 = onF2 * (1.0 - smoothstep(0.16, 0.16 + w2 * 1.4, f2)) * 0.55;',
    '    tick = max(tick, tick2);',
    '  }',
    '  if (uEmOnly > 0.5) { gl_FragColor = vec4(uPhoton * emis * 0.9 + vec3(uFlash) * 0.6 * (chan + 0.3), 1.0); return; }',
    '  float rough = 0.22;',
    '  float brush = 0.9 + 0.1 * hash(floor(vU * 5200.0) * 1.3 + floor((vPf.x + vPf.y) * 26.0) * 7.1 + uSeed);',
    '  vec3 R = reflect(-V, N);',
    '  vec3 env = envMap(R, rough);',
    '  vec3 F0 = vec3(0.58, 0.60, 0.64);',
    '  vec3 film = thinFilm(cosI, uFilm) * 1.35;',
    '  vec3 spec = mix(F0, film, uFilmAmt);',
    '  vec3 fres = spec + (vec3(1.0) - spec) * pow(1.0 - cosI, 5.0);',
    '  vec3 col = env * fres * brush;',
    '  col += spec * (0.010 + 0.05 * max(dot(N, normalize(vec3(-0.3, 0.8, 0.5))), 0.0));',
    '  col *= mix(1.0, 0.18, chan);',
    '  col += vec3(0.9, 0.95, 1.0) * lip * 0.06;',
    '  col = mix(col, col * 0.22, tick);',
    '  col += uPhoton * emis * 1.6;',
    '  col += fres * uFlash * 1.8;',
    '  col = aces(col * 1.05);',
    '  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);',
    '}'
  ].join('\n');

  var ORB_VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; uniform mat4 uModel; uniform mat4 uVP;',
    'varying vec3 vW; varying vec3 vN;',
    'void main(){ vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aNrm; gl_Position = uVP * w; }'
  ].join('\n');

  var ORB_FS = [
    'precision highp float;',
    ENV,
    'uniform vec3 uCam; uniform vec3 uCenter; uniform float uRadius; uniform float uTime; uniform float uEnergy; uniform float uEmOnly; uniform float uFlash;',
    'uniform vec3 uGlowA; uniform vec3 uGlowB;',
    'varying vec3 vW; varying vec3 vN;',
    'void main(){',
    '  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW); vec3 I = -V;',
    '  float cosI = clamp(dot(N, V), 0.0, 1.0);',
    '  float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);',
    '  vec3 oc = uCenter - uCam; float t = dot(oc, I); vec3 cl = uCam + I * t;',
    '  vec3 dv = (cl - uCenter) / uRadius; float d = length(dv);',
    '  float ang = atan(dv.y, dv.x);',
    '  float halo = exp(-d * d * 4.0) * 0.09 + exp(-d * d * 14.0) * 0.08;',
    '  float fil = pow(0.5 + 0.5 * sin(ang * 5.0 + d * 16.0 - uTime * 0.8 + 2.4 * sin(ang * 2.0 + uTime * 0.35)), 10.0);',
    '  fil *= smoothstep(1.0, 0.3, d) * smoothstep(0.1, 0.45, d) * 0.22;',
    '  float ringGlow = exp(-pow((d - 0.9) * 10.0, 2.0)) * 0.22;',
    '  vec3 glow = mix(uGlowB, uGlowA, exp(-d * d * 4.0)) * (halo + fil + ringGlow) * uEnergy;',
    '  glow += vec3(1.0) * uFlash * (exp(-d * d * 3.0) * 1.5);',
    '  if (uEmOnly > 0.5) { gl_FragColor = vec4(glow * 0.55, 1.0); return; }',
    '  vec3 refl = envMap(reflect(I, N), 0.02);',
    '  vec3 tr;',
    '  tr.r = envMap(refract(I, N, 1.0 / 1.42), 0.08).r;',
    '  tr.g = envMap(refract(I, N, 1.0 / 1.46), 0.08).g;',
    '  tr.b = envMap(refract(I, N, 1.0 / 1.52), 0.08).b;',
    '  vec3 R = reflect(I, N); float spk = pow(max(dot(R, normalize(vec3(-0.34, 0.86, 0.38))), 0.0), 220.0) * 5.0;',
    '  vec3 rim = vec3(0.55, 0.78, 1.0) * pow(1.0 - cosI, 3.0) * 0.28;',
    '  vec3 col = refl * (F * 2.2 + 0.015) + tr * 0.05 + glow + rim + vec3(spk);',
    '  float a = clamp(F * 1.4 + 0.04 + dot(glow + rim, vec3(0.33)) * 0.8 + spk * 0.5, 0.0, 1.0);',
    '  col = aces(col);',
    '  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)) * a, a);',
    '}'
  ].join('\n');

  var MARK_VS = [
    'attribute vec2 aQ; uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp; uniform vec2 uSize; uniform vec3 uCenter;',
    'varying vec2 vUV;',
    'void main(){ vUV = aQ * 0.5 + 0.5; vec3 p = uCenter + uRight * aQ.x * uSize.x + uUp * aQ.y * uSize.y; gl_Position = uVP * vec4(p, 1.0); }'
  ].join('\n');
  var MARK_FS = [
    'precision highp float; uniform sampler2D uTex; uniform vec3 uColor; uniform float uEnergy; uniform float uEmOnly;',
    'varying vec2 vUV;',
    'void main(){ vec4 t = texture2D(uTex, vec2(vUV.x, 1.0 - vUV.y)); float core = t.r; float glow = t.g;',
    '  vec3 c = uColor * core * 0.92 * uEnergy + vec3(0.22, 0.55, 1.0) * glow * 0.22 * uEnergy;',
    '  if (uEmOnly > 0.5) { gl_FragColor = vec4(c * 0.32, 1.0); return; }',
    '  vec3 o = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); float a = clamp(max(o.r, max(o.g, o.b)), 0.0, 1.0);',
    '  gl_FragColor = vec4(o, a);',
    '}'
  ].join('\n');

  var POST_VS = 'attribute vec2 aQ; varying vec2 vUV; void main(){ vUV = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }';
  var BLUR_FS = [
    'precision mediump float; uniform sampler2D uTex; uniform vec2 uDir; varying vec2 vUV;',
    'void main(){',
    '  vec3 c = texture2D(uTex, vUV).rgb * 0.2270270270;',
    '  c += texture2D(uTex, vUV + uDir * 1.3846153846).rgb * 0.3162162162;',
    '  c += texture2D(uTex, vUV - uDir * 1.3846153846).rgb * 0.3162162162;',
    '  c += texture2D(uTex, vUV + uDir * 3.2307692308).rgb * 0.0702702703;',
    '  c += texture2D(uTex, vUV - uDir * 3.2307692308).rgb * 0.0702702703;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');
  var COMP_FS = [
    'precision mediump float; uniform sampler2D uA; uniform sampler2D uB; uniform float uK; varying vec2 vUV;',
    'void main(){ vec3 c = texture2D(uA, vUV).rgb * 0.9 + texture2D(uB, vUV).rgb * 1.35; c *= uK;',
    '  c = c / (1.0 + c * 0.35); float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0); gl_FragColor = vec4(c, a); }'
  ].join('\n');

  /* ---------------- presets ---------------- */
  var PRESETS = {
    rings: [
      { r: 1.00, hT: 0.012, hW: 0.066, film: 64, filmAmt: 0.14, photon: [0.80, 0.94, 1.0], share: 0.477, start: 0.08, ticks: 120, ticks2: 720, e: [1.16, 0.00, 0.20], spin: 0.045, prec: 0.050, pulse: 0.085 },
      { r: 0.835, hT: 0.011, hW: 0.058, film: 142, filmAmt: 0.90, photon: [0.28, 0.72, 1.0], share: 0.259, start: 0.55, ticks: 60, ticks2: 0, e: [0.42, 1.02, 0.10], spin: -0.07, prec: -0.036, pulse: 0.11 },
      { r: 0.68, hT: 0.010, hW: 0.052, film: 82, filmAmt: 0.90, photon: [1.0, 0.60, 0.26], share: 0.197, start: 0.21, ticks: 0, ticks2: 480, e: [-0.88, 0.55, 0.42], spin: 0.095, prec: 0.071, pulse: 0.13 },
      { r: 0.535, hT: 0.010, hW: 0.046, film: 122, filmAmt: 0.92, photon: [0.62, 0.48, 1.0], share: 0.067, start: 0.70, ticks: 40, ticks2: 0, e: [0.25, -0.98, 0.62], spin: -0.12, prec: -0.058, pulse: 0.16 }
    ]
  };

  /* ---------------- GL helpers ---------------- */
  function sh(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('MeridianCore shader: ' + e); }
    return s;
  }
  function prog(gl, vs, fs) {
    var p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('MeridianCore link: ' + gl.getProgramInfoLog(p));
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), u = {}, i;
    for (i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    var na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES), a = {};
    for (i = 0; i < na; i++) { var ai = gl.getActiveAttrib(p, i); a[ai.name] = gl.getAttribLocation(p, ai.name); }
    return { p: p, u: u, a: a };
  }
  function buf(gl, data, target) { var b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  function fbo(gl, w, h, depth) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    var rb = null;
    if (depth) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f: f, t: t, rb: rb, w: w, h: h };
  }
  function freeFbo(gl, o) { if (!o) return; gl.deleteFramebuffer(o.f); gl.deleteTexture(o.t); if (o.rb) gl.deleteRenderbuffer(o.rb); }

  function markTexture(gl) {
    var S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    var g = cv.getContext('2d'), sc2 = S * 0.78 / 100, ox = (S - 100 * sc2) / 2, oy = (S - 86 * sc2) / 2;
    var path = new Path2D(MARK);
    // R channel: crisp mark; G channel: soft glow
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.filter = 'blur(14px)'; g.translate(ox, oy); g.scale(sc2, sc2); g.fillStyle = 'rgb(0,255,0)'; g.fill(path, 'evenodd'); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(ox, oy); g.scale(sc2, sc2); g.fillStyle = 'rgb(255,0,0)'; g.fill(path, 'evenodd'); g.restore();
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  /* ---------------- instance ---------------- */
  function mount(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) return null;
    var dExt = gl.getExtension('OES_standard_derivatives');
    var ringFs = dExt ? RING_FS : RING_FS.replace(/fwidth\(x\)/g, '0.01');
    var P;
    try {
      P = { ring: prog(gl, RING_VS, ringFs), orb: prog(gl, ORB_VS, ORB_FS), mark: prog(gl, MARK_VS, MARK_FS), blur: prog(gl, POST_VS, BLUR_FS), comp: prog(gl, POST_VS, COMP_FS) };
    } catch (err) { if (window.console) console.warn(err.message); return null; }

    var defs = (opts.rings || PRESETS.rings).map(function (r, i) {
      var base = PRESETS.rings[i % 4];
      var o = {}; for (var k in base) o[k] = base[k]; for (k in r) o[k] = r[k]; return o;
    });
    var rings = defs.map(function (d) {
      var g = band(d.r, d.hT, d.hW, Math.min(d.hT, d.hW) * 0.62, opts.segs || 300, 5);
      return { d: d, pos: buf(gl, g.pos), nrm: buf(gl, g.nrm), uv: buf(gl, g.uv), pf: buf(gl, g.pf), idx: buf(gl, g.idx, gl.ELEMENT_ARRAY_BUFFER), n: g.idx.length };
    });
    var coreR = opts.coreRadius || 0.27;
    var sp = sphere(coreR, 64, 40);
    var orb = { pos: buf(gl, sp.pos), nrm: buf(gl, sp.nrm), idx: buf(gl, sp.idx, gl.ELEMENT_ARRAY_BUFFER), n: sp.idx.length };
    var quad = buf(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
    var mTex = markTexture(gl);

    var S = {
      tilt: [0, 0], tiltT: [0, 0], align: 0, alignT: 0, energy: 1, energyT: 1, flash: 0, explode: 0, explodeT: 0,
      speed: opts.speed == null ? 1 : opts.speed, zoom: opts.zoom || 1, t0: performance.now(), last: performance.now(),
      intro: opts.intro === false ? 1 : 0, alignE: opts.alignEuler || [0.42, 0.0, 0.0], yaw: opts.yaw || 0, pitch: opts.pitch || 0
    };
    var dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2), fA = null, fB = null, fT = null, fW = null, W = 0, H = 0;
    var raf = 0, alive = true, readyFired = false, slow = 0, frames = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
      var w = Math.max(2, Math.round(cw * dpr)), h = Math.max(2, Math.round(ch * dpr));
      if (w === W && h === H) return;
      W = w; H = h; canvas.width = w; canvas.height = h;
      freeFbo(gl, fA); freeFbo(gl, fB); freeFbo(gl, fT); freeFbo(gl, fW);
      var bw = Math.max(2, Math.round(w / 3)), bh = Math.max(2, Math.round(h / 3));
      fA = fbo(gl, bw, bh, true); fB = fbo(gl, bw, bh, false); fT = fbo(gl, bw, bh, false); fW = fbo(gl, bw, bh, false);
    }

    function onMove(e) {
      var r = canvas.getBoundingClientRect(); if (!r.width) return;
      var span = opts.tiltSpan || 1.6;
      S.tiltT[0] = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2 * span), -1, 1);
      S.tiltT[1] = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2 * span), -1, 1);
    }
    function onLeave() { S.tiltT[0] = 0; S.tiltT[1] = 0; }
    var tgt = opts.pointerTarget || window;
    if (opts.interactive !== false) { tgt.addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerleave', onLeave); }
    function onVis() { if (!document.hidden && alive && !raf) raf = requestAnimationFrame(frame); }
    document.addEventListener('visibilitychange', onVis);
    function onLost(e) { e.preventDefault(); alive = false; cancelAnimationFrame(raf); if (opts.onLost) opts.onLost(); }
    canvas.addEventListener('webglcontextlost', onLost);

    function bindRing(r) {
      var p = P.ring, a = p.a;
      gl.bindBuffer(gl.ARRAY_BUFFER, r.pos); gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, r.nrm); gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, r.uv); gl.enableVertexAttribArray(a.aU); gl.vertexAttribPointer(a.aU, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, r.pf); gl.enableVertexAttribArray(a.aPf); gl.vertexAttribPointer(a.aPf, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.idx);
    }
    function disableAll() { for (var i = 0; i < 6; i++) gl.disableVertexAttribArray(i); }

    function drawScene(t, VP, cam, emOnly) {
      var al = ease(S.align), ex = ease(S.explode), intro = easeOut(S.intro);
      var tk = 1 - al * 0.9;
      var globalM = mul(rx(S.tilt[1] * 0.32 * tk + S.pitch * (1 - al)), ry(S.tilt[0] * 0.42 * tk + S.yaw * (1 - al)));
      // rings
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.useProgram(P.ring.p);
      var u = P.ring.u;
      gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uCam, cam); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uEmOnly, emOnly ? 1 : 0);
      gl.uniform1f(u.uFlash, S.flash); gl.uniform1f(u.uEnergy, (0.35 + 0.65 * intro) * S.energy);
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i], d = r.d, n = rings.length;
        var spinBoost = (1 - intro) * 2.4 * (i % 2 ? -1 : 1);
        var spinRaw = t * d.spin * S.speed + spinBoost + (d.phase || 0);
        var spinFix = Math.round(spinRaw / (Math.PI * 2)) * Math.PI * 2;
        var spin = opts.chart === false ? spinRaw * (1 - al * 0.7) : lerp(spinRaw, spinFix, al);
        var prec = t * d.prec * S.speed;
        var ex0 = d.e[0], ey0 = d.e[1] + prec * (1 - al), ez0 = d.e[2];
        var eA = S.alignE;
        var exA = lerp(ex0, eA[0], al), eyA = lerp(ey0, eA[1], al), ezA = lerp(ez0, eA[2], al);
        var off = d.off || [0, (i - (n - 1) / 2) * -0.36, 0];
        var eOff = [off[0] * ex, off[1] * ex, off[2] * ex];
        var s = lerp(0.84, 1, intro) * S.zoom;
        var model = mul(tr(eOff[0] * S.zoom, eOff[1] * S.zoom, eOff[2] * S.zoom), mul(globalM, mul(sc(s), mul(ry(eyA), mul(rx(exA), mul(rz(ezA), rz(spin)))))));
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniform1f(u.uFilm, d.film); gl.uniform1f(u.uFilmAmt, d.filmAmt); gl.uniform3fv(u.uPhoton, d.photon);
        var sh0 = d.share * (0.2 + 0.8 * intro); var st0 = opts.chart === false ? d.start : lerp(d.start, 0.25 - d.share, al);
        gl.uniform1f(u.uShare, sh0); gl.uniform1f(u.uStart, st0); gl.uniform1f(u.uTicks, d.ticks || 0); gl.uniform1f(u.uTicks2, d.ticks2 || 0);
        gl.uniform1f(u.uPulseSpd, d.pulse * (1 + al * 3)); gl.uniform1f(u.uSeed, i * 0.37);
        bindRing(r); gl.drawElements(gl.TRIANGLES, r.n, gl.UNSIGNED_SHORT, 0); disableAll();
      }
      // camera-facing basis for the mark
      var right = [1, 0, 0], up = [0, 1, 0];
      var cs = S.zoom * lerp(0.84, 1, intro);
      // mark (emissive, additive)
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.mark.p); var mu = P.mark.u;
      gl.uniformMatrix4fv(mu.uVP, false, VP); gl.uniform3fv(mu.uRight, right); gl.uniform3fv(mu.uUp, up);
      var ms = (opts.markScale || 0.235) * cs;
      gl.uniform2f(mu.uSize, ms, ms); gl.uniform3f(mu.uCenter, 0, 0, 0);
      gl.uniform3fv(mu.uColor, opts.markColor || [0.86, 0.97, 1.0]); gl.uniform1f(mu.uEnergy, (0.25 + 0.75 * intro) * (0.8 + 0.2 * S.energy) + S.flash * 1.5);
      gl.uniform1f(mu.uEmOnly, emOnly ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mTex); gl.uniform1i(mu.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(P.mark.a.aQ); gl.vertexAttribPointer(P.mark.a.aQ, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); disableAll();
      // glass orb
      if (opts.noOrb) { gl.depthMask(true); return; }
      if (emOnly) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.useProgram(P.orb.p); var ou = P.orb.u;
      var om = mul(sc(cs), ry(t * 0.1));
      gl.uniformMatrix4fv(ou.uModel, false, om); gl.uniformMatrix4fv(ou.uVP, false, VP); gl.uniform3fv(ou.uCam, cam);
      gl.uniform3f(ou.uCenter, 0, 0, 0); gl.uniform1f(ou.uRadius, coreR * cs); gl.uniform1f(ou.uTime, t);
      gl.uniform1f(ou.uEnergy, (0.3 + 0.7 * intro) * S.energy); gl.uniform1f(ou.uEmOnly, emOnly ? 1 : 0); gl.uniform1f(ou.uFlash, S.flash);
      gl.uniform3fv(ou.uGlowA, opts.glowA || [0.75, 0.95, 1.0]); gl.uniform3fv(ou.uGlowB, opts.glowB || [0.20, 0.42, 1.0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, orb.pos); gl.enableVertexAttribArray(P.orb.a.aPos); gl.vertexAttribPointer(P.orb.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, orb.nrm); gl.enableVertexAttribArray(P.orb.a.aNrm); gl.vertexAttribPointer(P.orb.a.aNrm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, orb.idx); gl.drawElements(gl.TRIANGLES, orb.n, gl.UNSIGNED_SHORT, 0); disableAll();
      gl.disable(gl.CULL_FACE); gl.depthMask(true);
    }

    function post() {
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      var bp = P.blur, a = bp.a.aQ;
      gl.useProgram(bp.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(bp.u.uTex, 0);
      gl.viewport(0, 0, fB.w, fB.h);
      function pass(srcT, dst, k, horiz) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.bindTexture(gl.TEXTURE_2D, srcT);
        gl.uniform2f(bp.u.uDir, horiz ? k / fB.w : 0, horiz ? 0 : k / fB.h); gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      pass(fA.t, fB, 1.0, true); pass(fB.t, fT, 1.0, false);
      pass(fT.t, fB, 2.6, true); pass(fB.t, fW, 2.6, false);
      pass(fW.t, fB, 4.8, true); pass(fB.t, fW, 4.8, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.useProgram(P.comp.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fT.t); gl.uniform1i(P.comp.u.uA, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fW.t); gl.uniform1i(P.comp.u.uB, 1);
      gl.uniform1f(P.comp.u.uK, opts.bloom == null ? 1 : opts.bloom);
      var ca = P.comp.a.aQ; gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(ca); gl.vertexAttribPointer(ca, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); disableAll(); gl.activeTexture(gl.TEXTURE0);
    }

    function render(now) {
      resize();
      var t = (now - S.t0) / 1000;
      var asp = W / H, fov = (opts.fov || 28) * Math.PI / 180, dist = opts.distance || 4.9;
      var proj = persp(fov, asp, 0.1, 30);
      var view = tr(opts.panX || 0, opts.panY || 0, -dist);
      var VP = mul(proj, view);
      var cam = [-(opts.panX || 0), -(opts.panY || 0), dist];
      // emissive pass -> fA
      gl.bindFramebuffer(gl.FRAMEBUFFER, fA.f); gl.viewport(0, 0, fA.w, fA.h);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawScene(t, VP, cam, true);
      // beauty pass -> canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawScene(t, VP, cam, false);
      post();
    }

    function step(dt) {
      var k = 1 - Math.pow(0.001, dt);
      S.tilt[0] += (S.tiltT[0] - S.tilt[0]) * k * 0.9; S.tilt[1] += (S.tiltT[1] - S.tilt[1]) * k * 0.9;
      var ak = S.alignT > S.align ? (opts.alignRate || 0.9) : 1.6;
      S.align = S.alignT > S.align ? Math.min(S.alignT, S.align + dt * ak) : Math.max(S.alignT, S.align - dt * ak);
      S.explode += (S.explodeT - S.explode) * k * 0.5;
      S.energy += (S.energyT - S.energy) * k * 0.6;
      S.flash = clamp(S.flash - dt * 1.3, 0, 3);
      S.align = clamp(S.align, 0, 1);
      if (S.intro < 1) S.intro = clamp(S.intro + dt / (opts.introDur || 2.4), 0, 1);
    }

    function frame() {
      raf = 0;
      if (!alive) return;
      var now = performance.now();
      var dt = clamp((now - S.last) / 1000, 0, 0.05); S.last = now;
      step(dt);
      var t0 = performance.now();
      try { render(now); } catch (err) { alive = false; if (window.console) console.warn('MeridianCore', err); return; }
      if (!readyFired) { readyFired = true; if (opts.onReady) opts.onReady(); }
      frames++;
      if (dt > 0.03 && frames > 20) { slow++; if (slow > 40 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slow = 0; } } else slow = Math.max(0, slow - 1);
      if (reduce && S.intro >= 1 && Math.abs(S.tiltT[0] - S.tilt[0]) < 0.001 && Math.abs(S.alignT - S.align) < 0.001 && S.flash <= 0) { return; }
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }
    if (reduce) S.intro = 1;
    raf = requestAnimationFrame(frame);

    var api = {
      set: function (p) {
        if (!p) return;
        if (p.align != null) S.alignT = clamp(p.align, 0, 1);
        if (p.alignNow != null) { S.align = S.alignT = clamp(p.alignNow, 0, 1); }
        if (p.energy != null) S.energyT = p.energy;
        if (p.flash) S.flash = p.flash;
        if (p.explode != null) S.explodeT = p.explode;
        if (p.speed != null) S.speed = p.speed;
        if (p.tilt) { S.tiltT[0] = p.tilt[0]; S.tiltT[1] = p.tilt[1]; }
        if (!raf && alive) raf = requestAnimationFrame(frame);
      },
      renderAt: function (sec, params) {
        // deterministic still (posters/exports)
        S.intro = 1; if (params) api.set(params);
        S.align = S.alignT; S.explode = S.explodeT; S.energy = S.energyT; S.tilt[0] = S.tiltT[0]; S.tilt[1] = S.tiltT[1];
        S.t0 = performance.now() - sec * 1000; render(performance.now());
      },
      destroy: function () {
        alive = false; cancelAnimationFrame(raf);
        if (opts.interactive !== false) { tgt.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); }
        document.removeEventListener('visibilitychange', onVis); canvas.removeEventListener('webglcontextlost', onLost);
      }
    };
    return api;
  }

  window.MeridianCore = { mount: mount, presets: PRESETS, version: '5.0.0' };
})();
