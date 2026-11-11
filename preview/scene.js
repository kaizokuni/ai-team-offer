/* The 3D story behind the offer page: a space-black laptop in the sky, six mini agents (one per job) and Yassine on his cloud.
   The page's inline script publishes window.stageState = { mode, method, team, idx } on scroll; this file only poses and draws.
   Modes: hero (agents orbit the laptop), travel/away (everything flies off), method (the laptop opens as you scroll),
   team (one agent at a time comes forward), final (everyone lines up above the last call to action).
   Everything is built from primitives in code: no downloaded models, nothing taken from another site. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const root = document.documentElement, canvas = document.getElementById("sky"), labels = document.getElementById("labels");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch (e) { root.classList.remove("live"); root.classList.add("flat"); canvas.remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const FOV = 35, DIST = 10, camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
camera.position.set(0, 0, DIST);
const sun = new THREE.DirectionalLight(0xffffff, 2), hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
scene.add(sun, hemi);

const THEMES = {
  day:    { sun: 0xfff4e0, sunI: 2.2, sunPos: [5, 6, 6],  sky: 0xd6e7ff, ground: 0xb9b2a8, hemiI: 0.9, env: 0.9,  cloud: 0xffffff, cloudO: 0.7,  stars: 0 },
  sunset: { sun: 0xff9a5c, sunI: 2.6, sunPos: [-6, 2, 5], sky: 0xffb48a, ground: 0x4a2f45, hemiI: 0.8, env: 0.7,  cloud: 0xffb38f, cloudO: 0.65, stars: 0.25 },
  night:  { sun: 0xcfd4ff, sunI: 1.2, sunPos: [3, 5, 6],  sky: 0x3d3f5c, ground: 0x08080e, hemiI: 0.6, env: 0.45, cloud: 0x20212e, cloudO: 0.5,  stars: 1 },
};

/* ---------- small helpers ---------- */
const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const phys = (color, o) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, ...o });
const lit = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const tex = (w, h, draw) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const glowTex = tex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const glowSprite = (color, sx, sy, opacity = 0.8) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
  s.scale.set(sx, sy, 1); return s;
};
const shell = phys(0xf4f2ec, { roughness: 0.28 }), darkGlass = phys(0x10141b, { roughness: 0.12, clearcoat: 1 });

/* ---------- sky: clouds and stars ---------- */
const clouds = [];
for (let i = 0; i < 24; i++) {
  let s = i * 7 + 3; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const map = tex(256, 256, (g) => { for (let b = 0; b < 9; b++) {
    const x = 256 * (0.25 + rnd() * 0.5), y = 256 * (0.35 + rnd() * 0.3), r = 256 * (0.12 + rnd() * 0.18), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  const size = 4 + Math.random() * 5; sp.scale.set(size * 1.7, size, 1);
  sp.position.set((Math.random() - 0.5) * 36, 0, -5 - Math.random() * 22);
  sp.userData = { v: 0.08 + Math.random() * 0.12, y0: Math.random() * 14 };
  scene.add(sp); clouds.push(sp);
}
const starPos = new Float32Array(700 * 3);
for (let i = 0; i < 700; i++) { starPos[i * 3] = (Math.random() - 0.5) * 120; starPos[i * 3 + 1] = Math.random() * 60 - 20; starPos[i * 3 + 2] = -40 - Math.random() * 30; }
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0, depthWrite: false });
scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3)), starMat));

