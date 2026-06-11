'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

module.exports = function bootGame(opts){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const dom = new JSDOM(html.replace(/<script src="https:[^"]*"><\/script>/, ''), {
    pretendToBeVisual: true, runScripts: 'outside-only', url: 'https://localhost/',
  });
  const window = dom.window, document = window.document;

  // permissive fake 2D context (textures are drawn, never read back headless)
  const fake2d = () => new Proxy({ canvas: {} }, {
    get(t, p){
      if (typeof p !== 'string') return undefined;
      if (p === 'canvas') return t.canvas;
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern')
        return () => ({ addColorStop(){} });
      if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      return () => {};
    },
    set(){ return true; },
    has(){ return true; },
  });
  window.HTMLCanvasElement.prototype.getContext = function(type){
    return type === '2d' ? fake2d() : null;
  };

  const THREE = require('three');
  class FakeRenderer {
    constructor(){ this.domElement = document.createElement('canvas'); this.shadowMap = { enabled: false, type: 0 }; this.outputEncoding = 3000; }
    setPixelRatio(){} setSize(){} setClearColor(){} render(){} dispose(){}
  }
  THREE.WebGLRenderer = FakeRenderer;

  window.THREE = THREE;
  window.__HEADLESS__ = true;

  const m = html.match(/<script id="game">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('game script not found in index.html');
  if (opts && typeof opts.preBoot === 'function') opts.preBoot(window);   // e.g. stub matchMedia before the game script runs
  const run = new Function('window', 'document', 'navigator', 'performance', 'requestAnimationFrame', m[1]);
  run(window, document, window.navigator, (typeof performance !== 'undefined' ? performance : { now: () => Date.now() }), () => {});

  if (!window.GAME) throw new Error('window.GAME was not exposed');
  return { GAME: window.GAME, window, document };
};
