/* Headless smoke test — runs the real game logic in Node with a DOM shim,
   simulates cuts (straight through spawned objects) and reports any exception
   thrown inside the game loop, with a stack trace. Not shipped with the game. */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------- DOM / browser shims ---------- */
const created = [];                       // every element ever created (to find object-list cells)
const listeners = new Map();              // element -> {type:[fns]}
function reg(el){ if(!listeners.has(el)) listeners.set(el, {}); return listeners.get(el); }

function makeStyle(){ const s={ setProperty(){} }; return s; }
function makeCtx(){
  return new Proxy({}, {
    get(t, prop){
      if(prop==='canvas') return {width:8,height:8};
      if(prop==='getImageData') return ()=>({data:new Uint8ClampedArray(4),width:1,height:1});
      if(prop==='measureText') return ()=>({width:10});
      if(prop==='createLinearGradient'||prop==='createRadialGradient'||prop==='createPattern')
        return ()=>({addColorStop(){}});
      if(typeof prop==='string') return ()=>{};
    },
    set(){ return true; },
  });
}
function makeEl(tag){
  const el = {
    tagName:(tag||'div').toUpperCase(),
    style: makeStyle(),
    classList:{ add(){}, remove(){}, toggle(){}, contains:()=>false },
    dataset:{},
    addEventListener(type, fn){ reg(el)[type]=(reg(el)[type]||[]).concat(fn); },
    removeEventListener(){},
    getContext: makeCtx,
    children: [],
    appendChild(c){ this.children.push(c); created.push(c); return c; },
    insertBefore(c){ this.children.push(c); created.push(c); return c; },
    removeChild(){}, remove(){},
    querySelector: ()=>makeEl(), querySelectorAll: ()=>[],
    getBoundingClientRect: ()=>({left:0, top:0, width:200, height:60, right:200, bottom:60}),
    focus(){}, blur(){}, click(){},
    setPointerCapture(){}, releasePointerCapture(){},
    disabled:false, offsetWidth:0, value:'', innerHTML:'', textContent:'',
    width:0, height:0, title:'', name:'', className:'', id:'',
  };
  Object.defineProperty(el, 'firstChild', { get(){ return makeEl(); } });
  Object.defineProperty(el, 'firstElementChild', { get(){ return makeEl(); } });
  return el;
}
const byId = new Map();
const document = {
  getElementById(id){ if(!byId.has(id)) byId.set(id, makeEl('div')); return byId.get(id); },
  createElement(tag){ const el = makeEl(tag); created.push(el); return el; },
  querySelectorAll(){ return []; },
  querySelector(){ return makeEl(); },
  addEventListener(){},
  body: makeEl('body'),
  documentElement: makeEl('html'),
  fonts: {ready: Promise.resolve()},
};
document.body.appendChild = c=>{ created.push(c); return c; };
const store = {};
const localStorage = {
  getItem(k){ return store[k]!==undefined ? store[k] : null; },
  setItem(k,v){ store[k]=String(v); },
  removeItem(k){ delete store[k]; },
};
class ImageShim{ set src(v){ this._src=v; if(this.onerror) setImmediate(()=>this.onerror&&this.onerror()); } get src(){ return this._src; } }
let maxRate = 1;
class AudioShim{
  constructor(src){ this.src=src; this._vol=1; this._rate=1; this.currentTime=0; this.paused=true; this.ended=false; this.loop=false; this.preload=''; }
  addEventListener(){ }
  get volume(){ return this._vol; } set volume(v){ this._vol=v; }
  get playbackRate(){ return this._rate; }
  set playbackRate(r){                       // mimic real browsers: out-of-range rates THROW
    if(!(r>=.0625 && r<=16)) throw new Error('NotSupportedError: playback rate '+r+' is not supported');
    if(r>maxRate) maxRate=r;
    this._rate=r;
  }
  play(){ this.paused=false; return Promise.resolve(); }
  pause(){ this.paused=true; }
  load(){}
}
let rafQueue = [];
const requestAnimationFrame = cb=>{ rafQueue.push(cb); };
const cancelAnimationFrame = ()=>{};
let tNow = 0;
const gThis = {
  innerWidth:1920, innerHeight:1080, devicePixelRatio:1,
  addEventListener(type, fn){ reg(gThis)[type]=(reg(gThis)[type]||[]).concat(fn); },
  removeEventListener(){},
  localStorage, document,
  Image: ImageShim, Audio: AudioShim,
  performance: { now: ()=>tNow },
  requestAnimationFrame, cancelAnimationFrame,
  navigator:{ userAgent:'headless' },
  location:{ href:'file:///game/index.html', reload(){} },
  matchMedia: ()=>({ matches:false, addListener(){}, removeListener(){} }),
  setTimeout, clearTimeout, setInterval, clearInterval,
  console, Math, JSON, Promise,
};
gThis.window = gThis; gThis.self = gThis; gThis.globalThis = gThis;

