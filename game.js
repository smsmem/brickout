// RIOT v0.1 — Riot Control side, Riot Clock (60 s) mode.
// Ragency core: RTP dial + result drawn at round start + reversion levers every 1/10 of the round
// + idle force + final true-up. All corrections are disguised as riot events.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* ============================== CONFIG ============================== */
const CFG = {
  round: 60,
  // Paytable (multiplier, probability). EV = 0.852 (RTP dial R = 0.85, low volatility).
  table: [[0, .10], [.3, .12], [.5, .18], [.7, .18], [.9, .14], [1.2, .12], [1.5, .08], [2, .05], [3, .02], [5, .01]],
  checkpoints: 10,            // reversion checks every 1/10 of the round
  corridorFrac: .25,          // corridor half-width as fraction of drawn result (min .08)
  idleAfter: 2.0,             // seconds without spraying before the idle force kicks in
  crowd: { regular: 12, heavy: 6, shield: 6, thrower: 5, runner: 5 },
  plaza: { x: 8, zFront: 6, zBack: -34, exit: -40 },
  truckZ: 15,
  unlocks: { 10: ['jet'], 25: ['jet', 'fan'], 50: ['jet', 'fan', 'pulse'], 100: ['jet', 'fan', 'pulse'] },
  demoCoins: 1000,
};
const TYPES = {
  regular: { hp: 1.0, mass: 1.0, speed: 1.0, disperse: .55 },
  heavy:   { hp: 2.5, mass: 2.2, speed: .8,  disperse: .6, chain: 1.6 },
  shield:  { hp: 1.5, mass: 1.3, speed: .85, disperse: .5, block: .8 },
  thrower: { hp: .9,  mass: .9,  speed: 1.0, disperse: .55 },
  runner:  { hp: .8,  mass: .85, speed: 1.8, disperse: .3 },
};
const NOZZLES = {
  jet:   { name: 'JET',   width: .9, force: 1.0,  drain: .22, reach: 34, spread: .25 },
  fan:   { name: 'FAN',   width: 3.2, force: .45, drain: .17, reach: 22, spread: 1.4 },
  pulse: { name: 'PULSE', width: 2.2, force: 3.2, drain: 0,   reach: 30, spread: .6, cost: .38 },
};

/* ============================== UTIL ============================== */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = n => Math.round(n).toLocaleString('en-US');
const store = {
  get(k, d) { try { const v = localStorage.getItem('riot.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('riot.' + k, JSON.stringify(v)); } catch { } },
};

/* game-time scheduler (so levers stay in sync with the round clock) */
const LATER = [];
let GAMETIME = 0;
function after(sec, fn) { LATER.push({ at: GAMETIME + sec, fn }); }
function runLater() { for (let i = LATER.length - 1; i >= 0; i--) if (LATER[i].at <= GAMETIME) { const f = LATER[i].fn; LATER.splice(i, 1); f(); } }

/* ============================== RENDERER / SCENE ============================== */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const DUSK = new THREE.Color(0x3a3350);
scene.background = DUSK;
scene.fog = new THREE.Fog(0x4a3f5c, 45, 120);
const camera = new THREE.PerspectiveCamera(60, 1, .1, 200);
const CAM_POS = new THREE.Vector3(0, 13.5, 23.5), CAM_LOOK = new THREE.Vector3(0, 0, -9);
camera.position.copy(CAM_POS); camera.lookAt(CAM_LOOK);

scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x3a2a22, 1.6));
const sun = new THREE.DirectionalLight(0xffb07a, 2.2); sun.position.set(-20, 18, 10); scene.add(sun);
const rim = new THREE.DirectionalLight(0x7fb4ff, .8); rim.position.set(15, 10, -30); scene.add(rim);

let BASE_FOV = 60;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  const aspect = w / h; camera.aspect = aspect;
  // keep ~40° horizontal view on phones, cap vertical fov
  const hf = 36 * Math.PI / 180;
  BASE_FOV = clamp(2 * Math.atan(Math.tan(hf / 2) / aspect) * 180 / Math.PI, 42, 78); camera.fov = BASE_FOV;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ============================== PROCEDURAL TEXTURES ============================== */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const asphaltTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3b3a40'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(20,20,24,.6)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rand(-40, 40); y += rand(-40, 40); g.lineTo(x, y); } g.stroke(); }
}, [6, 10]);
const facadeTex = (hue) => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = `hsl(${hue},18%,24%)`; g.fillRect(0, 0, w, h);
  for (let y = 18; y < h - 20; y += 44) for (let x = 14; x < w - 20; x += 46) {
    const lit = Math.random() < .35;
    g.fillStyle = lit ? `hsl(${38 + rand(-8, 8)},90%,${60 + rand(-10, 10)}%)` : `hsl(${hue},20%,12%)`;
    g.fillRect(x, y, 30, 28); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 25, 30, 3);
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, w, 6);
});
const blobTex = canvasTex(64, 64, (g, w, h) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const softTex = canvasTex(64, 64, (g, w, h) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
});
softTex.colorSpace = THREE.NoColorSpace;

