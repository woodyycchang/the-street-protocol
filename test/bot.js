'use strict';
/* Shared NULLSCROLL duel fighter — canonical v4 (best measured win rate).
   Call step(G, mem) once per frame before G.update(); mem = {} persisted by caller.
   - mid-ring positioning, alternating world-axis strafe
   - guard-cycle (re-tap RMB) while glyphs are inbound: most parry, the rest block free
   - slash through the cycle's open frames so melee never costs a parry
   - dash for lunges, firing beams, exposure gap-closing, rear wisps
   - chase integrity shards when hurt                                                   */
module.exports = function fightStep(G, m){
  if (m.guardCycle === undefined) Object.assign(m, { guardCycle: 0, lmbHold: 0, lmbCd: 0, dashCd: 0, frames: 0 });
  m.frames++;
  const ss = G.snapshot();
  const me = G.debug.refs.player.pos, bp = G.config.bossPos;
  const dB = Math.hypot(me.x - bp.x, me.z - bp.z);
  const exposed = ss.boss && ss.boss.exposed;

  const fl = Math.hypot(bp.x - me.x, bp.z - me.z) || 1;
  const fx = (bp.x - me.x) / fl, fz = (bp.z - me.z) / fl;
  const inFront = (x, z, halfArc) => {
    const dl = Math.hypot(x - me.x, z - me.z) || 1;
    return (fx * (x - me.x) / dl + fz * (z - me.z) / dl) > Math.cos(halfArc);
  };

  let lungeThreat = false, slashTarget = false, rearWisp = false;
  for (const e of G.debug.refs.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    if (e.kind === 'drone' && e.mode === 'lunge' && d < 4.5) lungeThreat = true;
    if (d < 3.1 && inFront(e.x, e.z, 1.3)) slashTarget = true;
    if (e.kind === 'wisp' && d < 1.9 && !inFront(e.x, e.z, 1.3)) rearWisp = true;
  }
  const glyphSoon = ss.enemyProjs.some(e => e.front && e.tti < 1.2);

  // movement: when hurt and a shard is on the floor, go get it (unless mid-exposure)
  let shard = null;
  if (!exposed && ss.player.hp < 75) {
    let best = 1e9;
    for (const sh of G.debug.refs.shards) if (sh.alive) {
      const d = Math.hypot(sh.x - me.x, sh.z - me.z);
      if (d < best) { best = d; shard = sh; }
    }
  }
  if (exposed) {
    G.input.w = dB > 3.2; G.input.s = false; G.input.a = false; G.input.d = false;
  } else if (shard) {
    const dx = shard.x - me.x, dz = shard.z - me.z;
    G.input.d = dx > 0.3; G.input.a = dx < -0.3;
    G.input.s = dz > 0.3; G.input.w = dz < -0.3;
  } else {
    G.input.w = dB > 12; G.input.s = dB < 7;
    const side = (m.frames % 360) < 180;
    G.input.a = side && !slashTarget; G.input.d = !side && !slashTarget;
  }

  // dash priority: incoming lunge > firing beam > closing an exposure gap > escaping a rear wisp
  let dash = false;
  if (m.dashCd <= 0 && !ss.player.dashing) {
    if (lungeThreat) { dash = true; m.dashCd = 20; }
    else if (ss.beam && ss.beam.mode === 'sweepFire' && ss.beam.willHit) { dash = true; m.dashCd = 26; }
    else if (exposed && dB > 7) { dash = true; m.dashCd = 70; }
    else if (rearWisp) { dash = true; m.dashCd = 40; }
  }
  G.input.space = dash;

  // defense first: whenever glyphs are inbound, keep the guard cycle running.
  // melee happens inside the cycle's 2-frame open windows, so swatting a wisp
  // never costs a parry.
  const wantMelee = (exposed && dB < 4.2) || slashTarget;
  const guardActive = glyphSoon;
  if (guardActive) { m.guardCycle = (m.guardCycle + 1) % 14; G.input.rmb = m.guardCycle >= 2; }
  else { G.input.rmb = false; m.guardCycle = 0; }

  // slash
  if (m.lmbHold > 0) { m.lmbHold--; if (!m.lmbHold) { G.input.lmb = false; m.lmbCd = 18; } }
  else if (m.lmbCd > 0) m.lmbCd--;
  else if (wantMelee && !G.input.rmb && (!guardActive || m.guardCycle <= 1)) { G.input.lmb = true; m.lmbHold = 2; }

  m.dashCd--;
  return ss;
};