/* ---------- the laptop: space black, notch, opens on its hinge ---------- */
const mac = (() => {
  const g = new THREE.Group();
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1e, metalness: 0.9, roughness: 0.4, clearcoat: 0.2, clearcoatRoughness: 0.4 });
  g.add(M(new RoundedBoxGeometry(3.4, 0.1, 2.3, 4, 0.05), alu));
  const keys = tex(1024, 400, (c, w, h) => {
    c.fillStyle = "#0a0a0c"; c.beginPath(); c.roundRect(0, 0, w, h, 18); c.fill(); c.fillStyle = "#1c1c20";
    [14, 14, 14, 13, 12, 10].forEach((n, r) => { for (let i = 0; i < n; i++) { c.beginPath(); c.roundRect(i * (w / n) + 4, r * (h / 6) + 5, w / n - 8, h / 6 - 10, 7); c.fill(); } });
  });
  const kb = M(new THREE.PlaneGeometry(2.95, 1.12), new THREE.MeshStandardMaterial({ map: keys, roughness: 0.6, metalness: 0.2 }), 0, 0.0505, -0.38);
  kb.rotation.x = -Math.PI / 2; g.add(kb);
  const pad = M(new THREE.PlaneGeometry(1.3, 0.78), new THREE.MeshPhysicalMaterial({ color: 0x222226, metalness: 0.7, roughness: 0.3 }), 0, 0.0505, 0.66);
  pad.rotation.x = -Math.PI / 2; g.add(pad);
  const lid = new THREE.Group(); lid.position.set(0, 0.05, -1.15); g.add(lid);
  lid.add(M(new RoundedBoxGeometry(3.4, 2.3, 0.07, 4, 0.035), alu, 0, 1.15, 0));
  const sc = document.createElement("canvas"); sc.width = 1280; sc.height = 832;
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
  const screen = M(new THREE.PlaneGeometry(3.3, 2.2), new THREE.MeshBasicMaterial({ map: st, toneMapped: false }), 0, 1.15, 0.036); lid.add(screen);
  const halo = glowSprite(0x8fd8ff, 5.5, 3.8, 0); halo.position.set(0, 1.15, 0.4); lid.add(halo);
  return { g, lid, screen, sc, st, halo };
})();
function drawScreen(l) {
  const g = mac.sc.getContext("2d"), fr = l === "fr", F = "system-ui, 'Segoe UI', sans-serif";
  g.fillStyle = "#000"; g.fillRect(0, 0, 1280, 832);
  g.fillStyle = "#1e2124"; g.beginPath(); g.roundRect(18, 18, 1244, 796, 22); g.fill();
  g.fillStyle = "#000"; g.beginPath(); g.roundRect(560, 0, 160, 44, [0, 0, 14, 14]); g.fill();
  g.fillStyle = "#2b2f33"; g.fillRect(18, 60, 1244, 70);
  g.fillStyle = "#8e9297"; g.font = `600 30px ${F}`; g.fillText(fr ? "# service-client" : "# customer-service", 56, 106);
  g.fillStyle = "#3ce0b0"; g.beginPath(); g.arc(96, 216, 38, 0, 7); g.fill();
  g.fillStyle = "#04150f"; g.font = `800 28px ${F}`; g.fillText(fr ? "SC" : "CS", 76, 226);
  g.fillStyle = "#fff"; g.font = `700 36px ${F}`; g.fillText(fr ? "Service client" : "Customer service", 160, 204);
  g.fillStyle = "#dcdee1"; g.font = `400 31px ${F}`; g.fillText(fr ? "Julie demande où est la commande n°1042." : "Julie asks where order #1042 is.", 160, 252);
  g.fillStyle = "#2b2f33"; g.fillRect(160, 292, 1040, 210); g.fillStyle = "#3ce0b0"; g.fillRect(160, 292, 7, 210);
  g.fillStyle = "#8e9297"; g.font = "700 22px monospace"; g.fillText(fr ? "PROPOSITION DE RÉPONSE" : "DRAFT REPLY", 192, 336);
  g.fillStyle = "#fff"; g.font = `400 31px ${F}`;
  g.fillText(fr ? "Bonjour Julie, votre colis est parti lundi" : "Hi Julie, your parcel left on Monday and", 192, 392);
  g.fillText(fr ? "et devrait arriver jeudi. Belle journée !" : "should arrive on Thursday. Have a lovely day!", 192, 438);
  g.fillStyle = "#dcdee1"; g.font = `600 34px ${F}`; g.fillText(fr ? "Je l'envoie ?" : "OK to send?", 160, 574);
  g.fillStyle = "#248046"; g.beginPath(); g.roundRect(160, 610, 250, 82, 10); g.fill();
  g.fillStyle = "#4e5058"; g.beginPath(); g.roundRect(430, 610, 250, 82, 10); g.fill();
  g.fillStyle = "#fff"; g.font = `700 32px ${F}`; g.fillText(fr ? "✓ Envoyer" : "✓ Send", 200, 662); g.fillText(fr ? "Modifier" : "Change it", 478, 662);
  mac.st.needsUpdate = true;
}
scene.add(mac.g);