/* ============================== ENVIRONMENT ============================== */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 110), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.z = -15; scene.add(ground);
// sidewalks
for (const s of [-1, 1]) {
  const sw = new THREE.Mesh(new THREE.BoxGeometry(4, .25, 110), new THREE.MeshStandardMaterial({ color: 0x6d6a70, roughness: 1 }));
  sw.position.set(s * 11, .12, -15); scene.add(sw);
}
// painted lines
const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c35a, transparent: true, opacity: .55 });
for (let z = 8; z > -40; z -= 6) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.25, 3), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(0, .02, z); scene.add(l); }
const stop = new THREE.Mesh(new THREE.PlaneGeometry(16, .5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35 }));
stop.rotation.x = -Math.PI / 2; stop.position.set(0, .02, CFG.plaza.zFront + 1.5); scene.add(stop);
// ---------------- City: detailed procedural facades + 3D street furniture ----------------
// Facade tile = 4 bays x 8 floors = 12 m x 24 m (bay 3 m, floor 3 m). Lit windows go in an emissive map.
const ALLEYS = [-10, -24];
const FLOOR = 3, BAY = 3;
function makeFacade(kind, seed) {
  const W = 1024, H = 2048, px = W / 12; // px per metre
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const base = kind === 'brick' ? [pick([14, 18, 22]), 38, 30] : kind === 'brown' ? [24, 28, 24] : [36, 8, 44];
  // wall
  if (kind === 'concrete') {
    g.fillStyle = `hsl(${base[0]},${base[1]}%,${base[2]}%)`; g.fillRect(0, 0, W, H);
    for (let f = 0; f < 8; f++) { const y = f * FLOOR * px; g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + FLOOR * px - 10, W, 10); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y, W, 6); }
    for (let x = 0; x < W; x += BAY * px) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 6, H); }
  } else {
    g.fillStyle = '#4a4440'; g.fillRect(0, 0, W, H); // mortar
    const bw = .25 * px, bh = .085 * px;
    for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
      const l = base[2] + rand(-5, 5), s = base[1] + rand(-6, 6), hh = base[0] + rand(-3, 3);
      g.fillStyle = `hsl(${hh},${s}%,${l}%)`; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  // soot / water streaks
  for (let i = 0; i < 26; i++) { const x = rand(0, W), y = rand(0, H * .9), w = rand(8, 40), grd = g.createLinearGradient(0, y, 0, y + rand(200, 600)); grd.addColorStop(0, 'rgba(10,8,8,.22)'); grd.addColorStop(1, 'rgba(10,8,8,0)'); g.fillStyle = grd; g.fillRect(x, y, w, 600); }
  // windows
  const winW = 1.35 * px, winH = 1.75 * px;
  for (let f = 0; f < 8; f++) for (let b = 0; b < 4; b++) {
    const cx = (b + .5) * BAY * px, top = H - (f * FLOOR + .9 + 1.75) * px; // canvas y grows down; floor 0 at bottom
    const x = cx - winW / 2, y = top;
    if (kind === 'concrete') { // ribbon windows
      g.fillStyle = '#1b2230'; g.fillRect(b * BAY * px + 14, y + 20, BAY * px - 28, winH - 30);
    } else {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 8, y - 16, winW + 16, 16); // lintel shadow
      g.fillStyle = `hsl(${base[0]},15%,${base[2] + 18}%)`; g.fillRect(x - 10, y - 18, winW + 20, 12); // lintel
      g.fillStyle = '#d9d4c8'; g.fillRect(x - 6, y + winH, winW + 12, 10); // sill
      g.fillStyle = '#2c2a2a'; g.fillRect(x - 4, y - 4, winW + 8, winH + 8); // frame
    }
    const lit = Math.random() < .32;
    const gx = kind === 'concrete' ? b * BAY * px + 20 : x, gw = kind === 'concrete' ? BAY * px - 40 : winW, gy = kind === 'concrete' ? y + 26 : y, gh = kind === 'concrete' ? winH - 42 : winH;
    if (lit) {
      const hue = rand(28, 46), grd = g.createLinearGradient(0, gy, 0, gy + gh); grd.addColorStop(0, `hsl(${hue},70%,62%)`); grd.addColorStop(1, `hsl(${hue - 8},65%,38%)`);
      g.fillStyle = grd; g.fillRect(gx, gy, gw, gh);
      ge.fillStyle = `hsl(${hue},80%,${rand(45, 60)}%)`; ge.fillRect(gx, gy, gw, gh);
      // curtains / blinds / silhouettes
      const k = Math.random();
      g.fillStyle = 'rgba(60,30,20,.55)'; ge.fillStyle = '#000';
      if (k < .35) { g.fillRect(gx, gy, gw * .22, gh); g.fillRect(gx + gw * .78, gy, gw * .22, gh); ge.fillRect(gx, gy, gw * .22, gh); ge.fillRect(gx + gw * .78, gy, gw * .22, gh); }
      else if (k < .65) { for (let yy = gy; yy < gy + gh * .6; yy += 7) { g.fillRect(gx, yy, gw, 3); ge.fillRect(gx, yy, gw, 3); } }
      else if (k < .75) { g.fillStyle = 'rgba(30,20,20,.7)'; g.beginPath(); g.ellipse(gx + gw * .6, gy + gh * .45, gw * .12, gh * .14, 0, 0, 7); g.fill(); g.fillRect(gx + gw * .45, gy + gh * .55, gw * .3, gh * .45); }
    } else {
      const grd = g.createLinearGradient(gx, gy, gx + gw, gy + gh); grd.addColorStop(0, '#2a3348'); grd.addColorStop(.5, '#141a26'); grd.addColorStop(1, '#232a3a');
      g.fillStyle = grd; g.fillRect(gx, gy, gw, gh);
      g.fillStyle = 'rgba(160,170,210,.08)'; g.fillRect(gx + gw * .1, gy + 6, gw * .25, gh - 12);
    }
    if (kind !== 'concrete') { g.fillStyle = '#2c2a2a'; g.fillRect(cx - 3, y, 6, winH); g.fillRect(x, y + winH * .5 - 3, winW, 6); } // mullions
  }
  // drainpipe
  if (kind !== 'concrete') { g.fillStyle = '#26292c'; g.fillRect(W - 22, 0, 10, H); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const te = new THREE.CanvasTexture(e); te.colorSpace = THREE.SRGBColorSpace; te.wrapS = te.wrapT = THREE.RepeatWrapping;
  return { map: t, emissive: te };
}
const FACADES = { brick: makeFacade('brick'), brown: makeFacade('brown'), concrete: makeFacade('concrete') };
const ironMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: .7, metalness: .5 });
const acMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: .8 });
const corniceMat = new THREE.MeshStandardMaterial({ color: 0x5a524c, roughness: .9 });
const IRON = [], AC = [];
// face: {x of face plane, dir (+1 faces +x), z0 (start), zDir, len, h}
function building(side, z1, z2, h, kind) {
  const d = z1 - z2, zc = (z1 + z2) / 2, w = 7, x = side * 16.5;
  const F = FACADES[kind];
  const map = F.map.clone(); map.needsUpdate = true; map.repeat.set(d / 12, h / 24);
  const em = F.emissive.clone(); em.needsUpdate = true; em.repeat.copy(map.repeat);
  map.offset.set(rand(0, 1), 0); em.offset.copy(map.offset);
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: .9, roughness: .95 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2, zc); scene.add(b);
  const faceX = x - side * w / 2;
  // cornice
  const cor = new THREE.Mesh(new THREE.BoxGeometry(.7, .5, d + .4), corniceMat); cor.position.set(faceX - side * .2, h - .3, zc); scene.add(cor);
  // shopfront band (ground floor)
  const st = shopTex(); st.wrapS = THREE.RepeatWrapping; st.repeat.set(Math.max(1, Math.round(d / 5)), 1);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(d, 3.6), new THREE.MeshStandardMaterial({ map: st, roughness: .9 }));
  band.position.set(faceX - side * .02, 1.8, zc); band.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(band);
  if (kind === 'concrete') return;
  // bays along the face; floors from 2 up (ground floor is shops)
  const floors = Math.floor(h / FLOOR);
  for (let bz = z2 + BAY / 2; bz < z1; bz += BAY) {
    for (let f = 1; f < floors; f++) if (Math.random() < .16) AC.push([faceX - side * .3, f * FLOOR + .55, bz]);
  }
  // fire escapes on some bay pairs
  for (let bz = z2 + BAY; bz < z1 - BAY; bz += BAY * 4) {
    if (Math.random() < .35) continue;
    for (let f = 2; f < floors; f++) {
      const y = f * FLOOR + .05;
      IRON.push([faceX - side * .55, y, bz, 1.1, .06, 2.8]);           // platform
      IRON.push([faceX - side * 1.08, y + .95, bz, .05, .05, 2.8]);     // top rail
      for (const dz of [-1.35, 0, 1.35]) IRON.push([faceX - side * 1.08, y + .48, bz + dz, .05, .95, .05]); // posts
      IRON.push([faceX - side * .55, y + 1.5, bz - .4, .5, .05, 2.2, .78]); // stair (tilted)
    }
  }
}
function shopTex() {
  return canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#2a2528'; g.fillRect(0, 0, w, h);
    const hue = pick([8, 28, 150, 200, 340, 45]);
    g.fillStyle = '#1b1719'; g.fillRect(0, 0, w, 50);
    g.fillStyle = `hsl(${hue},45%,34%)`; g.beginPath(); g.moveTo(16, 60); g.lineTo(w - 16, 60); g.lineTo(w - 40, 116); g.lineTo(40, 116); g.fill();
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? `hsl(${hue},45%,26%)` : 'rgba(235,230,220,.85)'; g.fillRect(40 + i * ((w - 80) / 12), 116, (w - 80) / 12, 10); }
    const shut = Math.random() < .55;
    if (shut) {
      g.fillStyle = '#8a8c90'; g.fillRect(48, 140, w - 96, h - 156);
      for (let y = 142; y < h - 16; y += 9) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(48, y, w - 96, 3); }
      g.fillStyle = 'rgba(120,60,40,.25)'; g.fillRect(48, h - 60, w - 96, 44); // rust at the base
      g.fillStyle = 'rgba(245,245,245,.5)'; for (let i = 0; i < 4; i++) g.fillRect(rand(60, w - 120), rand(170, 260), rand(18, 30), rand(22, 34)); // torn flyers (no text)
    } else {
      const grd = g.createLinearGradient(0, 140, 0, h); grd.addColorStop(0, 'hsl(42,70%,58%)'); grd.addColorStop(1, 'hsl(30,60%,32%)');
      g.fillStyle = grd; g.fillRect(48, 140, w - 96, h - 156);
      g.fillStyle = 'rgba(40,25,15,.55)'; for (let i = 0; i < 5; i++) g.fillRect(70 + i * 80, 170, 50, 8); for (let i = 0; i < 5; i++) g.fillRect(70 + i * 80, 230, 50, 8);
      g.fillStyle = '#2c2a2a'; g.fillRect(w / 2 - 4, 140, 8, h - 156);
    }
    g.fillStyle = '#6b6560'; g.fillRect(0, h - 16, w, 16); // stallriser
  });
}
// street layout (segments are multiples of the 3 m bay; gaps are the side-street alleys)
for (const s of [-1, 1]) {
  building(s, 24, -6, pick([18, 21, 24]), s < 0 ? 'brick' : 'brown');
  building(s, -12, -21, pick([15, 18]), 'concrete');
  building(s, -27, -63, pick([21, 24, 27]), s < 0 ? 'brown' : 'brick');
}
{ // back building, facing +z
  const F = FACADES.concrete, map = F.map.clone(); map.needsUpdate = true; map.repeat.set(40 / 12, 18 / 24);
  const em = F.emissive.clone(); em.needsUpdate = true; em.repeat.copy(map.repeat);
  const b = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 6), new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: .9, roughness: .95 }));
  b.position.set(0, 9, -52); scene.add(b);
}
// instanced AC units and iron
{
  const acG = new THREE.BoxGeometry(.5, .42, .72), im = new THREE.InstancedMesh(acG, acMat, AC.length), mm = new THREE.Matrix4();
  AC.forEach((p, i) => { mm.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, mm); }); scene.add(im);
  const ig = new THREE.BoxGeometry(1, 1, 1), ii = new THREE.InstancedMesh(ig, ironMat, IRON.length), q = new THREE.Quaternion(), e = new THREE.Euler();
  IRON.forEach((p, i) => { e.set(p[6] || 0, 0, 0); q.setFromEuler(e); mm.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(p[3], p[4], p[5])); ii.setMatrixAt(i, mm); }); scene.add(ii);
}
// water towers on a few roofs
function waterTower(x, y, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3f2c, roughness: .95 });
  const t = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 2.6, 16), wood); t.position.set(x, y + 3.1, z); scene.add(t);
  const r = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.1, 16), ironMat); r.position.set(x, y + 4.95, z); scene.add(r);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.8, .12), ironMat); l.position.set(x + dx * .9, y + .9, z + dz * .9); scene.add(l); }
}
waterTower(-17, 24, 6); waterTower(17.5, 27, -40); waterTower(-16, 27, -48);
// street lamps with light pools
const lampHead = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 2.2 });
const poolTex = canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,170,90,.32)'); r.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
for (const s of [-1, 1]) for (let z = 6; z > -40; z -= 11) {
  if (ALLEYS.some(a => Math.abs(z - a) < 2.5)) continue;
  const x = s * 9.6;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 5.2, 8), ironMat); pole.position.set(x, 2.6, z); scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, .08, .08), ironMat); arm.position.set(x - s * .55, 5.1, z); scene.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .28), lampHead); head.position.set(x - s * 1.1, 5.02, z); scene.add(head);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x - s * 1.4, .04, z); scene.add(pool);
}
// sky: vertical dusk gradient + distant skyline silhouette
{
  const sky = canvasTex(8, 512, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#1d1a36'); r.addColorStop(.55, '#4a3a63'); r.addColorStop(.8, '#b0685a'); r.addColorStop(1, '#e39a62'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(dome);
  const sl = canvasTex(2048, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let x = 0; x < w;) { const bw = rand(40, 140), bh = rand(120, 460); g.fillStyle = `hsl(250,${rand(12, 22)}%,${rand(14, 22)}%)`; g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 10; yy < h - 8; yy += 12) for (let xx = x + 6; xx < x + bw - 6; xx += 10) if (Math.random() < .12) { g.fillStyle = `hsla(${rand(30, 45)},80%,65%,.8)`; g.fillRect(xx, yy, 4, 5); }
      if (Math.random() < .2) { g.fillStyle = g.fillStyle; g.fillRect(x + bw / 2 - 2, h - bh - 40, 4, 40); }
      x += bw + rand(-10, 6); }
  });
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(260, 65), new THREE.MeshBasicMaterial({ map: sl, transparent: true, fog: false, depthWrite: false }));
  skyline.position.set(0, 20, -110); scene.add(skyline);
}

