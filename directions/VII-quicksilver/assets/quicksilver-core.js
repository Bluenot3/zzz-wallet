/*
 * Quicksilver core — liquid-metal treasury renderer for ZEN (Direction VII).
 * Dependency-free WebGL1. One full-screen fragment shader raymarches up to six
 * smooth-union metaballs (each asset is a droplet whose volume is its value),
 * on a seamless photographic studio sweep: floor, quarter-cylinder cove, wall.
 * The wall carries a canvas-drawn print (the balance) that the metal and the
 * glossy floor reflect. Droplets: tinted Schlick fresnel, one inter-reflection
 * bounce, cavity occlusion, soft key-light shadows, contact occlusion, spring
 * physics for lift and squash, and ferrofluid spikes for stress.
 *
 * API: Quicksilver.mount(canvas, opts) -> { set(o), project(i), redrawWall(), destroy() } | null
 *      Quicksilver.project(opts, [x, y, z], cssW, cssH) -> { x, y, s }   (pure, no WebGL)
 *      Quicksilver.radius(value, unitValue, unitRadius) -> volume-true radius
 */
(function () {
  'use strict';
  var MAXD = 6, NDIR = 18;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  var DEF = {
    camera: { pos: [0, 1.9, 5.2], target: [0, 0.8, 0], fov: 40 },
    scene: { wallZ: 2.6, cove: 1.25, light: [0.2, 4.4, 1.6], k: 0.2, exposure: 1.2 },
    wall: { rect: [-2.4, 1.5, 4.8, 2.4] }
  };

  function camera(c) {
    var f = norm(sub(c.target, c.pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    return { pos: c.pos, f: f, r: r, u: u, tan: Math.tan((c.fov || 40) * Math.PI / 360) };
  }
  function project(opts, p, w, h) {
    var cam = camera((opts && opts.camera) || DEF.camera), d = sub(p, cam.pos), z = dot(d, cam.f);
    var asp = w / h, x = dot(d, cam.r) / (z * cam.tan * asp), y = dot(d, cam.u) / (z * cam.tan);
    return { x: (x + 1) / 2 * w, y: (1 - y) / 2 * h, s: h / 2 / (z * cam.tan) };
  }
  /* Volume is value: r = unitRadius * cbrt(value / unitValue). */
  function radius(v, unitV, unitR) { return unitR * Math.cbrt(Math.max(v, 0) / unitV); }

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;uniform vec3 uCam,uF,uR,uU;uniform float uTan;',
    'uniform vec4 uD[6];uniform vec4 uT[6];uniform float uSq[6];uniform int uN;uniform float uK;',
    'uniform vec3 uDir[18];uniform sampler2D uTex;uniform vec4 uWall;uniform vec3 uScene;uniform vec3 uLight;uniform float uExpo;uniform float uSel[6];uniform vec4 uRing[2];',
    'vec4 map(vec3 p){',
    '  float d=1e3;vec3 col=vec3(0.8);',
    '  for(int i=0;i<6;i++){',
    '    if(i>=uN)break;',
    '    vec4 D=uD[i];if(D.w<0.004)continue;vec3 q=p-D.xyz;float sq=uSq[i];vec3 qs=vec3(q.x,q.y/sq,q.z);float l=length(qs);',
    '    float di=(l-D.w)*min(sq,1.0);',
    '    float sp=uT[i].w;',
    '    if(sp>0.002&&di<D.w*0.6&&di-sp*D.w*0.55<d+uK){',
    '      vec3 n=qs/max(l,1e-4);float m=0.0;',
    '      for(int j=0;j<18;j++){m=max(m,dot(n,uDir[j]));}',
    '      float a=max(0.0,1.0-sqrt(max(2.0-2.0*m,0.0))/0.36);',
    '      di-=sp*D.w*0.55*a*a;',
    '    }',
    '    float h=clamp(0.5+0.5*(di-d)/uK,0.0,1.0);',
    '    d=mix(di,d,h)-uK*h*(1.0-h);col=mix(uT[i].rgb,col,h);',
    '  }',
    '  return vec4(d,col);',
    '}',
    'vec3 nrm(vec3 p){vec2 e=vec2(1.0,-1.0)*0.0016;return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}',
    'vec2 bound(vec3 ro,vec3 rd){',
    '  float tn=1e9,tf=-1.0;',
    '  for(int i=0;i<6;i++){',
    '    if(i>=uN)break;',
    '    if(uD[i].w<0.004)continue;float R=uD[i].w*(1.0+uT[i].w*0.5)+uK+0.03;vec3 oc=ro-uD[i].xyz;float b=dot(oc,rd);float c=dot(oc,oc)-R*R;float h=b*b-c;',
    '    if(h>0.0){h=sqrt(h);tn=min(tn,-b-h);tf=max(tf,-b+h);}',
    '  }',
    '  return vec2(max(tn,0.0),tf);',
    '}',
    'float spikeMax(){float s=0.0;for(int i=0;i<6;i++){if(i>=uN)break;s=max(s,uT[i].w);}return s;}',
    'float march(vec3 ro,vec3 rd,vec2 b,float fac){',
    '  float t=b.x;',
    '  for(int i=0;i<140;i++){',
    '    if(t>b.y)return -1.0;',
    '    float d=map(ro+rd*t).x;',
    '    if(d<0.0007*(1.0+t))return t;',
    '    t+=d*fac;',
    '  }',
    '  return -1.0;',
    '}',
    'float marchLo(vec3 ro,vec3 rd,vec2 b,float fac){',
    '  float t=b.x;',
    '  for(int i=0;i<44;i++){',
    '    if(t>b.y)return -1.0;',
    '    float d=map(ro+rd*t).x;',
    '    if(d<0.003*(1.0+t))return t;',
    '    t+=d*fac;',
    '  }',
    '  return -1.0;',
    '}',
    /* seamless sweep: floor (y=0) -> cove (quarter cylinder, axis x) -> wall (z=-wallZ) */
    'float backdrop(vec3 ro,vec3 rd,out vec3 n,out float kind){',
    '  float WZ=uScene.x,R=uScene.y,cz=-WZ+R;float t=1e9;n=vec3(0.0,1.0,0.0);kind=-1.0;',
    '  if(rd.y<-1e-5){float tf=-ro.y/rd.y;vec3 p=ro+rd*tf;if(tf>1e-4&&p.z>=cz){t=tf;n=vec3(0.0,1.0,0.0);kind=0.0;}}',
    '  if(rd.z<-1e-5){float tw=(-WZ-ro.z)/rd.z;vec3 p=ro+rd*tw;if(tw>1e-4&&p.y>=R&&tw<t){t=tw;n=vec3(0.0,0.0,1.0);kind=2.0;}}',
    '  vec2 o=vec2(ro.y-R,ro.z-cz),dv=rd.yz;float a=dot(dv,dv),b=2.0*dot(o,dv),c=dot(o,o)-R*R,disc=b*b-4.0*a*c;',
    '  if(disc>0.0&&a>1e-6){float t2=(-b+sqrt(disc))/(2.0*a);vec3 p=ro+rd*t2;if(t2>1e-4&&p.y<R&&p.z<cz&&t2<t){t=t2;n=normalize(vec3(0.0,R-p.y,cz-p.z));kind=1.0;}}',
    '  return t;',
    '}',
    'float shadow(vec3 p,vec3 n){',
    '  float occ=0.0,sh=1.0;vec3 L=normalize(uLight-p);',
    '  for(int i=0;i<6;i++){',
    '    if(i>=uN)break;',
    '    if(uD[i].w<0.004)continue;vec3 c=uD[i].xyz;float r=uD[i].w*(0.92+uT[i].w*0.3);vec3 v=c-p;float dd=dot(v,v);',
    '    occ+=max(dot(n,v),0.0)/sqrt(dd)*r*r/dd;',
    '    float tt=dot(v,L);if(tt>0.0){float dist=length(v-L*tt);sh*=smoothstep(r*0.5,r*1.02+tt*0.2,dist);}',
    '  }',
    '  return clamp(1.0-0.92*occ,0.0,1.0)*mix(0.2,1.0,sh);',
    '}',
    'vec3 base(vec3 p,vec3 n,float kind,float emw){',
    '  vec3 L=uLight-p;float dl=length(L);L/=dl;',
    '  float ndl=max(dot(n,L),0.0);float spot=exp(-p.x*p.x*0.07)*(0.55+0.45*exp(-max(p.z-0.6,0.0)*0.35));',
    '  float irr=0.02+1.9*ndl*spot/(1.0+0.06*dl*dl);',
    '  irr+=2.6*exp(-p.x*p.x*0.13-(p.y-0.85)*(p.y-0.85)*0.42-(p.z+2.6)*(p.z+2.6)*0.32);',
    '  vec3 c=vec3(0.036,0.038,0.043)*irr;',
    '  if(kind>1.5){',
    '    vec2 uv=vec2((p.x-uWall.x)/uWall.z,1.0-(p.y-uWall.y)/uWall.w);',
    '    if(uv.x>0.0&&uv.x<1.0&&uv.y>0.0&&uv.y<1.0){vec4 tx=texture2D(uTex,uv);c=mix(c,tx.rgb*(irr*0.9+0.08),tx.a);}',
    '  }',
    '  float em=0.0;',
    '  if(kind<0.5){for(int i=0;i<2;i++){vec4 R=uRing[i];if(R.w<=0.0)continue;float d=length(p.xz-R.xy);em+=R.w*(smoothstep(0.03,0.0,abs(d-R.z))*0.9+smoothstep(R.z,R.z*0.2,d)*0.05+smoothstep(0.02,0.0,abs(d-R.z*0.82))*0.25);}}',
    '  if(kind>1.5){float ax=abs(p.x);em=smoothstep(2.25,2.55,ax)*(1.0-smoothstep(3.7,4.0,ax))*smoothstep(0.9,1.5,p.y)*(1.0-smoothstep(4.0,4.6,p.y));}',
    '  return c*shadow(p,n)+vec3(1.45,1.45,1.5)*em*emw;',
    '}',
    'vec3 studio(vec3 r){',
    '  vec3 c=vec3(0.008,0.0085,0.0095)+vec3(0.02,0.021,0.024)*smoothstep(-0.2,0.9,r.y);',
    '  if(r.y>0.02){vec2 q=r.xz*(4.4/r.y);',
    '    vec2 dd=abs(q-vec2(0.0,0.9))-vec2(3.4,2.8);float e=max(dd.x,dd.y);c+=vec3(0.62,0.62,0.64)*(1.0-smoothstep(-1.6,0.6,e));',
    '    vec2 d2=abs(q-vec2(0.0,0.7))-vec2(1.5,1.2);float e2=max(d2.x,d2.y);c+=vec3(1.9,1.87,1.82)*(1.0-smoothstep(-0.25,0.12,e2))*(0.75+0.25*smoothstep(-1.4,0.0,-abs(q.x)));}',
    '  if(r.x<-0.05){vec2 q=r.yz*(3.6/-r.x);vec2 dd=abs(q-vec2(1.6,1.8))-vec2(1.25,0.65);float e=max(dd.x,dd.y);c+=vec3(1.3,1.28,1.25)*(1.0-smoothstep(-0.22,0.12,e));}',
    '  if(r.x>0.05){vec2 q=r.yz*(3.6/r.x);vec2 dd=abs(q-vec2(1.4,1.5))-vec2(1.0,0.4);float e=max(dd.x,dd.y);c+=vec3(0.62,0.64,0.7)*(1.0-smoothstep(-0.22,0.12,e));}',
    '  if(r.z>0.05){vec2 q=r.xy*(6.0/r.z);vec2 dd=abs(q-vec2(0.0,1.4))-vec2(3.6,1.9);float e=max(dd.x,dd.y);c+=vec3(0.52,0.53,0.56)*(1.0-smoothstep(-1.4,0.4,e))*smoothstep(-0.2,1.6,q.y);',
    '    vec2 d2=abs(q-vec2(-1.2,2.1))-vec2(0.5,1.1);c+=vec3(0.9,0.9,0.92)*(1.0-smoothstep(-0.12,0.08,max(d2.x,d2.y)));}',
    '  return c;',
    '}',
    'vec3 env(vec3 p,vec3 r,float emw){vec3 n;float kind;float t=backdrop(p,r,n,kind);if(t<1e8)return base(p+r*t,n,kind,emw);return studio(r);}',
    'vec3 envDrops(vec3 p,vec3 r,vec3 selfC){',
    '  float tb=1e9;vec3 hc=vec3(0.0);float hr=1.0;vec3 ht=vec3(0.8);',
    '  for(int i=0;i<6;i++){',
    '    if(i>=uN)break;',
    '    vec3 c=uD[i].xyz;if(length(c-selfC)<1e-3||uD[i].w<0.004)continue;',
    '    float R=uD[i].w*mix(uSq[i],1.0,0.4);vec3 oc=p-c;float b=dot(oc,r);float cc=dot(oc,oc)-R*R;float h=b*b-cc;',
    '    if(h>0.0){float t=-b-sqrt(h);if(t>0.02&&t<tb){tb=t;hc=c;hr=R;ht=uT[i].rgb;}}',
    '  }',
    '  if(tb<1e8){vec3 q=p+r*tb;vec3 n2=normalize(q-hc);vec3 r2=reflect(r,n2);float ct=clamp(dot(n2,-r),0.0,1.0);vec3 F=ht+(1.0-ht)*pow(1.0-ct,5.0);return env(q,r2,1.0)*F;}',
    '  return env(p,r,1.0);',
    '}',
    'vec3 nearestC(vec3 p){float bd=1e9;vec3 bc=vec3(0.0);for(int i=0;i<6;i++){if(i>=uN)break;float d=length(p-uD[i].xyz)-uD[i].w;if(d<bd){bd=d;bc=uD[i].xyz;}}return bc;}',
    'float selAt(vec3 p){float bd=1e9;float s=0.0;for(int i=0;i<6;i++){if(i>=uN)break;float d=length(p-uD[i].xyz)-uD[i].w;if(d<bd){bd=d;s=uSel[i];}}return s;}',
    'vec3 shadeDrop(vec3 p,vec3 rd,bool bounce){',
    '  vec4 m=map(p);vec3 n=nrm(p);vec3 r=reflect(rd,n);',
    '  vec3 e=bounce?envDrops(p+n*0.004,r,nearestC(p)):env(p+n*0.004,r,1.0);',
    '  float ct=clamp(dot(n,-rd),0.0,1.0);vec3 F=m.yzw+(1.0-m.yzw)*pow(1.0-ct,5.0);',
    '  float ao=clamp(map(p+n*0.14).x/0.14,0.0,1.0);',
    '  vec3 c=e*F*mix(0.42,1.0,ao);',
    '  c+=vec3(0.9,0.92,1.0)*pow(1.0-ct,3.0)*0.05*selAt(p);',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy/uRes)*2.0-1.0;float asp=uRes.x/uRes.y;',
    '  vec3 rd=normalize(uF+uR*uv.x*uTan*asp+uU*uv.y*uTan);vec3 ro=uCam;',
    '  float fac=spikeMax()>0.01?0.6:0.85;',
    '  vec3 col;vec3 n;float kind;float tB=backdrop(ro,rd,n,kind);',
    '  vec2 b=bound(ro,rd);float tD=-1.0;',
    '  if(b.y>b.x&&b.x<tB)tD=march(ro,rd,vec2(b.x,min(b.y,tB)),fac);',
    '  if(tD>0.0){col=shadeDrop(ro+rd*tD,rd,true);}',
    '  else if(tB<1e8){',
    '    vec3 p=ro+rd*tB;col=base(p,n,kind,0.0);',
    '    if(kind<0.5){',
    '      float gloss=smoothstep(-uScene.x+uScene.y,-uScene.x+uScene.y+1.3,p.z);',
    '      vec3 rr=reflect(rd,n);vec3 po=p+n*0.002;float ct=clamp(dot(n,-rd),0.0,1.0);float fr=(0.03+0.3*pow(1.0-ct,5.0))*gloss;',
    '      vec2 b2=bound(po,rr);vec3 refl;float t2=-1.0;',
    '      if(b2.y>b2.x)t2=marchLo(po,rr,b2,fac);',
    '      if(t2>0.0){refl=shadeDrop(po+rr*t2,rr,false);fr=max(fr,0.14*gloss);}else{refl=env(po,rr,0.0)*0.42;}',
    '      col+=refl*fr;',
    '    }',
    '  } else col=studio(rd);',
    '  col=1.0-exp(-col*uExpo);',
    '  col=pow(col,vec3(1.0/2.2));',
    '  float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);col+=(g-0.5)/255.0;',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function sh(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Quicksilver shader: ' + gl.getShaderInfoLog(s));
    return s;
  }

  function fibDirs(n) {
    var out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i + 0.5) / n * 0.92, rr = Math.sqrt(1 - y * y), th = ga * i;
      out.push([Math.cos(th) * rr, y, Math.sin(th) * rr]);
    }
    return out;
  }

  /* The wall print. Default: a label, the balance as huge numerals, and small cents. */
  function drawWall(cv, w) {
    var g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (w.draw) { w.draw(g, W, H); return; }
    var ink = w.ink || '#E9ECEF', inkSoft = w.inkSoft || 'rgba(233,236,239,0.62)';
    var big = w.big || '', small = w.small || '', label = w.label || '', disp = w.font || 'Syne', ui = w.uiFont || 'Onest';
    var maxW = W * (w.fill || 0.9);
    var size = H * (w.bigSize || 0.5);
    g.textBaseline = 'alphabetic';
    var dF = disp + ', ' + ui + ', sans-serif', uF = ui + ', sans-serif';
    function widths(s) { g.font = '800 ' + s + 'px ' + dF; var a = g.measureText(big).width; g.font = '700 ' + (s * 0.36) + 'px ' + dF; var b = small ? g.measureText(small).width + s * 0.03 : 0; return a + b; }
    var tw = widths(size); if (tw > maxW) { size *= maxW / tw; tw = widths(size); }
    var x = w.align === 'left' ? W * (1 - (w.fill || 0.9)) / 2 : (W - tw) / 2, base = H * (w.baseline || 0.8);
    g.fillStyle = ink; g.font = '800 ' + size + 'px ' + dF; g.fillText(big, x, base);
    var bw = g.measureText(big).width;
    if (small) { g.fillStyle = inkSoft; g.font = '700 ' + (size * 0.36) + 'px ' + dF; g.fillText(small, x + bw + size * 0.03, base - size * 0.42); }
    if (label) { g.fillStyle = inkSoft; g.font = '500 ' + (H * (w.labelSize || 0.075)) + 'px ' + uF; g.fillText(label, x + size * 0.04, base - size * 0.84); }
  }

  /* Big beads sag more: mercury on a flat surface flattens with size. */
  function restSq(r) { return clamp(0.94 - 0.28 * r, 0.7, 0.9); }

  function mount(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) return null;
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl, gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, 'a'); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Quicksilver link: ' + gl.getProgramInfoLog(prog));
    } catch (err) { if (window.console) console.warn(err.message); return null; }
    gl.useProgram(prog);
    var U = {}; ['uRes', 'uCam', 'uF', 'uR', 'uU', 'uTan', 'uD', 'uT', 'uSq', 'uN', 'uK', 'uDir', 'uTex', 'uWall', 'uScene', 'uLight', 'uExpo', 'uSel', 'uRing'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k.match(/^u(D|T|Sq|Dir|Sel|Ring)$/) ? k + '[0]' : k); });
    var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var scene = {}, k; for (k in DEF.scene) scene[k] = DEF.scene[k]; for (k in (opts.scene || {})) scene[k] = opts.scene[k];
    var cam = camera(opts.camera || DEF.camera);
    var wall = opts.wall || {}; var rect = wall.rect || DEF.wall.rect;
    var wcv = document.createElement('canvas'); wcv.width = wall.texW || 2048; wcv.height = Math.round((wall.texW || 2048) * rect[3] / rect[2]);
    var tex = gl.createTexture();
    function uploadWall() {
      drawWall(wcv, wall);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wcv);
      var pot = (wcv.width & (wcv.width - 1)) === 0 && (wcv.height & (wcv.height - 1)) === 0;
      if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    uploadWall();

    // droplet state: springs for lift (y offset), squash (y scale), spike, radius
    var drops = (opts.drops || []).slice(0, MAXD).map(function (d) {
      return { x: d.x, xT: d.x, xV: 0, z: d.z, zT: d.z, zV: 0, tint: d.tint || [0.8, 0.8, 0.82],
        r: d.r, rT: d.r, rV: 0, lift: d.lift || 0, liftT: d.lift || 0, liftV: 0,
        sq: restSq(d.r), sqT: restSq(d.r), sqV: 0, spike: d.spike || 0, spikeT: d.spike || 0, spikeV: 0, sel: d.sel ? 1 : 0, selT: d.sel ? 1 : 0 };
    });
    var dirs = fibDirs(NDIR), dirBuf = new Float32Array(NDIR * 3), rings = opts.rings || [];
    var dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2), scale = opts.quality || 1, W = 0, H = 0;
    var raf = 0, alive = true, readyFired = false, last = performance.now(), t0 = last, dirty = true;
    var reduce = !!opts.still || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function resize() {
      var cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
      var w = Math.max(2, Math.round(cw * dpr * scale)), h = Math.max(2, Math.round(ch * dpr * scale));
      if (w === W && h === H) return; W = w; H = h; canvas.width = w; canvas.height = h; dirty = true;
    }
    function spring(o, key, dt, stiff, damp) {
      var x = o[key], v = o[key + 'V'], tgt = o[key + 'T'];
      if (reduce) { o[key] = tgt; o[key + 'V'] = 0; return false; }
      var a = stiff * (tgt - x) - damp * v; v += a * dt; x += v * dt;
      o[key] = x; o[key + 'V'] = v;
      return Math.abs(tgt - x) > 1e-4 || Math.abs(v) > 1e-4;
    }
    function step(dt) {
      var moving = false;
      drops.forEach(function (d) {
        var wasUp = d.lift > 0.05;
        if (spring(d, 'lift', dt, 70, 11)) moving = true;
        if (wasUp && d.liftT === 0 && d.lift <= 0.02 && d.liftV < -0.3) { d.sqV -= d.liftV * 0.9; } // landing jiggle
        d.sqT = d.lift > 0.04 ? 0.97 : restSq(d.r);
        if (spring(d, 'sq', dt, 160, 7)) moving = true;
        if (spring(d, 'spike', dt, 60, 13)) moving = true;
        if (spring(d, 'r', dt, 90, 16)) moving = true;
        if (spring(d, 'x', dt, 110, 19)) moving = true;
        if (spring(d, 'z', dt, 110, 19)) moving = true;
        if (Math.abs(d.selT - d.sel) > 1e-3) { d.sel += (d.selT - d.sel) * Math.min(1, dt * 10); moving = true; } else d.sel = d.selT;
      });
      return moving;
    }
    function draw(time) {
      resize();
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform3fv(U.uCam, cam.pos); gl.uniform3fv(U.uF, cam.f); gl.uniform3fv(U.uR, cam.r); gl.uniform3fv(U.uU, cam.u); gl.uniform1f(U.uTan, cam.tan);
      var D = new Float32Array(MAXD * 4), T = new Float32Array(MAXD * 4), SQ = new Float32Array(MAXD), SEL = new Float32Array(MAXD);
      drops.forEach(function (d, i) {
        var y = d.r * d.sq + d.lift;
        D[i * 4] = d.x; D[i * 4 + 1] = y; D[i * 4 + 2] = d.z; D[i * 4 + 3] = d.r;
        T[i * 4] = d.tint[0]; T[i * 4 + 1] = d.tint[1]; T[i * 4 + 2] = d.tint[2]; T[i * 4 + 3] = Math.max(0, d.spike);
        SQ[i] = d.sq; SEL[i] = d.sel;
      });
      gl.uniform4fv(U.uD, D); gl.uniform4fv(U.uT, T); gl.uniform1fv(U.uSq, SQ); gl.uniform1fv(U.uSel, SEL); gl.uniform1i(U.uN, drops.length);
      gl.uniform1f(U.uK, scene.k);
      var rot = time * 0.00012, cr = Math.cos(rot), sr = Math.sin(rot);
      dirs.forEach(function (v, j) { dirBuf[j * 3] = v[0] * cr - v[2] * sr; dirBuf[j * 3 + 1] = v[1]; dirBuf[j * 3 + 2] = v[0] * sr + v[2] * cr; });
      gl.uniform3fv(U.uDir, dirBuf);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
      gl.uniform4f(U.uWall, rect[0], rect[1], rect[2], rect[3]);
      var RG = new Float32Array(8); rings.slice(0, 2).forEach(function (g, i) { RG[i * 4] = g.x; RG[i * 4 + 1] = g.z; RG[i * 4 + 2] = g.r; RG[i * 4 + 3] = g.glow == null ? 1 : g.glow; });
      gl.uniform4fv(U.uRing, RG);
      gl.uniform3f(U.uScene, scene.wallZ, scene.cove, 0); gl.uniform3fv(U.uLight, scene.light); gl.uniform1f(U.uExpo, scene.exposure);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function frame(now) {
      raf = 0; if (!alive) return;
      var dt = Math.min(0.033, (now - last) / 1000); last = now;
      var moving = step(dt);
      var spiky = drops.some(function (d) { return d.spike > 0.01; });
      if (moving || dirty || (spiky && !reduce)) { draw(now - t0); dirty = false; }
      if (!readyFired) { readyFired = true; if (opts.onReady) opts.onReady(); }
      if ((moving || (spiky && !reduce)) && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function onVis() { if (!document.hidden) { dirty = true; kick(); } }
    function onLost(e) { e.preventDefault(); alive = false; if (raf) cancelAnimationFrame(raf); if (opts.onLost) opts.onLost(); }
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('webglcontextlost', onLost);
    var ro = window.ResizeObserver ? new ResizeObserver(function () { dirty = true; kick(); }) : null;
    if (ro) ro.observe(canvas);
    /* The print is drawn with web fonts that may still be loading (or not even declared yet):
       ask the font set to load the exact glyphs; an empty result means the face is not declared yet, so retry. */
    var fontTimers = [], fontsOk = false;
    function fontCheck() {
      if (!alive || fontsOk || !document.fonts || !document.fonts.load) return;
      var big = (wall.big || '$0') + (wall.small || '') + '0123456789,.';
      Promise.all([document.fonts.load('800 100px "' + (wall.font || 'Syne') + '"', big), document.fonts.load('500 40px "' + (wall.uiFont || 'Onest') + '"', wall.label || 'Total')])
        .then(function (r) { if (alive && !fontsOk && r[0].length && r[1].length) { fontsOk = true; uploadWall(); dirty = true; kick(); } }, function () {});
    }
    if (document.fonts) {
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fontCheck);
      [60, 250, 700, 1500, 3000, 6000, 12000].forEach(function (ms) { fontTimers.push(setTimeout(fontCheck, ms)); });
      fontCheck();
    }
    kick();

    return {
      set: function (o) {
        if (o.drops) o.drops.forEach(function (p, i) {
          var d = drops[i]; if (!d || !p) return;
          if (p.lift != null) d.liftT = p.lift;
          if (p.spike != null) d.spikeT = p.spike;
          if (p.r != null) d.rT = p.r;
          if (p.sel != null) d.selT = p.sel ? 1 : 0;
          if (p.tint) d.tint = p.tint;
          if (p.x != null) d.xT = p.x;
          if (p.z != null) d.zT = p.z;
          if (p.snap) { d.x = d.xT; d.z = d.zT; d.r = d.rT; d.lift = d.liftT; d.xV = d.zV = d.rV = d.liftV = 0; }
        });
        if (o.wall) { for (var kk in o.wall) wall[kk] = o.wall[kk]; uploadWall(); }
        if (o.exposure != null) scene.exposure = o.exposure;
        if (o.k != null) scene.k = o.k;
        if (o.rings) rings = o.rings;
        dirty = true; kick();
      },
      project: function (i, w, h) {
        var d = drops[i]; if (!d) return null;
        return project({ camera: opts.camera || DEF.camera }, [d.x, d.r * d.sq + d.lift, d.z], w, h);
      },
      redrawWall: function () { uploadWall(); dirty = true; kick(); },
      renderNow: function () { step(1); draw(performance.now() - t0); },
      destroy: function () {
        alive = false; if (raf) cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis); canvas.removeEventListener('webglcontextlost', onLost);
        if (ro) ro.disconnect();
        fontTimers.forEach(clearTimeout); if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', fontCheck);
        try { gl.deleteTexture(tex); gl.deleteBuffer(qb); gl.deleteProgram(prog); } catch (e) { /* context may be gone */ }
      }
    };
  }

  window.Quicksilver = { mount: mount, project: project, radius: radius, camera: camera, version: '1.0.0' };
})();