/* ---------- the six mini agents ---------- */
const ROLES = [
  { c: 0x2fd4a7, en: "Customer service", fr: "Service client" },
  { c: 0xff7fa3, en: "Ad images", fr: "Visuels pub" },
  { c: 0xffa53c, en: "Ad videos", fr: "Vidéos pub" },
  { c: 0x6c9bff, en: "Competitor watch", fr: "Veille concurrents" },
  { c: 0xa57bff, en: "Meta ads", fr: "Pubs Meta" },
  { c: 0xffcf4a, en: "E-mail & store", fr: "E-mails & boutique" },
];
/* each prop returns { o, act(t, k) }: what the agent holds, and how it moves (k = how much it is on stage, 0 to 1) */
const PROPS = [
  (col, glow, head) => { // headset + speech bubble with bouncing dots
    const band = M(new THREE.TorusGeometry(0.34, 0.022, 8, 24, Math.PI), col, 0, 0.02, 0); band.scale.y = 0.78; head.add(band);
    const boom = M(new THREE.CylinderGeometry(0.011, 0.011, 0.24), col, -0.3, -0.09, 0.13); boom.rotation.x = 1.25; head.add(boom, M(new THREE.SphereGeometry(0.03, 12, 8), darkGlass, -0.3, -0.13, 0.25));
    const o = new THREE.Group(); o.position.set(0.47, 0.5, 0.12);
    o.add(M(new RoundedBoxGeometry(0.38, 0.25, 0.06, 4, 0.03), shell));
    const tail = M(new THREE.ConeGeometry(0.05, 0.1, 3), shell, -0.1, -0.16, 0); tail.rotation.z = Math.PI; o.add(tail);
    const dots = [-0.095, 0, 0.095].map((x) => M(new THREE.SphereGeometry(0.027, 12, 8), glow, x, 0, 0.04)); o.add(...dots);
    return { o, act: (t, k) => { dots.forEach((d, i) => { d.position.y = Math.max(0, Math.sin(t * 6 - i * 0.9)) * 0.04 * k; }); o.scale.setScalar(1 + Math.sin(t * 2) * 0.04 * k); } };
  },
  (col) => { // a framed picture it just made
    const o = new THREE.Group(); o.position.set(0.47, 0.06, 0.2); o.rotation.y = -0.3;
    o.add(M(new RoundedBoxGeometry(0.42, 0.34, 0.035, 3, 0.015), col));
    const pic = tex(256, 192, (g, w, h) => { const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#ffb37a"); sky.addColorStop(1, "#ffe9c7"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(180, 62, 26, 0, 7); g.fill();
      g.fillStyle = "#7a5cc7"; g.beginPath(); g.moveTo(0, h); g.lineTo(90, 60); g.lineTo(180, h); g.fill();
      g.fillStyle = "#4b3a8f"; g.beginPath(); g.moveTo(90, h); g.lineTo(190, 92); g.lineTo(256, 150); g.lineTo(256, h); g.fill(); });
    o.add(M(new THREE.PlaneGeometry(0.35, 0.27), new THREE.MeshBasicMaterial({ map: pic, toneMapped: false }), 0, 0, 0.019));
    return { o, act: (t, k) => { o.rotation.z = Math.sin(t * 1.5) * 0.1 * k; } };
  },
  () => { // clapperboard that snaps
    const o = new THREE.Group(); o.position.set(0.47, 0.04, 0.2); o.rotation.y = -0.25;
    o.add(M(new RoundedBoxGeometry(0.4, 0.25, 0.04, 3, 0.015), darkGlass));
    const stripes = new THREE.MeshBasicMaterial({ toneMapped: false, map: tex(128, 32, (g) => { g.fillStyle = "#16181d"; g.fillRect(0, 0, 128, 32); g.fillStyle = "#f4f2ec";
      for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); } }) });
    const hinge = new THREE.Group(); hinge.position.set(-0.2, 0.135, 0); hinge.add(M(new THREE.BoxGeometry(0.4, 0.055, 0.045), stripes, 0.2, 0.028, 0)); o.add(hinge);
    o.add(M(new THREE.BoxGeometry(0.4, 0.05, 0.045), stripes, 0, 0.1, 0.001));
    return { o, act: (t, k) => { hinge.rotation.z = Math.pow(0.5 + 0.5 * Math.sin(t * 3.2), 4) * 0.65 * k; } };
  },
  (col, glow) => { // spyglass sweeping the horizon
    const o = new THREE.Group(); o.position.set(0.3, 0.36, 0.26); o.rotation.x = -0.15;
    [[0.045, 0, shell], [0.058, 0.13, col], [0.072, 0.27, shell]].forEach(([r, z, m]) => { const c = M(new THREE.CylinderGeometry(r, r, 0.15, 24), m, 0, 0, z); c.rotation.x = Math.PI / 2; o.add(c); });
    o.add(M(new THREE.CircleGeometry(0.064, 24), glow, 0, 0, 0.347));
    return { o, act: (t, k) => { o.rotation.y = Math.sin(t * 0.9) * 0.55 * k; } };
  },
  (col, glow) => { // megaphone with sound rings
    const o = new THREE.Group(); o.position.set(0.46, 0.12, 0.22); o.rotation.y = 0.35;
    const horn = M(new THREE.CylinderGeometry(0.17, 0.05, 0.3, 24, 1, true), col.clone()); horn.material.side = THREE.DoubleSide; horn.rotation.x = Math.PI / 2; o.add(horn);
    o.add(M(new THREE.CylinderGeometry(0.02, 0.02, 0.13), shell, 0, -0.09, -0.08));
    const rings = [0, 1, 2].map(() => M(new THREE.TorusGeometry(0.12, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: glow.color, transparent: true, toneMapped: false }))); o.add(...rings);
    return { o, act: (t, k) => { rings.forEach((r, i) => { const p = (t * 0.8 + i / 3) % 1; r.position.z = 0.2 + p * 0.4; r.scale.setScalar(0.6 + p * 1.3); r.material.opacity = (1 - p) * k; }); } };
  },
  (col, glow) => { // bar chart that keeps growing
    const o = new THREE.Group(); o.position.set(0.47, -0.02, 0.2); o.rotation.y = -0.3;
    o.add(M(new THREE.BoxGeometry(0.4, 0.025, 0.13), shell));
    const hs = [0.12, 0.21, 0.32], bars = hs.map((h, i) => M(new THREE.BoxGeometry(0.08, 1, 0.08), i === 2 ? glow : col, -0.13 + i * 0.13, 0, 0)); o.add(...bars);
    return { o, act: (t, k) => { bars.forEach((b, i) => { b.scale.y = hs[i] * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + i))) * (0.6 + 0.4 * k); b.position.y = b.scale.y / 2 + 0.0125; }); } };
  },
];
const agents = ROLES.map((role, i) => {
  const g = new THREE.Group(), col = phys(role.c), glow = lit(role.c);
  const body = M(new THREE.CapsuleGeometry(0.24, 0.14, 8, 24), shell); body.scale.z = 0.9; g.add(body);
  const belt = M(new THREE.TorusGeometry(0.236, 0.03, 12, 40), col, 0, -0.05, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.9; g.add(belt);
  g.add(M(new THREE.CircleGeometry(0.05, 24), glow, 0, 0.1, 0.219), M(new THREE.ConeGeometry(0.15, 0.14, 24), col, 0, -0.35, 0));
  const flame = glowSprite(role.c, 0.5, 0.75); flame.position.y = -0.52; g.add(flame);
  const head = new THREE.Group(); head.position.y = 0.5; g.add(head);
  head.add(M(new RoundedBoxGeometry(0.64, 0.46, 0.48, 6, 0.2), shell), M(new RoundedBoxGeometry(0.5, 0.3, 0.08, 4, 0.04), darkGlass, 0, 0, 0.21));
  const eyes = [-1, 1].map((s) => { const e = M(new THREE.CapsuleGeometry(0.032, 0.05, 4, 12), glow, 0.1 * s, 0.015, 0.252); e.scale.z = 0.3; return e; }); head.add(...eyes);
  const smile = M(new THREE.TorusGeometry(0.04, 0.009, 8, 16, Math.PI), glow, 0, -0.065, 0.252); smile.rotation.z = Math.PI; head.add(smile);
  for (const s of [-1, 1]) { const ear = M(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 24), col, 0.335 * s, 0, 0); ear.rotation.z = Math.PI / 2; head.add(ear); }
  head.add(M(new THREE.CylinderGeometry(0.012, 0.012, 0.14), shell, 0, 0.3, 0), M(new THREE.SphereGeometry(0.045, 16, 12), glow, 0, 0.39, 0));
  const arms = [-1, 1].map((s) => { const sh = new THREE.Group(); sh.position.set(0.27 * s, 0.1, 0); sh.rotation.z = 0.4 * s;
    sh.add(M(new THREE.CapsuleGeometry(0.05, 0.14, 4, 12), shell, 0, -0.12, 0), M(new THREE.SphereGeometry(0.065, 16, 12), col, 0, -0.26, 0)); g.add(sh); return sh; });
  const prop = PROPS[i](col, glow, head); g.add(prop.o);
  arms[1].rotation.set(-0.7, 0, 1.0);                        // the right arm reaches for what it holds
  const chip = document.createElement("span"); chip.className = "chip"; labels.append(chip);
  g.userData = { tp: new THREE.Vector3(0, 9, 0), ts: 0.5 }; g.position.set((i - 2.5) * 0.8, 9, 0); scene.add(g);
  return { g, head, eyes, arms, flame, prop, chip, role, phase: (i / 6) * Math.PI * 2, lift: (i % 2) * 0.5 - 0.25, blink: 2 + i };
});