/* ============================== PARTICLE POOLS ============================== */
class Pool {
  constructor(n, geo, mat) { this.n = n; this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.p = []; for (let i = 0; i < n; i++) this.p.push({ on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, s: 1 }); this.i = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sc = new THREE.Vector3(); scene.add(this.mesh); this.hideAll(); }
  hideAll() { for (let i = 0; i < this.n; i++) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); } this.mesh.instanceMatrix.needsUpdate = true; }
  spawn(pos, vel, life, s) { const p = this.p[this.i]; this.i = (this.i + 1) % this.n; p.on = true; p.pos.copy(pos); p.vel.copy(vel); p.life = 0; p.max = life; p.s = s; return p; }
}
// water droplets
const water = new Pool(900, new THREE.SphereGeometry(.2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd6f4ff, transparent: true, opacity: .78, depthWrite: false }));
// splash / mist sprites
const mist = new Pool(260, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, color: 0xe8f8ff, transparent: true, opacity: .55, depthWrite: false }));
// fire
const fire = new Pool(160, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
// gas
const gas = new Pool(220, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, color: 0xd9e6c2, transparent: true, opacity: .42, depthWrite: false }));
const GRAV = new THREE.Vector3(0, -9.8, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function updatePool(pool, dt, kind) {
  const camQ = camera.quaternion;
  for (let i = 0; i < pool.n; i++) {
    const p = pool.p[i];
    if (!p.on) continue;
    p.life += dt;
    if (p.life >= p.max) { p.on = false; pool.m.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, pool.m); continue; }
    const t = p.life / p.max;
    let s = p.s;
    if (kind === 'water') { p.vel.addScaledVector(GRAV, dt); p.pos.addScaledVector(p.vel, dt); if (p.pos.y < .05) { p.on = false; if (Math.random() < .25) spawnSplash(p.pos, .6); pool.m.makeScale(0, 0, 0); pool.mesh.setMatrixAt(i, pool.m); continue; } s *= 1 - t * .3; pool.m.compose(p.pos, _q.identity(), pool.sc.set(s, s, s)); }
    else if (kind === 'mist') { p.vel.multiplyScalar(1 - 2.5 * dt); p.vel.y -= 2 * dt; p.pos.addScaledVector(p.vel, dt); s *= .6 + t * 1.2; pool.m.compose(p.pos, camQ, pool.sc.set(s, s, s)); }
    else if (kind === 'fire') { p.pos.addScaledVector(p.vel, dt); s *= (1 - t) * 1.1; pool.m.compose(p.pos, camQ, pool.sc.set(s, s * 1.3, s)); }
    else if (kind === 'gas') { p.vel.multiplyScalar(1 - .8 * dt); p.pos.addScaledVector(p.vel, dt); s *= .5 + Math.min(1, t * 3) * .9 + t * .6; pool.m.compose(p.pos, camQ, pool.sc.set(s, s, s)); }
    pool.mesh.setMatrixAt(i, pool.m);
  }
  pool.mesh.instanceMatrix.needsUpdate = true;
}
function spawnSplash(pos, n = 1) {
  for (let k = 0; k < 2 * n; k++) mist.spawn(_v.copy(pos).setY(Math.max(.3, pos.y)), _v2.set(rand(-2, 2), rand(1, 3.5), rand(-2, 2)), rand(.35, .7), rand(.6, 1.2));
}

/* ============================== LOADING ============================== */
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const ART = {};
const CROWD_FILES = [];
for (const t of Object.keys(CFG.crowd)) for (let i = 1; i <= 3; i++) CROWD_FILES.push([t, `crowd/rioter_${t}_0${i}`]);
const PROP_FILES = ['vehicles/riot_water_cannon_truck', 'chars/officer_grenadier', 'chars/officer_turret_operator', 'props/env_storefront_corner', 'props/env_storefront_shutter', 'props/env_storefront_window_awning', 'props/prop_bottle', 'props/prop_burning_barrel', 'props/prop_crowd_barricade', 'props/prop_dumpster', 'props/prop_egg', 'props/prop_half_brick', 'props/prop_teargas_canister', 'props/prop_traffic_cones', 'props/prop_trashcan_lid', 'props/prop_wrecked_sedan'];
// Hosted builds (GitHub Pages, Rollerz) load the .glb files directly. The claude.ai preview
// can't serve .glb, so it loads the same bytes from base64 .txt copies (window.RIOT_ART.b64).
async function loadGLB(f) {
  if (window.RIOT_ART && window.RIOT_ART.flat) return loader.loadAsync(f.split('/').pop() + '.glb'); // all files in one folder
  if (window.RIOT_ART && window.RIOT_ART.b64) {
    const txt = await (await fetch(`art64/${f}.txt`)).text();
    const bin = Uint8Array.from(atob(txt), c => c.charCodeAt(0));
    return loader.parseAsync(bin.buffer, '');
  }
  return loader.loadAsync(`art/${f}.glb`);
}
async function loadAll() {
  const all = [...CROWD_FILES.map(f => f[1]), ...PROP_FILES]; let done = 0;
  await Promise.all(all.map(async f => {
    const g = await loadGLB(f);
    ART[f] = g; done++;
    $('loadbar').style.width = (done / all.length * 100) + '%';
  }));
}
// normalize a static prop: scale so a chosen axis has `size`, sit on ground
function prop(name, size, axis = 'max') {
  const o = ART[name].scene.clone(true);
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
  const ref = axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis];
  o.scale.setScalar(size / ref);
  const g = new THREE.Group(); g.add(o);
  const b2 = new THREE.Box3().setFromObject(o); const c = b2.getCenter(new THREE.Vector3());
  o.position.set(-c.x, -b2.min.y, -c.z);
  return g;
}

/* ============================== WORLD DRESSING ============================== */
const obstacles = []; // {x,z,r}
const barrels = [];
let truck, cannon, cannonYaw, cannonPitch, nozzleTip, gasOfficer, gasMixer, gasActions;
function dressWorld() {
  // storefront modules along the sidewalks, facing the plaza
  // one Meshy kiosk per side as street dressing (the facade band carries the shopfront look)
  const k1 = prop('props/env_storefront_shutter', 2.6, 'x'); k1.position.set(-10.4, .25, -31); k1.rotation.y = Math.PI / 2; scene.add(k1);
  const k2 = prop('props/env_storefront_window_awning', 2.6, 'x'); k2.position.set(10.4, .25, -33); k2.rotation.y = -Math.PI / 2; scene.add(k2);
  // truck — model front is -x; rotate so front faces -z (toward the crowd)
  truck = prop('vehicles/riot_water_cannon_truck', 8.5, 'x');
  truck.rotation.y = Math.PI / 2; truck.position.set(0, 0, CFG.truckZ); scene.add(truck);
  const tb = new THREE.Box3().setFromObject(truck);
  // water tank drum on the back (code addition per concept doc)
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, 1.9, 18), new THREE.MeshStandardMaterial({ color: 0x28405e, roughness: .6, metalness: .3 }));
  tank.rotation.z = Math.PI / 2; tank.position.set(0, tb.max.y + .1, CFG.truckZ + 3.4); scene.add(tank);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.64, .64, .22, 18), new THREE.MeshStandardMaterial({ color: 0xf0b400 }));
  band.rotation.z = Math.PI / 2; band.position.copy(tank.position); scene.add(band);
  // water cannon: stubby brass barrel on a turret ring (replaces the gun-like nozzle read)
  cannonYaw = new THREE.Group(); cannonYaw.position.set(0, tb.max.y + .05, CFG.truckZ + 1.1); scene.add(cannonYaw);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, .7, 22), new THREE.MeshStandardMaterial({ color: 0x1d2a3c, roughness: .5, metalness: .4 }));
  ring.position.y = .3; cannonYaw.add(ring);
  cannonPitch = new THREE.Group(); cannonPitch.position.y = .85; cannonYaw.add(cannonPitch);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9923a, roughness: .35, metalness: .8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, 1.1, 18), brass); body.rotation.x = Math.PI / 2; body.position.z = -.45; cannonPitch.add(body);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(.62, .42, .4, 18), brass); mouth.rotation.x = Math.PI / 2; mouth.position.z = -1.15; cannonPitch.add(mouth);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(.55, .13, 8, 18, Math.PI), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 }));
  hose.position.set(0, -.1, .35); hose.rotation.y = Math.PI / 2; cannonPitch.add(hose);
  nozzleTip = new THREE.Object3D(); nozzleTip.position.z = -1.4; cannonPitch.add(nozzleTip);
  obstacles.push({ x: 0, z: CFG.truckZ, r: 3.2 });

  // police line barriers in front of the truck
  for (const x of [-6, -3, 3, 6]) { const b = prop('props/prop_crowd_barricade', 2.6, 'x'); b.position.set(x, 0, CFG.plaza.zFront + 3.2); scene.add(b); }
  // gas officer beside the truck
  const og = ART['chars/officer_grenadier'];
  gasOfficer = SkeletonUtils.clone(og.scene); gasOfficer.position.set(4.2, 0, CFG.truckZ - 3); gasOfficer.rotation.y = Math.PI; scene.add(gasOfficer);
  gasMixer = new THREE.AnimationMixer(gasOfficer); gasActions = {};
  for (const c of og.animations) gasActions[c.name] = gasMixer.clipAction(c);
  gasActions.Walking.play(); gasActions.Walking.timeScale = 0; gasActions.Walking.time = .1;
  addBlob(gasOfficer, 1);

  // debris & props in the plaza
  const P = [
    ['props/prop_burning_barrel', 1.1, 'y', -5.2, -8, 0], ['props/prop_burning_barrel', 1.1, 'y', 5.8, -19, 0], ['props/prop_burning_barrel', 1.1, 'y', -2.5, -28, 0],
    ['props/prop_dumpster', 2.3, 'x', 6.9, -5, .3], ['props/prop_traffic_cones', 1.6, 'x', -6.8, 1, .4], ['props/prop_traffic_cones', 1.6, 'x', 3.2, -30, -.6],
    ['props/prop_crowd_barricade', 2.5, 'x', -3.6, -14, .9], ['props/prop_crowd_barricade', 2.5, 'x', 4.8, -26, -.4],
  ];
  for (const [f, sz, ax, x, z, r] of P) {
    const o = prop(f, sz, ax); o.position.set(x, 0, z); o.rotation.y = r; scene.add(o);
    if (f.includes('barrel')) { barrels.push(o.position.clone()); obstacles.push({ x, z, r: .9 }); }
    if (f.includes('dumpster')) obstacles.push({ x, z, r: 1.4 });
  }
  // sedan came out upright — flip it on its roof
  const car = prop('props/prop_wrecked_sedan', 4.6, 'x');
  car.children[0].rotation.z = Math.PI; car.children[0].position.y *= -1;
  const cb = new THREE.Box3().setFromObject(car); car.children[0].position.y -= cb.min.y;
  car.position.set(-5.6, 0, -20); car.rotation.y = .5; scene.add(car); obstacles.push({ x: -5.6, z: -20, r: 2.2 });
}