/* ---------- run the game ---------- */
const src = fs.readFileSync(path.join(__dirname,'script.js'), 'utf8');
/* the tutorial already ran once — skip straight to the menu ambience
   (pitch variation cranked to 25% — the worst case for playback rates;
   cutsCur funded so THE LAB purchase works; valid up/stats so the perfil
   system adopts this save instead of starting fresh) */
store['sliced-v1'] = JSON.stringify({
  tut:true, mode:'zen', cutsCur:9999, up:{}, relics:[],
  dungeon:{ unlocked:10, done:{} },        // every floor reachable — the descent must be exercised
  stats:{cuts:0,best:0,runs:0,time:0,bombs:0},
  settings:{ volume:.7, pitchVar:25 },
});

const vm = require('vm');
const ctx = vm.createContext(gThis);
try{ vm.runInContext(src, ctx, {filename:'script.js'}); }
catch(e){ console.error('BOOT EXCEPTION:\n', e.stack); process.exit(1); }
console.log('boot: OK');

/* the user cranked SFX PITCH VARIATION to the max — simulate that slider input
   (this is what arms pitchSpread, exactly like moving the real slider) */
const pvar = byId.get('s-pvar');
pvar.value = '25';
dispatch(pvar, 'input', { target: pvar });
console.log('pitch slider cranked to 25%');

function dispatch(el, type, ev){
  const m = listeners.get(el); if(!m || !m[type]) return;
  for(const fn of m[type]) fn(ev);
}
function fire(type, ev){
  dispatch(gThis, type, Object.assign({pointerId:1, pointerType:'mouse', button:0, timeStamp:tNow}, ev));
}
function frames(n){
  for(let i=0;i<n;i++){
    tNow += 16.7;
    const q = rafQueue; rafQueue = [];
    for(const cb of q){
      try{ cb(tNow); }catch(e){ console.error('FRAME EXCEPTION @t='+tNow.toFixed(0)+'ms:\n', e.stack); process.exit(1); }
    }
  }
}
function drag(x0,y0,x1,y1){
  dispatch(byId.get('game'), 'pointerdown', {pointerId:1, pointerType:'mouse', button:0, clientX:x0, clientY:y0, timeStamp:tNow});
  fire('pointermove', {clientX:x1, clientY:y1, timeStamp:tNow+16});
  fire('pointerup', {});
}

/* let the menu ambience spawn fruit, then cut across the whole screen */
frames(400);                       // ~6.7s of menu → ambient fruits in flight
console.log('ambient frames: OK');
for(const y of [200, 400, 600, 800]) drag(60, y, 1860, y);
frames(30);
console.log('generic cuts: OK');

/* spawn EVERY object via the object list (QA gallery) and cut through them */
try{ byId.get('b-objects').onclick(); }catch(e){ console.error('OBJECT LIST EXCEPTION:\n', e.stack); process.exit(1); }
/* object cells ONLY — blindly clicking every onclick element would now trip the
   DUNGEON mode button / BEGIN (opens the floor grid) / AGAIN (starts floors) */
const cells = created.filter(el=>typeof el.className==='string' && el.className.indexOf('obj-cell')===0 && typeof el.onclick==='function');
console.log('object cells:', cells.length);
for(const c of cells){ try{ c.onclick(); }catch(e){ console.error('SPAWN EXCEPTION:\n', e.stack); process.exit(1); } }
frames(60);                        // let them fly up
for(const y of [180, 360, 540, 720, 900]) drag(60, y, 1860, y);
frames(240);                       // fragments live, render and die
console.log('material cuts (jag + shards): OK');

/* start a real run and grow a big combo — this is where the combo pitch
   ladder meets the pitch-variation slider (the reported freeze) */
/* --- THE LAB: now a per-trail tree — reached from the SHOP, one bionic
   tree button per trail; buy a mastering level for the first blade --- */
try{ byId.get('b-shop').onclick(); }catch(e){ console.error('SHOP OPEN EXCEPTION:\n', e.stack); process.exit(1); }
const labOpens = created.filter(el=>el.className==='lab-open' && typeof el.onclick==='function');
console.log('lab tree buttons (one per trail):', labOpens.length);
if(!labOpens.length){ console.error('LAB OPEN BUTTONS MISSING'); process.exit(1); }
try{ labOpens[0].onclick(); }catch(e){ console.error('LAB OPEN EXCEPTION:\n', e.stack); process.exit(1); }
const labBtns = created.filter(el=>el.className==='lab-buy' && typeof el.onclick==='function');
console.log('lab buy buttons:', labBtns.length);
if(labBtns.length){ try{ labBtns[0].onclick(); }catch(e){ console.error('LAB BUY EXCEPTION:\n', e.stack); process.exit(1); } }
const upSave = JSON.parse(store['sliced-v1']||'{}');
console.log('DIAG: trailUp after lab buy =', JSON.stringify(upSave.trailUp||{}), '| cutsCur =', upSave.cutsCur);

/* --- DUNGEON: pick the mode, walk the floor grid, clear floor 1 (pineapple
   goal), then floor 3 — 100 objects, THE OBJECT MONSTER, hazards & all --- */
