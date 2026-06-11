'use strict';
/* STREET PROTOCOL — headless playthrough harness.
   Runs the real game logic at 60 Hz with scripted inputs and asserts on GAME.snapshot(). */
const boot = require('./stubs');
const fightStep = require('./bot');

let PASS = 0, FAIL = 0;
const failures = [];
function ok(cond, label, extra){
  if (cond) { PASS++; console.log('  ok  ' + label); }
  else { FAIL++; failures.push(label); console.log('  FAIL ' + label + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}
function scene(name){ console.log('\n== ' + name + ' =='); }

const DT = 1/60;
let G, W;

function step(n, dt){ dt = dt || DT; for (let i = 0; i < n; i++) G.update(dt); }
function stepSec(s, dt){ step(Math.ceil(s / (dt || DT)), dt); }
function hold(keys, on){ for (const k of keys) G.input[k] = on; }
function tap(k){ G.input[k] = true; G.update(DT); G.input[k] = false; G.update(DT); }
/* hold a key for n frames, then release and settle (hitstop-proof) */
function pressFor(k, n){ G.input[k] = true; step(n); G.input[k] = false; step(2); }
function clearKeys(){ for (const k of ['w','a','s','d','shift','space','e','lmb','rmb']) G.input[k] = false; }
function snap(){ return G.snapshot(); }
function until(cond, maxSec, dt){
  dt = dt || DT;
  const n = Math.ceil(maxSec / dt);
  for (let i = 0; i < n; i++) { if (cond()) return true; G.update(dt); }
  return cond();
}

/* drive the story to the duel start; assumes fresh reset */
function runToDuel(){
  G.debug.warp(8, -2875);
  step(2);                                  // triggers arrive
  if (G.state.phase !== 'arrive') return false;
  stepSec(3.5);                             // auto-park, dismount
  if (G.state.phase !== 'plaza') return false;
  G.debug.warp(2.8, -2924.5);               // next to the courier
  clearKeys();
  if (!until(() => snap().nearestTalk && snap().nearestTalk.id === 'courier', 1)) return false;
  tap('e');                                 // open
  if (G.state.phase !== 'chat') return false;
  tap('e'); tap('e'); tap('e');             // 3 lines -> close -> intro
  if (G.state.phase !== 'intro') return false;
  stepSec(4.0);
  return G.state.phase === 'duel';
}

/* ---------------------------------------------------------------- */
({ GAME: G, window: W } = boot());
G.seed(20260610);

scene('S1 boot');
ok(G.state.phase === 'title', 'starts on title');
G.start();
ok(G.state.phase === 'ride', 'JACK IN -> ride');
ok(W.document.getElementById('hud').classList.contains('on'), 'HUD visible');
ok(W.document.getElementById('boot').style.display === 'none', 'boot screen hidden');
stepSec(1);
let s = snap();
ok(s.speedKmh === 0 && s.bike.z === -4 && s.bike.x === 8, 'bike idle at the start line, off the pylon row', s.bike);

scene('S2 throttle and distance');
hold(['w'], true); stepSec(6);
s = snap();
ok(s.speedKmh > 180, 'speed builds past 180 km/h', s.speedKmh);
ok(s.bike.z < -150, 'covered real distance', s.bike.z);
ok(Math.abs(s.bike.yaw) < 0.01, 'no drift without steering', s.bike.yaw);
hold(['s'], true); hold(['w'], false); stepSec(3); hold(['s'], false);
ok(snap().speedKmh < 15, 'brakes shed speed', snap().speedKmh);

scene('S3 steering');
hold(['w'], true); stepSec(2);
const x0 = snap().bike.x;
hold(['a'], true); stepSec(0.8); hold(['a'], false);
s = snap();
ok(s.bike.x < x0 - 2, 'A leans left (x decreases)', { x0, x: s.bike.x });
ok(s.bike.yaw > 0.05 && s.bike.yaw <= 1.15, 'yaw within arcade clamp', s.bike.yaw);
hold(['d'], true); stepSec(1.6); hold(['d'], false);
ok(snap().bike.yaw < 0.1, 'D steers back', snap().bike.yaw);

scene('S4 turbo');
hold(['w','shift'], true);
ok(until(() => snap().speedKmh > 250, 4), 'boost exceeds normal top speed', snap().speedKmh);
const turboMid = snap().bike.turbo;
ok(turboMid < 2.85, 'turbo meter drains', turboMid);
hold(['shift'], false); stepSec(3);
s = snap();
ok(s.speedKmh <= Math.round(G.config.bikeMax * 3.6) + 2, 'speed settles back to vmax', s.speedKmh);
ok(s.bike.turbo > turboMid, 'turbo regenerates', s.bike.turbo);

scene('S5 walls and collisions');
G.state.freeRide = true;                       // suppress story arrival for physics checks
hold(['w','d'], true); stepSec(4);
s = snap();
ok(s.bike.x <= 59.5 && s.bike.x >= -59.5, 'lateral clamp holds', s.bike.x);
hold(['d'], false);
// head-on into the club wall: speed must die, position must stay outside the collider
G.debug.warp(0, -2960); G.state.freeRide = true;
hold(['w'], true);
until(() => snap().speedKmh < 30 && snap().bike.z < -2980, 6);
s = snap();
hold(['w'], false);
ok(s.bike.z >= -2990.0, 'club wall stops the bike', s.bike.z);
ok(s.speedKmh < 60, 'crash bleeds speed', s.speedKmh);
ok(Number.isFinite(s.bike.x) && Number.isFinite(s.bike.z), 'position stays finite');

scene('S6 world population');
const refs = G.debug.refs;
ok(refs.traffic.length >= 30, 'traffic spawned', refs.traffic.length);
ok(refs.walkers.length >= 25, 'crowd spawned', refs.walkers.length);
ok(refs.specials.length >= 8, 'all story avatars present', refs.specials.length);
let finite = true;
for (const v of refs.traffic) if (!Number.isFinite(v.z) || !Number.isFinite(v.grp.position.x)) finite = false;
for (const wk of refs.walkers) if (!Number.isFinite(wk.x) || !Number.isFinite(wk.z)) finite = false;
ok(finite, 'every actor at a finite position');

scene('S7 dialog with the archive daemon');
G.reset();
G.debug.warp(40, -56);
clearKeys(); step(2);
s = snap();
ok(s.nearestTalk && s.nearestTalk.id === 'archive', 'prompt finds the daemon', s.nearestTalk);
ok(W.document.getElementById('prompt').classList.contains('on'), 'TALK prompt shown');
tap('e');
ok(G.state.phase === 'chat', 'dialog opens, ride pauses');
const line0 = W.document.getElementById('dlgText').textContent;
tap('e');
ok(W.document.getElementById('dlgText').textContent !== line0, 'E advances the line');
for (let i = 0; i < 8 && G.state.phase === 'chat'; i++) tap('e');
ok(G.state.phase === 'ride', 'dialog closes back to ride');
ok(snap().stats.talks === 1, 'avatar counted as met', snap().stats.talks);
ok(!W.document.getElementById('dialog').classList.contains('on'), 'dialog panel hidden');

scene('S8 arrival at Club Eclipse');
G.reset();
G.debug.warp(8, -2875);
step(2);
ok(G.state.phase === 'arrive', 'arrival cinematic triggers');
stepSec(3.5);
s = snap();
ok(G.state.phase === 'plaza', 'on foot in the forecourt');
ok(!s.bike.mounted, 'dismounted');
ok(Math.abs(s.bike.x - G.config.parkPos.x) < 1.5 && Math.abs(s.bike.z - G.config.parkPos.z) < 1.5, 'bike parked at the rope', s.bike);
// walking works
hold(['a'], true); stepSec(0.5); hold(['a'], false);
ok(snap().player.x < s.player.x, 'WASD walking moves the avatar');
// confinement on foot
G.debug.warp(0, -2986); hold(['w'], true); stepSec(1.5); hold(['w'], false);
ok(snap().player.z >= -2987.6, 'club wall blocks walking', snap().player.z);

scene('S9 the courier and the unfurling');
G.debug.warp(2.8, -2924.5); clearKeys(); step(2);
s = snap();
ok(s.nearestTalk && s.nearestTalk.id === 'courier', 'courier in range', s.nearestTalk);
tap('e');
ok(G.state.phase === 'chat', 'courier dialog opens');
tap('e'); tap('e'); tap('e');
ok(G.state.phase === 'intro', 'refusing the scroll starts the intro');
stepSec(2.0);
s = snap();
ok(s.boss && !s.boss.dead, 'NULLSCROLL activates', s.boss);
ok(s.barrier === true, 'arena barrier rises');
ok(snap().nearestTalk === null || snap().nearestTalk.id !== 'courier', 'courier derezzed');
stepSec(2.0);
ok(G.state.phase === 'duel', 'duel begins');
ok(W.document.getElementById('bossWrap').classList.contains('on'), 'boss bar shown');

scene('S10 combat oracles');
clearKeys();
function cleanRoom(){ G.debug.calmBoss(); G.debug.clearWave(); clearKeys(); stepSec(0.6); G.debug.clearWave(); }

// a) raw projectile hit
cleanRoom();
let hp0 = snap().player.hp;
let p = snap().player;
G.debug.proj(p.x, p.z - 7, 0, 1, { homing: true });
ok(until(() => snap().player.hp < hp0, 2), 'unguarded glyph deals damage');
ok(hp0 - snap().player.hp === 9, 'glyph hit costs 9 integrity', hp0 - snap().player.hp);

// b) block (guard held early, well outside the parry window)
cleanRoom();
hp0 = snap().player.hp; p = snap().player;
const blocks0 = snap().stats.blocks;
G.input.rmb = true; stepSec(0.3);            // guard settled, parry window long gone
G.debug.proj(p.x, p.z - 6, 0, 1, { homing: true });
until(() => snap().enemyProjs.length === 0, 2);
G.input.rmb = false; step(2);
ok(snap().player.hp === hp0, 'held guard blocks a glyph for free', hp0 - snap().player.hp);
ok(snap().stats.blocks > blocks0, 'block recorded', snap().stats.blocks);

// c) parry converts the glyph and punishes the boss
cleanRoom();
hp0 = snap().player.hp; p = snap().player;
const bossHp0 = snap().boss.hp, parries0 = snap().stats.parries, stacks0 = snap().boss.stacks;
G.debug.proj(p.x, p.z - 9, 0, 1, { homing: true, speed: 13 });
for (let i = 0; i < 600; i++) {
  const e = snap().enemyProjs;
  if (e.length && e[0].tti < 0.12) { pressFor('rmb', 8); break; }
  G.update(DT);
}
ok(snap().stats.parries > parries0, 'tap-and-hold RMB parries', snap().stats.parries);
ok(snap().player.hp === hp0, 'parry takes no damage');
ok(until(() => snap().boss.hp < bossHp0, 3), 'reflected glyph homes into the boss', { before: bossHp0, after: snap().boss && snap().boss.hp });
ok((snap().boss.stacks || 0) > stacks0 || snap().boss.exposed, 'expose stack granted', snap().boss);

// d) dash i-frames
cleanRoom();
hp0 = snap().player.hp; p = snap().player;
G.debug.proj(p.x, p.z - 5, 0, 1, { homing: true, speed: 16 });
for (let i = 0; i < 600; i++) {
  const e = snap().enemyProjs;
  if (e.length && e[0].tti < 0.16 && !snap().player.dashing) { pressFor('space', 2); }
  G.update(DT);
  if (!snap().enemyProjs.length) break;
}
stepSec(0.3);
ok(snap().player.hp === hp0, 'dash phases through the glyph', hp0 - snap().player.hp);

// e) slash kills a wisp and registers
cleanRoom();
p = snap().player;
const facing = Math.atan2(-(G.config.bossPos.x - p.x), -(G.config.bossPos.z - p.z));
G.debug.spawnWisp(p.x - Math.sin(facing) * 2.2, p.z - Math.cos(facing) * 2.2);
const wisps0 = snap().counts.wisps, slashes0 = snap().stats.slashes;
ok(wisps0 >= 1, 'oracle wisp spawned', snap().counts);
pressFor('lmb', 2); stepSec(0.3);
ok(snap().counts.wisps < wisps0, 'katana slash derezzes a wisp', snap().counts);
ok(snap().stats.slashes > slashes0, 'slash recorded', snap().stats.slashes);

// f) drone lunge parried into a stun
cleanRoom();
p = snap().player;
const drone = G.debug.spawnDrone(p.x + 6, p.z + 6);
let stunned = false;
for (let i = 0; i < 60 * 14; i++) {
  if (drone.alive && drone.mode === 'lunge' && !G.input.rmb) {
    const me = G.debug.refs.player.pos;
    const d = Math.hypot(drone.x - me.x, drone.z - me.z);
    if (d < 2.6) { G.input.rmb = true; G.update(DT); setTimeoutFrames = 8; }
  }
  if (G.input.rmb && --setTimeoutFrames <= 0) G.input.rmb = false;
  G.update(DT);
  if (drone.stunT > 0) { stunned = true; break; }
  if (!drone.alive) break;
}
var setTimeoutFrames = 0;
clearKeys();
ok(stunned, 'parrying a drone lunge stuns it', { alive: drone.alive, mode: drone.mode, stun: drone.stunT });
G.debug.refs.boss.atkCd = 2.0;               // wake the boss back up

scene('S11 full duel — shared fighter wins');
({ GAME: G, window: W } = boot());   // pristine world: deterministic fight for this seed
G.start(); G.seed(777);
ok(runToDuel(), 'fast path reaches the duel');
clearKeys();
const t0 = G.state.time;
let won = false, frames = 0;
const mem = {};
while (frames++ < 60 * 360) {
  const ss = fightStep(G, mem);
  if (ss.phase === 'win') { won = true; break; }
  if (ss.phase === 'dead') break;
  G.update(DT);
}
clearKeys();
s = snap();
ok(won, 'fighter defeats NULLSCROLL', { phase: s.phase, hp: s.player.hp, bossHp: s.boss && s.boss.hp, simSec: +(G.state.time - t0).toFixed(1), parries: s.stats.parries, blocks: s.stats.blocks });
ok(s.player.hp > 0, 'fighter survives', s.player.hp);
ok(s.stats.parries >= 3, 'parries happened en route', s.stats.parries);
ok(s.barrier === false, 'barrier falls on victory');
stepSec(4.5);   // boss death plays a 1.1s slow-mo at 0.25x before the 2.2s screen timer
ok(W.document.getElementById('screenWin').classList.contains('on'), 'victory screen shows');
const grade = W.document.getElementById('gradeTag').textContent;
ok(['S','A','B','C'].includes(grade), 'grade computed', grade);
ok(/DUEL TIME/.test(W.document.getElementById('statsWin').innerHTML), 'stat sheet filled');

scene('S11b free ride after the win');
G.freeRide();
ok(G.state.phase === 'ride' && snap().freeRide === true, 'free ride starts');
hold(['w'], true); stepSec(4); hold(['w'], false);
s = snap();
ok(s.bike.z < -60, 'street is open again', s.bike.z);
ok(s.boss === null, 'no boss in free ride');
G.debug.warp(8, -2875); step(4);
ok(G.state.phase === 'ride', 'no forced arrival in free ride', G.state.phase);

scene('S12 defeat and clean restarts');
for (let round = 0; round < 2; round++) {
  G.reset(); G.seed(99 + round);
  ok(runToDuel(), 'r' + round + ': reached duel');
  clearKeys();
  G.debug.setHp(5);
  const me = G.debug.refs.player.pos;
  G.debug.proj(me.x, me.z - 5, 0, 1, { homing: true, speed: 18 });
  until(() => G.state.phase === 'dead', 4);
  ok(G.state.phase === 'dead', 'r' + round + ': lethal hit derezzes the player');
  stepSec(1.8);
  ok(W.document.getElementById('screenDead').classList.contains('on'), 'r' + round + ': defeat screen shows');
  G.reset();
  s = snap();
  ok(s.phase === 'ride' && s.player.hp === 100 && s.boss === null && s.barrier === false &&
     s.counts.projs === 0 && s.counts.wisps === 0 && s.counts.drones === 0 &&
     s.bike.mounted && s.bike.z === -4 && s.stats.parries === 0,
     'r' + round + ': reset restores a fresh run', s);
  ok(!W.document.getElementById('screenDead').classList.contains('on'), 'r' + round + ': defeat screen cleared');
}
// the courier must be back for the rerun
G.debug.warp(8, -2875); step(2); stepSec(3.5);
G.debug.warp(2.8, -2924.5); clearKeys(); step(2);
ok(snap().nearestTalk && snap().nearestTalk.id === 'courier', 'courier respawned after reset', snap().nearestTalk);

scene('S13 two-minute fuzz soak');
G.reset(); G.seed(424242);
const KEYS = ['w','a','s','d','shift','space','e','lmb','rmb'];
let crashed = null, resets = 0;
try {
  const FR = 60 * 120;
  for (let i = 0; i < FR; i++) {
    if (i % 13 === 0) { const k = KEYS[(Math.random() * KEYS.length) | 0]; G.input[k] = !G.input[k]; }
    if (i % 1700 === 0 && i) { G.debug.warp(Math.random() * 100 - 50, -Math.random() * 2980); }
    G.update(i % 3 === 0 ? 1/30 : DT);
    if (G.state.phase === 'dead' || G.state.phase === 'win') { resets++; clearKeys(); G.reset(); }
    if (i % 240 === 0) {
      const c = snap();
      if (!Number.isFinite(c.bike.x + c.bike.z + c.player.x + c.player.z)) throw new Error('non-finite position at frame ' + i);
      if (c.player.hp < 0 || c.player.hp > 100) throw new Error('hp out of range: ' + c.player.hp);
      if (c.counts.projs > 80 || c.counts.wisps + c.counts.drones > 20) throw new Error('pool overflow ' + JSON.stringify(c.counts));
    }
  }
} catch (e) { crashed = e; }
ok(!crashed, 'no exceptions, finite state, bounded pools across 120s of chaos', crashed && String(crashed));
console.log('   (fuzz forced ' + resets + ' resets)');

/* ---------------------------------------------------------------- */
console.log('\n==============================');
console.log('PASS ' + PASS + '  FAIL ' + FAIL);
if (FAIL) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('ALL GREEN');