/* ============================== AGENTS (CROWD) ============================== */
const blobGeo = new THREE.PlaneGeometry(1, 1);
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
function addBlob(obj, s) { const b = new THREE.Mesh(blobGeo, blobMat); b.rotation.x = -Math.PI / 2; b.position.y = .03; b.scale.setScalar(s * 1.1); scene.add(b); obj.userData.blob = b; return b; }

const agents = [];
let lidProto;
function findBone(root, key) { let r = null; root.traverse(o => { if (!r && o.isBone && o.name.includes(key)) r = o; }); return r; }
/* ---- per-person look: recolour clothes, shift skin tone, add accessories (no new meshes) ---- */
const VARIETY_VERT = '';
function varietyMaterial(src, look) {
  const m = src.clone();
  m.userData.look = look;
  m.onBeforeCompile = sh => {
    sh.uniforms.uHue = { value: look.hue }; sh.uniforms.uSat = { value: look.sat }; sh.uniforms.uVal = { value: look.val }; sh.uniforms.uSkin = { value: look.skin };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uHue; uniform float uSat; uniform float uVal; uniform float uSkin;
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 srgb = pow(max(diffuseColor.rgb, vec3(0.)), vec3(1. / 2.2));
  vec3 hsv = rgb2hsv(srgb);
  float skin = smoothstep(0.125, 0.085, hsv.x) * (1. - smoothstep(0.985, 0.995, hsv.x) * 0.) * smoothstep(0.14, 0.24, hsv.y) * smoothstep(0.72, 0.6, hsv.y) * smoothstep(0.14, 0.24, hsv.z);
  vec3 cloth = hsv2rgb(vec3(fract(hsv.x + uHue), clamp(hsv.y * uSat, 0., 1.), clamp(hsv.z * uVal, 0., 1.)));
  vec3 sk = hsv2rgb(vec3(hsv.x, clamp(hsv.y * mix(1.15, .9, uSkin), 0., 1.), clamp(hsv.z * uSkin, 0., 1.)));
  diffuseColor.rgb = pow(mix(cloth, sk, skin), vec3(2.2)); }`);
  };
  m.customProgramCacheKey = () => 'riot-variety-v2';
  return m;
}
const SKIN_TONES = [.42, .52, .64, .76, .88, 1.0, 1.12];
function randomLook() { const keep = Math.random() < .35; return { hue: keep ? 0 : rand(0, 1), sat: keep ? rand(.85, 1.1) : rand(.55, 1.2), val: rand(.72, 1.18), skin: pick(SKIN_TONES) }; }
const ACC_COLORS = [0x1c1c1c, 0xb22222, 0x1f4e8c, 0x2e7d32, 0xf2c14e, 0x6d4c41, 0xeeeeee, 0x7b1fa2, 0xff7043];
const accGeo = {
  beanie: new THREE.SphereGeometry(.105, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55),
  capTop: new THREE.SphereGeometry(.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5),
  brim: new THREE.CylinderGeometry(.09, .09, .012, 12, 1, false, 0, Math.PI),
  pack: new THREE.BoxGeometry(.3, .38, .14),
  scarf: new THREE.TorusGeometry(.085, .035, 6, 14),
};
function accessorize(a) {
  const head = findBone(a.mesh, 'Head'), spine = findBone(a.mesh, 'Spine2') || findBone(a.mesh, 'Spine1');
  a.mesh.updateMatrixWorld(true);
  const col = () => new THREE.MeshStandardMaterial({ color: pick(ACC_COLORS), roughness: .85 });
  const r = Math.random();
  if (head) {
    const ws = head.getWorldScale(new THREE.Vector3()).x, k = 1 / ws;
    if (r < .3) { const b = new THREE.Mesh(accGeo.beanie, col()); b.scale.setScalar(k); b.position.set(0, .1 * k, .005 * k); head.add(b); }
    else if (r < .52) { const m = col(); const c = new THREE.Mesh(accGeo.capTop, m); c.scale.setScalar(k); c.position.set(0, .1 * k, 0); head.add(c); const br = new THREE.Mesh(accGeo.brim, m); br.scale.setScalar(k); br.position.set(0, .105 * k, .07 * k); br.rotation.y = -Math.PI / 2; head.add(br); }
    if (Math.random() < .3) { const sc = new THREE.Mesh(accGeo.scarf, col()); sc.scale.setScalar(k); sc.rotation.x = Math.PI / 2; sc.position.set(0, -.02 * k, .01 * k); head.add(sc); }
  }
  if (spine && Math.random() < .35 && a.type !== 'shield') {
    const ws = spine.getWorldScale(new THREE.Vector3()).x, k = 1 / ws;
    const p = new THREE.Mesh(accGeo.pack, col()); p.scale.setScalar(k); p.position.set(0, .05 * k, -.17 * k); spine.add(p);
  }
}
function makeAgent(type, variant) {
  const src = ART[CROWD_FILES.find(f => f[0] === type && f[1].endsWith('0' + variant))[1]];
  const mesh = SkeletonUtils.clone(src.scene);
  const sc = type === 'heavy' ? rand(1.04, 1.12) : rand(.94, 1.06);
  mesh.scale.setScalar(sc);
  const look = randomLook();
  mesh.traverse(o => { if (o.isMesh && o.material && o.material.map) o.material = varietyMaterial(o.material, look); });
  scene.add(mesh);
  const mixer = new THREE.AnimationMixer(mesh);
  const acts = {}; for (const c of src.animations) acts[c.name] = mixer.clipAction(c);
  const a = { type, T: TYPES[type], mesh, mixer, acts, cur: null, state: 'advance', pos: new THREE.Vector3(), push: new THREE.Vector3(), yaw: 0, soak: 0, knocks: 0, timer: 0, speed: TYPES[type].speed * rand(.85, 1.15), target: new THREE.Vector3(), active: false, throwCd: rand(3, 8), lane: 0, hitFlash: 0 };
  a.blob = addBlob(mesh, type === 'heavy' ? 1.25 : 1);
  if (type === 'shield') {
    const hand = findBone(mesh, 'LeftHand') || findBone(mesh, 'LeftForeArm');
    if (hand) {
      const lid = lidProto.clone(true); mesh.updateMatrixWorld(true);
      const ws = hand.getWorldScale(new THREE.Vector3());
      lid.scale.setScalar(1 / ws.x); lid.rotation.set(Math.PI / 2, 0, 0); lid.position.set(0, .12 / ws.x, .12 / ws.x);
      hand.add(lid); a.lid = lid;
    }
  }
  a.hand = findBone(mesh, 'RightHand');
  accessorize(a);
  agents.push(a); return a;
}
function play(a, name, { loop = true, fade = .2, ts = 1, clampEnd = false } = {}) {
  const act = a.acts[name]; if (!act) return;
  if (a.cur === act && loop) { act.timeScale = ts; return; }
  act.reset(); act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); act.clampWhenFinished = clampEnd; act.timeScale = ts; act.enabled = true; act.setEffectiveWeight(1);
  if (a.cur && a.cur !== act) act.crossFadeFrom(a.cur, fade, false); act.play(); a.cur = act;
}
function spawnAgent(a, where) {
  a.active = true; a.counted = false; a.state = 'advance'; a.soak = 0; a.knocks = 0; a.push.set(0, 0, 0); a.timer = 0; a.throwCd = rand(3, 8);
  a.mesh.visible = true; a.blob.visible = true;
  if (where === 'alley') { const s = Math.random() < .5 ? -1 : 1; a.pos.set(s * 11, 0, pick(ALLEYS) + rand(-1.5, 1.5)); }
  else a.pos.set(rand(-7.5, 7.5), 0, rand(-32, 2));
  a.target.set(rand(-6.5, 6.5), 0, rand(CFG.plaza.zFront - 4, CFG.plaza.zFront));
  play(a, a.type === 'runner' ? 'Running' : 'Walking', { ts: a.speed * rand(.9, 1.1) });
  a.cur.time = rand(0, 1);
}
function laneOf(x) { return x < -2.7 ? 0 : x > 2.7 ? 2 : 1; }

/* ============================== GAME STATE ============================== */
const G = {
  phase: 'loading', amt: store.get('amt', 25), bal: store.get('bal', CFG.demoCoins), nozzle: 'jet', unlocked: ['jet'],
  t: 0, M: 0, T: 0, kd: 0, bestChain: 0, dispersed: 0, spawned: 0, lastSpray: -99, pressure: 1, surge: 0, sag: 0, domino: 1,
  aim: new THREE.Vector3(0, 0, -8), aimTarget: new THREE.Vector3(0, 0, -8), spraying: false, charge: 0, cpDone: 0, rivals: [], secClear: [false, false, false], demo: false, gasCd: 0, idleCd: 0, finalDone: false,
};

/* ------------------------------ Ragency engine ------------------------------ */
function drawResult() { let r = Math.random(), acc = 0; for (const [m, p] of CFG.table) { acc += p; if (r < acc) return m; } return CFG.table[CFG.table.length - 1][0]; }
const pathAt = (T, u) => T * Math.pow(clamp(u, 0, 1), .92);
function corridor(u) { return Math.max(.08, G.T * CFG.corridorFrac) * (1 - .6 * u); }
function gainMult() { const u = G.t / CFG.round; const e = pathAt(G.T, u + .05) - G.M; const c = corridor(u); return clamp(1 + 2.2 * e / c, .12, 3.2); }
function lossMult() { const u = G.t / CFG.round; const e = G.M - pathAt(G.T, u); const c = corridor(u); return clamp(1 + 2.2 * e / c, .15, 3); }
// every multiplier change goes through here
function award(base, label, kind = 'pos', worldPos) {
  if (G.phase !== 'play') return;
  let d = base * (base >= 0 ? gainMult() : lossMult());
  if (G.M + d < 0) d = -G.M;
  if (Math.abs(d) < .005) return;
  G.M += d;
  bumpMult(d < 0);
  toast(`${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} ${label}`, d > 0 ? kind : 'neg');
}
function checkpoint() {
  const u = G.t / CFG.round, E = pathAt(G.T, u), err = G.M - E, c = corridor(u);
  if (err > c) { // player running hot → counter levers
    const lever = pick(['reinforce', 'volley', 'sag', 'shields']);
    if (lever === 'reinforce') reinforce(5, 'REINFORCEMENTS FROM THE ALLEY');
    if (lever === 'volley') { G.volley = 3; banner('INCOMING!'); }
    if (lever === 'sag') { G.sag = 4; toast('PRESSURE DROP', 'info'); }
    if (lever === 'shields') reinforce(3, 'SHIELD WALL', 'shield');
    if (err > 2 * c) award(-(err - c) * .5 / lossMult(), 'CROWD SURGES');
  } else if (err < -c) { // player running cold → help levers
    const lever = pick(['gas', 'surge', 'domino']);
    if (lever === 'gas') throwGas(true);
    if (lever === 'surge') { G.surge = 5; banner('PRESSURE SURGE'); }
    if (lever === 'domino') { G.domino = 1.8; G.dominoT = 6; toast('CROWD IS WOBBLY', 'info'); }
    if (err < -2 * c) award((-err - c) * .5 / gainMult(), 'LINE HOLDS');
  }
}
function idleForce(dt) { // score still moves toward the drawn path when nobody is spraying
  G.idleCd -= dt; if (G.idleCd > 0) return; G.idleCd = 1.6;
  const u = G.t / CFG.round, diff = pathAt(G.T, u) - G.M;
  if (Math.abs(diff) < .02) return;
  if (diff > 0) award(diff * .3 / gainMult(), 'GAS COVER'); else award(diff * .3 / lossMult(), 'CROWD PUSHES');
  if (G.gasCd <= 0) throwGas(false);
}
function finalTrueUp() {
  const d = G.T - G.M;
  if (Math.abs(d) >= .005) { toast(`${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} ${d > 0 ? 'SECTOR BONUS' : 'LOOSE ENDS'}`, d > 0 ? 'pos' : 'neg'); }
  G.M = G.T; bumpMult(d < 0);
}

/* ------------------------------ Levers in the world ------------------------------ */
function reinforce(n, label, type) {
  const pool = agents.filter(a => !a.active && (!type || a.type === type));
  for (let i = 0; i < n && i < pool.length; i++) { spawnAgent(pool[i], 'alley'); G.spawned++; }
  if (label) banner(label);
}
let gasCan = null;
function throwGas(bigger) {
  if (G.gasCd > 0 && !bigger) return; G.gasCd = bigger ? 5 : 8;
  // target densest cluster
  let best = null, bc = -1;
  for (const a of agents) { if (!a.active || a.state === 'flee') continue; let c = 0; for (const b of agents) if (b.active && b.pos.distanceToSquared(a.pos) < 9) c++; if (c > bc) { bc = c; best = a; } }
  if (!best) return;
  const act = gasActions.Over_Shoulder_Throw; gasActions.Walking.stop(); act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = false; act.timeScale = 2.2; act.play();
  after(2.1, () => { act.stop(); gasActions.Walking.play(); });
  after(.8, () => {
    const from = gasOfficer.position.clone().setY(2.2), to = best.pos.clone();
    const tf = 1.1, vel = to.clone().sub(from).divideScalar(tf); vel.y += .5 * 9.8 * tf;
    gasCan.visible = true; gasCan.position.copy(from); G.canFlight = { vel, t: 0, tf, to, big: bigger };
  });
  toast('GAS OUT!', 'info');
}
function gasBurst(at, big) {
  for (let k = 0; k < (big ? 60 : 40); k++) gas.spawn(_v.set(at.x + rand(-.8, .8), rand(.3, 1.2), at.z + rand(-.8, .8)), _v2.set(rand(-2.5, 2.5), rand(.1, .6), rand(-2.5, 2.5)), rand(3.5, 5.5), rand(1.6, 2.6));
  G.gasZone = { x: at.x, z: at.z, r: big ? 4.2 : 3.4, t: 4.5 };
}
const thrown = [];
function throwProjectile(a) {
  const f = pick(['props/prop_bottle', 'props/prop_egg', 'props/prop_half_brick']);
  const o = prop(f, f.includes('bottle') ? .45 : .32); scene.add(o);
  const from = a.pos.clone().setY(2.0);
  const to = new THREE.Vector3(rand(-1.6, 1.6), rand(1.6, 3.2), CFG.truckZ - 2.8 + rand(-.8, .8));
  const tf = clamp(from.distanceTo(to) / 14, .7, 1.6), vel = to.clone().sub(from).divideScalar(tf); vel.y += .5 * 9.8 * tf;
  o.position.copy(from); thrown.push({ o, vel, t: 0, tf, spin: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)) });
}

/* ============================== INPUT ============================== */
const pad = $('pad');
let pointerId = null;
function padToAim(e) {
  const r = pad.getBoundingClientRect();
  const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
  const noz = NOZZLES[G.nozzle];
  const reach = lerp(noz.reach, 7, Math.pow(ny, .9)); // top of pad = far
  const yaw = (nx - .5) * 1.05;                        // ±30°
  G.aimTarget.set(Math.sin(yaw) * reach, 0, CFG.truckZ + 1.1 - Math.cos(yaw) * reach);
  G.aimTarget.x = clamp(G.aimTarget.x, -9, 9);
}
pad.addEventListener('pointerdown', e => {
  if (G.phase !== 'play') return; pointerId = e.pointerId; pad.setPointerCapture(e.pointerId); padToAim(e);
  G.spraying = true; G.charge = 0; $('padhint').style.opacity = 0;
});
pad.addEventListener('pointermove', e => { if (e.pointerId === pointerId) padToAim(e); });
const endPtr = e => { if (e.pointerId !== pointerId) return; pointerId = null; if (G.nozzle === 'pulse' && G.spraying) firePulse(); G.spraying = false; };
pad.addEventListener('pointerup', endPtr); pad.addEventListener('pointercancel', endPtr);

/* ============================== WATER / HITS ============================== */
const reticle = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 28), new THREE.MeshBasicMaterial({ color: 0x2fd3c8, transparent: true, opacity: .75, depthWrite: false }));
reticle.rotation.x = -Math.PI / 2; reticle.position.y = .05; scene.add(reticle);
const tipW = new THREE.Vector3();
const jetMat = new THREE.MeshBasicMaterial({ color: 0xe6f7ff, transparent: true, opacity: .55, depthWrite: false });
const jetCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false });
let jetMesh = null, jetCoreMesh = null;
function updateJet(on, width, impact) {
  if (jetMesh) { scene.remove(jetMesh); jetMesh.geometry.dispose(); jetMesh = null; }
  if (jetCoreMesh) { scene.remove(jetCoreMesh); jetCoreMesh.geometry.dispose(); jetCoreMesh = null; }
  if (!on) return;
  const end = impact.clone().setY(1.1), mid = tipW.clone().lerp(end, .5); mid.y += tipW.distanceTo(end) * .12;
  const curve = new THREE.QuadraticBezierCurve3(tipW.clone(), mid, end);
  const r = clamp(width * .09, .14, .34);
  jetMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 7, false), jetMat); scene.add(jetMesh);
  jetCoreMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r * .45, 5, false), jetCore); scene.add(jetCoreMesh);
}
function aimCannon(dt) {
  G.aim.lerp(G.aimTarget, 1 - Math.exp(-12 * dt));
  reticle.position.set(G.aim.x, .05, G.aim.z);
  const noz = NOZZLES[G.nozzle]; reticle.scale.setScalar(clamp(noz.width / 1.1, .8, 2.6) * (G.nozzle === 'pulse' ? 1 + G.charge : 1));
  const base = cannonYaw.getWorldPosition(_v);
  const dx = G.aim.x - base.x, dz = G.aim.z - base.z;
  cannonYaw.rotation.y = Math.atan2(-dx, -dz);
  const dist = Math.hypot(dx, dz); cannonPitch.rotation.x = clamp(.05 + dist * .012, .05, .45);
  nozzleTip.getWorldPosition(tipW);
}
function emitWater(dt, strength, spreadMul = 1) {
  const noz = NOZZLES[G.nozzle];
  const n = Math.ceil(240 * dt * strength) + 1;
  const dist = tipW.distanceTo(G.aim), tf = clamp(dist / 26, .28, 1.05);
  for (let k = 0; k < n; k++) {
    const tgt = _v.copy(G.aim); tgt.x += rand(-1, 1) * noz.spread * spreadMul; tgt.z += rand(-1, 1) * noz.spread * .5 * spreadMul; tgt.y = rand(.4, 1.6);
    const vel = _v2.copy(tgt).sub(tipW).divideScalar(tf); vel.y += .5 * 9.8 * tf;
    water.spawn(tipW, vel, tf * 1.25, rand(.8, 1.4) * (G.nozzle === 'fan' ? .8 : 1.15));
  }
  if (Math.random() < .5) mist.spawn(tipW, _v2.set(rand(-1, 1), rand(0, 1), rand(-1, 1)), .4, .8);
}
// find what the stream actually hits: the first upright agent along the ground line, else the aim point
function streamImpact(width) {
  const sx = tipW.x, sz = tipW.z, ex = G.aim.x, ez = G.aim.z; const lx = ex - sx, lz = ez - sz, L = Math.hypot(lx, lz) || 1, ux = lx / L, uz = lz / L;
  let first = null, fd = 1e9;
  for (const a of agents) {
    if (!a.active || a.state === 'down' || a.state === 'getup') continue;
    const px = a.pos.x - sx, pz = a.pos.z - sz; const along = px * ux + pz * uz; if (along < 3 || along > L + 1.2) continue;
    const lat = Math.abs(px * uz - pz * ux); if (lat > width * .5 + .35) continue;
    if (along < fd) { fd = along; first = a; }
  }
  return { first, dir: new THREE.Vector3(ux, 0, uz), point: first ? first.pos : G.aim };
}
function applyStream(dt, force, width) {
  const { first, dir, point } = streamImpact(width);
  const f = force * (1 + (G.surge > 0 ? .45 : 0)) * (G.sag > 0 ? .55 : 1);
  for (const a of agents) {
    if (!a.active || a.state === 'down' || a.state === 'getup') continue;
    const d = Math.hypot(a.pos.x - point.x, a.pos.z - point.z);
    const r = width * .5 + .6; if (d > r) continue;
    let k = (a === first ? 1 : .55) * (1 - d / (r + .5));
    if (a.type === 'shield') { const facing = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)); if (facing.dot(dir) < -.55) k *= 1 - a.T.block; }
    hitAgent(a, dir, f * k * dt);
  }
  if (Math.random() < .8) spawnSplash(_v.copy(point).setY(1.1), 2);
  return point;
}
function hitAgent(a, dir, amt) {
  a.soak += amt * 3.2 / a.T.mass;
  a.push.addScaledVector(dir, amt * 6 / a.T.mass);
  a.hitFlash = .15;
  if (a.state !== 'stagger' && a.state !== 'down') { a.state = 'stagger'; a.timer = 0; play(a, 'Stumble_Walk', { ts: 1.3, fade: .12 }); }
  if (a.soak > a.T.hp) knockDown(a, dir, 0);
}
function knockDown(a, dir, chainDepth) {
  if (a.state === 'down' || a.state === 'getup' || a.state === 'flee') return;
  a.state = 'down'; a.timer = 0; a.knocks++; a.soak = 0; G.kd++;
  a.push.addScaledVector(dir, 1.2);
  play(a, 'Fall_Down', { loop: false, ts: 2.1, clampEnd: true, fade: .1 });
  award(.035 + (a.type === 'heavy' ? .02 : 0), chainDepth ? `CHAIN ×${chainDepth + 1}` : 'KNOCKDOWN');
  G.bestChain = Math.max(G.bestChain, chainDepth + 1);
  // domino: fallers topple neighbours in the push direction
  const reach = (a.T.chain || 1) * 2.1 * G.domino;
  after(.26, () => {
    for (const b of agents) {
      if (b === a || !b.active || b.state === 'down' || b.state === 'getup' || b.state === 'flee') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > reach) continue;
      const along = (dx * dir.x + dz * dir.z) / (d || 1);
      if (along < -.2) continue;
      const hitAmt = (a.T.chain || 1) * G.domino * 1.35 * (1 - d / (reach + .6));
      b.soak += hitAmt / b.T.mass;
      if (b.soak > b.T.hp && chainDepth < 6) knockDown(b, dir, chainDepth + 1);
      else if (b.state === 'advance') { b.state = 'stagger'; b.timer = 0; play(b, 'Stumble_Walk', { ts: 1.3 }); b.push.addScaledVector(dir, .8); }
    }
  });
}
let pulseCharging = 0;
function firePulse() {
  const noz = NOZZLES.pulse; const c = clamp(G.charge, .25, 1);
  if (G.pressure < noz.cost * c) { toast('NEED PRESSURE', 'info'); return; }
  G.pressure -= noz.cost * c;
  for (let i = 0; i < 6; i++) emitWater(1 / 30, 6 * c, 1.3);
  applyStream(1, noz.force * c, noz.width * (1 + c * .5));
}

/* ============================== UPDATE LOOP ============================== */
const clock = new THREE.Clock();
function updateAgents(dt) {
  for (const a of agents) {
    if (!a.active) continue;
    a.mixAcc = (a.mixAcc || 0) + dt; if (a.pos.z > -16 || a.mixAcc > .05) { a.mixer.update(a.mixAcc); a.mixAcc = 0; }
    a.timer += dt;
    const T = a.T;
    // gas zone
    if (G.gasZone && a.state !== 'down' && a.state !== 'flee' && a.state !== 'getup' && Math.hypot(a.pos.x - G.gasZone.x, a.pos.z - G.gasZone.z) < G.gasZone.r && Math.random() < dt * 1.6) {
      flee(a); award(.03, 'GASSED OUT');
    }
    if (a.state === 'advance') {
      const dx = a.target.x - a.pos.x, dz = a.target.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > .6) { const sp = (a.type === 'runner' ? 2.6 : 1.25) * a.speed; a.pos.x += dx / d * sp * dt; a.pos.z += dz / d * sp * dt; a.yaw = Math.atan2(dx, dz); }
      else { // at the line: mill about, face the truck
        a.yaw = Math.atan2(-a.pos.x * .1, 1); if (a.timer > rand(2, 5)) { a.target.x = clamp(a.pos.x + rand(-2, 2), -7, 7); a.target.z = rand(CFG.plaza.zFront - 4, CFG.plaza.zFront); a.timer = 0; }
      }
      // throwers
      if (a.type === 'thrower' && G.phase === 'play') { a.throwCd -= dt * (G.volley > 0 ? 3 : 1); if (a.throwCd <= 0 && a.pos.z > -24) { a.state = 'throw'; a.timer = 0; a.thrown = false; play(a, 'Over_Shoulder_Throw', { loop: false, ts: 1.8, fade: .12 }); a.yaw = Math.atan2(-a.pos.x, CFG.truckZ - a.pos.z); if (G.volley > 0) G.volley--; } }
    } else if (a.state === 'throw') {
      if (!a.thrown && a.timer > 1.25) { a.thrown = true; throwProjectile(a); }
      if (a.timer > 2.4) { a.state = 'advance'; a.throwCd = rand(5, 10); play(a, 'Walking', { ts: a.speed }); }
    } else if (a.state === 'stagger') {
      a.soak = Math.max(0, a.soak - dt * .25);
      if (a.timer > 1.1 && a.push.lengthSq() < .05) { a.state = 'advance'; play(a, a.type === 'runner' ? 'Running' : 'Walking', { ts: a.speed }); }
    } else if (a.state === 'down') {
      if (a.timer > 2.4) {
        const leave = a.knocks >= 2 || Math.random() < T.disperse;
        if (leave) { a.state = 'getup'; a.timer = 0; a.willFlee = true; play(a, 'Stand_Up1', { loop: false, ts: 3.2, fade: .15, clampEnd: true }); }
        else { a.state = 'getup'; a.timer = 0; a.willFlee = false; play(a, 'Stand_Up1', { loop: false, ts: 3.2, fade: .15, clampEnd: true }); }
      }
    } else if (a.state === 'getup') {
      if (a.timer > 2.5) {
        if (a.willFlee) { flee(a); award(.05, 'SENT RUNNING'); }
        else { a.state = 'advance'; play(a, a.type === 'runner' ? 'Running' : 'Walking', { ts: a.speed }); if (G.phase === 'play' && a.pos.z > -16) award(-.02, 'BACK UP'); }
      }
    } else if (a.state === 'flee') {
      a.pos.z -= 3.4 * dt * a.speed; a.pos.x += (a.fleeX - a.pos.x) * dt * .4; a.yaw = Math.PI;
      if (a.pos.z < CFG.plaza.exit) { a.active = false; a.mesh.visible = false; a.blob.visible = false; }
    }
    // push / soak decay
    a.pos.addScaledVector(a.push, dt * 2.2); a.push.multiplyScalar(Math.exp(-3.2 * dt));
    if (a.state !== 'stagger') a.soak = Math.max(0, a.soak - dt * .15);
    // separation + obstacles
    if (a.state !== 'down') for (const b of agents) {
      if (b === a || !b.active || b.state === 'down') continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d2 = dx * dx + dz * dz; if (d2 > .64 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), k = (.8 - d) * .5; a.pos.x += dx / d * k; a.pos.z += dz / d * k;
    }
    for (const o of obstacles) { const dx = a.pos.x - o.x, dz = a.pos.z - o.z, d = Math.hypot(dx, dz); if (d < o.r + .35 && d > 1e-4) { a.pos.x = o.x + dx / d * (o.r + .35); a.pos.z = o.z + dz / d * (o.r + .35); } }
    a.pos.x = clamp(a.pos.x, -10.5, 10.5); if (a.state !== 'flee') a.pos.z = clamp(a.pos.z, -38, CFG.plaza.zFront + 1.5);
    a.mesh.position.copy(a.pos);
    const targetYaw = (a.state === 'stagger' || a.state === 'down' || a.state === 'getup') ? a.mesh.rotation.y : a.yaw;
    a.mesh.rotation.y += Math.atan2(Math.sin(targetYaw - a.mesh.rotation.y), Math.cos(targetYaw - a.mesh.rotation.y)) * Math.min(1, dt * 8);
    a.blob.position.set(a.pos.x, .03, a.pos.z);
    a.lane = laneOf(a.pos.x);
  }
}
function flee(a) { if (!a.counted) { a.counted = true; G.dispersed++; } a.state = 'flee'; a.timer = 0; a.fleeX = a.pos.x < 0 ? -9 : 9; if (Math.abs(a.pos.x) < 3) a.fleeX = rand(-4, 4); play(a, 'Running', { ts: 1.1 }); }
function updateThrown(dt) {
  for (let i = thrown.length - 1; i >= 0; i--) {
    const p = thrown[i]; p.t += dt; p.vel.addScaledVector(GRAV, dt); p.o.position.addScaledVector(p.vel, dt);
    p.o.rotation.x += p.spin.x * dt; p.o.rotation.y += p.spin.y * dt; p.o.rotation.z += p.spin.z * dt;
    if (p.t >= p.tf) { scene.remove(p.o); thrown.splice(i, 1); award(-.045, 'TRUCK HIT'); shake(.35); spawnSplash(p.o.position, 2); }
  }
  if (G.canFlight) {
    const c = G.canFlight; c.t += dt; c.vel.addScaledVector(GRAV, dt); gasCan.position.addScaledVector(c.vel, dt); gasCan.rotation.x += 8 * dt;
    if (c.t >= c.tf) { gasCan.visible = false; gasBurst(c.to, c.big); G.canFlight = null; }
  }
  if (G.gasZone) {
    G.gasZone.t -= dt; if (G.gasZone.t <= 0) G.gasZone = null;
    else if (Math.random() < dt * 14) gas.spawn(_v.set(G.gasZone.x + rand(-1.5, 1.5), .5, G.gasZone.z + rand(-1.5, 1.5)), _v2.set(rand(-1, 1), .2, rand(-1, 1)), 3, 2);
  }
}
let shakeT = 0; function shake(s) { shakeT = Math.max(shakeT, s); }
function updateFire(dt) { for (const b of barrels) if (Math.random() < dt * 30) fire.spawn(_v.set(b.x + rand(-.25, .25), 1.05, b.z + rand(-.25, .25)), _v2.set(rand(-.2, .2), rand(1.2, 2.2), rand(-.2, .2)), rand(.4, .8), rand(.5, .9)); }

function sectorState() {
  const counts = [0, 0, 0]; for (const a of agents) if (a.active && a.state !== 'flee' && a.pos.z > -30) counts[a.lane]++;
  return counts;
}
/* ------------------------------ Binoculars ------------------------------ */
let zoomK = 0; const ZOOM = 3;
const lookNow = new THREE.Vector3(), tagEls = [];
$('binobtn').addEventListener('pointerdown', e => { e.stopPropagation(); G.scope = !G.scope; $('binobtn').classList.toggle('on', G.scope); $('binoc').classList.toggle('on', G.scope); });
function updateScope(dt) {
  zoomK += ((G.scope ? 1 : 0) - zoomK) * Math.min(1, dt * 7);
  camera.fov = lerp(BASE_FOV, BASE_FOV / ZOOM, zoomK); camera.updateProjectionMatrix();
  lookNow.lerpVectors(CAM_LOOK, _v.set(G.aim.x, 1.2, G.aim.z), zoomK);
  const box = $('tags');
  if (zoomK < .6) { if (box.childElementCount) box.innerHTML = ''; return; }
  $('bzoom').textContent = (1 + (ZOOM - 1) * zoomK).toFixed(1);
  $('brange').textContent = Math.round(CAM_POS.distanceTo(_v.set(G.aim.x, 0, G.aim.z)));
  // tag the rioters nearest the centre of view
  const cand = agents.filter(a => a.active && a.state !== 'flee' && a.state !== 'down').map(a => ({ a, d: Math.hypot(a.pos.x - G.aim.x, a.pos.z - G.aim.z) })).sort((p, q) => p.d - q.d).slice(0, 5);
  while (tagEls.length < 5) { const el = document.createElement('div'); el.className = 'tag'; box.appendChild(el); tagEls.push(el); }
  if (!box.childElementCount) tagEls.forEach(el => box.appendChild(el));
  const W = innerWidth, H = innerHeight;
  tagEls.forEach((el, i) => {
    const c = cand[i]; if (!c) { el.style.display = 'none'; return; }
    const p = _v2.copy(c.a.pos); p.y = 2.1 * c.a.mesh.scale.y; p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) { el.style.display = 'none'; return; }
    el.style.display = ''; el.className = 'tag ' + c.a.type; el.textContent = c.a.type.toUpperCase();
    el.style.left = ((p.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - p.y) / 2 * H) + 'px';
  });
}
function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (!window.__manual) update(dt);
  camera.position.copy(CAM_POS);
  if (shakeT > 0) { camera.position.x += rand(-.25, .25) * shakeT; camera.position.y += rand(-.2, .2) * shakeT; }
  updateScope(window.__manual ? 1 : dt);
  camera.lookAt(zoomK > .001 ? lookNow : CAM_LOOK);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function update(dt) {
  GAMETIME += dt; runLater();
  if (shakeT > 0) shakeT -= dt;
  if (G.phase === 'play' || G.phase === 'demo' || G.phase === 'tally') {
    const noz = NOZZLES[G.nozzle];
    aimCannon(dt);
    if (G.surge > 0) G.surge -= dt; if (G.sag > 0) G.sag -= dt; if (G.dominoT > 0) { G.dominoT -= dt; if (G.dominoT <= 0) G.domino = 1; }
    G.gasCd -= dt;
    if (G.spraying && G.phase !== 'tally') {
      G.lastSpray = G.t;
      if (G.nozzle === 'pulse') { G.charge = Math.min(1, G.charge + dt / 1.1); if (Math.random() < .3) emitWater(dt, .3, .2); }
      else if (G.pressure > .02) {
        G.pressure = Math.max(0, G.pressure - noz.drain * dt * (G.surge > 0 ? .5 : 1));
        emitWater(dt, 1); const imp = applyStream(dt, noz.force, noz.width); updateJet(G.nozzle !== 'fan', noz.width, imp);
      } else if (Math.random() < .2) emitWater(dt, .15, 2);
    } else { updateJet(false); G.pressure = Math.min(1, G.pressure + dt * (G.surge > 0 ? .55 : .32) * (G.sag > 0 ? .5 : 1)); }
    if (!(G.spraying && G.pressure > .02 && G.nozzle !== 'pulse')) updateJet(false);
    if (G.phase === 'demo') demoTick(dt);
  }
  if (G.phase === 'play') {
    G.t += dt;
    const cpEvery = CFG.round / CFG.checkpoints;
    if (G.t >= (G.cpDone + 1) * cpEvery && G.cpDone < CFG.checkpoints - 1) { G.cpDone++; checkpoint(); }
    if (G.t - G.lastSpray > CFG.idleAfter) idleForce(dt);
    // sector clears
    const counts = sectorState();
    for (let i = 0; i < 3; i++) {
      if (!G.secClear[i] && counts[i] <= 1 && G.t > 6) { G.secClear[i] = true; banner(['LEFT', 'CENTER', 'RIGHT'][i] + ' SECTOR CLEAR'); award(.1, 'SECTOR CLEAR'); }
      else if (G.secClear[i] && counts[i] >= 4) { G.secClear[i] = false; award(-.05, 'SECTOR LOST'); }
    }
    // keep the plaza busy
    const act = agents.filter(a => a.active && a.state !== 'flee').length;
    if (act < 18 && Math.random() < dt * .6) reinforce(3);
    updateRivals();
    if (G.t >= CFG.round) endRound();
    updateHUD(counts);
  }
  updateAgents(dt); updateThrown(dt); updateFire(dt);
  if (gasMixer) gasMixer.update(dt);
  updatePool(water, dt, 'water'); updatePool(mist, dt, 'mist'); updatePool(fire, dt, 'fire'); updatePool(gas, dt, 'gas');
}

/* ============================== HUD ============================== */
const mnum = $('mnum');
function bumpMult(down) { mnum.classList.toggle('down', !!down); mnum.classList.add('bump'); setTimeout(() => mnum.classList.remove('bump', 'down'), 180); }
function toast(txt, kind = 'pos') {
  const box = $('toasts'); const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = txt; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => el.remove(), 1400);
}
function banner(txt) { const b = $('banner'); b.textContent = txt; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
const RIVAL_NAMES = ['Harbor Unit', 'Eastside Unit', 'Unit 12', 'North Unit'];
function updateRivals() {
  const u = G.t / CFG.round;
  for (const r of G.rivals) r.M = Math.max(0, pathAt(r.T, u) + Math.sin(G.t * r.f + r.ph) * .06 * u);
}
function updateHUD(counts) {
  const left = Math.max(0, CFG.round - G.t);
  $('tnum').textContent = Math.ceil(left); $('tring').style.strokeDashoffset = 119.4 * (1 - left / CFG.round);
  $('tnum').parentElement.classList.toggle('low', left < 10);
  mnum.textContent = G.M.toFixed(2) + '×'; $('pay').textContent = '= ' + fmt(G.M * G.amt) + ' Coins';
  const g = $('gfill'); g.style.width = (G.pressure * 100) + '%'; g.classList.toggle('low', G.pressure < .2); g.classList.toggle('surge', G.surge > 0);
  const secs = document.querySelectorAll('.sec'); counts.forEach((c, i) => { secs[i].querySelector('i').style.width = Math.min(100, c / 8 * 100) + '%'; secs[i].classList.toggle('clear', G.secClear[i]); });
  $('clr').textContent = Math.round(100 * G.dispersed / Math.max(1, G.spawned)) + '%';
  const rows = [...G.rivals.map(r => ({ n: r.n, m: r.M })), { n: 'You', m: G.M, me: true }].sort((a, b) => b.m - a.m);
  G.rank = rows.findIndex(r => r.me) + 1;
  $('board').innerHTML = rows.map((r, i) => `<div class="${r.me ? 'me' : ''}"><span>${i + 1}. ${r.n}</span><span>${r.m.toFixed(2)}×</span></div>`).join('');
}
function buildNozzles() {
  const icons = { jet: '<svg viewBox="0 0 22 14"><path d="M1 7h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', fan: '<svg viewBox="0 0 22 14"><path d="M2 7L20 1M2 7h18M2 7l18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>', pulse: '<svg viewBox="0 0 22 14"><circle cx="7" cy="7" r="5" fill="currentColor"/><path d="M14 3v8M18 5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' };
  const box = $('nozzles'); box.innerHTML = '';
  for (const k of G.unlocked) { const b = document.createElement('button'); b.className = 'nz' + (k === G.nozzle ? ' sel' : ''); b.innerHTML = icons[k] + NOZZLES[k].name; b.onpointerdown = e => { e.stopPropagation(); G.nozzle = k; buildNozzles(); }; box.appendChild(b); }
}

/* ============================== FLOW ============================== */
function refreshLobby() {
  $('bal').textContent = fmt(G.bal);
  document.querySelectorAll('#amts .chip').forEach(c => c.classList.toggle('sel', +c.dataset.amt === G.amt));
  const u = CFG.unlocks[G.amt];
  $('unlock').textContent = 'Nozzles at this amount: ' + u.map(k => NOZZLES[k].name).join(' · ') + (G.amt === 100 ? ' (switch mid-round)' : '');
}
document.querySelectorAll('#amts .chip').forEach(c => c.onclick = () => { G.amt = +c.dataset.amt; store.set('amt', G.amt); refreshLobby(); });
$('infobtn').onclick = () => $('howto').classList.remove('hidden');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).classList.add('hidden'));
$('playbtn').onclick = startRound;
$('again').onclick = () => { $('result').classList.add('hidden'); startRound(); };
$('tolobby').onclick = () => { $('result').classList.add('hidden'); toLobby(); };
$('showme').onclick = startDemo; $('demox').onclick = endDemo;

function resetCrowd() {
  for (const a of agents) { a.active = false; a.mesh.visible = false; a.blob.visible = false; }
  let n = 0; const inactive = agents.slice().sort(() => Math.random() - .5);
  const want = { regular: 14, heavy: 6, shield: 7, thrower: 7, runner: 6 };
  for (const a of inactive) if (want[a.type] > 0) { want[a.type]--; spawnAgent(a, 'plaza'); n++; }
  G.spawned = n; G.dispersed = 0;
}
function toLobby() { G.phase = 'lobby'; $('hud').classList.add('hidden'); $('lobby').classList.remove('hidden'); refreshLobby(); }
function startRound() {
  if (G.bal < G.amt) { G.bal += CFG.demoCoins; toast('+1,000 FREE Coins', 'info'); }
  G.bal -= G.amt; store.set('bal', G.bal);
  Object.assign(G, { t: 0, M: 0, kd: 0, bestChain: 0, pressure: 1, surge: 0, sag: 0, domino: 1, dominoT: 0, cpDone: 0, secClear: [false, false, false], volley: 0, gasCd: 3, idleCd: 0, lastSpray: 0, spraying: false, gasZone: null, finalDone: false });
  G.scope = false; $('binobtn').classList.remove('on'); $('binoc').classList.remove('on');
  G.T = drawResult();
  G.unlocked = CFG.unlocks[G.amt]; G.nozzle = 'jet'; buildNozzles();
  G.rivals = RIVAL_NAMES.map(n => ({ n, T: drawResult(), M: 0, f: rand(.3, .9), ph: rand(0, 6) }));
  resetCrowd();
  $('lobby').classList.add('hidden'); $('howto').classList.add('hidden'); $('hud').classList.remove('hidden'); $('padhint').style.opacity = 1;
  updateHUD([0, 0, 0]);
  G.phase = 'count'; const c = $('count'); c.classList.remove('hidden'); let n = 3; c.textContent = n;
  clearInterval(G.countIv); const iv = G.countIv = setInterval(() => { n--; if (n > 0) c.textContent = n; else { clearInterval(iv); c.textContent = 'GO!'; setTimeout(() => c.classList.add('hidden'), 500); G.phase = 'play'; clock.getDelta(); } }, 700);
}
function endRound() {
  G.phase = 'tally'; G.spraying = false; G.scope = false; $('binobtn').classList.remove('on'); $('binoc').classList.remove('on');
  banner('HORN!'); finalTrueUp(); updateHUD(sectorState());
  const win = Math.round(G.M * G.amt); G.bal += win; store.set('bal', G.bal);
  after(1.6, () => {
    $('rmult').textContent = G.M.toFixed(2) + '×'; $('rcoins').textContent = fmt(win);
    $('rclr').textContent = Math.round(100 * G.dispersed / Math.max(1, G.spawned)) + '%'; $('rkd').textContent = G.kd; $('rch').textContent = G.bestChain; $('rrank').textContent = '#' + G.rank;
    $('result').classList.remove('hidden'); $('hud').classList.add('hidden'); G.phase = 'result';
  });
}

/* ------------------------------ Show me demo (≤5 s) ------------------------------ */
let demoT = 0;
const DEMO_CAPS = [[0, 'Drag to aim'], [1.4, 'Hold to spray'], [2.8, 'Knock them into each other'], [4.2, 'Clear the plaza!']];
function startDemo() {
  $('howto').classList.add('hidden'); $('lobby').classList.add('hidden'); $('demo').classList.remove('hidden');
  resetCrowd(); G.unlocked = ['jet']; G.nozzle = 'jet'; G.pressure = 1; G.surge = 0; G.sag = 0; G.domino = 1.4;
  G.phase = 'demo'; demoT = 0;
}
function demoTick(dt) {
  demoT += dt;
  const u = demoT / 5; G.aimTarget.set(Math.sin(u * Math.PI * 2.2) * 5, 0, lerp(-2, -14, u));
  G.spraying = demoT > 1.2 && demoT < 4.8;
  let cap = ''; for (const [t, c] of DEMO_CAPS) if (demoT >= t) cap = c; $('democap').textContent = cap;
  if (demoT >= 5) endDemo();
}
function endDemo() { if (G.phase !== 'demo') return; G.spraying = false; G.domino = 1; $('demo').classList.add('hidden'); resetCrowd(); toLobby(); }

/* ============================== BOOT ============================== */
(async function boot() {
  try {
    await loadAll();
  } catch (e) { $('loadtxt').textContent = 'Could not load art: ' + e.message; throw e; }
  lidProto = prop('props/prop_trashcan_lid', .62);
  gasCan = prop('props/prop_teargas_canister', .35); gasCan.visible = false; scene.add(gasCan);
  dressWorld();
  // agent pool: every crowd model × 2
  for (const [type] of Object.entries(CFG.crowd)) for (let v = 1; v <= 3; v++) for (let k = 0; k < 5; k++) makeAgent(type, v);
  for (const a of agents) { a.mesh.visible = false; a.blob.visible = false; }
  resetCrowd();
  $('loading').classList.add('hidden');
  toLobby();
  window.RIOT_READY = true;
  tick();
})();

// test hooks (used by the automated checks; harmless in play)
window.RIOT = { G, CFG, agents, drawResult, startRound, step(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) update(dt); }, go() { clearInterval(G.countIv); G.phase = 'play'; $('count').classList.add('hidden'); }, setAim(x, z) { G.aimTarget.set(x, 0, z); }, spray(on) { G.spraying = on; }, scope(on) { G.scope = on; $('binoc').classList.toggle('on', on); } };
