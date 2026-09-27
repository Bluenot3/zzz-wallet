/*!
 * ZEN Vellum Holo — real-time diffraction-grating hologram (WebGL 1)
 * Concentric / linear / radial gratings, embossed relief, kinegram frames that swap with tilt,
 * glitter, silver or gilt foil. Draws into a <canvas> it is given.
 * API: VellumHolo.mount(canvas, { design: 'capital'|'seal'|'strip'|'certificate'|'swatch', tint, frame2Text, ... })
 *      -> { set({ tilt:[x,y], intensity, flash }), destroy() }
 */
(function () {
  'use strict';
  if (window.VellumHolo) return;

  var MARK = 'M0 31L12 31L22 21L10 21L10 9L44 9L0 53L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L100 33L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z';

  /* ------------------------------------------------------------------ design painting */
  function layer(S) { var c = document.createElement('canvas'); c.width = S[0]; c.height = S[1]; var g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S[0], S[1]); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; return { c: c, g: g }; }
  function mark(g, cx, cy, w) {
    var s = w / 100; g.save(); g.translate(cx - 50 * s, cy - 43 * s); g.scale(s, s); g.fill(new Path2D(MARK), 'evenodd'); g.restore();
  }
  function lathe(g, cx, cy, R, amp, k, lw, alpha) {
    g.save(); g.globalAlpha = alpha == null ? 1 : alpha; g.lineWidth = lw; g.beginPath();
    for (var i = 0; i <= 720; i++) { var t = i / 720 * Math.PI * 2, r = R + amp * Math.sin(k * t); var x = cx + r * Math.cos(t), y = cy + r * Math.sin(t); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke(); g.restore();
  }
  function ringText(g, cx, cy, R, text, size, weight) {
    g.save(); g.font = (weight || 600) + ' ' + size + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var chars = text.split(''), step = (Math.PI * 2) / chars.length;
    for (var i = 0; i < chars.length; i++) { g.save(); g.translate(cx, cy); g.rotate(i * step); g.translate(0, -R); g.fillText(chars[i], 0, 0); g.restore(); }
    g.restore();
  }
  function rosette(g, cx, cy, R, petals, lw) {
    g.save(); g.lineWidth = lw;
    for (var j = 0; j < 3; j++) {
      g.beginPath();
      for (var i = 0; i <= 1440; i++) {
        var t = i / 1440 * Math.PI * 2, r = R * (0.62 + 0.38 * Math.abs(Math.cos(petals / 2 * t + j * 0.35)));
        var x = cx + r * Math.cos(t), y = cy + r * Math.sin(t); if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  function paint(design, W, H, o) {
    var S = [W, H], hR = layer(S), f1 = layer(S), f2 = layer(S), sh = layer(S);
    var cx = W / 2, cy = H / 2, m = Math.min(W, H);
    if (design === 'seal' || design === 'certificate' || design === 'swatch') {
      var R = m * 0.48;
      sh.g.beginPath(); sh.g.arc(cx, cy, R, 0, Math.PI * 2); sh.g.fill();
      var g = hR.g;
      g.lineWidth = m * 0.012; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, Math.PI * 2); g.stroke();
      g.lineWidth = m * 0.006; g.beginPath(); g.arc(cx, cy, R * 0.80, 0, Math.PI * 2); g.stroke();
      ringText(g, cx, cy, R * 0.885, o.ringText || 'ZEN TREASURY · PROOF OF RESERVE · FOLIO IV · ', m * (design === 'certificate' ? 0.036 : 0.05), 700);
      for (var i = 0; i < 10; i++) lathe(g, cx, cy, R * (0.26 + i * 0.05), R * 0.014, 20 + i * 6, m * 0.0026, 0.9);
      if (design === 'certificate') { rosette(g, cx, cy, R * 0.74, 24, m * 0.003); }
      mark(f1.g, cx, cy, R * (design === 'certificate' ? 0.72 : 0.82));
      f2.g.save(); f2.g.font = '800 ' + Math.round(m * (design === 'certificate' ? 0.125 : 0.2)) + 'px Georgia, serif'; f2.g.textAlign = 'center'; f2.g.textBaseline = 'middle';
      var lines = (o.frame2Text || 'IV').split('\n');
      for (var L = 0; L < lines.length; L++) f2.g.fillText(lines[L], cx, cy + (L - (lines.length - 1) / 2) * m * (design === 'certificate' ? 0.13 : 0.2));
      f2.g.restore();
    } else if (design === 'strip') {
      sh.g.fillRect(0, 0, W, H);
      var g2 = hR.g; g2.lineWidth = W * 0.03;
      for (var y = 0; y < H + W; y += W * 0.25) { g2.beginPath(); for (var x = 0; x <= W; x += 2) { var yy = y + Math.sin(x / W * Math.PI * 2) * W * 0.08; if (x) g2.lineTo(x, yy); else g2.moveTo(x, yy); } g2.stroke(); }
      for (var k = 0; k * W * 1.3 < H; k++) {
        var yc = W * 0.65 + k * W * 1.3;
        if (k % 2 === 0) mark(f1.g, W / 2, yc, W * 0.62); else { f2.g.save(); f2.g.font = '700 ' + Math.round(W * 0.5) + 'px Georgia, serif'; f2.g.textAlign = 'center'; f2.g.textBaseline = 'middle'; f2.g.fillText('✦', W / 2, yc); f2.g.restore(); }
        if (k % 2 === 0) { f2.g.save(); f2.g.font = '700 ' + Math.round(W * 0.34) + 'px Georgia, serif'; f2.g.textAlign = 'center'; f2.g.textBaseline = 'middle'; f2.g.fillText('IV', W / 2, yc); f2.g.restore(); } else mark(f1.g, W / 2, yc, W * 0.4);
      }
    } else { // capital: illuminated square initial
      var pad = m * 0.04, r2 = m * 0.08;
      sh.g.beginPath(); if (sh.g.roundRect) sh.g.roundRect(pad, pad, W - pad * 2, H - pad * 2, r2); else sh.g.rect(pad, pad, W - pad * 2, H - pad * 2); sh.g.fill();
      var g3 = hR.g; g3.lineWidth = m * 0.02;
      g3.beginPath(); if (g3.roundRect) g3.roundRect(pad * 2.2, pad * 2.2, W - pad * 4.4, H - pad * 4.4, r2 * 0.7); else g3.rect(pad * 2.2, pad * 2.2, W - pad * 4.4, H - pad * 4.4); g3.stroke();
      for (var q = 0; q < 8; q++) lathe(g3, cx, cy, m * (0.1 + q * 0.045), m * 0.01, 14 + q * 4, m * 0.003, 0.8);
      for (var c4 = 0; c4 < 4; c4++) { var px = c4 % 2 ? W - pad * 3.6 : pad * 3.6, py = c4 > 1 ? H - pad * 3.6 : pad * 3.6; g3.beginPath(); g3.arc(px, py, m * 0.025, 0, Math.PI * 2); g3.fill(); }
      mark(f1.g, cx, cy, m * 0.58);
      rosette(f2.g, cx, cy, m * 0.3, 12, m * 0.018);
    }
    // soften relief for smooth normals
    var out = document.createElement('canvas'); out.width = W; out.height = H; var og = out.getContext('2d');
    var ids = [];
    [hR, f1, f2, sh].forEach(function (Lr, idx) {
      var t = document.createElement('canvas'); t.width = W; t.height = H; var tg = t.getContext('2d');
      tg.filter = idx === 3 ? 'blur(0.6px)' : 'blur(' + Math.max(1, m / 300).toFixed(2) + 'px)';
      tg.drawImage(Lr.c, 0, 0); ids.push(tg.getImageData(0, 0, W, H).data);
    });
    var img = og.createImageData(W, H), d = img.data;
    for (var p = 0; p < d.length; p += 4) { d[p] = ids[0][p]; d[p + 1] = ids[1][p]; d[p + 2] = ids[2][p]; d[p + 3] = 255; }
    // alpha lives in a second texture (shape); pack into a separate canvas
    var shapeImg = og.createImageData(W, H), sd = shapeImg.data;
    for (p = 0; p < sd.length; p += 4) { sd[p] = sd[p + 1] = sd[p + 2] = ids[3][p]; sd[p + 3] = 255; }
    return { main: img, shape: shapeImg };
  }

  /* ------------------------------------------------------------------ shaders */
  var VS = 'attribute vec2 aQ; varying vec2 vUV; void main(){ vUV = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'uniform sampler2D uTex; uniform sampler2D uShape; uniform vec2 uTexel; uniform vec2 uTilt; uniform float uTime; uniform float uAspect;',
    'uniform vec3 uTint; uniform float uIntensity; uniform float uFlash; uniform float uGlitter; uniform float uKine;',
    'varying vec2 vUV;',
    'vec3 bump3y(vec3 x, vec3 yo){ vec3 y = vec3(1.0) - x * x; return clamp(y - yo, 0.0, 1.0); }',
    'vec3 spectral(float w){',
    '  float x = clamp((w - 400.0) / 300.0, 0.0, 1.0);',
    '  vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945); vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880); vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);',
    '  vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128); vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860); vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);',
    '  float inR = step(380.0, w) * step(w, 720.0);',
    '  return (bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2)) * inR;',
    '}',
    'vec3 grating(vec3 L, vec3 V, vec3 t, float d){',
    '  float u = abs(dot(L, t) - dot(V, t)); vec3 c = vec3(0.0);',
    '  for (int m = 1; m <= 2; m++) { float w = d * u / float(m); c += spectral(w) / float(m * m); }',
    '  return c;',
    '}',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }',
    'mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }',
    'float H(vec2 uv, float f){ vec3 t = texture2D(uTex, uv).rgb; return t.r * 0.5 + t.g * 1.35 * (1.0 - f) + t.b * 1.35 * f; }',
    'void main(){',
    '  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);',
    '  float a = texture2D(uShape, uv).r; if (a < 0.003) { gl_FragColor = vec4(0.0); return; }',
    '  vec3 T = texture2D(uTex, uv).rgb;',
    '  float f = smoothstep(-0.18, 0.18, uTilt.x + uKine);',
    '  float h0 = H(uv, f);',
    '  float hx = H(uv + vec2(uTexel.x, 0.0), f) - H(uv - vec2(uTexel.x, 0.0), f);',
    '  float hy = H(uv + vec2(0.0, uTexel.y), f) - H(uv - vec2(0.0, uTexel.y), f);',
    '  vec3 N = normalize(vec3(-hx * 2.2, hy * 2.2, 1.0));',
    '  vec2 P2 = (vUV - 0.5) * vec2(uAspect, 1.0) * 2.0;',
    '  vec3 P = vec3(P2, 0.0);',
    '  mat3 R = rotY(uTilt.x * 0.55) * rotX(-uTilt.y * 0.45);',
    '  vec3 cam = R * vec3(0.0, 0.0, 3.2);',
    '  vec3 lp1 = R * vec3(-1.6, 2.2, 2.4); vec3 lp2 = R * vec3(2.4, -0.6, 2.0);',
    '  vec3 V = normalize(cam - P), L1 = normalize(lp1 - P), L2 = normalize(lp2 - P);',
    '  float e1 = T.g * (1.0 - f), e2 = T.b * f;',
    '  vec2 radial = length(P2) > 1e-3 ? normalize(P2) : vec2(1.0, 0.0);',
    '  vec2 t2 = radial; float d = 1500.0;',
    '  if (T.r > 0.45) { t2 = vec2(-radial.y, radial.x); d = 1850.0; }',
    '  if (e1 > 0.35) { t2 = normalize(vec2(1.0, 1.0)); d = 1150.0; }',
    '  if (e2 > 0.35) { t2 = normalize(vec2(1.0, -0.6)); d = 1300.0; }',
    '  vec3 t = normalize(vec3(t2, 0.0) - N * dot(vec3(t2, 0.0), N));',
    '  vec3 dif = grating(L1, V, t, d) * 0.9 + grating(L2, V, t, d) * 0.45;',
    '  vec3 Rf = reflect(-V, N);',
    '  float spec = pow(max(dot(Rf, L1), 0.0), 70.0) * 1.2 + pow(max(dot(Rf, L2), 0.0), 40.0) * 0.35;',
    '  float grad = 0.5 + 0.5 * dot(N, normalize(vec3(-0.4, 0.6, 0.7)));',
    '  vec3 base = mix(vec3(0.42, 0.43, 0.46), vec3(0.92, 0.93, 0.95), grad) * uTint;',
    '  vec2 cell = floor(uv / uTexel / 3.0);',
    '  float r1 = hash(cell), r2 = hash(cell + 17.3), r3 = hash(cell + 41.7);',
    '  vec3 gn = normalize(vec3((r1 - 0.5) * 0.9, (r2 - 0.5) * 0.9, 1.0));',
    '  float glit = pow(max(dot(reflect(-L1, gn), V), 0.0), 1600.0) * step(0.82, r3) * uGlitter * 2.2;',
    '  float emph = smoothstep(0.3, 0.7, max(e1, e2));',
    '  dif *= mix(1.0, 0.3, emph); base = mix(base, vec3(0.95, 0.96, 0.98) * uTint, emph * 0.55);',
    '  vec3 col = base * 0.5 + dif * uIntensity * 1.2 * mix(vec3(1.0), uTint, 0.35) + vec3(spec) + vec3(glit);',
    '  col += (e1 + e2) * vec3(0.13) + h0 * 0.03;',
    '  col += vec3(uFlash) * 0.8;',
    '  col = col / (1.0 + col * 0.22);',
    '  col = mix(vec3(dot(col, vec3(0.3333))), col, 1.18);',
    '  col = pow(clamp(col, 0.0, 1.0), vec3(0.95));',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('VellumHolo: ' + gl.getShaderInfoLog(s)); return s; }
  function tex(gl, img) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    var p;
    try {
      p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    } catch (e) { if (window.console) console.warn(e.message); return null; }
    var U = {}; ['uTex', 'uShape', 'uTexel', 'uTilt', 'uTime', 'uAspect', 'uTint', 'uIntensity', 'uFlash', 'uGlitter', 'uKine'].forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
    var aQ = gl.getAttribLocation(p, 'aQ');
    var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2);
    var W = 0, H = 0, tMain = null, tShape = null, texW = 0, texH = 0;
    var S = { tilt: [0, 0], tiltT: [0, 0], flash: 0, intensity: opts.intensity == null ? 1 : opts.intensity, t0: performance.now(), last: performance.now(), hover: false };
    var alive = true, raf = 0, ready = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function build() {
      var cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
      W = Math.max(2, Math.round(cw * dpr)); H = Math.max(2, Math.round(ch * dpr));
      canvas.width = W; canvas.height = H;
      var k = Math.min(1, (opts.texMax || 1024) / Math.max(W, H));
      texW = Math.max(16, Math.round(W * k)); texH = Math.max(16, Math.round(H * k));
      var d = paint(opts.design || 'seal', texW, texH, opts);
      if (tMain) gl.deleteTexture(tMain); if (tShape) gl.deleteTexture(tShape);
      tMain = tex(gl, d.main); tShape = tex(gl, d.shape);
    }
    function onMove(e) {
      var r = canvas.getBoundingClientRect(); if (!r.width) return;
      var span = opts.span || 2.2;
      S.tiltT[0] = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 * span)));
      S.tiltT[1] = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 * span)));
      S.hover = true; clearTimeout(S._ht); S._ht = setTimeout(function () { S.hover = false; }, 2600);
      if (!raf && alive) raf = requestAnimationFrame(frame);
    }
    if (opts.interactive !== false) window.addEventListener('pointermove', onMove, { passive: true });
    function draw(t) {
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p);
      gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.enableVertexAttribArray(aQ); gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tMain); gl.uniform1i(U.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tShape); gl.uniform1i(U.uShape, 1);
      gl.uniform2f(U.uTexel, 1.5 / texW, 1.5 / texH);
      var idle = S.hover || reduce ? 0 : 1;
      var sx = S.tilt[0] + idle * (Math.sin(t * 0.55) * 0.34 + Math.sin(t * 0.21) * 0.12);
      var sy = S.tilt[1] + idle * (Math.cos(t * 0.43) * 0.22);
      S.eff = [sx, sy];
      gl.uniform2f(U.uTilt, sx, sy); gl.uniform1f(U.uTime, t); gl.uniform1f(U.uAspect, W / H);
      var tint = opts.tint || [1, 1, 1]; gl.uniform3f(U.uTint, tint[0], tint[1], tint[2]);
      gl.uniform1f(U.uIntensity, S.intensity); gl.uniform1f(U.uFlash, S.flash); gl.uniform1f(U.uGlitter, opts.glitter == null ? 1 : opts.glitter);
      gl.uniform1f(U.uKine, opts.kine || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function frame() {
      raf = 0; if (!alive) return;
      var now = performance.now(), dt = Math.max(0, Math.min(0.05, (now - S.last) / 1000)); S.last = now;
      var k = 1 - Math.pow(0.002, dt);
      S.tilt[0] += (S.tiltT[0] - S.tilt[0]) * k; S.tilt[1] += (S.tiltT[1] - S.tilt[1]) * k;
      S.flash = Math.max(0, S.flash - dt * 1.4);
      try { draw((now - S.t0) / 1000); } catch (e) { alive = false; return; }
      if (!ready) { ready = true; if (opts.onReady) opts.onReady(); }
      if (reduce && S.flash <= 0 && Math.abs(S.tiltT[0] - S.tilt[0]) < 0.001) return;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }
    function onVis() { if (!document.hidden && alive && !raf) raf = requestAnimationFrame(frame); }
    document.addEventListener('visibilitychange', onVis);
    try { build(); } catch (e) { if (window.console) console.warn('VellumHolo', e); return null; }
    raf = requestAnimationFrame(frame);
    var api = {
      set: function (q) { if (!q) return; if (q.tilt) { S.tiltT[0] = q.tilt[0]; S.tiltT[1] = q.tilt[1]; S.hover = true; } if (q.intensity != null) S.intensity = q.intensity; if (q.flash) S.flash = q.flash; if (!raf && alive) raf = requestAnimationFrame(frame); },
      getTilt: function () { return S.eff || [0, 0]; },
      renderAt: function (sec, tilt) { S.hover = true; S.tilt = tilt ? tilt.slice() : [0, 0]; S.tiltT = S.tilt.slice(); draw(sec); },
      destroy: function () { alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); }
    };
    return api;
  }
  window.VellumHolo = { mount: mount, version: '4.0.0' };
})();
