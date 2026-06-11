'use strict';
/* Honest end-to-end run: no debug warps. Title -> 3km ride -> park -> walk -> courier -> duel -> win. */
const boot = require('./stubs');
const fightStep = require('./bot');
const { GAME: G, window: W } = boot();
const DT = 1/60;
let PASS = 0, FAIL = 0;
const ok = (c, l, x) => { if (c) { PASS++; console.log('  ok  ' + l); } else { FAIL++; console.log('  FAIL ' + l + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const step = (n, dt) => { for (let i = 0; i < n; i++) G.update(dt || DT); };
const sec = (s, dt) => step(Math.ceil(s / (dt || DT)), dt);
const key = (code, type) => W.dispatchEvent(new W.KeyboardEvent(type || 'keydown', { code, bubbles: true }));

G.seed(31337);

console.log('== title ambience ==');
sec(3);
ok(G.state.phase === 'title', 'title idles without errors');

console.log('== pause & mute via real key events ==');
G.start(); sec(0.5);
key('KeyP'); key('KeyP', 'keyup');
const tPaused = G.state.time; sec(1);
ok(G.state.paused && G.state.time === tPaused, 'P freezes the sim', { paused: G.state.paused });
ok(W.document.getElementById('pause').classList.contains('on'), 'pause screen up');
key('KeyP'); key('KeyP', 'keyup'); sec(0.2);
ok(!G.state.paused && G.state.time > tPaused, 'P resumes');
const muteTxt = W.document.getElementById('muteTag').textContent;
key('KeyM'); key('KeyM', 'keyup');
ok(W.document.getElementById('muteTag').textContent !== muteTxt, 'M toggles the mute tag');
key('KeyM'); key('KeyM', 'keyup');

let attempt = 0, won = false, fin = null, rideSec = 0, crashesTotal = 0, usedBoost = false;
while (attempt++ < 3 && !won) {
  if (attempt > 1) { console.log('   (derezzed; pressing REBOOT AVATAR, attempt ' + attempt + ')'); G.reset(); }

  console.log('== the full ride, hands on the bars (attempt ' + attempt + ') ==');
  key('KeyW');
  let crashes = 0, lastSpeed = 0, rideFrames = 0;
  while (G.state.phase === 'ride' && rideFrames++ < 60 * 180) {
    const s = G.snapshot();
    if (s.speedKmh < lastSpeed - 60) crashes++;          // big sudden loss = wall/pylon/traffic
    lastSpeed = s.speedKmh;
    if (s.bike.turbo > 2.6 && s.speedKmh > 120) { key('ShiftLeft'); usedBoost = true; }
    if (s.bike.turbo < 0.3) key('ShiftLeft', 'keyup');
    if (s.bike.x > 9.5) key('KeyA'); else key('KeyA', 'keyup');
    if (s.bike.x < 6.5) key('KeyD'); else key('KeyD', 'keyup');
    G.update(DT);
  }
  key('KeyW', 'keyup'); key('ShiftLeft', 'keyup'); key('KeyA', 'keyup'); key('KeyD', 'keyup');
  crashesTotal += crashes;
  if (attempt === 1) {
    ok(G.state.phase === 'arrive', 'rode the whole street to Club Eclipse', { phase: G.state.phase, frames: rideFrames });
    rideSec = +(rideFrames / 60).toFixed(1);
    ok(rideSec > 35 && rideSec < 120, 'ride length feels right (' + rideSec + 's for 2.9km)', rideSec);
  }
  sec(3.5);
  if (attempt === 1) ok(G.state.phase === 'plaza', 'parked and dismounted');

  console.log('== walking to the courier, no warp ==');
  let walkFrames = 0, found = false;
  while (walkFrames++ < 60 * 30) {
    const s = G.snapshot();
    if (s.nearestTalk && s.nearestTalk.id === 'courier' && s.nearestTalk.dist < 4.5) { found = true; break; }
    const me = G.debug.refs.player.pos;
    const tx = 3.2 - me.x, tz = -2925.2 - me.z;
    G.input.d = tx > 0.4; G.input.a = tx < -0.4;
    G.input.s = tz > 0.4; G.input.w = tz < -0.4;
    G.update(DT);
  }
  G.input.w = G.input.a = G.input.s = G.input.d = false;
  if (attempt === 1) ok(found, 'walked to the courier on real inputs', G.snapshot().nearestTalk);
  const tapE = () => { G.input.e = true; step(2); G.input.e = false; step(2); };
  tapE();
  if (attempt === 1) ok(G.state.phase === 'chat', 'courier speaks');
  let guard = 0; while (G.state.phase === 'chat' && guard++ < 10) tapE();
  if (attempt === 1) ok(G.state.phase === 'intro', 'the scroll comes out');
  sec(4.2);
  if (attempt === 1) ok(G.state.phase === 'duel', 'duel underway');

  console.log('== the duel, shared fighter ==');
  let frames = 0;
  const mem = {};
  while (frames++ < 60 * 360) {
    const ss = fightStep(G, mem);
    if (ss.phase === 'win') { won = true; break; }
    if (ss.phase === 'dead') break;
    G.update(DT);
  }
  for (const k of ['w','a','s','d','shift','space','e','lmb','rmb']) G.input[k] = false;
  fin = G.snapshot();
  if (!won) sec(2);                                      // let the defeat screen land before reboot
}
ok(crashesTotal === 0, 'clean riding, zero crashes in the cruising lane across attempts', crashesTotal);
ok(usedBoost, 'turbo used along the way');
ok(won, 'NULLSCROLL derezzed within 3 honest attempts', { attempts: attempt, hp: fin.player.hp, duelT: +fin.stats.duelT.toFixed(1) });
sec(4.5);
const gradeEl = W.document.getElementById('gradeTag').textContent;
ok(W.document.getElementById('screenWin').classList.contains('on'), 'win screen, stats, grade');
console.log('   run card: attempt ' + attempt + ' | duel ' + fin.stats.duelT.toFixed(1) + 's | parries ' + fin.stats.parries +
            ' | blocks ' + fin.stats.blocks + ' | slashes ' + fin.stats.slashes +
            ' | dmg ' + Math.round(fin.stats.dmgTaken) + ' | top ' + Math.round(fin.stats.topSpeed * 3.6) +
            ' km/h | met ' + fin.stats.talks + ' | grade ' + gradeEl);
ok(won && ['S','A','B','C'].includes(gradeEl), 'a win earns a real grade', gradeEl);

console.log('== expertise reversal: tutorial hints fade on replay ==');
{
  const toast = W.document.getElementById('hintToast');
  const fresh = boot();
  const G2 = fresh.GAME, D2 = fresh.window.document, T2 = D2.getElementById('hintToast');
  const fight = require('./bot');
  G2.seed(777); G2.start();
  const clear2 = () => { T2.textContent = ''; T2.classList.remove('on'); };
  const toDuel = () => {
    G2.debug.warp(8, -2875); for (let i = 0; i < 2; i++) G2.update(1/60);
    for (let i = 0; i < 210; i++) G2.update(1/60);
    G2.debug.warp(2.8, -2924.5); for (let i = 0; i < 4; i++) G2.update(1/60);
    for (const k of ['w','a','s','d','shift','space','e','lmb','rmb']) G2.input[k] = false;
    G2.input.e = true; G2.update(1/60); G2.update(1/60); G2.input.e = false; G2.update(1/60); G2.update(1/60);
    let g = 0; while (G2.state.phase === 'chat' && g++ < 10) { G2.input.e = true; G2.update(1/60); G2.update(1/60); G2.input.e = false; G2.update(1/60); G2.update(1/60); }
    for (let i = 0; i < 60 * 5; i++) { G2.update(1/60); if (G2.state.phase === 'duel') break; }
  };
  toDuel();
  let seen1 = false;
  for (let i = 0; i < 60; i++) { if (/PARRY/.test(T2.textContent)) seen1 = true; G2.update(1/60); }
  ok(seen1, 'first duel teaches the parry');
  const m2 = {}; let f2 = 0;
  while (f2++ < 60 * 360) { const ss = fight(G2, m2); if (ss.phase === 'win' || ss.phase === 'dead') break; G2.update(1/60); }
  for (const k of ['w','a','s','d','shift','space','e','lmb','rmb']) G2.input[k] = false;
  G2.reset(); clear2();
  toDuel();
  let seen2 = false;
  for (let i = 0; i < 60; i++) { if (/PARRY/.test(T2.textContent)) seen2 = true; G2.update(1/60); }
  ok(!seen2, 'replay does not re-teach the experienced player');
}

console.log('== 30Hz frame-rate independence ==');
G.reset(); G.seed(555);
G.input.w = true; sec(5, 1/30); G.input.w = false;
const s30 = G.snapshot();
ok(s30.speedKmh > 180 && Number.isFinite(s30.bike.z), 'physics behaves at 30 fps', s30.speedKmh);

console.log('\nPASS ' + PASS + '  FAIL ' + FAIL);
process.exit(FAIL ? 1 : 0);
