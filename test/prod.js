'use strict';
/* Production hardening checks: vendored lib, meta tags, reduce-flash mode,
   auto-pause on blur, context-loss overlay, error overlay, perf degrade.   */
const fs = require('fs'), path = require('path');
const boot = require('./stubs');

let PASS = 0, FAIL = 0;
const ok = (c, l, x) => { if (c) { PASS++; console.log('  ok  ' + l); } else { FAIL++; console.log('  FAIL ' + l + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

console.log('== static: single-file build ==');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(/<script id="vendor-three">/.test(html), 'three.js is embedded inline');
ok(!/<script src="https?:/.test(html), 'no external script dependencies');
ok(/<meta name="description"/.test(html), 'meta description present');
ok(/<meta name="theme-color"/.test(html), 'theme-color present');
ok(/<link rel="icon"/.test(html), 'inline favicon present');
ok((html.match(/<\/script>/g) || []).length === 2, 'exactly two script blocks');

const { GAME: G, window: W } = boot();
const document = W.document;
const step = (n, dt) => { for (let i = 0; i < n; i++) G.update(dt || 1/60); };

console.log('== reduce-flash: zero-UI, OS preference only ==');
// engine damping still works, driven purely by state
G.state.reduceFx = true;
G.state.glitch = 0; G.debug.glitch(1.0);
ok(Math.abs(G.state.glitch - 0.35) < 1e-9, 'glitch spikes are damped to 35%', G.state.glitch);
G.state.reduceFx = false;
G.state.glitch = 0; G.debug.glitch(1.0);
ok(G.state.glitch === 1, 'full glitch when the mode is off', G.state.glitch);
// the title screen carries no flash-related UI at all (user decision)
ok(!document.getElementById('photoNote'), 'photo-warning sentence absent');
ok(!document.getElementById('fxToggle'), 'reduce-flashing checkbox absent');
// the OS-level prefers-reduced-motion preference still auto-enables the mode, invisibly
{
  const fresh = boot({ preBoot: w => {
    w.matchMedia = q => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q),
                           addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  }});
  ok(fresh.GAME.state.reduceFx === true, 'prefers-reduced-motion auto-enables reduce-flash');
}
G.state.glitch = 0;

console.log('== auto-pause on tab blur ==');
let hidden = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
// on the title screen: must NOT pause
hidden = true; document.dispatchEvent(new W.Event('visibilitychange'));
ok(!G.state.paused, 'no auto-pause on the title screen');
hidden = false;
G.start(); step(30);
hidden = true; document.dispatchEvent(new W.Event('visibilitychange'));
ok(G.state.paused, 'blur pauses mid-game');
ok(document.getElementById('pause').classList.contains('on'), 'pause screen shown');
const tFrozen = G.state.time; step(60);
ok(G.state.time === tFrozen, 'sim frozen while paused');
hidden = false; document.dispatchEvent(new W.Event('visibilitychange'));
ok(G.state.paused, 'returning does not auto-resume');
G.update(0);                       // settle
W.dispatchEvent(new W.KeyboardEvent('keydown', { code: 'KeyP' }));
W.dispatchEvent(new W.KeyboardEvent('keyup', { code: 'KeyP' }));
ok(!G.state.paused, 'P resumes after returning');

console.log('== WebGL context loss ==');
const canvas = document.querySelector('#stage canvas');
ok(!!canvas, 'renderer canvas mounted');
canvas.dispatchEvent(new W.Event('webglcontextlost', { cancelable: true }));
ok(document.getElementById('glFault').classList.contains('on'), 'fault overlay on loss');
ok(G.state.paused, 'sim paused on loss');
canvas.dispatchEvent(new W.Event('webglcontextrestored'));
ok(!document.getElementById('glFault').classList.contains('on'), 'overlay clears on restore');
ok(document.getElementById('pause').classList.contains('on'), 'lands on the pause screen, P to resume');
W.dispatchEvent(new W.KeyboardEvent('keydown', { code: 'KeyP' }));
W.dispatchEvent(new W.KeyboardEvent('keyup', { code: 'KeyP' }));
ok(!G.state.paused, 'resumes cleanly');

console.log('== runtime error overlay ==');
W.dispatchEvent(new W.ErrorEvent('error', { message: 'synthetic test fault' }));
ok(document.getElementById('glFault').classList.contains('on'), 'error shows the fault overlay');
ok(/synthetic test fault/.test(document.getElementById('glFaultTxt').textContent), 'message surfaced');
document.getElementById('glFault').classList.remove('on'); G.state.paused = false;

console.log('== adaptive performance ==');
const perf = G.debug.perf;
ok(perf.degraded === false, 'starts at full resolution');
for (let i = 0; i < 60 * 3; i++) G.debug.perfTick(12);
ok(perf.degraded === false && perf.slowStreak === 0, 'fast frames never degrade');
let fired = false;
for (let i = 0; i < 60 * 6; i++) if (G.debug.perfTick(33)) fired = true;
ok(fired && perf.degraded === true, 'sustained slow frames drop pixel ratio once');
fired = false;
for (let i = 0; i < 60 * 6; i++) if (G.debug.perfTick(33)) fired = true;
ok(!fired, 'degrade fires only once');

console.log('== text: research-backed minimalism ==');
// scope checks to the title-screen markup, not the embedded vendor lib
// (three.js is full of "Matrix4" etc., unrelated to the film)
const bootHtml = html.slice(0, html.indexOf('<script id="vendor-three">'));
// each reference work is named, and named FIRST (before the title)
ok(/NEUROMANCER/.test(bootHtml) && /SNOW CRASH/.test(bootHtml) && /THE MATRIX/.test(bootHtml) && /GHOST IN THE SHELL/.test(bootHtml),
   'all four reference works named on the title screen');
ok(bootHtml.indexOf('NEUROMANCER') < bootHtml.indexOf('<h1'), 'references appear before the title');
ok(!/NO TEXT FROM THESE WORKS/.test(bootHtml), 'no originality disclaimer on the title screen (kept in README/NOTICE)');
// marketese stripped from the lore line (NN/G: objective beats promotional)
ok(!/sixty-five thousand|other people's money/i.test(bootHtml), 'promotional lore copy removed');
// courier keeps the refusal beat in original words, no film quotes (apostrophe may be a unicode char)
ok(/scroll doesn.{0,8}t take no/i.test(html), 'courier refusal line present and original');
// the showHint signature carries the `once` flag (expertise-reversal mechanism)
ok(/function showHint\(txt, dur, once\)/.test(html), 'showHint supports once-only hints');
ok(/_hintSeen/.test(html), 'once-hint dedupe set present');

console.log('== version ==');
ok(G.debug.version === '1.0.0', 'version exposed', G.debug.version);
ok(/STREET PROTOCOL/.test(html.match(/<title>([^<]*)<\/title>/)[1]), 'title intact');

console.log('\nPASS ' + PASS + '  FAIL ' + FAIL);
process.exit(FAIL ? 1 : 0);