const dgBtn = created.find(el=>el.className==='mode' && (el.textContent||'')==='DUNGEON' && typeof el.onclick==='function');
if(!dgBtn){ console.error('DUNGEON MODE BUTTON NOT FOUND'); process.exit(1); }
try{ dgBtn.onclick(); }catch(e){ console.error('DUNGEON MODE EXCEPTION:\n', e.stack); process.exit(1); }
const dgCells = created.filter(el=>typeof el.className==='string' && el.className.indexOf('dg-cell')===0 && typeof el.onclick==='function');
console.log('dungeon floor buttons:', dgCells.length);
if(dgCells.length<10){ console.error('DUNGEON FLOOR GRID INCOMPLETE'); process.exit(1); }
try{ byId.get('b-dg-back').onclick(); }catch(e){ console.error('DUNGEON BACK EXCEPTION:\n', e.stack); process.exit(1); }
try{ gThis.startDungeonLevel(1); }catch(e){ console.error('DUNGEON FLOOR 1 EXCEPTION:\n', e.stack); process.exit(1); }
/* carve until the results screen exists (clear or death) — pineapples spawn on chance */
for(let w=0; w<80 && !byId.has('go-title'); w++){ frames(10); for(const y of [200,400,600,800]) drag(60,y,1860,y); }
frames(60);                                     // the results headline settles
console.log('DIAG: over title =', (byId.get('go-title')||{textContent:'(floor still live)'}).textContent);
console.log('dungeon floor 1 (pineapple goal + leaf-spike hazards): OK');
try{ gThis.startDungeonLevel(3); }catch(e){ console.error('DUNGEON FLOOR 3 EXCEPTION:\n', e.stack); process.exit(1); }
for(let w=0; w<14; w++){ frames(10); for(const y of [200,500,800]) drag(60,y,1860,y); }   // keep cutting — misses cost lives
for(let i=0;i<100;i++) gThis.dgCount({ id:'apple', fruit:true });   // force the goal — the boss wakes
frames(40);                                      // THE OBJECT MONSTER enters
for(let k=0;k<26;k++){                           // carve him — spaced strokes for the hit cooldown
  frames(26); drag(880,300,1040,340); gThis.bossHit();
  for(const y of [220,540,860]) drag(60,y,1860,y);                 // catch his falling fruit too
}
frames(160);                                     // dying smoke → the floor clears
console.log('DIAG: floor-3 result =', byId.get('go-title').textContent,
            '| earned =', byId.get('go-earn').textContent);
console.log('dungeon floor 3 + THE OBJECT MONSTER (spikes · fruitfall · bulbs · bombs · ants · spin): OK');

/* --- CUSTOM mode: select + tune + run --- */
const customBtn = created.find(el=>typeof el.onclick==='function' && (el.textContent||'')==='CUSTOM');
if(!customBtn){ console.error('CUSTOM MODE BUTTON NOT FOUND'); process.exit(1); }
try{ customBtn.onclick(); }catch(e){ console.error('CUSTOM MODE EXCEPTION:\n', e.stack); process.exit(1); }
const sliders = created.filter(el=>el.tagName==='INPUT' && el.type==='range').slice(-7);
if(sliders.length<7){ console.error('CUSTOM SLIDERS MISSING'); process.exit(1); }
sliders[1].value = '160';                       // crank one percent slider → 160%
dispatch(sliders[1], 'input', { target: sliders[1] });
const cuSave = JSON.parse(store['sliced-v1']||'{}');
const pctKey = cuSave.custom && Object.keys(cuSave.custom).find(k=>cuSave.custom[k]===1.6);
console.log('DIAG: custom 160% stored on:', pctKey||'NOTHING', '| mode =', cuSave.mode);
try{ byId.get('b-custom-back').onclick(); }catch(e){ console.error('CUSTOM BACK EXCEPTION:\n', e.stack); process.exit(1); }

/* --- PERFIS: open the manager + back (switch/new reload in a real browser) --- */
try{ byId.get('b-perfil').onclick(); byId.get('b-perfil-back').onclick(); }
catch(e){ console.error('PERFIL EXCEPTION:\n', e.stack); process.exit(1); }
console.log('perfis UI: OK');

const cells2 = cells;
for(let round=0; round<3; round++){
  try{ byId.get('b-start').onclick(); }catch(e){ console.error('START RUN EXCEPTION:\n', e.stack); process.exit(1); }
  frames(60);                      // zen volleys launch fruit
  for(let wave=0; wave<30; wave++){
    for(const y of [160, 320, 480, 640, 800]) drag(40, y, 1880, y);
    frames(20);                     // combo window stays alive — combo climbs past 20
  }
}
console.log('run with big combo: OK');
const saved = JSON.parse(store['sliced-v1']||'{}');
console.log('DIAG: total cuts saved =', (saved.stats&&saved.stats.cuts)||0,
            '| best combo =', (saved.stats&&saved.stats.best)||0,
            '| pitchVar =', saved.settings && saved.settings.pitchVar,
            '| max playbackRate requested =', maxRate.toFixed(2)+'x (must stay <= 8x)');

frames(600);
console.log('PASS — no exceptions in the game loop');
process.exit(0);