/* ---------- Yassine, the builder, on his own little cloud ---------- */
const yas = (() => {
  const g = new THREE.Group(), skin = phys(0xd9a680, { clearcoat: 0.2, roughness: 0.55 }), hair = phys(0x1a1310, { clearcoat: 0, roughness: 0.9 });
  const tee = phys(0x23264a, { clearcoat: 0.1, roughness: 0.7 }), pants = phys(0x1c2028, { clearcoat: 0.1, roughness: 0.7 }), ink = phys(0x17110e, { roughness: 0.5 });
  g.add(M(new THREE.CapsuleGeometry(0.2, 0.2, 8, 16), tee, 0, 0.3, 0));
  const head = new THREE.Group(); head.position.y = 0.8; g.add(head);
  const skull = M(new THREE.SphereGeometry(0.22, 32, 24), skin); skull.scale.y = 1.08; head.add(skull);
  for (let i = 0; i < 34; i++) {              // curly hair: a cap of small spheres
    const u = (i + 0.5) / 34, th = Math.acos(1 - u * 1.05), ph = i * 2.4, r = 0.225;
    const x = r * Math.sin(th) * Math.cos(ph), y = r * Math.cos(th) * 1.08 + 0.02, z = r * Math.sin(th) * Math.sin(ph);
    if (z > 0.13 && y < 0.14) continue;       // keep the face clear
    head.add(M(new THREE.SphereGeometry(0.062 + (i % 3) * 0.012, 12, 8), hair, x, y, z));
  }
  for (const s of [-1, 1]) {
    head.add(M(new THREE.SphereGeometry(0.027, 12, 8), ink, 0.078 * s, 0.02, 0.2), M(new THREE.SphereGeometry(0.045, 12, 8), skin, 0.215 * s, -0.01, 0));
    const brow = M(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), ink, 0.078 * s, 0.075, 0.2); brow.rotation.z = Math.PI / 2 + 0.12 * s; head.add(brow);
  }
  const tache = M(new THREE.CapsuleGeometry(0.01, 0.085, 4, 8), ink, 0, -0.075, 0.212); tache.rotation.z = Math.PI / 2; head.add(tache);
  const grin = M(new THREE.TorusGeometry(0.05, 0.009, 8, 16, Math.PI), ink, 0, -0.105, 0.2); grin.rotation.z = Math.PI; head.add(grin);
  const arms = [-1, 1].map((s) => { const sh = new THREE.Group(); sh.position.set(0.24 * s, 0.46, 0); sh.rotation.z = 0.22 * s;
    sh.add(M(new THREE.CapsuleGeometry(0.062, 0.1, 4, 12), tee, 0, -0.08, 0), M(new THREE.CapsuleGeometry(0.048, 0.16, 4, 12), skin, 0, -0.26, 0), M(new THREE.SphereGeometry(0.058, 12, 8), skin, 0, -0.39, 0));
    g.add(sh); return sh; });
  for (const s of [-1, 1]) g.add(M(new THREE.CapsuleGeometry(0.078, 0.3, 4, 12), pants, 0.095 * s, -0.16, 0), M(new RoundedBoxGeometry(0.14, 0.09, 0.25, 3, 0.04), shell, 0.095 * s, -0.42, 0.04));
  const puff = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  [[0, 0, 0.3], [-0.3, 0.02, 0.22], [0.3, 0.01, 0.24], [-0.14, -0.02, 0.26], [0.16, 0.03, 0.25], [0, 0.02, 0.2]].forEach(([x, y, r], i) => {
    const b = M(new THREE.SphereGeometry(r, 20, 14), puff, x, -0.62 + y, i === 5 ? -0.2 : (i % 2) * 0.16); b.scale.y = 0.55; g.add(b); });
  const chip = document.createElement("span"); chip.className = "chip me"; labels.append(chip);
  g.userData = { tp: new THREE.Vector3(0, 9, 0), ts: 0.5 }; g.position.set(0, 9, 0); scene.add(g);
  return { g, head, arms, puff, chip };
})();

