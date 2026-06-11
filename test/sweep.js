'use strict';
/* Duel difficulty sweep: same fighter across N seeds. */
const boot = require('./stubs');
const fightStep = require('./bot');
let G;
const DT = 1/60;
const step = (n, dt) => { for (let i = 0; i < n; i++) G.update(dt || DT); };
const sec = (s) => step(Math.ceil(s / DT));
const clearKeys = () => { for (const k of ['w','a','s','d','shift','space','e','lmb','rmb']) G.input[k] = false; };
const tapE = () => { G.input.e = true; step(2); G.input.e = false; step(2); };

function runToDuel(){
  G.debug.warp(8, -2875); step(2); sec(3.5);
  G.debug.warp(2.8, -2924.5); clearKeys(); step(4);
  tapE(); let n = 0; while (G.state.phase === 'chat' && n++ < 10) tapE();
  sec(4.2);
  return G.state.phase === 'duel';
}

const seeds = [11, 42, 777, 1234, 31337, 5555, 90210, 246810];
let wins = 0;
const rows = [];
for (const sd of seeds) {
  ({ GAME: G } = boot());            // fresh world per seed: deterministic runs
  G.start(); G.seed(sd);
  if (!runToDuel()) { rows.push(sd + ': FAILED TO REACH DUEL'); continue; }
  clearKeys();
  const mem = {};
  let frames = 0, res = 'timeout', lastHp = 100;
  const src = { beam16: 0, lunge12: 0, glyph9: 0, wisp8: 0, blocked4: 0 };
  while (frames++ < 60 * 360) {
    const ss = fightStep(G, mem);
    const drop = lastHp - ss.player.hp; lastHp = ss.player.hp;
    if (drop === 16) src.beam16++; else if (drop === 12) src.lunge12++;
    else if (drop === 9) src.glyph9++; else if (drop === 8) src.wisp8++;
    else if (drop === 4) src.blocked4++;
    if (ss.phase === 'win') { res = 'WIN'; break; }
    if (ss.phase === 'dead') { res = 'dead'; break; }
    G.update(DT);
  }
  clearKeys();
  const s = G.snapshot();
  if (res === 'WIN') wins++;
  rows.push('seed ' + String(sd).padEnd(6) + res.padEnd(8) +
    ' duel ' + s.stats.duelT.toFixed(1) + 's  hp ' + String(s.player.hp).padStart(3) +
    '  dmg ' + String(Math.round(s.stats.dmgTaken)).padStart(3) +
    '  parry ' + s.stats.parries + ' block ' + s.stats.blocks + ' slash ' + s.stats.slashes +
    (res !== 'WIN' && s.boss ? '  bossHp ' + s.boss.hp : '') +
    '  [beam:' + src.beam16 + ' lunge:' + src.lunge12 + ' glyph:' + src.glyph9 + ' wisp:' + src.wisp8 + ' blk:' + src.blocked4 + ']');
}
console.log(rows.join('\n'));
console.log('\nwin rate: ' + wins + '/' + seeds.length);
process.exit(wins >= 6 ? 0 : 1);