/* ---------- words on screen and on the chips follow the page language ---------- */
function setLang(l) {
  const fr = l === "fr"; drawScreen(l);
  for (const ag of agents) ag.chip.textContent = ag.role[fr ? "fr" : "en"];
  yas.chip.textContent = fr ? "C'est moi : j'installe votre équipe" : "That's me: I install your team";
}
setLang(root.lang); addEventListener("langchange", (e) => setLang(e.detail));

/* ---------- themes blend instead of snapping ---------- */
const cur = { sun: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), cloud: new THREE.Color(), sunPos: new THREE.Vector3(), sunI: 2, hemiI: 1, env: 1, cloudO: 0.7, stars: 0 };
let target = THEMES[root.dataset.theme] || THEMES.day;
const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
function blend(k) {
  cur.sun.lerp(tmpC.set(target.sun), k); cur.sky.lerp(tmpC.set(target.sky), k); cur.ground.lerp(tmpC.set(target.ground), k); cur.cloud.lerp(tmpC.set(target.cloud), k);
  cur.sunPos.lerp(tmpV.set(...target.sunPos), k);
  for (const key of ["sunI", "hemiI", "env", "cloudO", "stars"]) cur[key] += (target[key] - cur[key]) * k;
  sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos);
  hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.ground); hemi.intensity = cur.hemiI;
  scene.environmentIntensity = cur.env; starMat.opacity = cur.stars; yas.puff.color.copy(cur.cloud).lerp(tmpC.set(0xffffff), 0.5);
  for (const c of clouds) { c.material.color.copy(cur.cloud); c.material.opacity = cur.cloudO; }
}
blend(1); addEventListener("themechange", (e) => { target = THEMES[e.detail] || THEMES.day; if (!live()) draw(); });

/* ---------- layout, input, loop ---------- */
const live = () => root.classList.contains("live");
const HERO = { mode: "hero", method: 0, team: 0, idx: 0 }, finalEl = document.getElementById("request");
const mouse = { x: 0, y: 0 }, v = new THREE.Vector3();
let W = 1, H = 1, t = 0, last = performance.now(), awayFor = 0;
function resize() { W = canvas.clientWidth; H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); if (!live()) draw(); }
addEventListener("resize", resize);
addEventListener("pointermove", (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
const go = (o, k) => { o.position.lerp(o.userData.tp, k); o.scale.setScalar(o.scale.x + (o.userData.ts - o.scale.x) * k); };
function chipAt(el, obj, dy, opacity) {
  if (!opacity) { el.style.opacity = 0; return; }
  v.setFromMatrixPosition(obj.matrixWorld); v.y += dy; v.project(camera);
  el.style.opacity = opacity; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
}

function frame(dt, k) {
  t += dt;
  const st = live() ? (window.stageState || HERO) : HERO, sy = live() ? scrollY : 0, vh = innerHeight;
  const hH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * DIST, hW = hH * camera.aspect, narrow = camera.aspect < 0.85, UP = hH * 2.3;
  blend(k);
  for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 20) c.position.x = -20; c.position.y = ((c.userData.y0 + sy * 0.0016) % 14) - 6.5; }

  /* the laptop */
  let mp = [hW * 0.5, UP], ms = 0.6, mr = [0.25, -0.5], open = st.mode === "travel" ? 0 : 1;
  if (st.mode === "hero") { mp = narrow ? [0, hH * 0.42] : [hW * 0.5, -hH * 0.1]; ms = narrow ? 0.4 : 0.6; mp[1] += (sy / vh) * hH * 1.3; }
  else if (st.mode === "method") { mp = narrow ? [0, hH * 0.4] : [hW * 0.45, -hH * 0.16]; ms = narrow ? 0.42 : 0.82; mr = [0.14, -0.3]; open = smooth(st.method / 0.55); }
  mac.g.userData.tp = mac.g.userData.tp || new THREE.Vector3(); mac.g.userData.tp.set(mp[0], mp[1], 0); mac.g.userData.ts = ms; go(mac.g, k);
  mac.g.rotation.x += (mr[0] + mouse.y * 0.12 - mac.g.rotation.x) * k; mac.g.rotation.y += (mr[1] + mouse.x * 0.3 + Math.sin(t * 0.3) * 0.05 - mac.g.rotation.y) * k;
  mac.lid.rotation.x += (THREE.MathUtils.lerp(Math.PI / 2, -0.28, open) - mac.lid.rotation.x) * k;
  const on = smooth((1.25 - mac.lid.rotation.x) / 1.2); mac.screen.material.color.setScalar(on); mac.halo.material.opacity = 0.16 * on * (1.4 - cur.env);

  /* the agents */
  const fTop = finalEl.getBoundingClientRect().top, rowY = hH * (1 - (2 * (fTop + vh * 0.27)) / vh), gap = Math.min(1.25, (hW * 1.8) / 7);
  agents.forEach((ag, i) => {
    const d = ag.g.userData; let s = 0.45, emph = 0.35, turn = 0;
    const bob = Math.sin(t * 1.6 + ag.phase) * 0.06;
    if (st.mode === "hero") { const a = ag.phase + t * 0.22, R = narrow ? 1.05 : 2.0; s = narrow ? 0.3 : 0.5; emph = 0.6;
      d.tp.set(mp[0] + Math.cos(a) * R, mp[1] + ms + ag.lift * 0.7 + bob, Math.sin(a) * R * 0.55); }
    else if (st.mode === "method") { const SL = [[-2.05, 1.5, 0.3], [-1.2, 2.75, -0.5], [-0.05, 2.95, -0.5], [1.15, 2.75, -0.5], [2.05, 1.5, 0.3], [2.2, 0.2, 0.9]][i];
      s = (narrow ? 0.26 : 0.42) * Math.max(0.001, smooth((st.method - 0.3 - i * 0.05) / 0.2)); d.tp.set(mp[0] + SL[0] * ms, mp[1] + SL[1] * ms + bob, SL[2] * ms); }
    else if (st.mode === "team") {
      if (i === st.idx) { s = narrow ? 1.05 : 1.75; emph = 1; turn = Math.sin(t * 0.6) * 0.3; d.tp.set(narrow ? 0 : -hW * 0.45, (narrow ? hH * 0.38 : -hH * 0.12) + bob, 1); }
      else { s = narrow ? 0.2 : 0.3; d.tp.set(narrow ? (i - 2.5) * 0.42 : -hW * 0.45 + (i - 2.5) * 0.62, hH * (narrow ? 0.82 : 0.62) + bob, 0); } }
    else if (st.mode === "final") { s = Math.min(0.62, gap * 0.52); emph = 0.7; d.tp.set((i < 3 ? i - 3 : i - 2) * gap, rowY + bob, 0); }
    else d.tp.set(ag.g.position.x, UP + i * 0.25, 0);
    d.ts = s; go(ag.g, k);
    ag.g.rotation.y += (turn + mouse.x * 0.5 - ag.g.rotation.y) * k; ag.g.rotation.z = Math.sin(t * 1.1 + ag.phase) * 0.06;
    ag.head.rotation.x = mouse.y * 0.25; ag.arms[0].rotation.z = -0.4 - (emph > 0.9 ? 1.9 + Math.sin(t * 7) * 0.25 : Math.sin(t * 1.3 + ag.phase) * 0.12);
    if (t > ag.blink) ag.blink = t + 2 + Math.random() * 4;
    ag.eyes.forEach((e) => { e.scale.y = ag.blink - t > 0.12 && ag.blink - t < 100 ? 1 : 0.12; });
    ag.flame.material.opacity = 0.55 + 0.25 * Math.sin(t * 9 + i); ag.prop.act(t, emph);
  });

  /* Yassine */
  { const d = yas.g.userData; let s = 0.5, wave = 0;
    if (st.mode === "hero") { s = narrow ? 0.34 : 0.56; wave = 1; d.tp.set(mp[0] - ms * 2.6, mp[1] - ms * 0.55, 0.8); }
    else if (st.mode === "method") { s = narrow ? 0.3 : 0.6; wave = 0.5; d.tp.set(mp[0] - ms * 2.75, mp[1] - ms * 0.3, 0.9); }
    else if (st.mode === "final") { s = Math.min(0.7, gap * 0.6); wave = 1; d.tp.set(0, rowY - 0.05, 0.2); }
    else d.tp.set(yas.g.position.x, UP, 0);
    d.tp.y += Math.sin(t * 1.2) * 0.05; d.ts = s; go(yas.g, k);
    yas.g.rotation.y += (mouse.x * 0.5 + (st.mode === "method" ? 0.5 : 0) - yas.g.rotation.y) * k; yas.head.rotation.x = mouse.y * 0.2;
    const armZ = wave === 1 ? 2.45 + Math.sin(t * 7) * 0.28 : wave ? 1.75 : 0.22;
    yas.arms[1].rotation.z += (armZ - yas.arms[1].rotation.z) * k; }

  camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.05; camera.position.y += (-mouse.y * 0.3 - camera.position.y) * 0.05; camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);

  /* name chips: only in the opening scene on wide screens; Yassine's also in the last one */
  const names = live() && st.mode === "hero" && !narrow && sy < vh * 0.3;
  for (const ag of agents) chipAt(ag.chip, ag.g, 1.0 * ag.g.scale.x, names ? (ag.g.position.z < -0.2 ? 0.35 : 1) : 0);
  chipAt(yas.chip, yas.g, 1.2 * yas.g.scale.x, live() && ((st.mode === "hero" && sy < vh * 0.3) || st.mode === "final") ? 1 : 0);
}
function draw() { for (let i = 0; i < 3; i++) frame(0, 1); }      // still picture: settle every pose at once
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden || !live()) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  awayFor = (window.stageState || HERO).mode === "away" ? awayFor + dt : 0;
  if (awayFor > 1.2) return;                                        // hidden behind the solid sections: no drawing
  frame(dt, 1 - Math.exp(-dt * 4.5));
}
resize(); draw(); requestAnimationFrame(loop);
