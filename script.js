'use strict';
/* =====================================================================
   SLICED — a minimalist samurai slicing game.
   Systems: input · trail(+per-trail FX & perks) · object registry ·
            cutting · FX · damage feedback · audio · dual economy
            (¥ + CUT currency) · modes · difficulty · settings ·
            preview (+cut demo, zoom, speed) · status · UI · state machine.
   ===================================================================== */

/* ---------------- utils ---------------- */
const TAU = Math.PI*2;
const INK = '#101010';
const clamp = (v,a,b)=> v<a?a : v>b?b : v;
const rand  = (a=1,b)=> b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const pick  = a => a[Math.random()*a.length|0];
const fmt   = n => Math.round(n).toLocaleString('en-US');
const $     = id => document.getElementById(id);
function fmtTime(s){
  s = Math.floor(s||0);
  const h=(s/3600)|0, m=((s%3600)/60)|0, x=s%60;
  if(h) return h+'h '+String(m).padStart(2,'0')+'m';
  if(m) return m+'m '+String(x).padStart(2,'0')+'s';
  return x+'s';
}

/* ---------------- canvas ---------------- */
const cv = $('game'), ctx = cv.getContext('2d');
let W=0, H=0, DPR=1;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  W = innerWidth; H = innerHeight;
  cv.width = W*DPR; cv.height = H*DPR;
  /* CSS size must match the viewport, or the canvas renders at its intrinsic
     (DPR-scaled) size on hi-DPI screens and the game cursor drifts away from
     the real mouse — the further from the top-left corner, the bigger the gap. */
  cv.style.width = W+'px'; cv.style.height = H+'px';
}
addEventListener('resize', resize); resize();

/* ---------------- save / progression ---------------- */
const SAVE_KEY = 'sliced-v1';
const UPGRADES = [
  { id:'window',  name:'COMBO WINDOW', desc:'the combo meter drains more slowly',     vals:[1.6,2.0,2.4,2.8], prices:[0,300000,1200000,5000000], fmt:v=>v.toFixed(1)+'s' },
  { id:'fortune', name:'BLADE FORTUNE',desc:'every cut pays a little more',           vals:[1,1.1,1.2,1.3],   prices:[0,250000,1000000,4000000], fmt:v=>'×'+v.toFixed(2) },
  { id:'fate',    name:'FATE',         desc:'strange objects appear more often',      vals:[1,1.35,1.7,2.1],  prices:[0,400000,1500000,6000000], fmt:v=>'×'+v.toFixed(2) },
  { id:'edge',    name:'EDGE',         desc:'the blade reaches a few pixels further', vals:[0,2,4],           prices:[0,300000,1200000,5000000], fmt:v=>'+'+v+'px' },
];
/* trails: bought with CUT currency — every blade 500 cuts, none above the rest */
const TRAILS = [
  { id:'ink',      name:'SUMI',     color:'#101010', price:0,   life:270, desc:'pure ink — stains linger twice as long' },
  { id:'crimson',  name:'CRIMSON',  color:'#c2202e', price:500, life:270, desc:'blood scent — every 30 fruits cut restores 1 life' },
  { id:'ghost',    name:'GHOST',    color:'#8f9499', price:500, life:270, desc:'faint steel — the combo endures 60% longer' },
  { id:'frost',    name:'FROST',    color:'#6f9cc4', price:500, life:270, desc:'cold heart — slow-time lasts 50% longer' },
  { id:'gold',     name:'GOLD LEAF',color:'#c99a1e', price:500, life:270, desc:'gilded edge — every cut pays ×1.5' },
  { id:'fire',     name:'FIRE',     color:'#d96b2a', price:500, life:430, desc:'a longer blade — ignites whatever it touches' },
  { id:'universe', name:'GALAXY',   color:'#241a4a', line:'#cbb2ff', price:500, life:270, desc:'galaxy glass — drags the world toward it, novas on contact' },
  { id:'lightning',name:'LIGHTNING',color:'#4db8ff', line:'#eaffff', price:500, life:270, desc:'storms leap — each cut arcs to a neighbor' },
  { id:'liquid',   name:'INK',      color:'#0b0b0d', price:500, life:340, desc:'black water — heavy splash, no tricks' },
  { id:'wind',     name:'WIND',     color:'#b9bec4', price:500, life:200, desc:'nearly unseen — huge swings shove the world away' },
  { id:'nature',   name:'NATURE',   color:'#3f7d3a', price:500, life:290, desc:'living vine — cuts seed snares that slow neighbors' },
  { id:'magnet',   name:'MAGNET',   color:'#7a7f87', line:'#e8eaee', price:500, life:270, desc:'aimed pull — coins cannot resist it' },
  { id:'mirror',   name:'MIRROR',   color:'#c0c4ca', line:'#ffffff', price:500, life:270, desc:'silvered glass — every victim leaves a fading twin' },
  { id:'time',     name:'TIME',     color:'#8a6d3b', price:500, life:270, desc:'clockwork — cuts freeze the air around them' },
  { id:'chaos',    name:'CHAOS',    color:'#4a3b5c', price:500, life:270, desc:'a gambler\'s blade — no cut does what the last did' },
  { id:'bubble',   name:'BUBBLE',   color:'#9fc9de', price:500, life:270, desc:'soft soap — halves drift up in bubbles, then pop' },
  { id:'solar',    name:'SOLAR',    color:'#e8a13a', line:'#ffd98a', price:500, life:290, desc:'a flare — every cut pays ×1.25 and burns bright' },
  { id:'void',     name:'VOID',     color:'#08080c', line:'#2a2a3a', price:500, life:270, desc:'hunger — what it cuts collapses into a point' },
];
/* swords & relics: the money flexes — bought with ¥ */
const SWORDS = [
  { id:'none',    name:'BARE HAND',      price:0,        desc:'just you and the pointer' },
  { id:'wood',    name:'WOODEN SWORD',   price:50000,    desc:'a training blade — humble, honest' },
  { id:'neon',    name:'NEON SWORD',     price:250000,   desc:'hums with cold light' },
  { id:'obsidian',name:'OBSIDIAN SWORD', price:1000000,  desc:'carved from volcanic glass' },
  { id:'galaxy',  name:'GALAXY SWORD',   price:5000000,  desc:'a blade with a universe inside' },
];
const RELICS = [
  { id:'golden', name:'GOLDEN EVERYTHING', price:25000000, desc:'the world remembers gold — money, stains, sparks',
    reveal:'GOLDEN EVERYTHING', revealDesc:'held — money, stains and sparks shine gold' },
  { id:'age',    name:'???', price:50000000, desc:'some things must be witnessed',
    reveal:'GOLDEN AGE', revealDesc:'held — the sun never sets. everything pays ×2, forever' },
];
function trailLifeFor(id){
  const t = TRAILS.find(t=>t.id===id);
  return (t && t.life) || 270;
}

/* ---- perfis: named saves — switch anytime, nothing is ever lost ---- */
const PROFILES_KEY = SAVE_KEY+'-profiles', ACTIVE_KEY = SAVE_KEY+'-active';
function freshSave(){
  return { bank:0, cutsCur:0, up:{}, trail:'ink', trails:['ink'], swords:['none'], sword:'none', relics:[],
           stats:{cuts:0,best:0,runs:0,time:0,bombs:0} };
}
function loadRegistry(){ try{ return JSON.parse(localStorage.getItem(PROFILES_KEY))||{}; }catch(e){ return {}; } }
function saveRegistry(){ try{ localStorage.setItem(PROFILES_KEY, JSON.stringify(reg)); }catch(e){} }
let reg = loadRegistry();
let perfil = localStorage.getItem(ACTIVE_KEY) || 'PERFIL 1';
if(!reg[perfil]){                     // first run with perfis — adopt the existing save
  let old=null;
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if(s && s.up && s.stats) old=s; }catch(e){}
  reg[perfil] = old || freshSave();
  saveRegistry();
}
try{ localStorage.setItem(ACTIVE_KEY, perfil); }catch(e){}
function loadSave(){ return reg[perfil] || freshSave(); }
let save = loadSave();
UPGRADES.forEach(u=>{ if(!(u.id in save.up)) save.up[u.id]=0; });
if(!Array.isArray(save.trails)) save.trails=['ink'];
if(!TRAILS.some(t=>t.id===save.trail)) save.trail='ink';
if(typeof save.cutsCur!=='number') save.cutsCur=0;
if(!Array.isArray(save.swords)) save.swords=['none'];
if(!SWORDS.some(s=>s.id===save.sword)) save.sword='none';
if(!Array.isArray(save.relics)) save.relics=[];
save.stats = save.stats||{};
save.stats.time  = save.stats.time||0;
save.stats.bombs = save.stats.bombs||0;
save.settings = Object.assign(
  { volume:.7, btnScale:1, textScale:1, hideTexts:false, fxTrail:1, fxCut:1, smooth:1,
    musicVol:null, menuVol:1, matchVol:1, pitchVar:6, shake:1 },
  save.settings||{}
);
if(save.settings.musicVol==null) save.settings.musicVol = save.settings.volume;   // old single VOLUME slider → split
save.custom = Object.assign(                       // CUSTOM mode — your arcade, your rules
  { lives:3, size:1, speed:1, grav:1, spawn:1, tough:1, money:1, bombs:true, miss:true, off:[] },
  save.custom||{}
);
if(!Array.isArray(save.custom.off)) save.custom.off = [];
save.dungeon = Object.assign({ unlocked:1, done:{} }, save.dungeon||{});   // the descent — floors reached/cleared
save.trailUp = save.trailUp||{};                   // trail mastering levels (THE LAB)
function persist(){
  reg[perfil] = save; saveRegistry();               // the perfil is always up to date
  try{ localStorage.setItem(ACTIVE_KEY, perfil); }catch(e){}
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){}   // kept for old tools
}
function hasRelic(id){ return save.relics.includes(id); }

function upg(id){ const u = UPGRADES.find(u=>u.id===id); return u.vals[save.up[id]]; }
const isTrail = id => save.trail===id;
const comboWindow = ()=> upg('window')*(isTrail('ghost')?1.6+.3*tlv('ghost'):1);
const fortune     = ()=> upg('fortune');
const fate        = ()=> upg('fate');
const edgeBonus   = ()=> upg('edge');
const tlv = id => clamp(save.trailUp[id]||0, 0, 3);         // trail mastering level 0–3 (THE LAB)
const TLAB_PRICES = [400, 1200, 3600];                      // CUTS per mastering level
const cMul = k => mode==='custom' ? (save.custom[k] ?? 1) : 1;   // custom-mode knobs
function trailPay(){                                       // pay perks — upgraded in THE LAB
  if(isTrail('gold'))   return 1.5+.25*tlv('gold');
  if(isTrail('solar'))  return 1.25+.15*tlv('solar');
  if(isTrail('ink'))    return 1+.04*tlv('ink');
  if(isTrail('mirror')) return 1+.05*tlv('mirror');
  if(isTrail('chaos'))  return 1+.06*tlv('chaos');
  if(isTrail('void'))   return 1+.05*tlv('void');
  return 1;
}
/* ---- THE LAB skins — the reward for mastering a blade (level 3): the trail
       and its ambient FX recolor into its final form. nature → AUTUMN etc. ---- */
const SKINS = {
  ink:      { name:'MIDNIGHT',   color:'#1b1b2e', line:'#9a9ac2', fx:{ ink:'#3a3a5c' } },
  crimson:  { name:'BLOOD MOON', color:'#8a1626', line:'#ff8a96', fx:{ ink:'#8a1626' } },
  ghost:    { name:'PHANTOM',    color:'#3a3a44', line:'#c8ccd4', fx:{ dust:'#4a4a56' } },
  frost:    { name:'DEEP FROST', color:'#3a6a94', line:'#cfeaff', fx:{ snow:'#cfeaff' } },
  gold:     { name:'ROYAL',      color:'#8a6b17', line:'#f6e6a0', fx:{ goldstar:'#f2d98a' } },
  fire:     { name:'BLUE FLAME', color:'#2a5ac4', line:'#9adcff', fx:{ ember:'#5ab0e8', ember2:'#2a6ad9' } },
  universe: { name:'SUPERNOVA',  color:'#4a2a7a', line:'#ffffff' },
  lightning:{ name:'PLASMA',     color:'#a04dff', line:'#ffffff', fx:{ spark2:'#c48aff' } },
  liquid:   { name:'ABYSS',      color:'#0e1a2a', line:'#4a7a9a', fx:{ drop:'#0e1a2a' } },
  wind:     { name:'GALE',       color:'#6aa8b8', line:'#eafcff' },
  nature:   { name:'AUTUMN',     color:'#c96a1e', line:'#ffd98a', fx:{ leaf:'#c96a1e', leaf2:'#8a4a1a' } },
  magnet:   { name:'ION STORM',  color:'#3a5a9a', line:'#9adcff' },
  mirror:   { name:'ECLIPSE',    color:'#1a1a24', line:'#8a90a0' },
  time:     { name:'ETERNITY',   color:'#3a5a7a', line:'#c4d8ea' },
  chaos:    { name:'RUIN',       color:'#2a1a3a', line:'#b06ad9' },
  bubble:   { name:'FOAM',       color:'#d0e8f4', line:'#ffffff' },
  solar:    { name:'NOVA',       color:'#ff6a2a', line:'#fff2c8' },
  void:     { name:'SINGULARITY', color:'#000000', line:'#6a6a9a' },
};
const skinOf = id => (tlv(id)>=3 && SKINS[id]) ? SKINS[id] : null;   // mastered → final form
function trailCss(id){                                              // skin-aware trail color
  const t = TRAILS.find(t=>t.id===id)||TRAILS[0], sk = skinOf(id);
  return (sk && sk.color) || t.color;
}
function skinned(type, css){                                        // ambient FX may wear the skin
  const s = skinOf(save.trail);
  return s && s.fx && s.fx[type]!==undefined ? s.fx[type] : css;
}

/* ---------------- game modes ---------------- */
const MODES = {
  classic:  { name:'CLASSIC',   desc:'3 LIVES · MISSES AND BOMBS COST LIVES · A STEADY RAMP', lives:3 },
  zen:      { name:'ZEN',       desc:'NO BOMBS · NO FAILURE · ONLY THE CUT', lives:0, noBombs:true, noMiss:true, spawnFloor:.95 },
  chaos:    { name:'CHAOS',     desc:'DENSE VOLLEYS · DOUBLE-SPEED UNLOCKS · ONLY BOMBS HURT', lives:5, noMiss:true, timeShift:2, density:34, greed:1.4, capFn:t=>Math.min(7, 2+Math.floor(t/14)), maxBombs:2, spdBonus:.3, spawnFloor:.38 },
  precision:{ name:'PRECISION', desc:'40% SMALLER TARGETS · EVERY SWING MUST BE FASTER', lives:3, sizeScale:.6, toughMul:1.5, spawnFloor:.75 },
  endless:  { name:'ENDLESS',   desc:'NO LIVES · THE RAMP NEVER FLATTENS · LEAVE VIA PAUSE', lives:0, noMiss:true, greed:1.6, capFn:t=>1+Math.floor(t/12), maxBombs:2, spawnFloor:.32 },
  dungeon:  { name:'DUNGEON',   desc:'10 FLOORS · CUT EACH GOAL TO DESCEND · A BOSS EVERY THIRD FLOOR', lives:3, dungeon:true },
  custom:   { name:'CUSTOM',    desc:'YOUR ARCADE — TUNE EVERY RULE IN ITS FOLD', lives:3, custom:true },
};

/* ---------------- difficulty ---------------- */
const DIFFS = {
  easy:   { name:'EASY',    desc:'SLOW · LARGE · FORGIVING · PAYS ×0.5', sizeMul:1.25, speedMul:.8,  gravMul:.75, toughMul:.7,  spawnMul:1.6, moneyMul:.5 },
  normal: { name:'NORMAL',  desc:'THE WORLD AS INTENDED · PAYS ×1', sizeMul:1.25 },
  hard:   { name:'HARD',    desc:'FASTER FALLS · PAYS ×1.25', sizeMul:1.25, speedMul:1.15, gravMul:1.08, moneyMul:1.25 },
  samurai:{ name:'SAMURAI', desc:'ONLY A SWIFT BLADE WILL DO · PAYS ×1.6', sizeMul:1.25, speedMul:1.3, gravMul:1.2, toughMul:1.5, spawnMul:.9, moneyMul:1.6 },
  sensei: { name:'SENSEI',  desc:'HUMANLY IMPOSSIBLE · PAYS ×2.5', sizeMul:1.05, speedMul:1.6, gravMul:1.35, toughMul:2.2, spawnMul:.8, moneyMul:2.5 },
};
let mode = MODES[save.mode] ? save.mode : 'classic'; save.mode = mode;
let diffKey = DIFFS[save.diff] ? save.diff : 'normal'; save.diff = diffKey;
function diff(){ return DIFFS[diffKey]; }
const G_BASE = 760;
let GRAV = G_BASE;
function applyDiff(){ GRAV = G_BASE*(diff().gravMul||1)*cMul('grav'); }

/* =====================================================================
   AUDIO — tiny synth, everything generated locally, no files
   ===================================================================== */
const S = (()=>{
  let ac=null, master=null, noiseBuf=null, muted=false, baseVol=.7;
  let pitchSpread=.06;   // SFX pitch variation ± (0–30%), driven by the settings slider
  function init(){
    if(ac) return;
    try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    master = ac.createGain(); master.gain.value = muted?0:.8*baseVol;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  }
  function tone(o){
    if(!ac) return;
    const { type='sine', f=440, f2=0, t=0, dur=0.2, vol=0.2 } = o;
    const t0 = ac.currentTime+t, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if(f2) osc.frequency.exponentialRampToValueAtTime(Math.max(25,f2), t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001,vol), t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0+dur+0.06);
  }
  function noise(o){
    if(!ac) return;
    const { t=0, dur=0.2, vol=0.3, type='bandpass', f=1000, f2=0, q=1 } = o;
    const t0 = ac.currentTime+t;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0);
    if(f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40,f2), t0+dur);
    fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001,vol), t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0); src.stop(t0+dur+0.06);
  }

  /* ---- real recorded SFX (../Assets/SFX) wired over the synth; synth = fallback ---- */
  const SFX_URL = f => '../Assets/SFX/' + f.replace(/ /g,'%20');
  const SAMPLES = {                                // one uniform level — the bomb alone stands above
    slice:   { files:['Object SFX/Slice_01.wav',
                      'Object SFX/Slice_02.mp3',
                      'Object SFX/Slice_04.wav',
                      'Object SFX/Slice_05.wav'] },
    fruit:   { files:['Fruit SFX/Fruit_Cut01.wav',
                      'Fruit SFX/Fruit_Cut02.wav',
                      'Fruit SFX/Fruit_Cut03.wav',
                      'Fruit SFX/Fruit_Cut04.wav',
                      'Fruit SFX/Fruit_Cut05.wav'], vol: 1.0},
    ice:     { files:['Object SFX/Ice_Cube_Cut01.wav'] },
    egg:     { files:['Object SFX/Egg_Cut.mp3'] },
    toast:   { files:['Object SFX/Toast_Cut.mp3'] },
    teapot:  { files:['Object SFX/TeaPot_cut.mp3'], cap:1.5 },
    medkit:  { files:['Object SFX/medkit_cut.mp3'] },
    squish:  { files:['Object SFX/Wet_squish.mp3'] },
    shatter: { files:['Object SFX/Glass_Cut.mp3'] },
    fizz:    { files:['Object SFX/soda_fizz.mp3'] },
    chord:   { files:['Object SFX/piano_chord.mp3'] },
    crackle: { files:['Object SFX/fire_cracker.mp3'] },
    boom:    { files:['Object SFX/bomb_explosion.mp3'], vol:.85 },
    gold:    { files:['Object SFX/golden_apple_cut.mp3'] },
    coin:    { files:['Object SFX/coin_chime01.mp3',
                      'Object SFX/coin_chime02.mp3',
                      'Object SFX/coin_chime03.mp3'] },
    squeak:  { files:['Object SFX/mouse_squeak01.mp3'], cap:.5 },
    duck:    { files:['Object SFX/rubber_duck_bounce01.mp3',
                      'Object SFX/rubber_duck_bounce02.mp3'], cap:.5 },
    pop:     { files:['Object SFX/ballon_pop01.mp3',
                      'Object SFX/ballon_pop02.mp3'], cap:.4 },
    tick:    { files:['Object SFX/clock_tick.mp3'], cap:.35 },   // 17s file — only the first tick plays
    zap:     { files:['Trail SFX/eletric_zap01.wav',
                      'Trail SFX/eletric_zap02.wav',
                      'Trail SFX/eletric_zap03.mp3'], cap:.6 },
    zapTrail:{ files:['Trail SFX/eletric_zap01.wav',
                      'Trail SFX/eletric_zap02.wav',
                      'Trail SFX/eletric_zap03.mp3'], cap:.22, fade:true },  // electric chain only: short + fades
    ignite:  { files:['Trail SFX/Fire_ignite.wav'] },
    rustle:  { files:['Trail SFX/Leaf_rustle.wav',
                      'Trail SFX/Leaf_rustle02.wav',
                      'Trail SFX/Leaf_rustle03.wav'] },
    voids:   { files:['Trail SFX/Void_suck.wav'] },
    whoosh:  { files:['Trail SFX/wind_whoosh01.wav',
                      'Trail SFX/wind_whoosh02.wav',
                      'Trail SFX/wind_whoosh03.wav'] },
    ui:      { files:['UI sfx/UI Click.mp3'], cap:.45 },
    buy:     { files:['UI sfx/buy.mp3'] },
    thump:   { files:['UI sfx/deny.mp3'] },
    hit:     { files:['UI sfx/hit.mp3'] },
    hitLast: { files:['UI sfx/hit_Last_Life.mp3'] },
    stamp:   { files:['UI sfx/Seal_Stamp.mp3'] },
    combo:   { files:['UI sfx/combo.wav'], cap:.7 },
  };
  const SAMP = {};
  for(const key in SAMPLES){
    const e = SAMPLES[key], s = SAMP[key] = { vol:e.vol??.6, cap:e.cap||0, fade:!!e.fade, files:[], deck:[] };
    for(const f of e.files){
      const a = new Audio(SFX_URL(f));
      a.preload = 'auto';
      a.addEventListener('error', ()=>{ a._dead = true;
        console.warn('SFX: cannot load "'+a.src+'" — using the synth instead.'); }, false);
      s.files.push(a);
    }
  }
  function freePlayer(src){
    const pool = src._pool || (src._pool = []);
    for(const pl of pool) if(pl.paused || pl.ended) return pl;   // idle clone of THIS file
    if(pool.length >= 6) return pool[0];                          // all busy: recycle the oldest
    const pl = new Audio(src.src);
    pl.preload = 'auto';
    pool.push(pl);
    return pl;
  }
  function playSample(key, rate=1){
    if(muted) return true;                       // muted: handled; the synth path is muted anyway
    const e = SAMP[key];
    if(!e) return false;
    const live = e.files.filter(a=>!a._dead);
    if(!live.length) return false;
    if(!e.deck.length){                          // shuffled deck: no repeat until all have played
      e.deck = live.slice();
      for(let i=e.deck.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [e.deck[i],e.deck[j]]=[e.deck[j],e.deck[i]]; }
    }
    const a = freePlayer(e.deck.pop());
    const v = clamp(e.vol*baseVol, 0, 1);
    try{                                        // audio problems must never freeze the game
      a.volume = v;
      a.playbackRate = clamp(rand(1-pitchSpread,1+pitchSpread)*rate, .25, 8);  // real media elements reject extreme rates
      try{ a.currentTime = 0; }catch(err){}
      a.play().catch(()=>{});
      clearTimeout(a._c);
      if(e.cap) a._c = setTimeout(()=>{ try{ a.pause(); a.currentTime=0; }catch(err){} }, e.cap*1000);
      if(e.fade){                                  // electric chain: fade out instead of a hard stop
        clearInterval(a._f);
        const t0=performance.now(), dur=Math.max(60, e.cap*1000);
        a._f=setInterval(()=>{
          const k=(performance.now()-t0)/dur;
          if(k>=1 || a.paused){ clearInterval(a._f); return; }
          a.volume = clamp(v*(1-k), 0, 1);
        }, 25);
      }
    }catch(err){ return false; }                    // fall back to the synth instead of crashing
    return true;
  }
  const M = {
    init,
    resume(){ if(ac && ac.state==='suspended') ac.resume(); },
    setVolume(v){ baseVol=clamp(v,0,1); if(master&&!muted) master.gain.value=.8*baseVol; },
    setPitchVar(p){ pitchSpread=clamp(p,0,.3); },   // ± pitch spread for sample variation
    toggleMute(){ muted=!muted; if(master) master.gain.value=muted?0:.8*baseVol; return muted; },
    slice(r){ noise({dur:.08, vol:.4, f:clamp(1500-r*9,380,1400), f2:260, q:1.3}); tone({f:130,f2:60,dur:.07,vol:.2}); },
    thump(){ noise({dur:.07, vol:.3, type:'lowpass', f:260}); tone({f:95,f2:55,dur:.1,vol:.28}); },
    hit(v=.2, last=false){
      if(playSample(last?'hitLast':'hit')) return;
      noise({dur:.15, vol:.1+.22*v, type:'lowpass', f:420, f2:110}); tone({f:130,f2:52,dur:.2,vol:.12+.3*v});
    },
    combo(n){
      const SC=[0,2,4,7,9], i=Math.min(n-1,19);
      const st = SC[i%5] + 12*((i/5)|0);
      if(playSample('combo', Math.min(2, Math.pow(2, st/12)))) return;   // sample ladder: cap an octave up — real audio, no chipmunk
      const f = 523.25*Math.pow(2, st/12);
      tone({type:'triangle', f, dur:.15, vol:.085});
      tone({type:'triangle', f:f*1.5, dur:.1, vol:.03, t:.012});
    },
    gold(){ tone({f:1318,dur:.7,vol:.15}); tone({f:1975,dur:.6,vol:.09,t:.04}); tone({f:2637,dur:.5,vol:.05,t:.08}); noise({dur:.4,vol:.05,type:'highpass',f:6000}); },
    ice(){                          // real recorded ice cut — via the pooled sample engine
      if(playSample('ice')) return;
      [2600,3300,4150].forEach((f,i)=>tone({f,dur:.24-i*.04,vol:.08,t:i*.02})); noise({dur:.28,vol:.1,type:'highpass',f:4800}); tone({f:170,f2:60,dur:.2,vol:.1});
    },
    zap(){ tone({type:'square',f:1700,f2:280,dur:.06,vol:.1}); noise({dur:.16,vol:.18,type:'highpass',f:2600}); tone({type:'sawtooth',f:110,dur:.14,vol:.07,t:.02}); },
    boom(){ noise({dur:.6,vol:.65,type:'lowpass',f:900,f2:60}); tone({f:150,f2:34,dur:.5,vol:.5}); noise({dur:.12,vol:.25,type:'highpass',f:1600}); },
    squeak(v=1){ tone({f:1500,f2:2900,dur:.06,vol:.1*v}); tone({f:2600,f2:1700,dur:.08,vol:.08*v,t:.06}); },
    duck(v=1){ tone({type:'square',f:290,f2:430,dur:.08,vol:.07*v}); tone({type:'square',f:400,f2:240,dur:.09,vol:.06*v,t:.09}); },
    pop(){ noise({dur:.045,vol:.45,f:850,q:.8}); tone({f:430,f2:170,dur:.05,vol:.18}); },
    squish(){ noise({dur:.16,vol:.26,type:'lowpass',f:520,f2:120}); tone({f:300,f2:85,dur:.14,vol:.1}); },
    chord(){ [110,164.81,220,261.63,329.63].forEach((f,i)=>tone({type:'triangle',f,dur:1.3,vol:.085,t:i*.012})); tone({f:55,f2:38,dur:.35,vol:.4}); noise({dur:.1,vol:.22,type:'lowpass',f:420}); },
    coin(){ tone({f:2350,dur:.25,vol:.11}); tone({f:3520,dur:.18,vol:.06,t:.02}); },
    tick(){ noise({dur:.02,vol:.1,type:'highpass',f:3600}); tone({type:'square',f:2100,dur:.015,vol:.03}); },
    riser(){ tone({type:'sawtooth',f:210,f2:660,dur:.35,vol:.045}); },
    crackle(){ for(let i=0;i<6;i++) noise({t:i*.05+Math.random()*.02, dur:.03, vol:.15, f:rand(500,1600), q:2}); },
    stamp(){ tone({f:75,f2:28,dur:.35,vol:.55}); noise({dur:.22,vol:.35,type:'lowpass',f:240}); noise({dur:.03,vol:.25,type:'highpass',f:2200}); },
    ui(){ noise({dur:.02,vol:.08,type:'highpass',f:3200}); },
    buy(){ tone({f:2350,dur:.2,vol:.1}); tone({f:2960,dur:.25,vol:.08,t:.07}); },
    ignite(){ noise({dur:.3,vol:.14,type:'highpass',f:2400}); tone({type:'sawtooth',f:90,f2:50,dur:.25,vol:.06}); },
    voids(){ tone({type:'sawtooth',f:320,f2:45,dur:.4,vol:.11}); noise({dur:.35,vol:.12,type:'lowpass',f:700,f2:120}); },
    whoosh(){ noise({dur:.28,vol:.3,type:'bandpass',f:300,f2:1400,q:.8}); },
    shimmer(){ tone({f:1567,dur:.3,vol:.07}); tone({f:2349,dur:.25,vol:.05,t:.03}); noise({dur:.12,vol:.06,type:'highpass',f:5200}); },
    rustle(){ for(let i=0;i<5;i++) noise({t:i*.03,dur:.05,vol:.07,type:'bandpass',f:rand(900,2200),q:1.5}); },
    fizz(){ noise({dur:.5,vol:.25,type:'highpass',f:3000,f2:8000}); tone({f:900,f2:1600,dur:.3,vol:.05}); },
    shatter(){ for(let i=0;i<5;i++) tone({f:rand(2400,4200),dur:.12,vol:.05,t:i*.03}); noise({dur:.25,vol:.12,type:'highpass',f:5200}); },
    fruitCut(){                    // real recorded cuts — via the pooled sample engine
      if(playSample('fruit')) return;
      noise({dur:.08,vol:.4,f:1500,f2:260,q:1.3}); tone({f:130,f2:60,dur:.07,vol:.2});
    },
  };
  /* real SFX first, synth as fallback — combo wires itself (pitch ladder), the rest auto-wrap */
  (function(){
    for(const key in SAMPLES){
      if(key==='combo' || key==='fruit' || key==='ice') continue;   // these wire themselves
      const fn = M[key];
      M[key] = function(){ if(playSample(key)) return; if(fn) fn.apply(this, arguments); };
    }
  })();
  /* per-object cut sounds that never had a synth key */
  M.egg    = r=>{ if(!playSample('egg'))    M.slice(r); };
  M.toast  = r=>{ if(!playSample('toast'))  M.slice(r); };
  M.teapot = r=>{ if(!playSample('teapot')) M.slice(r); };
  M.medkit = r=>{ if(!playSample('medkit')) M.slice(r); };
  return M;
})();
/* =====================================================================
   MUSIC — the two composed tracks, fully self-driving.
   Watches the game state, so nothing else in the game needs editing:
     menu / shop / settings  →  Main_Menu_SLICED.mp3
     play                    →  In-match SLICED.mp3
     pause                   →  ducks the current track
     death                   →  fades out, menu theme returns ~1s later
   Follows the volume slider + M mute key. Waits for the first
   click/keypress before starting (browser autoplay policy).
   ===================================================================== */
const MUSIC = (()=>{
  const TRACKS = {
    menu:  { el:null, file:'../Assets/Music/Main_Menu_SLICED.mp3', vol:.5  },
    match: { el:null, file:'../Assets/Music/In-match%20SCLICED.mp3', vol:.55 },
  };
  let current=null, muted=false, userVol=.7, ducked=false, menuMul=1, matchMul=1;
  let lastState=null, overAt=0, unlocked=false;

  const target = k => TRACKS[k].vol * userVol * (k==='menu'?menuMul:matchMul) * (muted?0:1) * (ducked?.25:1);

  function elFor(k){
    const t=TRACKS[k];
    if(!t.el){ t.el=new Audio(t.file); t.el.loop=true; t.el.preload='auto'; t.el.volume=0; }
    return t.el;
  }
  function fade(el,to,ms){
    clearInterval(el._f);
    const from=el.volume, t0=performance.now();
    el._f=setInterval(()=>{
      const k=clamp((performance.now()-t0)/ms, 0, 1);
      el.volume=clamp(from+(to-from)*k, 0, 1);
      if(k>=1) clearInterval(el._f);
    },40);
  }
  function play(k){
    const el=elFor(k);
    if(current===k && !el.paused) return;
    if(current && current!==k){          // crossfade the old track out
      const old=TRACKS[current].el;
      fade(old,0,700);
      setTimeout(()=>{ if(old!==el){ old.pause(); old.currentTime=0; } },740);
    }
    current=k; el.volume=0;
    el.play().then(()=>{ if(current===k) fade(el, target(k), 900); })
             .catch(err=>console.warn('MUSIC: cannot play "'+TRACKS[k].file+'" — is the file in ../Assets/Music, named exactly?', err));
  }
  function stop(){
    if(!current) return;
    const el=TRACKS[current].el;
    fade(el,0,450);
    setTimeout(()=>{ el.pause(); el.currentTime=0; },480);
    current=null;
  }
  function retune(ms=250){
    if(current && !TRACKS[current].el.paused)
      fade(TRACKS[current].el, target(current), ms);
  }

  // browser autoplay policy: music may only start after a gesture
  const unlock=()=>{ unlocked=true; };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  // M key mutes the music in sync with the SFX mute
  addEventListener('keydown', e=>{
    if(e.key==='m'||e.key==='M'){ muted=!muted; retune(150); }
  });

  setInterval(()=>{
    // follow the music volume sliders (global + per-track)
    const st = save.settings||{};
    const v  = clamp(st.musicVol ?? st.volume ?? .7, 0, 1);
    const mm = clamp(st.menuVol ?? 1, 0, 1), mi = clamp(st.matchVol ?? 1, 0, 1);
    if( Math.abs(v-userVol)>.001 || Math.abs(mm-menuMul)>.001 || Math.abs(mi-matchMul)>.001 ){
      userVol=v; menuMul=mm; matchMul=mi; retune();
    }
    if(!unlocked) return;
    // state-driven track changes
    if(state!==lastState){
      if(lastState==='play' && state==='over'){ stop(); overAt=performance.now(); }
      else if(state==='menu') play('menu');
      else if(state==='play') play('match');
      lastState=state;
    }
    // after the death beat, the menu theme returns on the results screen
    if(state==='over' && current!=='menu' && performance.now()-overAt>1000) play('menu');
    // duck while paused
    const wantDuck = state==='pause';
    if(wantDuck!==ducked){ ducked=wantDuck; retune(); }
  },250);

  return { play, stop };
})();
/* =====================================================================
   GAME STATE
   ===================================================================== */
let state = 'menu';          // menu | play | pause | over
let props=[], fragments=[], parts=[], stains=[], floaters=[], slashes=[];
let cutSegs = [];
let lives=3, combo=0, comboTimer=0, runMoney=0, run={cuts:0,best:0};
let runCuts=0, crimsonFruit=0, missStreak=0;
let tRun=0, spawnT=0.8, menuT=1.2;
let slowT=0, fastT=0, goldT=0, tickT=0;
let flashT=0, flashX=0, flashY=0;
let hitStop=0, trauma=0, timeScale=1, bg=[255,255,255], bgImpulses=[];
let vignT=0, vignMax=.32, vignStr=0, vignRed=false, vignGreen=false;   // damage / medkit feedback
let overT=0, overShown=false, goldSeen=false, runBanked=false, taughtFaster=false;
let hz=[], flares=[];                    // hazard spikes/ants/bulbs/shards · solar burn zones
let invulnT=0, halfHit=false, halfT=0;   // hazard i-frames + the half-damage debt (0.5+0.5 = 1 life)
let overTitle='THE BLADE RESTS', dgNext=false;   // results headline · dungeon floor advance flag

const trail = { pts:[], css:'#101010' };
trail.css = trailCss(save.trail);          // a mastered blade may wear its LAB skin
function setTrail(id){ trail.css = trailCss(id); }

/* =====================================================================
   INPUT — sword pointer
   ===================================================================== */
const ptr = { x:W/2, y:H/2, lastX:W/2, lastY:H/2, lastT:0, down:false, speed:0 };

function trailPush(x,y,sp){
  trail.pts.push({x,y,sp,t:0});
  if(trail.pts.length > (isTrail('fire')?64:48)) trail.pts.shift(); // FIRE keeps a longer ribbon
}
cv.addEventListener('pointerdown', e=>{
  S.init(); S.resume();
  if(e.pointerType==='mouse' && e.button!==0) return;
  ptr.down = true;
  ptr.x = ptr.lastX = e.clientX; ptr.y = ptr.lastY = e.clientY; ptr.lastT = e.timeStamp;
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
});
window.addEventListener('pointermove', e=>{
  const x=e.clientX, y=e.clientY, dtms = Math.max(1, e.timeStamp - ptr.lastT);
  if(ptr.down){
    const dx = x-ptr.lastX, dy = y-ptr.lastY, d = Math.hypot(dx,dy);
    if(d > 1.2){
      const sp = d/dtms; // px per ms — the "swing speed"
      cutSegs.push({x0:ptr.lastX, y0:ptr.lastY, x1:x, y1:y, sp});
      trailPush(x,y,sp);
      ptr.speed = ptr.speed*0.4 + sp*0.6;
    }
  }
  ptr.x=x; ptr.y=y; ptr.lastX=x; ptr.lastY=y; ptr.lastT=e.timeStamp;
});
const release = ()=>{ ptr.down=false; };
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', release);
cv.addEventListener('contextmenu', e=> e.preventDefault());

/* =====================================================================
   OBJECT DEFINITIONS — the whole roster is data + small draw/hook fns.
   cur = CUT currency: fruits 1 · objects 3 · heavy 5 · bombs 0
   ===================================================================== */

/* --- silhouette drawing helpers (all centered on origin) --- */
function applePath(g,r){
  g.beginPath();
  g.moveTo(0,-.42*r);
  g.bezierCurveTo(-.38*r,-.8*r, -.92*r,-.55*r, -.88*r,-.05*r);
  g.bezierCurveTo(-.84*r,.52*r, -.42*r,.95*r, 0,.9*r);
  g.bezierCurveTo(.42*r,.95*r, .84*r,.52*r, .88*r,-.05*r);
  g.bezierCurveTo(.92*r,-.55*r, .38*r,-.8*r, 0,-.42*r);
  g.closePath();
}
function drawApple(g,r){
  g.fillStyle=INK; applePath(g,r); g.fill();
  g.strokeStyle=INK; g.lineWidth=.1*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-.45*r); g.quadraticCurveTo(.06*r,-.8*r,.16*r,-1.05*r); g.stroke();
  g.beginPath(); g.moveTo(.14*r,-.86*r); g.quadraticCurveTo(.68*r,-1.28*r,.95*r,-.7*r);
  g.quadraticCurveTo(.5*r,-.55*r,.14*r,-.86*r); g.closePath(); g.fill();
}
function drawGoldApple(g,r){
  g.fillStyle='#d9a927'; applePath(g,r); g.fill();
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=.09*r;
  g.beginPath(); g.arc(-.15*r,-.1*r,.5*r,-2.4,-1.7); g.stroke();
  g.strokeStyle='#8a6b17'; g.lineWidth=.1*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-.45*r); g.quadraticCurveTo(.05*r,-.8*r,.15*r,-1.02*r); g.stroke();
  g.fillStyle='#b8871f';
  g.beginPath(); g.moveTo(.13*r,-.84*r); g.quadraticCurveTo(.62*r,-1.18*r,.86*r,-.66*r);
  g.quadraticCurveTo(.45*r,-.55*r,.13*r,-.84*r); g.closePath(); g.fill();
}
function drawOrange(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,.04*r,.88*r,0,TAU); g.fill();
  g.beginPath(); g.moveTo(.08*r,-.72*r); g.quadraticCurveTo(.6*r,-1.15*r,.8*r,-.62*r);
  g.quadraticCurveTo(.42*r,-.5*r,.08*r,-.72*r); g.closePath(); g.fill();
  g.fillRect(-.045*r,-.9*r,.09*r,.22*r);
}
function drawPear(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(0,-.95*r);
  g.bezierCurveTo(.16*r,-.72*r, .3*r,-.3*r, .22*r,.02*r);
  g.bezierCurveTo(.72*r,.16*r, .8*r,.72*r, .42*r,.9*r);
  g.bezierCurveTo(.16*r,1.02*r, -.16*r,1.02*r, -.42*r,.9*r);
  g.bezierCurveTo(-.8*r,.72*r, -.72*r,.16*r, -.22*r,.02*r);
  g.bezierCurveTo(-.3*r,-.3*r, -.16*r,-.72*r, 0,-.95*r);
  g.closePath(); g.fill();
  g.strokeStyle=INK; g.lineWidth=.1*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-.9*r); g.quadraticCurveTo(.06*r,-1.05*r,.16*r,-1.12*r); g.stroke();
}
function drawMelon(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(0,0,.95*r,.72*r,0,0,TAU); g.fill();
  g.save();
  g.beginPath(); g.ellipse(0,0,.95*r,.72*r,0,0,TAU); g.clip();
  g.strokeStyle='#fff'; g.lineWidth=.16*r; g.lineCap='round';
  for(const k of [-.42,0,.42]){
    g.beginPath(); g.moveTo(k*r,-.8*r); g.quadraticCurveTo(k*r*1.7,0,k*r,.8*r); g.stroke();
  }
  g.restore();
  g.strokeStyle=INK; g.lineWidth=.09*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-.68*r); g.quadraticCurveTo(.1*r,-.95*r,.32*r,-.86*r); g.stroke();
}
function drawCoin(g,r){
  g.fillStyle=INK; g.beginPath(); g.arc(0,0,.95*r,0,TAU); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.13*r; g.lineCap='round'; g.lineJoin='round';
  g.beginPath();
  g.moveTo(-.3*r,-.42*r); g.lineTo(0,-.02*r);
  g.moveTo(.3*r,-.42*r);  g.lineTo(0,-.02*r);
  g.moveTo(0,-.02*r);     g.lineTo(0,.5*r);
  g.moveTo(-.26*r,.16*r); g.lineTo(.26*r,.16*r);
  g.moveTo(-.26*r,.34*r); g.lineTo(.26*r,.34*r);
  g.stroke();
}
function drawBalloon(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,-.18*r,.68*r,0,TAU); g.fill();
  g.beginPath(); g.moveTo(-.15*r,.4*r); g.lineTo(.15*r,.4*r); g.lineTo(0,.72*r); g.closePath(); g.fill();
  g.strokeStyle=INK; g.lineWidth=.055*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,.72*r); g.quadraticCurveTo(.22*r,.95*r,.02*r,1.15*r); g.stroke();
}
function drawDuck(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(-.05*r,.28*r,.72*r,.42*r,-.06,0,TAU); g.fill();
  g.beginPath(); g.moveTo(-.5*r,.1*r); g.quadraticCurveTo(-1*r,-.05*r,-1.05*r,-.45*r);
  g.quadraticCurveTo(-.6*r,-.18*r,-.35*r,-.02*r); g.closePath(); g.fill();
  g.beginPath(); g.arc(.42*r,-.32*r,.36*r,0,TAU); g.fill();
  g.beginPath(); g.moveTo(.18*r,-.25*r); g.quadraticCurveTo(.22*r,.15*r,.6*r,.18*r);
  g.lineTo(.68*r,-.15*r); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(.72*r,-.44*r); g.lineTo(1.12*r,-.32*r); g.lineTo(.74*r,-.18*r); g.closePath(); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(.5*r,-.4*r,.055*r,0,TAU); g.fill();
}
function drawMouse(g,r){
  g.strokeStyle=INK; g.lineWidth=.09*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.7*r,.05*r);
  g.bezierCurveTo(-1.1*r,.1*r,-1.25*r,-.35*r,-1.62*r,-.3*r); g.stroke();
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(-.05*r,.02*r,.72*r,.46*r,0,0,TAU); g.fill();
  g.beginPath(); g.moveTo(.25*r,-.35*r); g.quadraticCurveTo(.9*r,-.12*r,1*r,.06*r);
  g.quadraticCurveTo(.62*r,.3*r,.2*r,.36*r); g.closePath(); g.fill();
  g.beginPath(); g.arc(-.32*r,-.45*r,.27*r,0,TAU); g.fill();
  g.beginPath(); g.arc(-.72*r,-.36*r,.24*r,0,TAU); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(.42*r,-.06*r,.05*r,0,TAU); g.fill();
}
function drawEye(g,r,p){
  p = p || {x:0,y:0,rot:0};
  g.beginPath();
  g.moveTo(-r,0); g.quadraticCurveTo(0,-1.02*r,r,0); g.quadraticCurveTo(0,1.02*r,-r,0);
  g.closePath();
  g.fillStyle='#fff'; g.fill();
  g.strokeStyle=INK; g.lineWidth=.14*r; g.stroke();
  const a = Math.atan2(ptr.y-p.y, ptr.x-p.x) - (p.rot||0);
  const ix = Math.cos(a)*.33*r, iy = Math.sin(a)*.33*r;
  g.fillStyle=INK; g.beginPath(); g.arc(ix,iy,.34*r,0,TAU); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(ix-.09*r,iy-.11*r,.085*r,0,TAU); g.fill();
}
function drawBulb(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,-.28*r,.64*r,0,TAU); g.fill();
  g.beginPath(); g.moveTo(-.3*r,.1*r); g.lineTo(-.2*r,.5*r); g.lineTo(.2*r,.5*r); g.lineTo(.3*r,.1*r); g.closePath(); g.fill();
  g.fillRect(-.22*r,.5*r,.44*r,.36*r);
  g.strokeStyle='#fff'; g.lineWidth=.07*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.2*r,.6*r); g.lineTo(.2*r,.6*r); g.stroke();
  g.beginPath(); g.moveTo(-.2*r,.74*r); g.lineTo(.2*r,.74*r); g.stroke();
  g.lineWidth=.075*r; g.lineJoin='round';
  g.beginPath(); g.moveTo(-.15*r,.02*r); g.lineTo(-.05*r,-.16*r); g.lineTo(.05*r,.02*r); g.lineTo(.15*r,-.16*r); g.stroke();
}
function drawIce(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.7*r,-.5*r); g.lineTo(-.32*r,-.85*r); g.lineTo(.4*r,-.8*r); g.lineTo(.78*r,-.32*r);
  g.lineTo(.62*r,.52*r); g.lineTo(-.08*r,.9*r); g.lineTo(-.72*r,.34*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.1*r; g.lineJoin='round';
  g.beginPath(); g.moveTo(-.32*r,-.85*r); g.lineTo(-.1*r,.05*r); g.lineTo(.62*r,.52*r); g.stroke();
  g.beginPath(); g.moveTo(.4*r,-.8*r); g.lineTo(-.1*r,.05*r); g.stroke();
}
function rr(g,x,y,w,h,rad){
  g.beginPath();
  g.moveTo(x+rad,y); g.arcTo(x+w,y,x+w,y+h,rad); g.arcTo(x+w,y+h,x,y+h,rad);
  g.arcTo(x,y+h,x,y,rad); g.arcTo(x,y,x+w,y,rad); g.closePath();
}
function drawCracker(g,r){
  g.fillStyle=INK;
  rr(g,-.4*r,-.75*r,.8*r,1.5*r,.12*r); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.11*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.36*r,-.3*r); g.lineTo(.36*r,-.3*r); g.stroke();
  g.beginPath(); g.moveTo(-.36*r,.18*r); g.lineTo(.36*r,.18*r); g.stroke();
  g.strokeStyle=INK; g.lineWidth=.09*r;
  g.beginPath(); g.moveTo(0,-.75*r); g.quadraticCurveTo(.25*r,-1.05*r,.1*r,-1.25*r); g.stroke();
}
function drawClock(g,r,p){
  const t = p ? p.t : 0;
  g.fillStyle=INK;
  g.beginPath(); g.arc(-.55*r,-.72*r,.27*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.55*r,-.72*r,.27*r,0,TAU); g.fill();
  g.fillRect(-.07*r,-.92*r,.14*r,.3*r);
  g.fillRect(-.55*r,.5*r,.15*r,.32*r);
  g.fillRect(.4*r,.5*r,.15*r,.32*r);
  g.beginPath(); g.arc(0,0,.72*r,0,TAU); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(0,0,.56*r,0,TAU); g.fill();
  const a1=t*6, a2=-t*2.6;
  g.strokeStyle=INK; g.lineCap='round';
  g.lineWidth=.085*r; g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a1)*.4*r,Math.sin(a1)*.4*r); g.stroke();
  g.lineWidth=.07*r;  g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(a2)*.5*r,Math.sin(a2)*.5*r); g.stroke();
  g.beginPath(); g.arc(0,0,.06*r,0,TAU); g.fill();
}
function drawPiano(g,r){
  g.fillStyle=INK;
  const w=1.02*r, h=1.2*r;
  g.fillRect(-w,-h,2*w,h*.78);
  g.fillRect(-w*1.1,-h*.24,2.2*w,h*.24);
  g.fillStyle='#fff';
  g.fillRect(-w*.98,-h*.2,1.96*w,h*.15);
  g.fillStyle=INK;
  for(let i=0;i<9;i++) g.fillRect(-w*.94 + i*(1.88*w/9), -h*.2, w*.075, h*.085);
  g.fillRect(-w*.96,-h*.02,w*.16,h*.3);
  g.fillRect(w*.8,-h*.02,w*.16,h*.3);
  g.fillRect(-w*.14,h*.22,w*.28,h*.07);
}
function drawBomb(g,r,p){ // grey shell · red rim · spinning TNT
  const t = p ? p.t : 0;
  g.fillStyle='#4a4a50';
  g.beginPath(); g.arc(0,.12*r,.8*r,0,TAU); g.fill();
  g.strokeStyle='#c22833'; g.lineWidth=.09*r; g.stroke();
  g.strokeStyle='rgba(255,255,255,.28)'; g.lineWidth=.07*r;
  g.beginPath(); g.arc(0,.12*r,.58*r,-2.3,-1.5); g.stroke();
  g.fillStyle='#2c2c31';
  g.fillRect(.1*r,-.72*r,.3*r,.28*r);
  g.strokeStyle=INK; g.lineWidth=.1*r; g.lineCap='round';
  g.beginPath(); g.moveTo(.25*r,-.6*r); g.quadraticCurveTo(.5*r,-1.05*r,.26*r,-1.1*r); g.stroke();
  g.fillStyle='#fff';
  g.font=`700 ${.34*r}px "Permanent Marker","IBM Plex Mono",monospace`;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('TNT', 0, .16*r);
  g.save(); g.translate(.26*r,-1.1*r);
  g.fillStyle='rgba(224,90,50,.25)';
  g.beginPath(); g.arc(0,0,.3*r,0,TAU); g.fill();
  g.strokeStyle='#ffb14e'; g.lineWidth=.05*r; g.lineCap='round';
  const s=(.8+.3*Math.sin(t*40))*.26*r;
  for(let k=0;k<5;k++){
    const a=k*TAU/5 + t*3.2;
    g.beginPath(); g.moveTo(-Math.cos(a)*s,-Math.sin(a)*s); g.lineTo(Math.cos(a)*s,Math.sin(a)*s); g.stroke();
  }
  g.fillStyle='#fff'; g.beginPath(); g.arc(0,0,.06*r,0,TAU); g.fill();
  g.restore();
}
function drawSpark(g,r){ g.fillStyle=INK; g.beginPath(); g.arc(0,0,.85*r,0,TAU); g.fill(); }
/* ---- BATCH 1 silhouettes: kitchen & food ---- */
function drawBanana(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.8*r,-.25*r);
  g.quadraticCurveTo(0,.6*r, .8*r,-.25*r);     // belly
  g.quadraticCurveTo(0,.05*r, -.8*r,-.25*r);   // inner curve
  g.closePath(); g.fill();
  g.beginPath(); g.arc(-.78*r,-.25*r,.09*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.78*r,-.25*r,.11*r,0,TAU); g.fill();
  g.save(); g.translate(.82*r,-.28*r); g.rotate(-.7);
  rr(g,-.055*r,-.2*r,.11*r,.3*r,.04*r); g.fill();
  g.restore();
}
function drawStrawberry(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.55*r,-.35*r);
  g.bezierCurveTo(-.5*r,.35*r, -.25*r,.85*r, 0,.85*r);
  g.bezierCurveTo(.25*r,.85*r, .5*r,.35*r, .55*r,-.35*r);
  g.bezierCurveTo(.3*r,-.6*r, -.3*r,-.6*r, -.55*r,-.35*r);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(-.45*r,-.4*r); g.lineTo(-.15*r,-.75*r); g.lineTo(0,-.45*r);
  g.lineTo(.15*r,-.75*r); g.lineTo(.45*r,-.4*r); g.closePath(); g.fill();
  g.fillStyle='#fff';
  for(const [sx,sy] of [[-.25,-.05],[.25,-.05],[0,.15],[-.15,.4],[.15,.4],[0,.62]]){
    g.beginPath(); g.arc(sx*r,sy*r,.045*r,0,TAU); g.fill();
  }
}
function drawToast(g,r){
  g.fillStyle=INK;
  rr(g,-.62*r,-.62*r,1.24*r,1.24*r,.28*r); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.07*r;
  rr(g,-.47*r,-.47*r,.94*r,.94*r,.16*r); g.stroke();
}
function drawEgg(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(0,0,.58*r,.78*r,0,0,TAU); g.fill();
  g.fillStyle='#fff';
  for(const [sx,sy] of [[-.2,-.32],[.24,-.12],[-.08,.18],[.26,.34],[-.28,.1]]){
    g.beginPath(); g.arc(sx*r,sy*r,.05*r,0,TAU); g.fill();
  }
}
function drawSushi(g,r){
  g.fillStyle=INK;
  rr(g,-.7*r,-.05*r,1.4*r,.72*r,.3*r); g.fill();
  g.beginPath();
  g.moveTo(-.65*r,-.05*r);
  g.quadraticCurveTo(0,-.72*r, .65*r,-.05*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.09*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.5*r,-.16*r); g.quadraticCurveTo(0,-.48*r, .5*r,-.16*r); g.stroke();
}
function drawDonut(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,0,.85*r,0,TAU); g.fill();
  g.fillStyle='#fff';
  g.beginPath(); g.arc(0,0,.32*r,0,TAU); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.13*r; g.lineCap='round';
  g.beginPath(); g.arc(0,0,.6*r,.3,1.8); g.stroke();
}
function drawCheese(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.9*r,.45*r);
  g.lineTo(.8*r,.45*r);
  g.lineTo(.8*r,-.25*r);
  g.quadraticCurveTo(-.1*r,-.15*r, -.9*r,.45*r);
  g.closePath(); g.fill();
  g.fillStyle='#fff';
  for(const [cx,cy,cr] of [[-.35,.1,.11],[.25,.05,.13],[.05,.32,.07],[-.05,-.1,.06],[.5,.28,.06]]){
    g.beginPath(); g.arc(cx*r,cy*r,cr*r,0,TAU); g.fill();
  }
}
function drawCandy(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(0,0,.5*r,.32*r,0,0,TAU); g.fill();
  g.beginPath();
  g.moveTo(-.45*r,-.15*r); g.lineTo(-.9*r,-.35*r); g.lineTo(-.85*r,0); g.lineTo(-.9*r,.35*r); g.lineTo(-.45*r,.15*r);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(.45*r,-.15*r); g.lineTo(.9*r,-.35*r); g.lineTo(.85*r,0); g.lineTo(.9*r,.35*r); g.lineTo(.45*r,.15*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.08*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.1*r,-.27*r); g.lineTo(-.18*r,.27*r); g.stroke();
  g.beginPath(); g.moveTo(.16*r,-.27*r); g.lineTo(.08*r,.27*r); g.stroke();
}
function drawLollipop(g,r){
  g.strokeStyle=INK; g.lineWidth=.09*r; g.lineCap='round';
  g.beginPath(); g.moveTo(0,-.2*r); g.lineTo(0,.95*r); g.stroke();
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,-.35*r,.55*r,0,TAU); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.09*r;
  g.beginPath();
  for(let a=0;a<TAU*1.6;a+=.3){
    const rad=(a/(TAU*1.6))*.4*r;
    const x=Math.cos(a+2)*rad, y=-.35*r+Math.sin(a+2)*rad;
    if(a===0) g.moveTo(x,y); else g.lineTo(x,y);
  }
  g.stroke();
}
function drawFish(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.75*r,0);
  g.bezierCurveTo(-.5*r,-.5*r, .3*r,-.55*r, .6*r,-.1*r);
  g.bezierCurveTo(.3*r,.5*r, -.5*r,.5*r, -.75*r,0);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(-.6*r,-.05*r);
  g.lineTo(-1*r,-.4*r); g.lineTo(-.9*r,0); g.lineTo(-1*r,.4*r);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(0,-.38*r); g.lineTo(.15*r,-.72*r); g.lineTo(.3*r,-.32*r);
  g.closePath(); g.fill();
  g.fillStyle='#fff';
  g.beginPath(); g.arc(.35*r,-.12*r,.08*r,0,TAU); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.05*r;
  g.beginPath(); g.arc(.15*r,0,.3*r,-1.1,1.1); g.stroke();
}
function drawMushroom(g,r){
  g.fillStyle=INK;
  rr(g,-.22*r,.1*r,.44*r,.75*r,.12*r); g.fill();
  g.beginPath();
  g.moveTo(-.8*r,.12*r);
  g.bezierCurveTo(-.8*r,-.75*r, .8*r,-.75*r, .8*r,.12*r);
  g.closePath(); g.fill();
  g.fillStyle='#fff';
  g.beginPath(); g.arc(-.35*r,-.25*r,.13*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.3*r,-.3*r,.1*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.05*r,.02*r,.08*r,0,TAU); g.fill();
}
function drawCarrot(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.3*r,-.45*r);
  g.lineTo(.3*r,-.45*r);
  g.lineTo(.08*r,.9*r);
  g.lineTo(-.08*r,.9*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.05*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.2*r,-.15*r); g.lineTo(.18*r,-.25*r); g.stroke();
  g.beginPath(); g.moveTo(-.14*r,.2*r); g.lineTo(.1*r,.12*r); g.stroke();
  g.fillStyle=INK;
  for(const k of [-1,0,1]){
    g.beginPath();
    g.moveTo(k*.1*r-.04*r,-.45*r);
    g.quadraticCurveTo(k*.3*r,-.75*r, k*.38*r,-.95*r);
    g.quadraticCurveTo(k*.16*r,-.8*r, k*.1*r+.04*r,-.45*r);
    g.closePath(); g.fill();
  }
}
function drawBroccoli(g,r){
  g.fillStyle=INK;
  rr(g,-.14*r,.2*r,.28*r,.65*r,.08*r); g.fill();
  for(const [bx,by,br] of [[-.45,-.1,.28],[0,-.32,.32],[.45,-.1,.28],[-.25,.08,.24],[.25,.08,.24]]){
    g.beginPath(); g.arc(bx*r,by*r,br*r,0,TAU); g.fill();
  }
  g.fillStyle='#fff';
  g.beginPath(); g.arc(-.3*r,-.15*r,.04*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.1*r,-.38*r,.04*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.42*r,.02*r,.04*r,0,TAU); g.fill();
}
function drawDrumstick(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(.18*r,-.18*r,.55*r,0,TAU); g.fill();
  g.beginPath(); g.arc(-.28*r,.22*r,.38*r,0,TAU); g.fill();
  g.beginPath();
  g.moveTo(-.3*r,.3*r); g.lineTo(-.62*r,.62*r);
  g.lineTo(-.45*r,.5*r); g.lineTo(-.58*r,.78*r);
  g.closePath(); g.fill();
  g.beginPath(); g.arc(-.68*r,.66*r,.15*r,0,TAU); g.fill();
  g.beginPath(); g.arc(-.5*r,.85*r,.15*r,0,TAU); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.06*r;
  g.beginPath(); g.arc(.18*r,-.18*r,.38*r,-2.6,-1.2); g.stroke();
}
function drawBurger(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.7*r,.1*r);
  g.bezierCurveTo(-.7*r,-.62*r, .7*r,-.62*r, .7*r,.1*r);
  g.closePath(); g.fill();
  g.fillStyle='#fff';
  for(const [sx,sy] of [[-.32,-.2],[0,-.33],[.32,-.2],[-.13,-.06],[.15,-.06]]){
    g.beginPath(); g.ellipse(sx*r,sy*r,.07*r,.05*r,0,0,TAU); g.fill();
  }
  g.fillStyle=INK;
  g.fillRect(-.72*r,.12*r,1.44*r,.1*r);
  g.strokeStyle='#fff'; g.lineWidth=.03*r;
  g.beginPath(); g.moveTo(-.72*r,.17*r); g.lineTo(.72*r,.17*r); g.stroke();
  g.fillStyle=INK;
  g.fillRect(-.66*r,.26*r,1.32*r,.16*r);
  rr(g,-.68*r,.46*r,1.36*r,.3*r,.12*r); g.fill();
}
function drawPizza(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.55*r,-.6*r);
  g.lineTo(.55*r,-.6*r);
  g.lineTo(.1*r,.85*r);
  g.lineTo(-.1*r,.85*r);
  g.closePath(); g.fill();
  g.strokeStyle=INK; g.lineWidth=.18*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.6*r,-.58*r); g.quadraticCurveTo(0,-.88*r,.6*r,-.58*r); g.stroke();
  g.fillStyle='#fff';
  g.beginPath(); g.arc(-.2*r,-.25*r,.11*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.22*r,-.1*r,.11*r,0,TAU); g.fill();
  g.beginPath(); g.arc(0,.25*r,.1*r,0,TAU); g.fill();
}
function drawPineapple(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.ellipse(0,.18*r,.56*r,.7*r,0,0,TAU); g.fill();
  g.save();
  g.beginPath(); g.ellipse(0,.18*r,.56*r,.7*r,0,0,TAU); g.clip();
  g.strokeStyle='#fff'; g.lineWidth=.05*r;
  for(let k=-2;k<=2;k++){
    const y=(k*.3+.18)*r;
    g.beginPath(); g.moveTo(-.55*r,y-.12*r); g.lineTo(.55*r,y+.12*r); g.stroke();
    g.beginPath(); g.moveTo(-.55*r,y+.12*r); g.lineTo(.55*r,y-.12*r); g.stroke();
  }
  g.restore();
  g.fillStyle=INK;
  for(let k=-2;k<=2;k++){
    const x=k*.16*r, lean=k*.14*r;
    g.beginPath();
    g.moveTo(x-.07*r,-.45*r);
    g.lineTo(x+lean-.04*r,-1.02*r+Math.abs(k)*.06*r);
    g.lineTo(x+.07*r,-.45*r);
    g.closePath(); g.fill();
  }
}
function drawIceCream(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.35*r,-.1*r); g.lineTo(.35*r,-.1*r); g.lineTo(0,.95*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.05*r;
  g.beginPath(); g.moveTo(-.3*r,.25*r); g.lineTo(.22*r,-.08*r); g.stroke();
  g.beginPath(); g.moveTo(.3*r,.25*r); g.lineTo(-.22*r,-.08*r); g.stroke();
  g.fillStyle=INK;
  g.beginPath(); g.arc(0,-.35*r,.42*r,0,TAU); g.fill();
  g.beginPath(); g.ellipse(.15*r,-.02*r,.1*r,.18*r,0,0,TAU); g.fill();
}
function drawTeapot(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.6*r,.55*r);
  g.bezierCurveTo(-.75*r,-.2*r, -.3*r,-.45*r, 0,-.45*r);
  g.bezierCurveTo(.3*r,-.45*r, .75*r,-.2*r, .6*r,.55*r);
  g.closePath(); g.fill();
  g.beginPath(); g.ellipse(0,-.45*r,.3*r,.12*r,0,0,TAU); g.fill();
  g.beginPath(); g.arc(0,-.62*r,.08*r,0,TAU); g.fill();
  g.beginPath();
  g.moveTo(-.5*r,-.25*r);
  g.quadraticCurveTo(-.95*r,-.35*r,-.85*r,-.75*r);
  g.lineTo(-.7*r,-.7*r);
  g.quadraticCurveTo(-.75*r,-.4*r,-.4*r,-.1*r);
  g.closePath(); g.fill();
  g.strokeStyle=INK; g.lineWidth=.11*r;
  g.beginPath(); g.arc(.55*r,.05*r,.3*r,-1.9,1.9); g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=.06*r;
  g.beginPath(); g.arc(0,.05*r,.4*r,.6,1.8); g.stroke();
}
function drawCoffee(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.6*r,-.2*r);
  g.lineTo(-.5*r,.6*r);
  g.quadraticCurveTo(0,.72*r, .5*r,.6*r);
  g.lineTo(.6*r,-.2*r);
  g.closePath(); g.fill();
  g.strokeStyle=INK; g.lineWidth=.12*r;
  g.beginPath(); g.arc(.72*r,.1*r,.25*r,-1.2,1.2); g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=.07*r;
  g.beginPath(); g.moveTo(-.52*r,-.18*r); g.lineTo(.52*r,-.18*r); g.stroke();
  g.strokeStyle=INK; g.lineWidth=.06*r; g.lineCap='round';
  g.beginPath(); g.moveTo(-.15*r,-.45*r); g.quadraticCurveTo(-.3*r,-.6*r,-.12*r,-.78*r); g.stroke();
  g.beginPath(); g.moveTo(.15*r,-.45*r); g.quadraticCurveTo(.3*r,-.6*r,.12*r,-.78*r); g.stroke();
}
function drawMelonSlice(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.8*r,-.35*r); g.lineTo(.8*r,-.35*r);
  g.arc(0,-.35*r,.8*r,0,Math.PI);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.13*r; g.lineCap='round';
  g.beginPath(); g.arc(0,-.35*r,.7*r,.12,Math.PI-.12); g.stroke();
  g.fillStyle='#fff';
  for(const [sx,sy] of [[-.32,.02],[0,.12],[.32,.02],[-.13,.3],[.13,.3]]){
    g.beginPath(); g.ellipse(sx*r,sy*r,.04*r,.07*r,.25,0,TAU); g.fill();
  }
}
function drawGarlic(g,r){
  g.fillStyle=INK;
  g.beginPath(); g.arc(-.35*r,.15*r,.38*r,0,TAU); g.fill();
  g.beginPath(); g.arc(.35*r,.15*r,.38*r,0,TAU); g.fill();
  g.beginPath(); g.arc(0,-.1*r,.44*r,0,TAU); g.fill();
  g.beginPath(); g.moveTo(-.1*r,-.4*r); g.lineTo(0,-.85*r); g.lineTo(.1*r,-.4*r); g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.05*r;
  g.beginPath(); g.moveTo(-.35*r,-.15*r); g.quadraticCurveTo(-.3*r,.3*r,-.2*r,.55*r); g.stroke();
  g.beginPath(); g.moveTo(.35*r,-.15*r); g.quadraticCurveTo(.3*r,.3*r,.2*r,.55*r); g.stroke();
}
function drawFork(g,r){
  g.fillStyle=INK;
  rr(g,-.09*r,.25*r,.18*r,.7*r,.08*r); g.fill();
  rr(g,-.32*r,-.15*r,.64*r,.42*r,.1*r); g.fill();
  for(const k of [-.24,-.08,.08,.24]){
    rr(g, k*r-.035*r, -.8*r, .07*r, .7*r, .03*r); g.fill();
  }
}
function drawWineGlass(g,r){
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.42*r,-.55*r);
  g.bezierCurveTo(-.42*r,.05*r, -.18*r,.22*r, 0,.28*r);
  g.bezierCurveTo(.18*r,.22*r, .42*r,.05*r, .42*r,-.55*r);
  g.closePath(); g.fill();
  g.fillRect(-.05*r,.28*r,.1*r,.48*r);
  g.beginPath(); g.ellipse(0,.82*r,.3*r,.07*r,0,0,TAU); g.fill();
  g.strokeStyle=INK; g.lineWidth=.07*r;
  g.beginPath(); g.moveTo(-.45*r,-.55*r); g.lineTo(.45*r,-.55*r); g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=.06*r;
  g.beginPath(); g.moveTo(-.26*r,-.45*r); g.quadraticCurveTo(-.3*r,-.05*r,-.12*r,.2*r); g.stroke();
}
function drawBottle(g,r){
  g.fillStyle=INK;
  rr(g,-.38*r,-.1*r,.76*r,1*r,.14*r); g.fill();
  g.beginPath();
  g.moveTo(-.38*r,-.05*r);
  g.quadraticCurveTo(-.2*r,-.3*r, -.14*r,-.45*r);
  g.lineTo(.14*r,-.45*r);
  g.quadraticCurveTo(.2*r,-.3*r, .38*r,-.05*r);
  g.closePath(); g.fill();
  g.fillRect(-.14*r,-.72*r,.28*r,.3*r);
  g.fillRect(-.17*r,-.85*r,.34*r,.15*r);
  g.fillStyle='#fff';
  g.fillRect(-.3*r,.25*r,.6*r,.3*r);
  g.fillStyle=INK;
  g.font=`600 ${.17*r}px "IBM Plex Mono",monospace`;
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('FIZZ', 0, .4*r);
}

/* --- movement hooks --- */
function spawnMouse(p,spd){
  const dir = Math.random()<.5 ? 1 : -1;
  p.x = dir>0 ? -40 : W+40; p.y = rand(H*.3,H*.7);
  p.vx = dir*rand(430,560)*Math.min(spd,1.2); p.vy = rand(-60,60);
  p.face = dir; p.vr = 0;
}
function updateMouse(p,dt){
  p.jinkT -= dt;
  if(p.jinkT<=0){
    p.jinkT = rand(.35,.9);
    p.vy += rand(-330,330);
    if(Math.random()<.16){ p.vx *= -0.85; p.face = p.vx>0?1:-1; if(Math.abs(p.vx)>60) S.squeak(.4); }
  }
  p.vy -= p.vy*Math.min(1,dt*1.6);
  p.x += p.vx*dt; p.y += p.vy*dt;
  const r=p.def.r;
  if(p.y<r){ p.y=r; p.vy=Math.abs(p.vy)*.5; }
  if(p.y>H-r){ p.y=H-r; p.vy=-Math.abs(p.vy)*.5; }
  p.rot = Math.sin(p.t*10)*.06 + clamp(p.vy*.0004,-.3,.3);
}
function spawnBalloon(p){
  p.x = rand(W*.2,W*.8); p.y = H+30;
  p.vx = rand(-15,15); p.vy = -rand(75,110); p.vr = 0;
}
function updateBalloon(p,dt){
  p.vy += (-85-p.vy)*Math.min(1,dt*1.8);
  p.x += Math.sin(p.t*1.6+p.phase)*46*dt + p.vx*dt;
  p.y += p.vy*dt;
  p.rot = Math.sin(p.t*1.6+p.phase)*.14;
}
function spawnDuck(p,spd){
  const dir = Math.random()<.5 ? 1 : -1;
  p.x = dir>0 ? -60 : W+60; p.y = rand(H*.45,H*.7);
  p.vx = dir*rand(230,330)*spd; p.vy = -rand(40,160); p.vr = 0;
}
function updateDuck(p,dt){
  p.vy += GRAV*.5*dt; p.x += p.vx*dt; p.y += p.vy*dt;
  const r = p.def.r;
  if((p.x<r && p.vx<0) || (p.x>W-r && p.vx>0)){
    if(p.bounces<5){ p.vx*=-.93; p.squash=1; if(Math.random()<.8) S.duck(.5); p.bounces++; }
  }
  if(p.y>H-r*.7 && p.vy>0){
    p.y = H-r*.7; p.vy = -Math.abs(p.vy)*.85-90; p.squash=1;
    if(Math.random()<.5) S.duck(.4);
  }
  if(p.y < -r*3) p.dead = true;
}
function spawnEye(p,spd){
  const dir = Math.random()<.5 ? 1 : -1;
  p.x = dir>0 ? -50 : W+50; p.y = rand(H*.3,H*.6);
  p.vx = dir*rand(75,125)*spd; p.vy = -rand(30,90); p.vr = 0; p.rot = 0;
}
function updateEye(p,dt){ p.vy += GRAV*.12*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.rot = Math.sin(p.t*1.3+p.phase)*.12; }
function spawnPiano(p,spd){
  p.x = rand(W*.18,W*.82); p.y = -p.def.r*1.6;
  p.vx = rand(-70,70); p.vy = rand(90,150)*spd; p.vr = 0; p.rot = rand(-.2,.2);
}
function updatePiano(p,dt){ p.vy += GRAV*.85*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.rot = Math.sin(p.t*.8)*.05; }
function updateGold(p,dt){
  p.vy += GRAV*.9*dt; p.x += p.vx*dt; p.y += p.vy*dt;
  p.glintT -= dt;
  if(p.glintT<=0){
    p.glintT = .06;
    addP({type:'glint', x:p.x+rand(-8,8), y:p.y+rand(-8,8), vx:rand(-15,15), vy:rand(-10,20),
          life:rand(.3,.5), max:.5, size:rand(1.5,3.2), rot:rand(TAU)});
  }
}
function updateSpark(p,dt){ p.vy += GRAV*.45*dt; }

/* --- cut hooks --- */
function onCutBomb(p,ang,hit){
  explosion(p.x,p.y);
  if(state==='play'){
    floatText(p.x, p.y-30, '×0', INK, 15);
    loseLife(p.x, p.y, {bomb:true});
  }
}
function onCutGold(p,ang,hit){
  goldT = 6;
  addP({type:'ring', x:hit.x, y:hit.y, life:.6, max:.6, size:360, lw:11, css:'#c99a1e'});
  for(let i=0;i<26;i++){
    const a=rand(TAU), sp=rand(60,320);
    addP({type:'glint', x:hit.x, y:hit.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
          life:rand(.5,1.1), max:1.1, size:rand(2.5,6), rot:rand(TAU)});
  }
}
function onCutIce(p,ang,hit){
  slowT = 3.5*(isTrail('frost') ? 1.5+.2*tlv('frost') : 1);   // FROST perk: longer bullet time (LAB-upgraded)
  for(let i=0;i<14;i++){
    const a=rand(TAU), sp=rand(60,300);
    addP({type:'shard', x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
          life:rand(.8,1.5), max:1.5, size:rand(3,8), rot:rand(TAU), vr:rand(-6,6), css:'#a9cde6'});
  }
}
function onCutBulb(p,ang,hit){
  flashT = .38; flashX = hit.x; flashY = hit.y;
  for(let i=0;i<10;i++){
    addP({type:'ray', x:hit.x, y:hit.y, ang:i/10*TAU, life:.3, max:.3, len:rand(120,220)});
  }
}
function onCutClock(p,ang,hit){
  fastT = 3.2; tickT = 0;
  floatText(p.x, p.y-p.def.r-12, 'TIME ×2', INK, 13);
}
function onCutCracker(p,ang,hit){
  for(let i=0;i<5;i++){
    const a = -Math.PI/2 + rand(-1.1,1.1), sp = rand(260,460);
    const s = spawnProp(D.spark, 1);
    s.x=p.x; s.y=p.y;
    s.vx = Math.cos(a)*sp + p.vx*.25; s.vy = Math.sin(a)*sp + p.vy*.25;
    s.rot = rand(TAU); s.vr = rand(-6,6);
  }
  for(let i=0;i<10;i++){
    const a=rand(TAU), sp=rand(120,380);
    addP({type:'line', x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
          life:rand(.15,.3), max:.3, ang:a, len:rand(8,18)});
  }
}
function onCutBalloon(p,ang,hit){
  for(let i=0;i<7;i++){
    const a=rand(TAU), sp=rand(90,260);
    addP({type:'debris', x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
          life:rand(.3,.6), max:.6, size:rand(2,4), rot:rand(TAU), vr:rand(-10,10)});
  }
}
function onCutEye(p,ang,hit){
  for(let i=0;i<9;i++){
    const a=rand(TAU), sp=rand(80,300);
    addP({type:'ink', x:hit.x, y:hit.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-50,
          life:rand(.4,.8), max:.8, size:rand(2,4.5)});
  }
}
function onCutPiano(p,ang,hit){
  for(let i=0;i<12;i++){
    const a=rand(TAU), sp=rand(150,480);
    addP({type:'debris', x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-100,
          life:rand(.4,.9), max:.9, size:rand(3,8), rot:rand(TAU), vr:rand(-8,8)});
  }
}
function onCutMelon(p,ang,hit){
  splatStain(hit.x+rand(-30,30), hit.y+rand(-30,30), p.def);
  for(let i=0;i<10;i++){
    const a=rand(TAU), sp=rand(80,320);
    addP({type:'ink', x:hit.x, y:hit.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
          life:rand(.4,.9), max:.9, size:rand(2,4.5)});
  }
}

/* ---- BATCH 1 hooks ---- */
function spawnFish(p,spd){
  const dir = Math.random()<.5 ? 1 : -1;
  p.x = dir>0 ? -50 : W+50;
  p.y = rand(H*.3,H*.65);
  p.vx = dir*rand(260,380)*spd;
  p.vy = rand(-120,40);
  p.face = dir; p.vr = rand(-.8,.8);
}
function updateFish(p,dt){
  p.vy += GRAV*.55*dt;
  p.x += p.vx*dt; p.y += p.vy*dt;
  p.rot += Math.sin(p.t*9)*.6*dt + clamp(p.vy*.0003,-.25,.25);
  p.squash = .3+.3*Math.sin(p.t*9);   // it never stops flapping
  p.face = p.vx>=0 ? 1 : -1;
}
function updateIceCream(p,dt){
  p.vy += GRAV*.75*dt;
  p.x += p.vx*dt; p.y += p.vy*dt;
  p.rot += p.vr*dt*.5;
  if(p.baseScale==null) p.baseScale = p.scale;
  p.meltT = (p.meltT||0)+dt;
  p.scale = p.baseScale*Math.max(.5, 1-p.meltT*.06);   // melting mid-air
  if(Math.random()<dt*3)
    addP({type:'drop', x:p.x+rand(-8,8), y:p.y+p.def.r*.5, vx:rand(-15,15), vy:rand(10,40), life:.5, max:.5, size:rand(1.2,2)});
}
function onCutBottle(p,ang,hit){
  for(let i=0;i<16;i++)
    addP({type:'bub', x:hit.x, y:hit.y, vx:rand(-160,160), vy:rand(-420,-140), life:rand(.4,.9), max:.9, size:rand(2,5)});
  for(let i=0;i<8;i++)
    addP({type:'gleam', x:hit.x, y:hit.y, vx:rand(-120,120), vy:rand(-300,-80), life:rand(.2,.5), max:.5, size:rand(1.5,3)});
  for(const q of props){ // the spray shoves its neighbors
    if(q.dead || q===p) continue;
    const dx=q.x-hit.x, dy=q.y-hit.y, d=Math.hypot(dx,dy);
    if(d<200 && d>1){ const f=(1-d/200)*160; q.vx+=dx/d*f; q.vy+=dy/d*f-120*(1-d/200); }
  }
}
function onCutWine(p,ang,hit){
  for(let i=0;i<12;i++){
    const a=rand(TAU), sp=rand(120,360);
    addP({type:'shard', x:hit.x, y:hit.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
          life:rand(.6,1.1), max:1.1, size:rand(2.6,6), rot:rand(TAU), vr:rand(-8,8), css:'#cfe8f4'});
  }
}
function onCutCoffee(p,ang,hit){
  if(state==='play' && combo>0){
    comboTimer = comboWindow();   // CAFFEINE — the combo meter refills
    floatText(hit.x, hit.y-p.def.r-14, 'CAFFEINE', '#8a6d3b', 12);
  }
  for(let i=0;i<6;i++)
    addP({type:'smoke', x:hit.x+rand(-14,14), y:hit.y+rand(-10,10), vx:rand(-30,30), vy:rand(-120,-60), life:rand(.5,.9), max:.9, size:rand(6,12)});
}
function onCutTeapot(p,ang,hit){
  for(let i=0;i<9;i++)
    addP({type:'smoke', x:hit.x+rand(-20,20), y:hit.y+rand(-14,14), vx:rand(-40,40), vy:rand(-160,-70), life:rand(.6,1.1), max:1.1, size:rand(8,16)});
}
function onCutMedkit(p,ang,hit){
  // MEDKIT — one life back (only if a life is actually missing, otherwise nothing happens)
  if(state!=='play') return;
  const maxL = MODES[mode].lives;
  if(maxL<=0 || lives>=maxL) return;
  lives++; syncLives();
  const el=$('h-lives'); el.classList.remove('hit','gain'); void el.offsetWidth; el.classList.add('gain');
  floatText(hit.x, hit.y-p.def.r-18, '+1 LIFE', '#2f7a44', 14);
  vignMax=1.6; vignT=1.6; vignStr=.22; vignRed=false; vignGreen=true;   // soft green breath from the edges
  S.shimmer();
}
/* --- hazard burst — shared by the training objects & the boss --- */
function spikeBurst(x,y,n,o){        // radial ring of small flying spikes
  for(let i=0;i<n;i++){
    const a=(i/n)*TAU+rand(-.22,.22), sp=rand(o.spd[0],o.spd[1]);
    hz.push({ kind:'spike', x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
              rot:a, vrot:rand(-8,8), size:o.size, dmg:o.dmg, purple:false,
              hits:0, cut:o.cut??0, t:0, warnT:.3, life:o.life, grav:520, dead:false });
  }                                  // .3s arming — the blade has already moved on
}
function onCutPineapple(p,ang,hit){  // PINEAPPLE — the leaves fly out as needles (½ a life)
  spikeBurst(hit.x, hit.y, 6, { spd:[300,520], dmg:.5, size:4.5, life:1.2 });
  S.rustle();
}
function onCutCactus(p,ang,hit){     // CACTUS — a full radial burst, the boss's spike-spin
  spikeBurst(hit.x, hit.y, 10, { spd:[240,430], dmg:1, size:5.5, life:1.5, cut:1 });
  S.rustle();
}
function drawCactus(g,r){
  g.fillStyle=INK;
  rr(g,-.24*r,-.72*r,.48*r,1.5*r,.24*r); g.fill();    // the trunk
  rr(g,-.8*r,-.5*r,.34*r,.72*r,.17*r);  g.fill();    // left arm
  rr(g,-.62*r,-.04*r,.44*r,.3*r,.15*r); g.fill();    // left join
  rr(g,.46*r,-.62*r,.34*r,.8*r,.17*r);  g.fill();    // right arm
  rr(g,.18*r,-.1*r,.44*r,.3*r,.15*r);  g.fill();     // right join
  g.strokeStyle='#fff'; g.lineWidth=.05*r; g.lineCap='round';
  for(const [sx,sy] of [[-.1,-.5],[.12,-.18],[-.14,.2],[.06,.56],[-.66,-.34],[-.68,.1],[.62,-.44],[.6,-.02],[-.02,-.66]]){
    g.beginPath(); g.moveTo(sx*r,sy*r); g.lineTo((sx+.11)*r,(sy-.09)*r); g.stroke();
  }
}
function drawMedkit(g,r){    // ink fallback — the PNG takes over once loaded
  g.fillStyle=INK;
  rr(g,-.85*r,-.6*r,1.7*r,1.2*r,.14*r); g.fill();
  g.fillStyle='#fff';
  g.fillRect(-.13*r,-.38*r,.26*r,.76*r);
  g.fillRect(-.38*r,-.13*r,.76*r,.26*r);
}
function drawCroissant(g,r){ // ink fallback — the PNG takes over once loaded
  g.fillStyle=INK;
  g.beginPath();
  g.moveTo(-.9*r,.4*r);
  g.bezierCurveTo(-1.05*r,-.4*r, -.45*r,-.85*r, 0,-.5*r);
  g.bezierCurveTo(.45*r,-.85*r, 1.05*r,-.4*r, .9*r,.4*r);
  g.bezierCurveTo(.5*r,.1*r, .25*r,.5*r, 0,.5*r);
  g.bezierCurveTo(-.25*r,.5*r, -.5*r,.1*r, -.9*r,.4*r);
  g.closePath(); g.fill();
  g.strokeStyle='#fff'; g.lineWidth=.05*r;
  g.beginPath(); g.moveTo(-.5*r,-.22*r); g.quadraticCurveTo(0,-.58*r, .5*r,-.22*r); g.stroke();
}

/* --- THE REGISTRY --- */
const DEFS = [
  { id:'apple',  name:'APPLE',       r:30, sm:2.7, value:10,  cur:1, fruit:true, w:30, minT:0,   draw:drawApple,  missPenalty:true },
  { id:'orange', name:'ORANGE',      r:20, sm:2.5, value:8,   cur:1, fruit:true, w:24, minT:0,   draw:drawOrange, missPenalty:true },
  { id:'pear',   name:'PEAR',        r:26, sm:2.6, value:12,  cur:1, fruit:true, w:15, minT:4,   draw:drawPear,   missPenalty:true, img:'Pear.png', ib:[150,82,201,337] },
  { id:'melon',  name:'WATERMELON',  r:46, sm:2.4, value:25,  cur:1, fruit:true, w:11, minT:6,   draw:drawMelon,  missPenalty:true, mass:1.7, tough:.6, impact:45, trauma:.22, onCut:onCutMelon, img:'Watermelon.png', ib:[84,84,333,333] },
  /* ---- BATCH 1: KITCHEN & FOOD ---- */
  { id:'banana',    name:'BANANA',      r:26, sm:2.5, value:10, cur:1, fruit:true, w:14, minT:0,  draw:drawBanana,    missPenalty:true, img:'Banana.png', ib:[12,48,157,213] },
  { id:'strawberry',name:'STRAWBERRY',  r:17, sm:2.5, value:16, cur:1, fruit:true, w:12, minT:2,  draw:drawStrawberry, missPenalty:true, tough:.45, img:'Strawberry.png', ib:[408,160,213,269] },
  { id:'toast',     name:'TOAST',       r:24, sm:2.5, value:9,  cur:1, fruit:true, w:11, minT:4,  draw:drawToast,     missPenalty:true, img:'Bread.png', ib:[40,56,153,145], sfx:'toast', jag:true },
  { id:'egg',       name:'EGG',         r:18, sm:2.3, value:10, cur:1, fruit:true, w:10, minT:5,  draw:drawEgg,       missPenalty:true, img:'Egg.png', ib:[98,50,305,399], sfx:'egg', jag:true, shard:'#fff' },
  { id:'sushi',     name:'SUSHI',       r:20, sm:2.5, value:14, cur:1, fruit:true, w:8,  minT:7,  draw:drawSushi,     missPenalty:true, img:'Sushi.png', ib:[100,164,301,173] },
  { id:'donut',     name:'DONUT',       r:21, sm:2.4, value:9,  cur:1, fruit:true, w:10, minT:9,  draw:drawDonut,     missPenalty:true, tough:.4, jag:true },
  { id:'cheese',    name:'CHEESE',      r:24, sm:2.6, value:12, cur:1, fruit:true, w:9,  minT:11, draw:drawCheese,    missPenalty:true },
  { id:'candy',     name:'CANDY',       r:15, sm:2.4, value:22, cur:3, w:6,  minT:12, draw:drawCandy,     rare:true, tough:.35 },
  { id:'lollipop',  name:'LOLLIPOP',    r:19, sm:2.6, value:18, cur:3, w:5,  minT:14, draw:drawLollipop,  rare:true, tough:.5, img:'Lollipop.png', ib:[170,76,161,349] },
  { id:'fish',      name:'FISH',        r:23, sm:2.7, value:26, cur:3, w:6,  minT:16, draw:drawFish,      sfx:'squish', flippable:true, rare:true, spawn:spawnFish, update:updateFish },
  { id:'mushroom',  name:'MUSHROOM',    r:23, sm:2.6, value:12, cur:1, fruit:true, w:9,  minT:18, draw:drawMushroom,  missPenalty:true, img:'Mushroom.png', ib:[100,74,299,363] },
  { id:'carrot',    name:'CARROT',      r:25, sm:2.7, value:11, cur:1, fruit:true, w:9,  minT:20, draw:drawCarrot,    missPenalty:true, tough:.7 },
  { id:'broccoli',  name:'BROCCOLI',    r:23, sm:2.6, value:13, cur:1, fruit:true, w:8,  minT:22, draw:drawBroccoli,  missPenalty:true },
  { id:'drumstick', name:'DRUMSTICK',   r:24, sm:2.6, value:20, cur:1, fruit:true, w:8,  minT:24, draw:drawDrumstick, missPenalty:true, mass:1.3, tough:.6, img:'ChickenDrumstick.png', ib:[96,84,305,333] },
  { id:'burger',    name:'HAMBURGER',   r:27, sm:2.5, value:22, cur:1, fruit:true, w:7,  minT:26, draw:drawBurger,    missPenalty:true, mass:1.2, tough:.55 },
  { id:'pizza',     name:'PIZZA SLICE', r:27, sm:2.6, value:18, cur:1, fruit:true, w:7,  minT:28, draw:drawPizza,     missPenalty:true, img:'PizzaSlice.png', ib:[40,92,225,225] },
  { id:'pineapple', name:'PINEAPPLE',   r:29, sm:3.0, value:25, cur:1, fruit:true, w:6,  minT:30, draw:drawPineapple, missPenalty:true, mass:1.3, tough:.6, img:'PineApple.png', ib:[88,0,149,329], onCut:onCutPineapple },
  { id:'cactus',    name:'CACTUS',      r:27, sm:2.7, value:22, cur:2, w:6,  minT:14, draw:drawCactus, missPenalty:true, tough:.7, jag:true, onCut:onCutCactus },
  { id:'croissant', name:'CROISSANT',   r:20, sm:2.9, value:14, cur:1, fruit:true, w:7,  minT:26, draw:drawCroissant, missPenalty:true, img:'Croassaint.png', ib:[12,28,119,59], jag:true },
  { id:'icecream',  name:'ICE CREAM',   r:22, sm:2.6, value:24, cur:3, w:5,  minT:33, draw:drawIceCream,  rare:true, update:updateIceCream, life:8 },
  { id:'teapot',    name:'TEAPOT',      r:26, sm:2.9, value:30, cur:3, w:5,  minT:36, draw:drawTeapot,    sfx:'teapot', rare:true, onCut:onCutTeapot, img:'TeaPot.png', ib:[12,56,221,149] },
  { id:'coffee',    name:'COFFEE',      r:21, sm:2.8, value:35, cur:3, w:5,  minT:38, draw:drawCoffee,    rare:true, onCut:onCutCoffee, img:'CoffeMug.png', ib:[36,64,165,129], jag:true },
  { id:'melonslice',name:'MELON SLICE', r:26, sm:2.5, value:12, cur:1, fruit:true, w:8,  minT:40, draw:drawMelonSlice, missPenalty:true },
  { id:'garlic',    name:'GARLIC',      r:15, sm:2.5, value:28, cur:3, w:4,  minT:44, draw:drawGarlic,    rare:true, tough:.5, img:'Garlic.png', ib:[48,60,385,385], jag:true },
  { id:'fork',      name:'FORK',        r:24, sm:2.7, value:55, cur:3, w:3,  minT:48, draw:drawFork,      rare:true, tough:1.2, img:'Fork.png', ib:[208,70,93,385] },
  { id:'wineglass', name:'WINE GLASS',  r:23, sm:2.5, value:40, cur:3, w:4,  minT:52, draw:drawWineGlass, sfx:'shatter', jag:true, rare:true, onCut:onCutWine },
  { id:'soda',      name:'FIZZ',        r:27, sm:2.7, value:45, cur:3, w:4,  minT:55, draw:drawBottle,    sfx:'fizz', rare:true, onCut:onCutBottle, jag:true },
  { id:'coin',   name:'COIN',        r:17, sm:2.1, value:15,  cur:3, w:8,  minT:15,  draw:drawCoin,   sfx:'coin', precision:true, rare:true },
  { id:'balloon',name:'BALLOON',     r:24, sm:2.7, value:10,  cur:3, w:7,  minT:25,  draw:drawBalloon, sfx:'pop', tough:.12, fragment:false, rare:true, spawn:spawnBalloon, update:updateBalloon, onCut:onCutBalloon },
  { id:'duck',   name:'DUCK',        r:27, sm:2.6, value:20,  cur:3, w:6,  minT:35,  draw:drawDuck,   sfx:'duck', tough:.4, rare:true, spawn:spawnDuck, update:updateDuck, img:'RubberDuck.png', ib:[44,48,245,225] },
  { id:'bulb',   name:'LIGHT BULB',  r:25, sm:2.4, value:40,  cur:3, w:6,  minT:30,  draw:drawBulb,   sfx:'zap', impact:30, trauma:.12, rare:true, onCut:onCutBulb },
  { id:'mouse',  name:'MOUSE',       r:15, sm:3.7, value:80,  cur:3, w:6,  minT:45,  draw:drawMouse,  sfx:'squeak', tough:.6, flippable:true, rare:true, spawn:spawnMouse, update:updateMouse },
  { id:'eye',    name:'EYE',         r:25, sm:2.3, value:30,  cur:3, w:5,  minT:55,  draw:drawEye,    sfx:'squish', tough:.45, live:true, rare:true, spawn:spawnEye, update:updateEye, onCut:onCutEye },
  { id:'ice',    name:'ICE BLOCK',   r:30, sm:2.2, value:35,  cur:3, w:5,  minT:60,  draw:drawIce,    sfx:'ice', jag:true, stain:'#a9cde6', rare:true, onCut:onCutIce, img:'IceBlock.png', ib:[78,66,349,377] },
  { id:'cracker',name:'FIRECRACKER', r:23, sm:2.7, value:30,  cur:3, w:5,  minT:75,  draw:drawCracker, sfx:'crackle', tough:.35, trauma:.2, rare:true, onCut:onCutCracker, jag:true },
  { id:'clock',  name:'CLOCK',       r:27, sm:2.4, value:50,  cur:3, w:4,  minT:90,  draw:drawClock,  sfx:'riser', live:true, rare:true, onCut:onCutClock },
  { id:'medkit', name:'MED KIT',     r:26, sm:2.6, value:40, cur:3, w:2,  minT:55,  draw:drawMedkit,  tough:.7, rare:true, onCut:onCutMedkit, img:'MedKit.png', ib:[84,100,333,287], sfx:'medkit' },
  { id:'piano',  name:'PIANO',       r:55, sm:2.6, value:220, cur:5, w:3,  minT:110, draw:drawPiano,  sfx:'chord', mass:5, tough:2, impact:120, trauma:.5, missPenalty:true, spawn:spawnPiano, update:updatePiano, onCut:onCutPiano, img:'Piano.png', ib:[30,42,351,337] },
  { id:'bomb',   name:'BOMB',        r:25, sm:2.9, value:0,   cur:0, w:t=>Math.min(13,(t-20)*.18), minT:20, draw:drawBomb, sfx:'boom', tough:.05, dangerous:true, fragment:false, live:true, onCut:onCutBomb },
  { id:'goldenApple', name:'GOLDEN APPLE', r:13, sm:2.6, value:150, cur:3, w:0, pool:false, minT:0, draw:drawGoldApple, sfx:'gold', tough:.8, impact:55, trauma:.2, stain:'#c9a227', update:updateGold, onCut:onCutGold },
  { id:'spark',  name:'SPARK',       r:8,  sm:2.2, value:6,   cur:1, w:0,  pool:false, minT:0, draw:drawSpark, tough:.25, mass:.4, life:1.7, update:updateSpark },
];
const D = {}; DEFS.forEach(d=>D[d.id]=d);
const FRUITS = [D.apple, D.orange, D.pear, D.melon];
const GOLDEN = D.goldenApple;
const FRUITY = DEFS.filter(d=>d.fruit && !d.dangerous);   // every fruit — dungeon fruit floors & the boss shake

/* --- sprite cache (each silhouette rendered once, reused for halves) --- */
const spriteCache = {};
const OBJ_IMG = {};   // PNG object art (Assets/Objects), filled by the loader below
function getSprite(d){
  let s = spriteCache[d.id];
  if(!s){
    const size = Math.ceil(d.r*(d.sm||2.7)), SS = 2;
    const c = document.createElement('canvas');
    c.width = c.height = size*SS;
    const g = c.getContext('2d');
    g.scale(SS,SS); g.translate(size/2,size/2); g.lineJoin='round';
    const im = d.img ? OBJ_IMG[d.id] : null;
    if(im){
      // PNG art — the ib content box is scaled so the image fills the hitbox (diameter 2r)
      const ib = d.ib || [0,0,im.width,im.height];
      const k  = 2*d.r/Math.max(ib[2],ib[3]);
      g.drawImage(im, ib[0],ib[1],ib[2],ib[3], -ib[2]*k/2,-ib[3]*k/2, ib[2]*k, ib[3]*k);
    } else {
      d.draw(g, d.r, {t:0,x:0,y:0,rot:0});   // ink drawing (also the pre-load fallback)
    }
    s = spriteCache[d.id] = { c, s:size };
  }
  return s;
}
function getSpriteTinted(d, css, alpha){
  const key = d.id+'|'+css+'|'+alpha;
  let s = spriteCache[key];
  if(!s){
    const base = getSprite(d);
    const c = document.createElement('canvas');
    c.width = base.c.width; c.height = base.c.height;
    const g = c.getContext('2d');
    g.drawImage(base.c,0,0);
    g.globalCompositeOperation='source-atop';
    g.globalAlpha=alpha; g.fillStyle=css; g.fillRect(0,0,c.width,c.height);
    s = spriteCache[key] = { c, s:base.s };
  }
  return s;
}

/* --- PNG object art: images from ../Assets/Objects replace the ink drawings.
       They load in the background — the ink version shows for the first
       instants, then the sprite cache is invalidated and rebuilt with the PNG. --- */
DEFS.forEach(d=>{
  if(!d.img) return;
  const im = new Image();
  im.onload = ()=>{ OBJ_IMG[d.id] = im;
    for(const k in spriteCache) if(k===d.id || k.startsWith(d.id+'|')) delete spriteCache[k]; };
  im.onerror = ()=>{ console.warn('IMG: cannot load "../Assets/Objects/'+d.img+'" — using the ink drawing instead.'); };
  im.src = '../Assets/Objects/'+d.img;
});

/* =====================================================================
   FX — particles, stains, floaters, slashes, screen state
   ===================================================================== */
function addP(o){ parts.push(o); if(parts.length>320) parts.splice(0, parts.length-320); }

function splatStain(x,y,d,css){
  let col = css || d.stain || trail.css;
  if(hasRelic('golden')) col = tintGold(col);
  const R = d.r*rand(.55,.95);
  const blobs = [{ox:0,oy:0,r:R*.35}];
  const n = 5+(Math.random()*4|0);
  for(let i=0;i<n;i++){
    const a=rand(TAU), rr2=R*rand(.15,.75);
    blobs.push({ox:Math.cos(a)*rr2, oy:Math.sin(a)*rr2, r:R*rand(.12,.3)});
  }
  stains.push({x,y,blobs,css:col,age:0,max: isTrail('ink')?9:4.5});
  if(stains.length>46) stains.shift();
  for(let i=0;i<6;i++){
    const a=rand(TAU), sp=rand(60,240);
    addP({type:'ink', x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60, life:rand(.35,.7), max:.7, size:rand(1.5,3.5), css:col});
  }
}
function tintGold(css){
  const m = /^#?([0-9a-f]{6})$/i.exec(css||'');
  if(!m) return css;
  const n = parseInt(m[1],16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  const gr=Math.round(r+(201-r)*.5), gg=Math.round(g+(162-g)*.5), gb=Math.round(b+(39-b)*.5);
  return '#'+((gr<<16)|(gg<<8)|gb).toString(16).padStart(6,'0');
}
function floatText(x,y,text,css,size){
  floaters.push({x,y,text,css,size,life:1});
  if(floaters.length>26) floaters.shift();
}
function explosion(x,y){
  trauma = Math.min(1, trauma+.85); hitStop = Math.max(hitStop, 90);
  bgImpulses.push({c:[42,42,46], s:.85});
  addP({type:'ring', x,y, life:.5, max:.5, size:300, lw:15});
  addP({type:'flash', x,y, life:.16, max:.16, size:110});
  for(let i=0;i<12;i++)
    addP({type:'smoke', x:x+rand(-20,20), y:y+rand(-20,20), vx:rand(-60,60), vy:rand(-90,-10), life:rand(.5,.9), max:.9, size:rand(14,30)});
  for(let i=0;i<14;i++){
    const a=rand(TAU), sp=rand(180,520);
    addP({type:'debris', x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-80, life:rand(.4,.8), max:.8, size:rand(2,5), rot:rand(TAU), vr:rand(-9,9)});
  }
  for(const q of props){
    if(q.dead) continue;
    const dx=q.x-x, dy=q.y-y, dd=Math.hypot(dx,dy);
    if(dd<340 && dd>1){
      const f=(1-dd/340)*560;
      q.vx += dx/dd*f; q.vy += dy/dd*f - 60; q.vr += rand(-4,4);
    }
  }
}

/* =====================================================================
   TRAIL FX — ambient particles + cut bursts (shared with preview)
   ===================================================================== */
const CONFETTI = ['#b3574f','#5a7f52','#5a6f9a','#9a8a4f','#7a5a86'];
const TFX = {
  ink:     { rate:10, spdMin:1.3,  make:(x,y)=>({type:'ink',css:'#101010',x,y,vx:rand(-70,70),vy:rand(-70,40),life:rand(.25,.5),max:.5,size:rand(1,2.5)}) },
  crimson: { rate:30, spdMin:.2,   make:(x,y)=>({type:'ink',css:'#c2202e',x,y,vx:rand(-70,70),vy:rand(-60,20),life:rand(.3,.6),max:.6,size:rand(1.5,3)}) },
  ghost:   { rate:36, spdMin:1.05, make:(x,y)=>({type:'dust',x,y,vx:rand(-40,40),vy:rand(-30,10),life:rand(.5,1),max:1,size:rand(1.5,3.5)}) },
  frost:   { rate:16, spdMin:.15,  make:(x,y)=>({type:'snow',x,y,vx:rand(-18,18),vy:rand(4,26),life:rand(1,2),max:2,size:rand(1.1,2.4),rot:rand(TAU)}) },
  gold:    { rate:16, spdMin:.15,  make:(x,y)=>({type:'goldstar',x,y,vx:rand(-22,22),vy:rand(-14,22),life:rand(.6,1.2),max:1.2,size:rand(1.3,2.6),rot:rand(TAU),vr:rand(-7,7)}) },
  fire:    { rate:38, spdMin:.2,   make:(x,y)=> Math.random()<.3
              ? {type:'smoke',x,y,vx:rand(-26,26),vy:rand(-70,-30),life:rand(.7,1.3),max:1.3,size:rand(4,9)}
              : {type:'ember',x,y,vx:rand(-50,50),vy:rand(-120,-30),life:rand(.35,.7),max:.7,size:rand(1.5,3.2)} },
  universe:{ rate:28, spdMin:.15,  make:(x,y)=>({type:'star',x,y,vx:rand(-16,16),vy:rand(-16,16),
                life:rand(.5,1.1),max:1.1,size:rand(1.2,2.8),rot:rand(TAU),
                css:pick(['#cbb2ff','#e9dcff','#f6f4ff','#a98ae8'])}) },
  lightning:{ rate:22, spdMin:.3,  make:(x,y)=>({type:'spark2',x,y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.1,.26),max:.26,size:rand(4,9),rot:rand(TAU)}) },
  liquid:   { rate:13, spdMin:.1,  make:(x,y)=>({type:'drop',x,y,vx:rand(-22,22),vy:rand(-5,25),life:rand(.5,1),max:1,size:rand(1.4,2.8)}) },
  wind:     { rate:26, spdMin:.5,  make:(x,y)=>({type:'gust',x,y,vx:rand(-26,26),vy:rand(-26,26),life:rand(.35,.7),max:.7,size:rand(7,15),rot:rand(TAU)}) },
  nature:   { rate:12, spdMin:.15, make:(x,y)=>({type:'leaf',x,y,vx:rand(-38,38),vy:rand(-8,42),life:rand(.7,1.4),max:1.4,size:rand(2,3.6),rot:rand(TAU),vr:rand(-4,4)}) },
  magnet:   { rate:11, spdMin:.15, make:(x,y)=>({type:'gleam',x,y,vx:rand(-20,20),vy:rand(-20,20),life:rand(.3,.6),max:.6,size:rand(1.5,3)}) },
  mirror:   { rate:12, spdMin:.15, make:(x,y)=>({type:'gleam',x,y,vx:rand(-24,24),vy:rand(-24,24),life:rand(.3,.6),max:.6,size:rand(1.5,3)}) },
  time:     { rate:10, spdMin:.15, make:(x,y)=>({type:'line',x,y,vx:rand(-12,12),vy:rand(-8,18),life:rand(.5,.9),max:.9,ang:rand(TAU),len:rand(4,8)}) },
  chaos:    { rate:14, spdMin:.15, make:(x,y)=>({type:'confetti',x,y,vx:rand(-30,30),vy:rand(-20,30),life:rand(.5,1),max:1,size:rand(1.5,3),rot:rand(TAU),vr:rand(-6,6),css:pick(CONFETTI)}) },
  bubble:   { rate:12, spdMin:.15, make:(x,y)=>({type:'bub',x,y,vx:rand(-16,16),vy:rand(-34,-12),life:rand(.6,1.2),max:1.2,size:rand(2,4.5)}) },
  solar:    { rate:15, spdMin:.15, make:(x,y)=>({type:'sunray',x,y,vx:rand(-22,22),vy:rand(-16,24),life:rand(.4,.9),max:.9,size:rand(1.4,2.6),rot:rand(TAU)}) },
  void:     { rate:16, spdMin:.15, make:(x,y)=>{ const a=Math.atan2(ptr.y-y,ptr.x-x)+rand(-.5,.5), sp=rand(90,220);
                return {type:'suckdot',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.3,.6),max:.6,size:rand(1,2)}; } },
};
function trailCutFX(list, hx, hy){
  const k = save.settings.fxCut; if(k<=0) return;
  const push = o=>{ list.push(o); if(list.length>320) list.splice(0, list.length-320); };
  switch(save.trail){
    case 'crimson':
      for(let i=0;i<Math.round(8*k);i++){ const a=rand(TAU), sp=rand(60,300);
        push({type:'ink',css:'#c2202e',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-50,life:rand(.4,.8),max:.8,size:rand(2,4)}); }
      break;
    case 'ghost':
      for(let i=0;i<Math.round(7*k);i++){ const a=rand(TAU), sp=rand(60,300);
        push({type:'dust',x:hx,y:hy,vx:Math.cos(a)*sp*.6,vy:Math.sin(a)*sp*.6-30,life:rand(.6,1.1),max:1.1,size:rand(2,4)}); }
      break;
    case 'frost':
      for(let i=0;i<Math.round(12*k);i++)
        push({type:'snow',x:hx,y:hy,vx:rand(-110,110),vy:rand(-50,70),life:rand(.9,1.8),max:1.8,size:rand(1.3,2.6),rot:rand(TAU)});
      break;
    case 'gold':
      S.coin();
      for(let i=0;i<Math.round(11*k);i++){
        const a=rand(TAU), sp=rand(70,320);
        push({type:'goldstar',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:rand(.6,1.1),max:1.1,size:rand(1.6,3),rot:rand(TAU),vr:rand(-9,9)});
      }
      break;
    case 'fire':
      for(let i=0;i<Math.round(12*k);i++)
        push({type:'ember',x:hx,y:hy,vx:rand(-140,140),vy:rand(-160,-20),life:rand(.4,.8),max:.8,size:rand(2,3.5)});
      for(let i=0;i<Math.round(5*k);i++)
        push({type:'smoke',x:hx,y:hy,vx:rand(-60,60),vy:rand(-90,-20),life:rand(.7,1.2),max:1.2,size:rand(5,10)});
      for(let i=0;i<Math.round(4*k);i++)
        push({type:'debris',css:'#4a2c1a',x:hx,y:hy,vx:rand(-160,160),vy:rand(-140,40),life:rand(.4,.7),max:.7,size:rand(2,4),rot:rand(TAU),vr:rand(-8,8)});
      break;
    case 'universe':
      S.voids();
      // purple nova — the solar explosion, recolored to galaxy glass (no gold in it)
      for(let i=0;i<Math.round(12*k);i++)
        push({type:'ray',x:hx,y:hy,ang:rand(TAU),life:.32,max:.32,len:rand(60,140),css:'#8a6cd4'});
      push({type:'ring',x:hx,y:hy,life:.55,max:.55,size:170,lw:8,css:'#8a6cd4'});
      push({type:'ring',x:hx,y:hy,life:.4,max:.4,size:110,lw:4,css:'#e9dcff'});
      for(let i=0;i<Math.round(12*k);i++)
        push({type:'sunray',x:hx,y:hy,vx:rand(-120,120),vy:rand(-120,120),life:rand(.4,.8),max:.8,size:rand(1.6,3),rot:rand(TAU),
              css:pick(['#8a6cd4','#a98ae8','#cbb2ff'])});
      for(let i=0;i<Math.round(14*k);i++){
        const a=rand(TAU), sp=rand(140,480);
        push({type:'star',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
              life:rand(.5,1.05),max:1.05,size:rand(1.4,3.6),rot:rand(TAU),
              css:pick(['#cbb2ff','#e9dcff','#f6f4ff','#a98ae8'])});
      }
      break;
    case 'lightning':
      for(let i=0;i<Math.round(10*k);i++){
        const a=rand(TAU);
        push({type:'spark2',x:hx,y:hy,vx:Math.cos(a)*rand(80,340),vy:Math.sin(a)*rand(80,340),life:rand(.12,.3),max:.3,size:rand(4,9),rot:a});
      }
      break;
    case 'liquid':
      for(let i=0;i<Math.round(14*k);i++){
        const a=rand(TAU), sp=rand(80,380);
        push({type:'drop',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-70,life:rand(.5,1.1),max:1.1,size:rand(1.6,3.4)});
      }
      for(let i=0;i<Math.round(6*k);i++)
        push({type:'ink',css:'#0b0b0d',x:hx,y:hy,vx:rand(-200,200),vy:rand(-220,60),life:rand(.35,.7),max:.7,size:rand(2,4.5)});
      break;
    case 'wind':
      for(let i=0;i<Math.round(9*k);i++){
        const a=rand(TAU);
        push({type:'gust',x:hx,y:hy,vx:Math.cos(a)*rand(120,360),vy:Math.sin(a)*rand(120,360),life:rand(.3,.6),max:.6,size:rand(8,16),rot:rand(TAU)});
      }
      break;
    case 'nature':
      S.rustle();
      for(let i=0;i<Math.round(12*k);i++){
        const a=rand(TAU), sp=rand(70,330);
        push({type:'leaf',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:rand(.6,1.3),max:1.3,size:rand(2,3.8),rot:rand(TAU),vr:rand(-7,7)});
      }
      break;
    case 'magnet':
      push({type:'ring',x:hx,y:hy,life:.35,max:.35,size:90,lw:4,css:'#9aa1a9'});
      for(let i=0;i<Math.round(8*k);i++)
        push({type:'gleam',x:hx,y:hy,vx:rand(-140,140),vy:rand(-140,140),life:rand(.25,.5),max:.5,size:rand(1.5,3.2)});
      break;
    case 'mirror':
      S.shimmer();
      for(let i=0;i<Math.round(8*k);i++)
        push({type:'gleam',x:hx,y:hy,vx:rand(-160,160),vy:rand(-160,160),life:rand(.25,.55),max:.55,size:rand(1.5,3.4)});
      break;
    case 'time':
      S.tick();
      push({type:'ring',x:hx,y:hy,life:.45,max:.45,size:150,lw:3,css:'#8a6d3b'});
      for(let i=0;i<Math.round(10*k);i++){
        const a=i/Math.round(10*k)*TAU;
        push({type:'line',x:hx,y:hy,vx:Math.cos(a)*40,vy:Math.sin(a)*40,life:.5,max:.5,ang:a,len:rand(5,9)});
      }
      break;
    case 'chaos':
      for(let i=0;i<Math.round(10*k);i++){
        const a=rand(TAU), sp=rand(60,280);
        push({type:'confetti',x:hx,y:hy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-70,life:rand(.5,1),max:1,size:rand(1.6,3),rot:rand(TAU),vr:rand(-8,8),css:pick(CONFETTI)});
      }
      break;
    case 'bubble':
      for(let i=0;i<Math.round(8*k);i++)
        push({type:'bub',x:hx,y:hy,vx:rand(-40,40),vy:rand(-80,-20),life:rand(.6,1.2),max:1.2,size:rand(2.5,5)});
      break;
    case 'solar':
      for(let i=0;i<Math.round(10*k);i++)
        push({type:'ray',x:hx,y:hy,ang:rand(TAU),life:.32,max:.32,len:rand(60,140),css:'#e8a13a'});
      push({type:'ring',x:hx,y:hy,life:.4,max:.4,size:130,lw:5,css:'#e8a13a'});
      for(let i=0;i<Math.round(9*k);i++)
        push({type:'sunray',x:hx,y:hy,vx:rand(-120,120),vy:rand(-120,120),life:rand(.4,.8),max:.8,size:rand(1.6,3),rot:rand(TAU)});
      break;
    case 'void':
      for(let i=0;i<Math.round(9*k);i++){
        const a=rand(TAU), r=rand(30,90);
        push({type:'suckdot',x:hx+Math.cos(a)*r,y:hy+Math.sin(a)*r,vx:-Math.cos(a)*r*4,vy:-Math.sin(a)*r*4,life:.28,max:.28,size:rand(1,2)});
      }
      break;
  }
}
/* per-blade gameplay, fired from cut() */
function trailOnCut(p, ang, hit, opts={}){
  switch(save.trail){
    case 'lightning': { // the storm leaps — arcs to the nearest neighbors (never bombs)
      if(opts.chain) break;
      for(let c=0, n=1+tlv('lightning'); c<n; c++){   // chains 1 → 2 → 3 → 4, mastered in THE LAB
        let best=null, bd=300;
        for(const q of props){
          if(q===p || q.dead || q.def.dangerous) continue;
          const d=Math.hypot(q.x-hit.x, q.y-hit.y);
          if(d<bd){ bd=d; best=q; }
        }
        if(!best) break;
        addP({type:'bolt', x0:hit.x, y0:hit.y, x1:best.x, y1:best.y, life:.22, max:.22});
        S.zapTrail();
        cut(best, Math.atan2(best.y-hit.y, best.x-hit.x), best.x, best.y, .5, {chain:true});
      }
      break;
    }
    case 'wind': { // the swing shoves everything nearby
      S.whoosh();
      for(const q of props){
        if(q.dead || q===p) continue;
        const dx=q.x-hit.x, dy=q.y-hit.y, d=Math.hypot(dx,dy);
        const R=240+50*tlv('wind');
        if(d<R && d>1){
          const f=(1-d/R)*(540+90*tlv('wind'));
          q.vx += dx/d*f; q.vy += dy/d*f - 110; q.vr += rand(-3,3);
        }
      }
      trauma = Math.min(1, trauma+.06);
      break;
    }
    case 'liquid': { // the heavy splash shoves what's nearby (radius & force LAB-upgraded)
      const R=170+30*tlv('liquid'), F=320+80*tlv('liquid');
      for(const q of props){
        if(q.dead || q===p) continue;
        const dx=q.x-hit.x, dy=q.y-hit.y, d=Math.hypot(dx,dy);
        if(d<R && d>1){ const f=(1-d/R)*F; q.vx+=dx/d*f; q.vy+=dy/d*f-60; q.vr+=rand(-2,2); }
      }
      break;
    }
    case 'solar': { // the flare — the nova leaves a burning zone in its radius (LAB widens it)
      const R = 150+40*tlv('solar');
      flares.push({ x:hit.x, y:hit.y, r:R, life:.6, max:.6 });
      addP({type:'ring', x:hit.x, y:hit.y, life:.5, max:.5, size:R*.85, lw:4, css:'#e8a13a'});
      break;
    }
    case 'nature': { // snare the neighbors
      for(const q of props){
        if(q.dead) continue;
        if(Math.hypot(q.x-hit.x, q.y-hit.y) < 220+45*tlv('nature')) q.vineT = 1.15+.2*tlv('nature');
      }
      break;
    }
    case 'mirror': { // a fading twin, reflected across the cut
      const sp = getSprite(p.def);
      addP({type:'ghostimg', spr:sp.c, size:sp.s*(p.scale||1),
            x:2*hit.x-p.x, y:2*hit.y-p.y, rot:-p.rot, life:.55+.15*tlv('mirror'), max:.55+.15*tlv('mirror')});
      break;
    }
    case 'time': { // the air freezes around the cut — not the blade
      for(const q of props){
        if(q.dead) continue;
        if(Math.hypot(q.x-hit.x, q.y-hit.y) < 260+55*tlv('time')) q.tsT = .9+.15*tlv('time');
      }
      break;
    }
    case 'chaos': chaosEffect(p, hit); break;
    case 'void':  voidCollapse(p); break;
  }
}
function chaosEffect(p, hit){
  const roll = pick(['SHOVE','SLOW','BOUNCE','SPIN','SHRINK','GROW','SPARKLE','POP']);
  floatText(hit.x, hit.y-42, roll, '#7a6b8f', 11);
  const CHS = 1+.12*tlv('chaos');               // THE LAB: chaos hits harder
  const fr = fragments.slice(-2);
  switch(roll){
    case 'SHOVE':
      for(const q of props){
        if(q.dead) continue;
        const dx=q.x-hit.x, dy=q.y-hit.y, d=Math.hypot(dx,dy);
        if(d<200*CHS && d>1){ const f=(1-d/(200*CHS))*380*CHS; q.vx+=dx/d*f; q.vy+=dy/d*f-70; }
      }
      break;
    case 'SLOW':
      for(const q of props){ if(!q.dead && Math.hypot(q.x-hit.x,q.y-hit.y)<220*CHS) q.tsT=.7; }
      break;
    case 'BOUNCE': for(const f of fr){ f.vy=-rand(380,560); f.vx*=.4; } break;
    case 'SPIN':   for(const f of fr) f.vr*=7*CHS; break;
    case 'SHRINK': for(const f of fr) f.size*=.5; break;
    case 'GROW':   for(const f of fr) f.size*=1.6; break;
    case 'SPARKLE':
      for(let i=0;i<14;i++){
        const a=rand(TAU), sp=rand(80,300);
        addP({type:'confetti',x:hit.x,y:hit.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:rand(.5,1),max:1,size:rand(1.6,3),rot:rand(TAU),vr:rand(-8,8),css:pick(CONFETTI)});
      }
      break;
    case 'POP':
      addP({type:'ring',x:hit.x,y:hit.y,life:.3,max:.3,size:70,lw:4});
      S.pop();
      for(const q of props){
        if(q.dead) continue;
        const dx=q.x-hit.x, dy=q.y-hit.y, d=Math.hypot(dx,dy);
        if(d<140 && d>1){ const f=(1-d/140)*220; q.vx+=dx/d*f; q.vy+=dy/d*f; }
      }
      break;
  }
}
function voidCollapse(p){ // no halves — a purple nova imploding inward
  const sp = getSprite(p.def);
  addP({type:'collapse', spr:sp.c, size:sp.s*(p.scale||1), x:p.x, y:p.y, rot:p.rot, life:.32, max:.32});
  addP({type:'ring', x:p.x, y:p.y, life:.42, max:.42, size:130, lw:5, css:'#8a6cd4'});
  for(let i=0;i<12;i++){
    const a=rand(TAU), r=rand(30,90);
    addP({type:'star', x:p.x+Math.cos(a)*r, y:p.y+Math.sin(a)*r,
          vx:-Math.cos(a)*r*3.2, vy:-Math.sin(a)*r*3.2,
          life:rand(.25,.45), max:.45, size:rand(1.2,2.6), rot:rand(TAU),
          css:pick(['#cbb2ff','#e9dcff','#f6f4ff','#a98ae8'])});
  }
  for(let i=0;i<9;i++){
    const a=rand(TAU), r=rand(26,80);
    addP({type:'suckdot', x:p.x+Math.cos(a)*r, y:p.y+Math.sin(a)*r,
          vx:-Math.cos(a)*r*3.4, vy:-Math.sin(a)*r*3.4, life:.3, max:.3, size:rand(1,2.2)});
  }
  S.voids();
}
function ignite(p){ // FIRE trail: even a graze sets objects ablaze
  if(p.burnT!=null) return;
  p.burnT = p.def.dangerous ? .38 : .8-.1*tlv('fire');
  S.ignite();
}
function burnOut(p){
  if(p.dead) return;
  cut(p, rand(TAU), p.x, p.y, .5, {burn:true});
}

/* =====================================================================
   SPAWNING & DIFFICULTY
   ===================================================================== */
function spawnProp(def, spd=1){
  const p = { def, x:0, y:H+def.r, vx:0, vy:0, rot:rand(TAU), vr:rand(-1.6,1.6),
              t:0, face:1, squash:0, thump:0, dead:false, phase:rand(TAU),
              jinkT:rand(.3,.8), glintT:0, bounces:0, burnT:null, embT:0,
              scale:(MODES[mode].sizeScale||1)*(diff().sizeMul||1)*cMul('size') };
  if(def.spawn){ def.spawn(p, spd); }
  else if(Math.random()<.62){
    p.x = rand(W*.18,W*.82); p.y = H+def.r;
    const apex = Math.min(H*rand(.5,.85), H*.92);
    p.vy = -Math.sqrt(2*GRAV*apex);
    const flight = 2*Math.abs(p.vy)/GRAV;
    p.vx = (W*.5-p.x)/flight*rand(.4,1)*spd;
  } else {
    const dir = Math.random()<.5 ? 1 : -1;
    p.x = dir>0 ? -def.r-10 : W+def.r+10;
    p.y = rand(H*.22,H*.55);
    p.vx = dir*rand(260,400)*spd;
    p.vy = -rand(140,360)*spd;
  }
  props.push(p);
  return p;
}
function pickDef(t){
  let tot=0; const el=[];
  for(const d of DEFS){
    if(d.pool===false) continue;
    if(t < d.minT) continue;
    if(MODES[mode].noBombs && d.dangerous) continue;
    if(MODES[mode].custom && ((!save.custom.bombs && d.dangerous) || save.custom.off.includes(d.id))) continue;
    let w = typeof d.w==='function' ? d.w(t) : d.w;
    if(w<=0) continue;
    if(d.rare) w *= fate();
    el.push([d,w]); tot += w;
  }
  let r = Math.random()*tot;
  for(const [d,w] of el){ r -= w; if(r<0) return d; }
  return FRUITS[0];
}
function volley(t){
  const m = MODES[mode], df = diff();
  const tt = t*(m.timeShift||1) + (mode==='dungeon' ? (DG.lvl-1)*12 : 0);   // deeper floors unlock deeper shapes
  if(props.length > (m.density||24)) return;
  const cap = m.capFn ? m.capFn(tt) : 1 + (tt>12?1:0) + (tt>40?1:0) + (tt>78?1:0);
  let n=1; while(n<cap && Math.random() < Math.min(.6, tt/170)*(m.greed||1)) n++;
  const spd = ((m.spdBonus||0) + (1+Math.min(.5, tt/260))*(df.speedMul||1))*cMul('speed');
  let bombs=0;
  for(let i=0;i<n;i++){
    let d = pickDef(tt);
    if(d.dangerous){ if(bombs >= (m.maxBombs??1)) d = pick(FRUITS); else bombs++; }
    spawnProp(d, spd);
  }
  if(tt>25 && Math.random() < .009*fate()) spawnProp(GOLDEN, spd*1.15);
  if(tt>90 && !goldSeen){ goldSeen=true; spawnProp(GOLDEN, 1.1); }
}

/* =====================================================================
   CUTTING — segment vs circle, speed-gated, splits sprites in half
   ===================================================================== */
function segCircle(x0,y0,x1,y1,cx,cy,r){
  const dx=x1-x0, dy=y1-y0, l2=dx*dx+dy*dy;
  let t = l2 ? ((cx-x0)*dx+(cy-y0)*dy)/l2 : 0;
  t = clamp(t,0,1);
  const px=x0+t*dx-cx, py=y0+t*dy-cy;
  return (px*px+py*py <= r*r) ? t : -1;
}
function processCuts(){
  if(state==='pause' || !cutSegs.length){ cutSegs.length=0; return; }
  const list = props.slice();
  for(const s of cutSegs){
    for(const p of list){
      if(p.dead) continue;
      const R = p.def.r*(p.scale||1) + edgeBonus();
      const t = segCircle(s.x0,s.y0,s.x1,s.y1,p.x,p.y,R);
      if(t<0) continue;
      const req = (p.def.tough ?? .5)*(MODES[mode].toughMul||1)*(diff().toughMul||1)*cMul('tough');
      if(s.sp < req){
        if(isTrail('fire')){ ignite(p); continue; }   // fire doesn't need speed — it needs contact
        if(p.burnT!=null) continue;
        if(p.thump<=0){
          p.thump=.5; S.thump();
          p.squash = Math.min(1,(p.squash||0)+.6);
          p.vr += rand(-1.5,1.5);
          if(state==='play' && !taughtFaster){
            taughtFaster = true;
            floatText(p.x, p.y-p.def.r-18, 'SWING FASTER', '#8a8a8a', 12);
          }
        }
        continue;
      }
      const ang = Math.atan2(s.y1-s.y0, s.x1-s.x0);
      cut(p, ang, s.x0+(s.x1-s.x0)*t, s.y0+(s.y1-s.y0)*t, t);
    }
  }
  /* THE OBJECT MONSTER — the blade bites the ball */
  if(BOSS.on && !BOSS.dying){
    for(const s of cutSegs){
      if(segCircle(s.x0,s.y0,s.x1,s.y1,BOSS.x,BOSS.y,BOSS.r*.8)>=0 && s.sp>=.5){ bossHit(); break; }
    }
  }
  /* hazards — spikes crack and shatter, ants pop, bulbs defuse, shards dust */
  for(const s of cutSegs){
    if(s.sp < .4) continue;
    for(const h of hz){
      if(h.dead || !h.cut || h.t < (h.warnT||0)) continue;    // unarmed spikes can't be touched yet
      if(segCircle(s.x0,s.y0,s.x1,s.y1,h.x,h.y,h.size+edgeBonus()) < 0) continue;
      h.hits = (h.hits||0)+1;
      if(h.hits >= h.cut) hazKill(h);
      else {                                    // a crack — the purple glass groans
        S.thump();
        addP({type:'ink', x:h.x, y:h.y, vx:rand(-60,60), vy:rand(-60,10), life:.3, max:.3, size:rand(1,2)});
      }
    }
  }
  cutSegs.length = 0;
}
function cut(p, ang, hx, hy, tt, opts={}){
  p.dead = true;
  p._cut = true;   // (lets the tutorial respawn anything that slips away uncut)
  const d = p.def;
  const rr2 = d.r*(p.scale||1)*1.4;
  if(!opts.burn){
    slashes.push({ x0:hx-Math.cos(ang)*rr2, y0:hy-Math.sin(ang)*rr2,
                   x1:hx+Math.cos(ang)*rr2, y1:hy+Math.sin(ang)*rr2, life:.14 });
    if(slashes.length>12) slashes.shift();
  }
  splatStain(hx,hy,d, opts.burn?'#4a3a33':undefined);
  if(state==='play'){
    run.cuts++; save.stats.cuts++;
    if(d.dangerous){
      combo = 0;
      save.stats.bombs = (save.stats.bombs||0)+1;
    }
    else{
      combo++; comboTimer = comboWindow();
      missStreak = 0;                 // a clean cut breaks the miss chain
      run.best = Math.max(run.best, combo);
      save.stats.best = Math.max(save.stats.best, combo);
      runCuts += (d.cur ?? 1);        // CUT currency
      let val = d.value;
      if(d.precision && Math.abs(tt-.5)<.14){
        val *= 3;
        floatText(hx, hy-d.r-22, 'PRECISE', '#a8861c', 12);
        S.coin();
      }
      const gain = Math.round(val * Math.min(combo,30) * fortune()
                 * trailPay()
                 * (goldT>0?2:1) * (fastT>0?2:1)
                 * (hasRelic('age')?2:1)
                 * (cMul('money')*(diff().moneyMul||1)));
      runMoney += gain;
      floatText(hx, hy-d.r-4, '+¥'+fmt(gain), d.id==='goldenApple' ? '#a8861c' : INK, gain>=100?16:13);
      S.combo(combo);
      if(isTrail('crimson') && d.fruit){          // CRIMSON perk: blood scent
        crimsonFruit++;
        const maxL = MODES[mode].lives;
        if(crimsonFruit>=30-5*tlv('crimson') && maxL>0 && lives<maxL){
          crimsonFruit = 0;
          lives++; syncLives();
          const el=$('h-lives'); el.classList.remove('hit','gain'); void el.offsetWidth; el.classList.add('gain');
          floatText(hx, hy-d.r-42, '+1 LIFE', '#b3202a', 14);
          S.buy();
        }
      }
    }
  }
  if(state==='play' && mode==='dungeon' && !d.dangerous) dgCount(d);   // the floor goal drinks the cut
  if(opts.burn){ S.crackle(); S.pop(); }
  else if(d.sfx) (S[d.sfx]||S.slice)(d.r);
  else if(d.fruit) S.fruitCut();
  else S.slice(d.r);
  if(d.onCut) d.onCut(p, ang, {x:hx,y:hy});
  if(opts.burn){
    const n = Math.round(14*save.settings.fxCut);
    for(let i=0;i<n;i++)
      addP({type:'ember',x:hx,y:hy,vx:rand(-160,160),vy:rand(-200,-30),life:rand(.4,.9),max:.9,size:rand(2,4)});
  } else {
    if(d.fragment!==false && !isTrail('void')) split(p, ang);
    if(d.shard){                               // material burst — eggshell chunks, glass, ice
      const n = Math.round(10*save.settings.fxCut);
      for(let i=0;i<n;i++){
        const a=rand(TAU), sp=rand(70,320);
        addP({type:'shard', x:hx, y:hy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-60,
              life:rand(.5,1.2), max:1.2, size:rand(2.6,6.5), rot:rand(TAU), vr:rand(-9,9), css:d.shard});
      }
    }
    trailCutFX(parts, hx, hy);
    trailOnCut(p, ang, {x:hx,y:hy}, opts);
  }
  if(d.impact){ hitStop = Math.max(hitStop, d.impact); trauma = Math.min(1, trauma+(d.trauma||.15)); }
}
function split(p, ang){
  const d = p.def;
  let spr;
  if(isTrail('fire'))        spr = getSpriteTinted(d,'#3a2015',.6);
  else if(isTrail('gold'))   spr = getSpriteTinted(d,'#caa61e',.5);
  else if(isTrail('mirror')) spr = getSpriteTinted(d,'#c7ccd2',.35);
  else                       spr = getSprite(d);
  const ice = isTrail('frost'), suck = isTrail('universe'), bub = isTrail('bubble');
  const jag = d.jag ? [] : null;                // jagged cut — the same teeth for both halves
  if(jag) for(let i=0;i<12;i++) jag.push(rand(-1,1));   // normalized: scaled to the object at draw time
  for(let side=-1; side<=1; side+=2){
    const nx=-Math.sin(ang), ny=Math.cos(ang);
    const imp = rand(70,150)/(d.mass??1);
    fragments.push({ spr:spr.c, size:spr.s*(p.scale||1), la:ang-p.rot, side, jag,
      ice, suck, bubble:bub,
      x:p.x, y:p.y, rot:p.rot, vr:side*rand(1.2,3.2)*(32/d.r), sep:2, life:0, alpha:1,
      vx:p.vx*.45 + nx*side*imp + Math.cos(ang)*rand(-40,40),
      vy:p.vy*.45 + ny*side*imp - rand(30,110) });
  }
  if(fragments.length>40) fragments.splice(0, fragments.length-40);
}

/* =====================================================================
   LIVES / RUN FLOW
   ===================================================================== */
function loseLife(x,y,opts={}){
  if(state!=='play') return;
  if(MODES[mode].lives===0) return;
  lives--; syncLives();
  const last = lives<=0;
  // feedback hierarchy: 1st miss subtle → streaks stronger → last life pulses red
  const str = Math.min(.6, (opts.bomb?.45:.15) + Math.min(missStreak,3)*.08 + (last?.2:0));
  vignMax=.32; vignT=.32; vignStr=str; vignRed = last || !!opts.bomb; vignGreen=false;
  trauma = Math.min(1, trauma + (opts.bomb?.25 : .04+str*.12));
  const el=$('h-lives');
  el.classList.remove('hit','gain'); void el.offsetWidth; el.classList.add('hit');
  S.hit(str, last);
  floatText(x, y-24, '−1 LIFE', '#b3202a', 14);
  if(lives<=0) endRun();
}
function bankRun(){
  if(!runBanked){
    save.bank += runMoney;
    save.cutsCur += runCuts;
    persist(); runBanked = true;
  }
}
function endRun(){
  bankRun();
  save.stats.runs++; persist();
  state='over'; overT=0; overShown=false; overTitle='THE BLADE RESTS';
}
function showGameOver(){
  document.body.classList.remove('playing');
  $('go-title').textContent = overTitle;                 // THE BLADE RESTS · FLOOR X CLEARED · …
  $('go-earn').textContent = '¥ '+fmt(runMoney);
  $('go-cuts').textContent = '+'+fmt(runCuts);
  $('go-best').textContent = '× '+run.best;
  const seal = $('go-seal');
  seal.classList.remove('stamp'); void seal.offsetWidth; seal.classList.add('stamp');
  show('scr-over'); S.stamp(); trauma = .5;
}
function startRun(){
  state='play';
  document.body.classList.add('playing');
  props.length=0; fragments.length=0; parts.length=0; floaters.length=0; slashes.length=0; cutSegs.length=0;
  hz.length=0; flares.length=0; BOSS.on=false; invulnT=0; halfHit=false; halfT=0;
  lives = MODES[mode].custom ? save.custom.lives : MODES[mode].lives; combo=0; comboTimer=0; runMoney=0; run={cuts:0,best:0};
  runCuts=0; crimsonFruit=0; missStreak=0; vignT=0;
  tRun=0; spawnT=.8; slowT=fastT=goldT=0; hitStop=0; trauma=0;
  overT=0; overShown=false; goldSeen=false; runBanked=false; taughtFaster=false;
  dgNext=false; DG={lvl:0,goal:null,got:0,boss:false,cleared:false};
  show(''); syncLives();
}
function toMenu(){
  state='menu';
  document.body.classList.remove('playing');
  props.length=0; fragments.length=0; cutSegs.length=0;
  hz.length=0; flares.length=0; BOSS.on=false;
  refreshMenuStats(); show('scr-menu');
}
function togglePause(){
  if(state==='play'){
    state='pause'; cutSegs.length=0; ptr.down=false;
    document.body.classList.remove('playing');
    $('pause-stats').textContent =
      `this run — ¥ ${fmt(runMoney)} · cuts +${fmt(runCuts)} · combo ×${combo}`;
    show('scr-pause');
  } else if(state==='pause'){
    state='play'; document.body.classList.add('playing');
    show('');
  }
}

/* =====================================================================
   DUNGEON — the descent. Normal rules (volleys · misses · bombs · the
   difficulty folds still apply), but every floor has a GOAL — and floors
   3 / 6 / 9 end with THE OBJECT MONSTER, stronger each time.
   ===================================================================== */
const DG_LEVELS = [
  { n:5,   type:'pineapple', label:'CUT 5 PINEAPPLES' },
  { n:75,  type:'fruit',     label:'CUT 75 FRUITS' },
  { n:100, type:'object',    label:'CUT 100 OBJECTS',  boss:1 },
  { n:125, type:'fruit',     label:'CUT 125 FRUITS' },
  { n:150, type:'object',   label:'CUT 150 OBJECTS' },
  { n:175, type:'fruit',     label:'CUT 175 FRUITS',  boss:2 },
  { n:200, type:'object',   label:'CUT 200 OBJECTS' },
  { n:225, type:'fruit',    label:'CUT 225 FRUITS' },
  { n:250, type:'object',   label:'CUT 250 OBJECTS',  boss:3 },
  { n:300, type:'object',   label:'CUT 300 OBJECTS' },
];
let DG = { lvl:0, goal:null, got:0, boss:false, cleared:false };

function startDungeonLevel(lvl){
  mode='dungeon'; save.mode='dungeon'; applyDiff();
  startRun();
  DG = { lvl, goal:DG_LEVELS[lvl-1], got:0, boss:false, cleared:false };
  floatText(W/2, H*.38, 'FLOOR '+lvl, INK, 26);
  floatText(W/2, H*.38+30, DG.goal.label, '#555', 13);
  if(DG.goal.boss) floatText(W/2, H*.38+52, 'SOMETHING STIRS BELOW', '#8a8a8a', 10);
}
function dgCount(d){                    // called from cut() — a cut feeds the floor goal
  const g = DG.goal;
  if(!g || DG.boss || DG.cleared) return;
  if(g.type==='pineapple' && d.id!=='pineapple') return;
  if(g.type==='fruit' && !d.fruit) return;
  DG.got++;
  if(DG.got>=g.n){
    if(g.boss){ DG.boss=true; bossStart(g.boss); }
    else dgClear();
  }
}
function dgClear(){
  DG.cleared=true; DG.boss=false; BOSS.on=false; hz.length=0;
  const last = DG.lvl>=10;
  endRun();
  overTitle = last ? 'THE DUNGEON IS CLEARED' : 'FLOOR '+DG.lvl+' CLEARED';
  save.dungeon.done[DG.lvl]=true;
  if(!last) save.dungeon.unlocked = Math.max(save.dungeon.unlocked||1, DG.lvl+1);
  dgNext = true; persist();
  floatText(W/2, H*.55, overTitle, INK, 20);
}
function buildDungeon(){                // the floor grid — 1..10, bosses every third
  const grid = $('dg-grid'); grid.innerHTML='';
  for(let i=1;i<=10;i++){
    const L = DG_LEVELS[i-1];
    const unlocked = i <= (save.dungeon.unlocked||1);
    const b = document.createElement('button');
    b.className = 'dg-cell'+(L.boss?' boss b'+L.boss:'')+(unlocked?'':' lock');
    b.innerHTML = '<i></i><span>'+i+'</span>';
    b.disabled = !unlocked;
    b.onclick = ()=>{ if(!unlocked) return; S.ui(); startDungeonLevel(i); };
    grid.appendChild(b);
  }
  $('dg-note').textContent = save.dungeon.done[10]
    ? 'THE DUNGEON IS CLEARED — EVERY FLOOR REMEMBERS YOU'
    : 'CUT THE GOAL TO DESCEND · A BOSS ON EVERY THIRD FLOOR · THE DIFFICULTY FOLDS STILL APPLY';
}
/* ---- hazard damage — ½ damage twice costs a life; i-frames between hits ---- */
function hazGate(){
  return state==='play' && lives>0 && !MODES[mode].noMiss
      && !(MODES[mode].custom && !save.custom.miss);
}
function hurtPlayer(x,y,dmg=1){
  if(!hazGate() || invulnT>0) return;
  x=clamp(x,40,W-40); y=clamp(y,40,H-40);
  if(dmg>=1){ invulnT=.9; halfHit=false; loseLife(x,y); }
  else if(halfHit){ halfHit=false; halfT=0; invulnT=.9; loseLife(x,y); }
  else{
    halfHit=true; halfT=12; invulnT=.7;      // the wound lingers — the next ½ finishes it
    vignMax=.32; vignT=.32; vignStr=.16; vignRed=true; vignGreen=false;
    trauma=Math.min(1,trauma+.08);
    floatText(x,y-22,'−½','#b3202a',12);
    S.hit(.14,false);
  }
}
function hazTouch(h){                    // the cursor itself, or the ribbon while it flies
  const R = h.size+8;
  if(Math.hypot(ptr.x-h.x, ptr.y-h.y) < R+4) return true;
  if(ptr.down){
    for(let i=trail.pts.length-1;i>=0;i--){
      const q = trail.pts[i];
      if(Math.hypot(q.x-h.x, q.y-h.y) < R) return true;
      if(trail.pts.length-i>16) break;
    }
  }
  return false;
}
function bulbShatter(h){                 // the bulb dies at the middle of the screen
  h.dead=true; S.shatter();
  const tp = BOSS.on ? BOSS.tp : { shardN:7, spd:1 };
  for(let i=0;i<tp.shardN;i++){
    const a=rand(TAU), sp=rand(120,300)*tp.spd;
    hz.push({ kind:'shard', x:h.x, y:h.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
              rot:a, vrot:rand(-10,10), size:4.5, dmg:.5, purple:false,
              hits:0, cut:1, t:0, warnT:0, life:3.2, grav:300, dead:false });
  }
  addP({type:'ring', x:h.x, y:h.y, life:.3, max:.3, size:40, lw:3, css:'#8a8a92'});
}
function hazKill(h){                     // destroyed by the blade
  h.dead=true;
  if(h.kind==='spike' && h.purple){       // purple glass shatters
    S.shatter();
    for(let i=0;i<8;i++){
      const a=rand(TAU), sp=rand(60,260);
      addP({type:'shard', x:h.x, y:h.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-40,
            life:rand(.4,.9), max:.9, size:rand(2,4.5), rot:rand(TAU), vr:rand(-9,9), css:'#8a7ab0'});
    }
  } else if(h.kind==='bulb'){             // a clean defuse — no shards
    S.shatter();
    addP({type:'ring', x:h.x, y:h.y, life:.3, max:.3, size:36, lw:3, css:'#8a8a92'});
  } else if(h.kind==='ant'){
    S.pop();
    for(let i=0;i<5;i++)
      addP({type:'ink', x:h.x, y:h.y, vx:rand(-90,90), vy:rand(-90,20), life:rand(.25,.5), max:.5, size:rand(1,2.4)});
  } else {
    S.pop();
    for(let i=0;i<4;i++)
      addP({type:'ink', x:h.x, y:h.y, vx:rand(-70,70), vy:rand(-70,20), life:rand(.2,.4), max:.4, size:rand(1,2)});
  }
}
function updateHazards(dt){
  for(const h of hz){
    h.t += dt;
    if(h.kind==='ant'){                  // the swarm chases the blade
      h.wig = (h.wig||rand(TAU)) + dt*9;
      const dx=ptr.x-h.x, dy=ptr.y-h.y, L=Math.hypot(dx,dy)||1;
      h.vx += (dx/L*h.spd - h.vx)*Math.min(1,dt*2.4);
      h.vy += (dy/L*h.spd - h.vy)*Math.min(1,dt*2.4);
      h.x += h.vx*dt + Math.cos(h.wig)*26*dt;
      h.y += h.vy*dt + Math.sin(h.wig*1.3)*26*dt;
    } else if(!h.static){
      h.vy += (h.grav??380)*dt;
      h.x += h.vx*dt; h.y += h.vy*dt;
      h.rot = (h.rot||0) + (h.vrot??7)*dt;
    }
    if(h.kind==='bulb' && !h.dead && h.y>=H*.5 && h.vy>0) bulbShatter(h);
    if(h.life && h.t>h.life) h.dead=true;
    if(h.x<-90 || h.x>W+90 || h.y>H+90 || h.y<-260) h.dead=true;
    if(!h.dead && h.dmg && h.t>=(h.warnT||0) && hazTouch(h)) hurtPlayer(h.x, h.y, h.dmg);
  }
  for(let i=hz.length-1;i>=0;i--) if(hz[i].dead) hz.splice(i,1);
  if(hz.length>140) hz.splice(0, hz.length-140);
}
function drawHazards(){
  for(const h of hz){
    if(h.warnT && h.t<h.warnT){          // telegraph — a red ghost where it will bite
      const k = h.t/h.warnT;
      ctx.globalAlpha = .2 + .45*k*(.6+.4*Math.sin(h.t*14));
      ctx.strokeStyle='#b3202a'; ctx.lineWidth=1.4; ctx.setLineDash([4,5]);
      ctx.beginPath(); ctx.arc(h.x,h.y,h.size+5,0,TAU); ctx.stroke();
      ctx.setLineDash([]); continue;
    }
    const end = h.life ? clamp((h.life-h.t)/.4, 0, 1) : 1;
    const grow = h.static ? clamp((h.t-(h.warnT||0))/.25, 0, 1) : 1;
    ctx.globalAlpha = end;
    const s = h.size*(.3+.7*grow);
    if(h.kind==='spike'){
      ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rot||0);
      ctx.fillStyle = h.purple ? '#6a4a9a' : INK;
      ctx.beginPath(); ctx.moveTo(0,-s*1.15); ctx.lineTo(s*.6,s*.8); ctx.lineTo(-s*.6,s*.8); ctx.closePath(); ctx.fill();
      if(h.purple){                      // white seams — they crack as the blade passes
        ctx.strokeStyle='#fff'; ctx.lineWidth=1;
        for(let i=0;i<(h.hits||0);i++){
          ctx.beginPath(); ctx.moveTo(-s*.4+i*s*.2,-s*.6); ctx.lineTo(-s*.2+i*s*.2,s*.5); ctx.stroke();
        }
      }
      ctx.restore();
    } else if(h.kind==='ant'){
      ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(Math.atan2(h.vy,h.vx));
      ctx.fillStyle=INK;
      ctx.beginPath(); ctx.ellipse(0,0,s*1.15,s*.62,0,0,TAU); ctx.fill();
      ctx.strokeStyle=INK; ctx.lineWidth=1; ctx.lineCap='round';
      for(const lg of [-.5,0,.5]){
        const ph=Math.sin(h.wig+lg*4)*.35;
        ctx.beginPath(); ctx.moveTo(lg*s*.8,s*.3);
        ctx.lineTo(lg*s*.8+Math.cos(ph)*s*.5, s*.3+Math.sin(ph)*s*.5); ctx.stroke();
      }
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s*.72,-s*.1,s*.16,0,TAU); ctx.fill();
      ctx.restore();
    } else if(h.kind==='bulb'){
      ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rot||0);
      ctx.fillStyle=INK;
      ctx.beginPath(); ctx.arc(0,-s*.45,s*.72,0,TAU); ctx.fill();
      ctx.fillRect(-s*.3,s*.05,s*.6,s*.5);
      ctx.fillStyle='#fff'; ctx.fillRect(-s*.14,-s*.75,s*.28,s*.9);   // the filament glints
      ctx.restore();
    } else if(h.kind==='shard'){
      ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rot||0);
      ctx.fillStyle=INK;
      ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s*.7,s*.7); ctx.lineTo(-s*.7,s*.7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha=1;
}

/* =====================================================================
   THE OBJECT MONSTER — every shape in the game, pressed into one
   giant ball. Cut it to hurt it. Floors 3 / 6 / 9: slow → chaining.
   ===================================================================== */
const BOSS_ATKS = ['spikes','shake','bulbs','bombs','ants','spin'];
const ATKN = { spikes:'SPIKE FIELD', shake:'FRUITFALL', bulbs:'LIGHT BULBS',
              bombs:'BOMB RAIN', ants:'THE SWARM', spin:'SPIKE SPIN' };
const TP = {   // per-tier: 3 = slow & forgiving · 6 = faster, combos · 9 = fast & chained
  1:{ hp:10, warn:1.35, rec:2.5,  spd:.8,  combo:0,   spikes:6,  purple:2, spikeLife:4.5,
      dropN:6,  dropIv:.55, bulbs:3, bulbIv:.6,  shardN:6,  bombs:4,  bombIv:.75,
      ants:4,  antSpd:95,  spinDur:5,   spinIv:.6,  spinSpd:330 },
  2:{ hp:16, warn:.85,  rec:1.35, spd:1,   combo:.3,  spikes:9,  purple:3, spikeLife:5.5,
      dropN:9,  dropIv:.36, bulbs:5, bulbIv:.42, shardN:9,  bombs:7,  bombIv:.5,
      ants:7,  antSpd:140, spinDur:6.5, spinIv:.36, spinSpd:460 },
  3:{ hp:22, warn:.5,   rec:.75,  spd:1.25,combo:.6,  spikes:13, purple:4, spikeLife:6.5,
      dropN:12, dropIv:.24, bulbs:8, bulbIv:.3,  shardN:13, bombs:11, bombIv:.34,
      ants:10, antSpd:185, spinDur:8,   spinIv:.24, spinSpd:600 },
};
let BOSS = { on:false };
function bossStart(tier){
  const tp = TP[tier];
  const ids = ['apple','melon','pear','orange','banana','toast','egg','donut','cheese','mushroom',
               'carrot','broccoli','strawberry','pineapple','cactus','fish','lollipop','sushi','croissant','candy'];
  const r = clamp(Math.min(W,H)*.14, 90, 150);
  const sprs=[];
  for(let i=0;i<7;i++){  const a=i/7*TAU;      sprs.push({ def:DEFS.find(x=>x.id===ids[i%ids.length]),
    dx:Math.cos(a)*r*.5, dy:Math.sin(a)*r*.5, rot:rand(TAU), rv:rand(-.7,.7), s:r*.52 }); }
  for(let i=0;i<11;i++){ const a=i/11*TAU+.28; sprs.push({ def:DEFS.find(x=>x.id===ids[(i+7)%ids.length]),
    dx:Math.cos(a)*r*.92, dy:Math.sin(a)*r*.92, rot:rand(TAU), rv:rand(-.9,.9), s:r*.4 }); }
  for(const s of sprs) s.spr = getSprite(s.def);
  BOSS = { on:true, tier, tp, hp:tp.hp, maxHp:tp.hp, sprs, r,
           x:W/2, y:-r*2, baseY:clamp(H*.3,120,H*.42), t:0, rot:0,
           st:'enter', warnT:0, recT:0, atkT:0, atkIv:0, atk:null,
           invT:0, flash:0, seq:[], chain:false, dying:0, spinA:0 };
  spawnT = 1e9;                 // the volleys stop — the floor is his now
  floatText(W/2, H*.5, 'THE OBJECT MONSTER', '#b3202a', 22);
  S.riser(); trauma=Math.min(1,trauma+.2);
}
function bossPick(){            // next attack — telegraphed before it bites
  const b=BOSS, tp=b.tp;
  if(!b.seq.length){
    b.seq = BOSS_ATKS.slice();
    for(let i=b.seq.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [b.seq[i],b.seq[j]]=[b.seq[j],b.seq[i]]; }
  }
  b.atk = b.seq.pop();
  b.warnT = tp.warn*(b.chain?.55:1);    // chained attacks warn faster (tier 2+)
  b.st='warn';
  floatText(b.x, b.y-b.r-30, ATKN[b.atk], '#b3202a', 15);
  S.riser();
}
function bossGo(){
  const b=BOSS, tp=b.tp;
  b.st='attack'; b.atkT=1.2; b.atkIv=0; b.chain=false;
  switch(b.atk){
    case 'spikes': {              // a field of spikes — the purple ones shatter after 5 passes
      const placed=[];
      for(let i=0;i<tp.spikes;i++){
        let x=W/2, y=H/2, ok=false, tries=0;
        while(!ok && tries++<30){
          x=rand(90,W-90); y=rand(130,H-110); ok=true;
          for(const q of placed) if(Math.hypot(q.x-x,q.y-y)<105){ ok=false; break; }
        }
        placed.push({x,y});
        hz.push({ kind:'spike', static:true, x, y, rot:rand(TAU), size:rand(15,22),
                  dmg:1, purple:i<tp.purple, hits:0, cut:i<tp.purple?5:0,
                  t:0, warnT:tp.warn*1.4, life:tp.spikeLife, dead:false });
      }
      S.thump();
      break; }
    case 'shake':  b.atkT = tp.dropN*tp.dropIv+.8; break;
    case 'bulbs':  b.atkT = tp.bulbs*tp.bulbIv+.6; break;
    case 'bombs':  b.atkT = tp.bombs*tp.bombIv+.8; break;
    case 'ants':   b.atkT = 2.4; bossAnts(Math.ceil(tp.ants*.6)); break;
    case 'spin':   b.atkT = tp.spinDur; b.spinA=0; S.whoosh(); break;
  }
}
function bossAnts(n){
  const b=BOSS;
  for(let i=0;i<n;i++)
    hz.push({ kind:'ant', x:b.x+rand(-b.r,b.r), y:b.y+b.r*.7, vx:rand(-40,40), vy:rand(20,80),
              spd:b.tp.antSpd, size:7, dmg:.5, purple:false, hits:0, cut:1,
              t:0, warnT:0, life:8, dead:false });
}
function bossAtk(b,dt){
  const tp=b.tp;
  b.atkT -= dt; b.atkIv -= dt;
  switch(b.atk){
    case 'shake':                  // he trembles — his fruits rain down, medkits among them
      b.x += (W/2-b.x)*Math.min(1,dt*2);
      b.y = b.baseY + Math.sin(b.t*34)*7;
      if(b.atkIv<=0){
        b.atkIv = tp.dropIv;
        const med = Math.random()<.22;
        const p = spawnProp(med ? D.medkit : pick(FRUITY), 1);
        p.x = b.x+rand(-b.r*.5,b.r*.5); p.y = b.y+b.r*.6;
        p.vx = rand(-130,130); p.vy = rand(40,150); p.vr = rand(-3,3);
        p._drop = med ? 'kit' : true;   // an uncut fruit costs ½ a life; a lost medkit costs nothing
      }
      break;
    case 'bulbs':                  // bulbs that shatter at the middle of the screen
      b.x += (W/2-b.x)*Math.min(1,dt*2);
      b.y = b.baseY + Math.sin(b.t*2.2)*8;
      if(b.atkIv<=0){
        b.atkIv = tp.bulbIv;
        const dx=ptr.x-b.x, dy=ptr.y-b.y, L=Math.hypot(dx,dy)||1;
        hz.push({ kind:'bulb', x:b.x, y:b.y+b.r*.6,
                  vx:dx/L*rand(150,260)*tp.spd+rand(-60,60), vy:Math.abs(dy/L)*rand(60,160)*tp.spd+120,
                  size:13, dmg:0, purple:false, hits:0, cut:1,
                  t:0, warnT:0, life:7, grav:240, rot:rand(-.3,.3), vrot:rand(-4,4), dead:false });
        S.tick();
      }
      break;
    case 'bombs':{                 // he strafes the sky, raining bombs
      b.x = W/2 + Math.sin(b.t*1.5)*W*.3;
      b.y = b.baseY*.55;
      if(b.atkIv<=0){
        b.atkIv = tp.bombIv;
        const p = spawnProp(D.bomb, 1);
        p.x = b.x; p.y = b.y+b.r*.7;
        p.vx = Math.cos(b.t*1.5)*W*.3*.35 + rand(-30,30); p.vy = rand(90,190);
      }
      break; }
    case 'ants':
      if(b.atkIv<=0){ b.atkIv=.5; bossAnts(2); }
      break;
    case 'spin': {                 // he circles the arena, flinging small spikes inward
      b.spinA += dt*tp.spinSpd;
      const M=95, pw=W-2*M, ph=H-2*M, peri=2*pw+2*ph;
      const s=((b.spinA%peri)+peri)%peri;
      let x,y;
      if(s<pw){ x=M+s; y=M; }
      else if(s<pw+ph){ x=W-M; y=M+(s-pw); }
      else if(s<2*pw+ph){ x=W-M-(s-pw-ph); y=H-M; }
      else { x=M; y=H-M-(s-2*pw-ph); }
      b.x=x; b.y=y;
      if(b.atkIv<=0){
        b.atkIv = tp.spinIv;
        const a = Math.atan2(H/2-y, W/2-x)+rand(-.5,.5);
        const sp = rand(190,300)*tp.spd, purple = Math.random()<.22;
        hz.push({ kind:'spike', x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                  rot:a, vrot:rand(-9,9), size:6.5, dmg:1, purple,
                  hits:0, cut:purple?5:1, t:0, warnT:0, life:3, grav:140, dead:false });
      }
      break; }
    default:                       // spike field — he waits, watching
      b.x += (W/2-b.x)*Math.min(1,dt*2);
      b.y = b.baseY + Math.sin(b.t*2.2)*8;
  }
  if(b.atkT<=0){ b.atk=null; b.st='recover'; b.recT=tp.rec; }
}
function bossUpdate(dt){
  const b=BOSS;
  if(!b.on || state!=='play') return;
  b.t += dt; b.rot += dt*.22;
  if(b.invT>0) b.invT -= dt;
  if(b.flash>0) b.flash -= dt;
  if(b.dying){                    // falling apart
    b.dying -= dt; b.y += dt*30;
    if(Math.random()<dt*20)
      addP({type:'smoke', x:b.x+rand(-b.r,b.r), y:b.y+rand(-b.r,b.r), vx:rand(-40,40), vy:rand(-90,-20), life:rand(.5,1), max:1, size:rand(10,22)});
    if(b.dying<=0){ BOSS.on=false; dgClear(); }
    return;
  }
  switch(b.st){
    case 'enter':
      b.y += (b.baseY-b.y)*Math.min(1,dt*2);
      if(b.t>1.6) bossPick();
      break;
    case 'warn':
      b.y = b.baseY + Math.sin(b.t*2.2)*8;
      b.warnT -= dt;
      if(b.warnT<=0) bossGo();
      break;
    case 'attack': bossAtk(b,dt); break;
    case 'recover':
      b.x += (W/2-b.x)*Math.min(1,dt*2.2);
      b.y += (b.baseY-b.y)*Math.min(1,dt*2.2);
      b.recT -= dt;
      if(b.recT<=0){
        b.chain = b.tier>=2 && Math.random()<b.tp.combo;   // tier 2+: attacks chain together
        bossPick();
      }
      break;
  }
}
function bossHit(){
  const b=BOSS;
  if(b.invT>0 || b.dying) return;
  b.hp--; b.invT=.34; b.flash=.13;
  trauma=Math.min(1,trauma+.16); hitStop=Math.max(hitStop,24);
  S.thump();
  for(let i=0;i<10;i++){
    const a=rand(TAU), sp=rand(60,240);
    addP({type:'ink', x:b.x+Math.cos(a)*b.r*.7, y:b.y+Math.sin(a)*b.r*.7,
          vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rand(.3,.6), max:.6, size:rand(1.5,3)});
  }
  addP({type:'ring', x:b.x, y:b.y, life:.25, max:.25, size:b.r*1.1, lw:3});
  if(b.hp<=0) bossDie();
}
function bossDie(){
  const b=BOSS;
  b.dying=1.6; b.hp=0;
  hz.length=0;                     // the arena goes quiet
  explosion(b.x,b.y); S.boom();
  for(const s of b.sprs)
    addP({type:'debris', x:b.x+s.dx, y:b.y+s.dy, vx:s.dx*3+rand(-160,160), vy:s.dy*3-rand(120,320),
          life:rand(.5,1), max:1, size:rand(3,7), rot:rand(TAU), vr:rand(-9,9)});
  const bonus = 2000*b.tier;
  runMoney += bonus; runCuts += 8*b.tier;
  floatText(b.x, b.y-b.r-20, '+'+fmt(bonus)+' ¥', INK, 15);
  floatText(W/2, H*.55, 'THE OBJECT MONSTER FALLS', INK, 20);
}
function drawBossBody(){
  const b=BOSS;
  if(!b.on) return;
  if(b.st==='warn'){               // the telegraph — a red ring that pulses with the warning
    const pu=.5+.5*Math.sin(b.t*16);
    ctx.globalAlpha=.3+.4*pu;
    ctx.strokeStyle='#b3202a'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r+14+pu*8,0,TAU); ctx.stroke();
    ctx.globalAlpha=1;
  }
  ctx.save();
  ctx.translate(b.x + (b.st==='attack'&&b.atk==='shake' ? rand(-5,5) : 0), b.y);
  if(b.flash>0) ctx.translate(rand(-3,3), rand(-3,3));
  ctx.rotate(b.rot);
  for(const s of b.sprs){          // every shape in the game, pressed into one ball
    ctx.save();
    ctx.translate(s.dx, s.dy);
    ctx.rotate(s.rot + b.t*s.rv);
    ctx.drawImage(s.spr.c, -s.s/2, -s.s/2, s.s, s.s);
    ctx.restore();
  }
  ctx.fillStyle=INK;               // the dark core that holds it all together
  ctx.beginPath(); ctx.arc(0,0,b.r*.55,0,TAU); ctx.fill();
  const ang = Math.atan2(ptr.y-b.y, ptr.x-b.x)-b.rot;   // two white slits track the blade
  const ex=Math.cos(ang)*b.r*.14, ey=Math.sin(ang)*b.r*.14;
  ctx.fillStyle='#fff';
  for(const sd of [-1,1]){
    ctx.save();
    ctx.translate(sd*b.r*.2+ex*.5, -b.r*.06+ey*.5);
    ctx.rotate(sd*.22);
    ctx.fillRect(-b.r*.085, -b.r*.026, b.r*.17, b.r*.052);
    ctx.restore();
  }
  if(b.flash>0){
    ctx.globalAlpha=Math.min(1,b.flash*7); ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(0,0,b.r*.62,0,TAU); ctx.fill(); ctx.globalAlpha=1;
  }
  if(b.invT>0 && !b.dying){        // brief invulnerability shimmer between hits
    ctx.globalAlpha=.2+.2*Math.sin(b.t*60);
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,b.r*.85,0,TAU); ctx.stroke(); ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawBossBar(){
  const b=BOSS;
  if(!b.on || b.dying) return;
  const bw=280, bh=6, x=(W-bw)/2, y=86;
  ctx.strokeStyle=INK; ctx.lineWidth=1;
  ctx.strokeRect(x-1.5, y-1.5, bw+3, bh+3);
  ctx.fillStyle='#b3202a';
  ctx.fillRect(x, y, bw*clamp(b.hp/b.maxHp,0,1), bh);
  ctx.fillStyle=INK; ctx.textAlign='center';
  ctx.font='600 10px "IBM Plex Mono", monospace';
  ctx.fillText('THE OBJECT MONSTER · '+b.hp+'/'+b.maxHp, W/2, y-8);
  ctx.textAlign='left';
}
function drawFlares(){             // SOLAR — the lingering burn zones
  for(const fl of flares){
    const a = clamp(fl.life/fl.max, 0, 1);
    ctx.globalAlpha=a*.3; ctx.strokeStyle='#e8a13a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r*(1.05-a*.15), 0, TAU); ctx.stroke();
    ctx.globalAlpha=a*.09; ctx.fillStyle='#f2b25c';
    ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r*a, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha=1;
}

/* =====================================================================
   UPDATE
   ===================================================================== */
function update(raw){
  trauma = Math.max(0, trauma-raw*1.5);
  vignT  = Math.max(0, vignT-raw);
  flashT = Math.max(0, flashT-raw);
  slowT  = Math.max(0, slowT-raw);
  fastT  = Math.max(0, fastT-raw);
  goldT  = Math.max(0, goldT-raw);
  for(const im of bgImpulses) im.s -= raw*2.4;
  bgImpulses = bgImpulses.filter(i=>i.s>0);

  let ts = 1;
  if(state==='over') ts = .3;
  else if(slowT>0) ts = .32;
  else if(fastT>0) ts = 1.75;
  timeScale += (ts-timeScale)*Math.min(1, raw*6);
  let dt = raw*timeScale;
  if(hitStop>0){ hitStop -= raw*1000; dt = 0; }
  if(state==='pause') dt = 0;

  if(fastT>0){ tickT-=raw; if(tickT<=0){ tickT=.15; S.tick(); } }
  if(combo>0){ comboTimer-=dt; if(comboTimer<=0) combo=0; }

  if(state==='play'){
    tRun += dt; spawnT -= dt;
    save.stats.time += raw;          // lifetime play time
    if(spawnT<=0){
      spawnT = Math.max((MODES[mode].spawnFloor??.55)*(diff().spawnMul||1), .18)*rand(.75,1.2)/cMul('spawn');
      const dgHold = mode==='dungeon' && (DG.boss || DG.cleared);   // the boss floor is his now
      if(!dgHold) volley(tRun);
      if(mode==='dungeon' && !dgHold){                // dungeon floors feed their goal
        const g = DG.goal;
        if(g.type==='pineapple' && Math.random()<.7) spawnProp(D.pineapple, 1);
        else if(g.type==='fruit' && Math.random()<.65) spawnProp(pick(FRUITY), 1);
      }
    }
  }
  if(TUT.active) tutTick(raw);                    // tutorial steps watch their own props
  if(state==='menu' && !TUT.active){              // menu ambience stays silent during the tutorial
    menuT -= dt;
    if(menuT<=0){ menuT = rand(2.4,3.6); if(props.length<3) spawnProp(pick(FRUITS), .8); }
  }
  if(state==='over'){
    overT += raw;
    if(overT>.85 && !overShown){ overShown=true; showGameOver(); }
  }

  updateProps(dt); updateFragments(dt); stepParticles(parts,dt);
  updateFloaters(dt); updateSlashes(dt); updateStains(dt);
  bossUpdate(dt); updateHazards(dt);                          // THE MONSTER + his hazards
  if(invulnT>0) invulnT -= raw;
  if(halfHit){ halfT -= raw; if(halfT<=0) halfHit=false; }    // an unheeded ½ wound slowly closes
  for(let i=flares.length-1;i>=0;i--){ flares[i].life-=dt; if(flares[i].life<=0) flares.splice(i,1); }

  const LIFE = trailLifeFor(save.trail);
  for(const p of trail.pts) p.t += dt*1000;
  while(trail.pts.length && trail.pts[0].t>LIFE) trail.pts.shift();

  if(ptr.down){
    const fx = TFX[save.trail];
    if(fx && ptr.speed>=fx.spdMin && Math.random() < raw*fx.rate*save.settings.fxTrail)
      addP(fx.make(ptr.x+rand(-4,4), ptr.y+rand(-4,4)));
  }
  if(goldT>0 && Math.random()<raw*6*save.settings.fxTrail)
    addP({type:'glint', x:rand(W), y:rand(H), vx:0, vy:0, life:rand(.4,.8), max:.8, size:rand(1.5,3), rot:rand(TAU)});

  processCuts();
  updateBG(raw);
  syncHUD();
  ptr.speed *= Math.exp(-raw*5);
}
function updateProps(dt){
  for(const p of props){
    if(p.dead) continue;
    p.t += dt;
    if(p.thump>0) p.thump -= dt;
    if(p.squash>0) p.squash = Math.max(0, p.squash-dt*3.2);
    const d = p.def;
    // per-object time dilation (TIME / CHAOS): the world slows, never the blade
    let pdt = dt;
    if(p.tsT>0){ p.tsT -= dt; pdt = dt*.35; }
    // vine snare (NATURE): tangled and slowed
    if(p.vineT>0){ p.vineT -= dt; p.vx*=Math.exp(-2.4*dt); p.vy*=Math.exp(-1.4*dt); }
    if(p.burnT!=null){
      p.burnT -= pdt;
      p.embT -= pdt;
      if(p.embT<=0){
        p.embT = .05;
        addP({type:'ember', x:p.x+rand(-d.r*.5,d.r*.5), y:p.y+rand(-d.r*.5,d.r*.5),
              vx:rand(-30,30), vy:rand(-90,-30), life:rand(.3,.6), max:.6, size:rand(1.5,3.5)});
      }
      if(p.burnT<=0){ burnOut(p); continue; }
    }
    else if((state==='play'||state==='menu') && ptr.down && isTrail('fire')){
      // FIRE perk: anything that drifts into the lingering ribbon catches fire
      // (radius now matches the visible ribbon; works on the menu backdrop too)
      const R = d.r*(p.scale||1) + 12;
      for(let i=trail.pts.length-1;i>=0;i--){
        const q = trail.pts[i];
        if(q.t>200) break;
        const dx=q.x-p.x, dy=q.y-p.y;
        if(dx*dx+dy*dy < R*R){ ignite(p); break; }
      }
    }
    if(ptr.down){
      if(isTrail('universe')){      // gravity: everything leans in (radius & force LAB-upgraded)
        const dx=ptr.x-p.x, dy=ptr.y-p.y, L=Math.hypot(dx,dy);
        const GR2=300+70*tlv('universe');
        if(L<GR2 && L>1){ const f=(1-L/GR2)*640*(1+.2*tlv('universe'))*dt; p.vx+=dx/L*f; p.vy+=dy/L*f; }
      } else if(isTrail('magnet')){ // targeted pull — coins can't resist
        const dx=ptr.x-p.x, dy=ptr.y-p.y, L=Math.hypot(dx,dy);
        const coin = d.id==='coin' || d.id==='goldenApple';
        const R = (coin ? 340 : 240)+50*tlv('magnet');
        if(L<R && L>1){ const f=(1-L/R)*(coin?760:420)*(1+.2*tlv('magnet'))*dt; p.vx+=dx/L*f; p.vy+=dy/L*f; }
      } else if(isTrail('void')){   // a quiet hunger
        const dx=ptr.x-p.x, dy=ptr.y-p.y, L=Math.hypot(dx,dy);
        const VR=170+35*tlv('void');
        if(L<VR && L>1){ const f=(1-L/VR)*300*(1+.2*tlv('void'))*dt; p.vx+=dx/L*f; p.vy+=dy/L*f; }
      }
    }
    if(flares.length && p.burnT==null && !d.dangerous){   // SOLAR — the nova scorches its whole radius
      for(const fl of flares){
        if(Math.hypot(p.x-fl.x, p.y-fl.y) < fl.r){ ignite(p); break; }
      }
    }
    if(d.update) d.update(p,pdt);
    else { p.vy += GRAV*pdt; p.x += p.vx*pdt; p.y += p.vy*pdt; }
    p.rot += p.vr*pdt;
    if(d.life && p.t>d.life){ p.dead=true; continue; }
    const m = d.r+70;
    if(p.x<-m || p.x>W+m || p.y<-m-40 || p.y>H+m){
      if(p._drop){                              // boss fruitfall — an uncut fruit costs ½ a life
        if(p._drop===true) hurtPlayer(clamp(p.x,40,W-40), clamp(p.y,40,H-40), .5);
        p.dead = true; continue;
      }
      if(d.missPenalty && state==='play' && lives>0 && !MODES[mode].noMiss && !(MODES[mode].custom && !save.custom.miss)){
        missStreak++;
        loseLife(clamp(p.x,40,W-40), clamp(p.y,40,H-40));
      }
      p.dead = true;
    }
  }
  for(let i=props.length-1;i>=0;i--) if(props[i].dead) props.splice(i,1);
}
function updateFragments(dt){
  for(const f of fragments){
    f.life += dt;
    if(f.suck && f.life<.55){
      const dx=ptr.x-f.x, dy=ptr.y-f.y, L=Math.hypot(dx,dy)||1;
      f.vx=(f.vx+dx/L*2400*dt)*Math.exp(-2.2*dt);
      f.vy=(f.vy+dy/L*2400*dt)*Math.exp(-2.2*dt);
      if(Math.random()<dt*14)
        addP({type:'star',x:f.x,y:f.y,vx:rand(-40,40),vy:rand(-40,40),life:.35,max:.35,size:rand(1.5,3),rot:rand(TAU),
              css:pick(['#cbb2ff','#e9dcff','#f6f4ff'])});
    } else if(f.bubble){
      f.vy += -180*dt;                    // buoyant — the halves drift skyward
      f.vx *= Math.exp(-1.2*dt);
      f.vy *= Math.exp(-.8*dt);
      f.vy = Math.min(f.vy, -60);
      if(!f.popped && f.life>.62+.08*tlv('bubble')){        // …then the soap gives out (LAB: floats longer)
        f.popped = true;
        addP({type:'ring', x:f.x, y:f.y, life:.25, max:.25, size:f.size*.8, lw:2, css:'#9fc9de'});
        for(let i=0;i<4;i++)
          addP({type:'bub', x:f.x, y:f.y, vx:rand(-60,60), vy:rand(-60,20), life:rand(.3,.6), max:.6, size:rand(1.5,3)});
        S.pop();
      }
    } else if(!f.suck){
      f.vy += 820*dt;
    }
    f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.vr*dt; f.sep += 52*dt;
    if(f.bubble) f.alpha = f.popped ? 0 : 1;
    else{
      const start = f.suck? .3 : .5, win = f.suck? .3 : .45;
      f.alpha = f.life<start ? 1 : clamp(1-(f.life-start)/win, 0, 1);
    }
  }
  for(let i=fragments.length-1;i>=0;i--)
    if(fragments[i].alpha<=0 || fragments[i].y>H+180) fragments.splice(i,1);
}
function stepParticles(list,dt){
  for(const p of list){
    p.life -= dt;
    const g = p.type==='ink'?900 : p.type==='debris'?900 : p.type==='shard'?380
            : p.type==='glint'?60 : p.type==='smoke'?-40 : p.type==='dust'?-25
            : p.type==='snow'?26 : p.type==='ember'?-120 : p.type==='goldstar'?46
            : p.type==='drop'?760 : p.type==='leaf'?60 : p.type==='confetti'?140
            : p.type==='bub'?-50 : 0;
    p.vy = (p.vy||0)+g*dt;
    p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt;
    if(p.vr) p.rot = (p.rot||0)+p.vr*dt;
    if(p.type==='snow'){ p.rot=(p.rot||0)+dt*1.5; p.x += Math.sin(p.life*5+(p.rot||0))*9*dt; }
    if(p.type==='leaf') p.x += Math.sin(p.life*4+(p.rot||0))*14*dt;
  }
  for(let i=list.length-1;i>=0;i--) if(list[i].life<=0) list.splice(i,1);
}
function updateFloaters(dt){
  for(const f of floaters){ f.life -= dt*.9; f.y -= 44*dt; }
  for(let i=floaters.length-1;i>=0;i--) if(floaters[i].life<=0) floaters.splice(i,1);
}
function updateSlashes(dt){
  for(const s of slashes) s.life -= dt;
  for(let i=slashes.length-1;i>=0;i--) if(slashes[i].life<=0) slashes.splice(i,1);
}
function updateStains(dt){
  for(const s of stains) s.age += dt;
  for(let i=stains.length-1;i>=0;i--) if(stains[i].age>=stains[i].max) stains.splice(i,1);
}
function updateBG(raw){
  let t = [255,255,255];
  if(slowT>0) t = [223,236,246];
  else if(fastT>0) t = [255,250,240];
  if(goldT>0){ const g=[243,206,98]; t=[t[0]+(g[0]-t[0])*.9, t[1]+(g[1]-t[1])*.9, t[2]+(g[2]-t[2])*.9]; }
  if(hasRelic('age')){ const g=[250,238,196]; t=[t[0]+(g[0]-t[0])*.5, t[1]+(g[1]-t[1])*.5, t[2]+(g[2]-t[2])*.5]; }
  for(const im of bgImpulses) t=[t[0]+(im.c[0]-t[0])*im.s, t[1]+(im.c[1]-t[1])*im.s, t[2]+(im.c[2]-t[2])*im.s];
  const k = Math.min(1, raw*3.4);
  bg[0]+=(t[0]-bg[0])*k; bg[1]+=(t[1]-bg[1])*k; bg[2]+=(t[2]-bg[2])*k;
  if(hasRelic('golden') && Math.random()<raw*6)
    addP({type:'glint', x:rand(W), y:rand(H), vx:0, vy:0, life:rand(.4,.8), max:.8, size:rand(1.5,3), rot:rand(TAU)});
}

/* =====================================================================
   RENDER
   ===================================================================== */
function drawStains(){
  for(const s of stains){
    const a = (1-s.age/s.max)*.13;
    if(a<=0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = s.css;
    ctx.beginPath();
    for(const b of s.blobs){ ctx.moveTo(s.x+b.ox+b.r, s.y+b.oy); ctx.arc(s.x+b.ox, s.y+b.oy, b.r, 0, TAU); }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawPropBody(p, x, y){
  const d = p.def;
  ctx.save();
  ctx.translate(x,y); ctx.rotate(p.rot);
  if(p.scale!==1) ctx.scale(p.scale,p.scale);
  if(d.flippable && p.face<0) ctx.scale(-1,1);
  if(p.squash>0){ const s=p.squash*.28; ctx.scale(1+s, 1-s); }
  if(d.live) d.draw(ctx, d.r, p);
  else { const sp=getSprite(d); ctx.drawImage(sp.c, -sp.s/2, -sp.s/2, sp.s, sp.s); }
  ctx.restore();
}
function drawProps(){
  for(const p of props){
    const d=p.def, spd=Math.hypot(p.vx,p.vy);
    const ga = d.life ? clamp((d.life-p.t)/.35, 0, 1) : 1;
    if(d.dangerous){ // faint pulsing danger ring — the telegraph
      const pu = .5+.5*Math.sin(p.t*7);
      ctx.globalAlpha = ga*(.1+.15*pu);
      ctx.strokeStyle = '#c22833'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, d.r*1.5+pu*5, 0, TAU); ctx.stroke();
    }
    if(p.tsT>0){ // caught in a pocket of slowed time
      ctx.globalAlpha = ga*clamp(p.tsT,0,1)*.5;
      ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, d.r*(p.scale||1)+10, 0, TAU); ctx.stroke();
    }
    if(p.vineT>0){ // nature's snare — animated tendrils
      const k = clamp(p.vineT,0,1), R = d.r*(p.scale||1)+6;
      ctx.globalAlpha = ga*k;
      ctx.strokeStyle = '#4a8a45'; ctx.lineWidth = 2; ctx.lineCap='round';
      for(let s=0;s<3;s++){
        const a0 = p.t*2 + s*2.1;
        ctx.beginPath(); ctx.arc(p.x, p.y, R, a0, a0+1.4); ctx.stroke();
      }
      ctx.globalAlpha = ga*k*.8;
      ctx.fillStyle = '#3f7d3a';
      for(let s=0;s<3;s++){
        const a0 = p.t*2 + s*2.1;
        ctx.beginPath();
        ctx.ellipse(p.x+Math.cos(a0+1.4)*R, p.y+Math.sin(a0+1.4)*R, 4, 2, a0+1.4, 0, TAU);
        ctx.fill();
      }
    }
    if(spd>430){ ctx.globalAlpha=.12*ga; drawPropBody(p, p.x-p.vx*.02, p.y-p.vy*.02); }
    ctx.globalAlpha = ga; drawPropBody(p, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
function drawOneFragment(g,f){
  g.save();
  g.translate(f.x,f.y); g.rotate(f.rot);
  const nx=-Math.sin(f.la), ny=Math.cos(f.la);
  g.translate(nx*f.sep*f.side, ny*f.sep*f.side);
  g.save();
  g.rotate(f.la);
  const S2=600;
  g.beginPath();
  if(f.jag){                                    // jagged cut — teeth scaled to the object
    const amp=f.size*.085, span=f.size*.55, N=f.jag.length-1, dx=span*2/N;
    g.moveTo(-S2, f.side*.5);
    g.lineTo(-span, f.jag[0]*amp+f.side*.5);    // straight run-up to the object
    for(let i=1;i<=N;i++) g.lineTo(-span+i*dx, f.jag[i]*amp+f.side*.5);
    g.lineTo(S2, f.side*.5);                    // straight run-out
    if(f.side>0){ g.lineTo(S2,S2); g.lineTo(-S2,S2); }
    else { g.lineTo(-S2,-S2); g.lineTo(S2,-S2); }
  }
  else if(f.side>0) g.rect(-S2, .5, S2*2, S2); else g.rect(-S2, -S2-.5, S2*2, S2);
  g.clip();
  g.rotate(-f.la);
  g.globalAlpha = f.alpha;
  g.drawImage(f.spr, -f.size/2, -f.size/2, f.size, f.size);
  g.restore();                 // clip off — sprite half done
  if(f.ice){                   // the cube grows in around the frozen half
    const gr = 1-Math.pow(1-clamp(f.life/.4,0,1),3);   // eased growth 0→1
    const s  = f.size*.62*(.45+.55*gr);
    const rad = Math.max(3,s*.16);
    g.globalAlpha = f.alpha*(.4+.3*gr);
    g.fillStyle = 'rgba(118,178,222,.5)';              // cold glass over the fruit
    rr(g,-s,-s,s*2,s*2,rad); g.fill();
    g.globalAlpha = f.alpha*(.55+.45*gr);
    g.strokeStyle = 'rgba(238,250,255,.95)'; g.lineWidth=1.5;
    rr(g,-s,-s,s*2,s*2,rad); g.stroke();
    g.globalAlpha = f.alpha*.4*gr;                     // two shine streaks
    g.strokeStyle = '#fff'; g.lineWidth=Math.max(1,s*.09);
    g.beginPath(); g.moveTo(-s*.5,s*.12); g.lineTo(-s*.1,-s*.55); g.stroke();
    g.beginPath(); g.moveTo(-s*.18,s*.48); g.lineTo(s*.22,-s*.18); g.stroke();
  }
  if(f.bubble){ // soap glass around the drifting half
    const s = f.size*.72;
    g.globalAlpha = f.alpha*.85;
    g.strokeStyle = 'rgba(159,201,222,.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(0,0,s,0,TAU); g.stroke();
    g.globalAlpha = f.alpha*.5;
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.beginPath(); g.arc(0,0,s,-2.2,-1.4); g.stroke();
  }
  g.restore();
}
function drawFragments(){
  for(const f of fragments) drawOneFragment(ctx,f);
  ctx.globalAlpha = 1;
}
function drawParticleSet(g,list){
  for(const p of list){
    const a = clamp(p.life/p.max, 0, 1);
    switch(p.type){
      case 'ink':
        g.globalAlpha=a; g.fillStyle=skinned('ink', p.css||INK);
        g.beginPath(); g.arc(p.x,p.y,p.size*(.35+.65*a),0,TAU); g.fill(); break;
      case 'dust':
        g.globalAlpha=a*.4; g.fillStyle=skinned('dust','#a7abb0');
        g.beginPath(); g.arc(p.x,p.y,p.size*(1+(1-a)*.8),0,TAU); g.fill(); break;
      case 'snow': {
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.globalAlpha=a*.95; g.strokeStyle=skinned('snow','#d7ecf7'); g.lineWidth=Math.max(.7,p.size*.26);
        g.lineCap='round';
        const R=p.size*1.9;
        g.beginPath();
        for(let k=0;k<6;k++){
          const an=k*Math.PI/3, ax=Math.cos(an), ay=Math.sin(an);
          g.moveTo(0,0); g.lineTo(ax*R, ay*R);
          const bx=ax*R*.58, by=ay*R*.58, bl=R*.34;
          g.moveTo(bx,by); g.lineTo(bx+Math.cos(an+.75)*bl, by+Math.sin(an+.75)*bl);
          g.moveTo(bx,by); g.lineTo(bx+Math.cos(an-.75)*bl, by+Math.sin(an-.75)*bl);
        }
        g.stroke();
        g.globalAlpha=a*.9; g.fillStyle='#eef7fc';
        g.beginPath(); g.arc(0,0,Math.max(.5,p.size*.22),0,TAU); g.fill();
        g.restore(); break; }
      case 'goldstar': {
        const tw=.55+.45*Math.sin((p.max-p.life)*18+(p.rot||0)*3);
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.globalAlpha=a*tw; g.fillStyle=skinned('goldstar','#e9c437');
        const R=p.size*2.2, r2=R*.45;
        g.beginPath();
        for(let k=0;k<10;k++){
          const an=-Math.PI/2+k*Math.PI/5, rad=k%2?r2:R;
          const X=Math.cos(an)*rad, Y=Math.sin(an)*rad;
          if(k) g.lineTo(X,Y); else g.moveTo(X,Y);
        }
        g.closePath(); g.fill();
        g.globalAlpha=a*tw*.55; g.strokeStyle='#fff6d8'; g.lineWidth=.8;
        g.beginPath();
        g.moveTo(-r2*.9,0); g.lineTo(r2*.9,0);
        g.moveTo(0,-r2*.9); g.lineTo(0,r2*.9);
        g.stroke();
        g.restore(); break; }
      case 'ember': {
        const fl=.6+.4*Math.sin((p.max-p.life)*40+(p.rot||0));
        g.globalAlpha=a; g.fillStyle=fl>.75?skinned('ember','#e8933f'):skinned('ember2','#cf4a26');
        g.beginPath(); g.arc(p.x,p.y,p.size*(.5+.5*fl),0,TAU); g.fill(); break; }
      case 'star': {
        const tw=.5+.5*Math.sin((p.max-p.life)*22+(p.rot||0));
        const s=p.size*(.7+.5*tw);
        g.globalAlpha=a*tw; g.strokeStyle=p.css||'#efd98f'; g.lineWidth=1; g.lineCap='round';
        g.beginPath();
        g.moveTo(p.x-s,p.y); g.lineTo(p.x+s,p.y);
        g.moveTo(p.x,p.y-s); g.lineTo(p.x,p.y+s);
        g.stroke();
        if(tw>.72){                                 // white core at the twinkle peak
          g.globalAlpha=a*(tw-.5)*2; g.strokeStyle='#fff'; g.lineWidth=1;
          g.beginPath();
          g.moveTo(p.x-s*.55,p.y); g.lineTo(p.x+s*.55,p.y);
          g.moveTo(p.x,p.y-s*.55); g.lineTo(p.x,p.y+s*.55);
          g.stroke();
        }
        g.lineCap='butt'; break; }
      case 'smoke':
        g.globalAlpha=a*.3; g.fillStyle='#55555a';
        g.beginPath(); g.arc(p.x,p.y,p.size*(1+(1-a)*1.8),0,TAU); g.fill(); break;
      case 'debris':
        g.globalAlpha=a; g.fillStyle=p.css||INK;
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.fillRect(-p.size/2,-p.size/2,p.size,p.size*.7); g.restore(); break;
      case 'shard':
        g.globalAlpha=a; g.fillStyle=p.css||'#b9dff0';
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.beginPath(); g.moveTo(0,-p.size); g.lineTo(p.size*.8,p.size*.7); g.lineTo(-p.size*.8,p.size*.7);
        g.closePath(); g.fill();
        if(p.css){                                  // ink chip edge — must read on the white world
          g.globalAlpha=a; g.strokeStyle=INK; g.lineWidth=Math.max(.9, p.size*.22); g.stroke();
        }
        g.restore(); break;
      case 'glint': {
        const tw=.55+.45*Math.sin((p.max-p.life)*26+(p.rot||0));
        g.globalAlpha=a*tw; g.fillStyle='#dcaf35';
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.fillRect(-p.size/2,-p.size/2,p.size,p.size); g.restore(); break; }
      case 'spark2': { // electric fleck — blue halo, white core
        g.globalAlpha=a; g.lineCap='round';
        g.strokeStyle=skinned('spark2','#4db8ff'); g.lineWidth=2.6;
        g.beginPath();
        g.moveTo(p.x-Math.cos(p.rot)*p.size, p.y-Math.sin(p.rot)*p.size);
        g.lineTo(p.x+Math.cos(p.rot)*p.size, p.y+Math.sin(p.rot)*p.size);
        g.stroke();
        g.strokeStyle='#eaffff'; g.lineWidth=1;
        g.beginPath();
        g.moveTo(p.x-Math.cos(p.rot)*p.size*.7, p.y-Math.sin(p.rot)*p.size*.7);
        g.lineTo(p.x+Math.cos(p.rot)*p.size*.7, p.y+Math.sin(p.rot)*p.size*.7);
        g.stroke(); break; }
      case 'drop':
        g.globalAlpha=a; g.fillStyle=skinned('drop','#0b0b0d');
        g.beginPath(); g.arc(p.x,p.y,p.size*(.6+.4*(1-a)),0,TAU); g.fill(); break;
      case 'gust': { // a curl of moving air
        g.globalAlpha=a*.4; g.strokeStyle='#9aa0a6'; g.lineWidth=1.4; g.lineCap='round';
        g.beginPath(); g.arc(p.x,p.y,p.size,p.rot,p.rot+1.7); g.stroke();
        g.beginPath(); g.arc(p.x,p.y,p.size*.55,p.rot+.5,p.rot+1.9); g.stroke(); break; }
      case 'leaf': {
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.globalAlpha=a; g.fillStyle=skinned('leaf','#4a8a45');
        g.beginPath(); g.ellipse(0,0,p.size*1.7,p.size*.7,0,0,TAU); g.fill();
        g.strokeStyle=skinned('leaf2','#2e5c2b'); g.lineWidth=.8;
        g.beginPath(); g.moveTo(-p.size*1.7,0); g.lineTo(p.size*1.7,0); g.stroke();
        g.restore(); break; }
      case 'gleam': { // steel sparkle
        const tw=.5+.5*Math.sin((p.max-p.life)*30+(p.size||0));
        g.globalAlpha=a*tw; g.strokeStyle='#e8ebef'; g.lineWidth=1; g.lineCap='round';
        const s=p.size*1.6;
        g.beginPath();
        g.moveTo(p.x-s,p.y); g.lineTo(p.x+s,p.y);
        g.moveTo(p.x,p.y-s); g.lineTo(p.x,p.y+s);
        g.moveTo(p.x-s*.5,p.y-s*.5); g.lineTo(p.x+s*.5,p.y+s*.5);
        g.moveTo(p.x+s*.5,p.y-s*.5); g.lineTo(p.x-s*.5,p.y+s*.5);
        g.stroke(); break; }
      case 'bub': {
        g.globalAlpha=a*.8; g.strokeStyle='rgba(159,201,222,.9)'; g.lineWidth=1.2;
        g.beginPath(); g.arc(p.x,p.y,p.size,0,TAU); g.stroke();
        g.globalAlpha=a*.5; g.strokeStyle='#fff';
        g.beginPath(); g.arc(p.x,p.y,p.size,-2.2,-1.5); g.stroke(); break; }
      case 'sunray': {
        const tw=.5+.5*Math.sin((p.max-p.life)*20+(p.rot||0));
        g.globalAlpha=a*tw; g.strokeStyle=skinned('sunray', p.css||'#f2b25c'); g.lineWidth=1.2; g.lineCap='round';
        const s=p.size*2;
        g.beginPath();
        g.moveTo(p.x-s,p.y); g.lineTo(p.x+s,p.y);
        g.moveTo(p.x,p.y-s); g.lineTo(p.x,p.y+s);
        g.moveTo(p.x-s*.6,p.y-s*.6); g.lineTo(p.x+s*.6,p.y+s*.6);
        g.moveTo(p.x+s*.6,p.y-s*.6); g.lineTo(p.x-s*.6,p.y+s*.6);
        g.stroke(); break; }
      case 'suckdot':
        g.globalAlpha=a*.8; g.fillStyle='#cfd2da';
        g.beginPath(); g.arc(p.x,p.y,p.size*a,0,TAU); g.fill(); break;
      case 'confetti':
        g.globalAlpha=a; g.fillStyle=p.css||'#7a5a86';
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot||0);
        g.beginPath(); g.moveTo(0,-p.size); g.lineTo(p.size*.9,p.size*.7); g.lineTo(-p.size*.9,p.size*.7);
        g.closePath(); g.fill(); g.restore(); break;
      case 'bolt': { // live lightning arcing to the next victim
        g.globalAlpha=a; g.lineCap='round'; g.lineJoin='round';
        for(const [col,lw] of [['#4db8ff',4],['#eaffff',1.4]]){
          g.strokeStyle=col; g.lineWidth=lw;
          g.beginPath(); g.moveTo(p.x0,p.y0);
          for(let i=1;i<4;i++){
            const t=i/4;
            const mx=p.x0+(p.x1-p.x0)*t, my=p.y0+(p.y1-p.y0)*t;
            const dx=p.y1-p.y0, dy=-(p.x1-p.x0), L=Math.hypot(dx,dy)||1;
            const off=rand(-9,9)*(1-t*.5);
            g.lineTo(mx+dx/L*off, my+dy/L*off);
          }
          g.lineTo(p.x1,p.y1); g.stroke();
        }
        break; }
      case 'ghostimg': { // MIRROR — the fading twin
        const k=1-p.life/p.max;
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot);
        g.globalAlpha=(1-k)*.5;
        const s=p.size*(1+k*.25);
        g.drawImage(p.spr,-s/2,-s/2,s,s);
        g.restore(); break; }
      case 'collapse': { // VOID — imploding into a point
        const k=1-p.life/p.max;
        const sc=Math.pow(1-k,1.6);
        g.save(); g.translate(p.x,p.y); g.rotate(p.rot);
        g.globalAlpha=.9;
        const s=p.size*Math.max(.02,sc);
        g.drawImage(p.spr,-s/2,-s/2,s,s);
        if(k>.55){
          g.globalAlpha=(k-.55)/.45;
          g.fillStyle='#050508';
          g.beginPath(); g.arc(0,0,3,0,TAU); g.fill();
        }
        g.restore(); break; }
      case 'ray': {
        const L=p.len*(1-a), r0=26;
        g.globalAlpha=a*.7; g.strokeStyle=p.css||'#141414'; g.lineWidth=1.5;
        g.beginPath();
        g.moveTo(p.x+Math.cos(p.ang)*r0, p.y+Math.sin(p.ang)*r0);
        g.lineTo(p.x+Math.cos(p.ang)*(r0+L), p.y+Math.sin(p.ang)*(r0+L));
        g.stroke(); break; }
      case 'ring':
        g.globalAlpha=a*.9; g.strokeStyle=p.css||INK; g.lineWidth=Math.max(1,p.lw*a);
        g.beginPath(); g.arc(p.x,p.y,p.size*(1-a),0,TAU); g.stroke(); break;
      case 'flash':
        g.globalAlpha=a*.8; g.fillStyle='#151515';
        g.beginPath(); g.arc(p.x,p.y,p.size*(1+(1-a)*.5),0,TAU); g.fill(); break;
      case 'line':
        g.globalAlpha=a; g.strokeStyle=INK; g.lineWidth=1.4;
        g.beginPath(); g.moveTo(p.x,p.y);
        g.lineTo(p.x+Math.cos(p.ang)*p.len*a, p.y+Math.sin(p.ang)*p.len*a); g.stroke(); break;
    }
  }
  g.globalAlpha = 1;
}
function drawSlashes(){
  for(const s of slashes){
    const a = clamp(s.life/.14, 0, 1);
    ctx.globalAlpha = a*.9; ctx.strokeStyle = trail.css; ctx.lineWidth = 1+a*2;
    ctx.beginPath(); ctx.moveTo(s.x0,s.y0); ctx.lineTo(s.x1,s.y1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawFloaters(){
  ctx.textAlign='center';
  for(const f of floaters){
    ctx.globalAlpha = clamp(f.life,0,1);
    ctx.fillStyle = f.css;
    ctx.font = '500 '+f.size+'px "IBM Plex Mono", monospace';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

/* ---- trail smoothing: Catmull-Rom resampling kills the quad-step look ---- */
function resampleTrail(src,lvl){
  const out=[];
  for(let i=0;i<src.length-1;i++){
    const p0=src[Math.max(0,i-1)], p1=src[i], p2=src[i+1], p3=src[Math.min(src.length-1,i+2)];
    out.push(p1);
    for(let k=1;k<=lvl;k++){
      const u=k/(lvl+1), u2=u*u, u3=u2*u;
      out.push({
        x:.5*(2*p1.x+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u2+(-p0.x+3*p1.x-3*p2.x+p3.x)*u3),
        y:.5*(2*p1.y+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u2+(-p0.y+3*p1.y-3*p2.y+p3.y)*u3),
        sp:(p1.sp+p2.sp)*.5, t:(p1.t+p2.t)*.5
      });
    }
  }
  out.push(src[src.length-1]);
  return out;
}
/* ---- shared ribbon renderer: used by the game trail AND the shop preview ---- */
function renderTrailRibbon(g, src, trailId, opts={}){
  let pts = src;
  const sm = clamp(Math.round(save.settings.smooth),0,3);
  if(sm>0 && pts.length>2) pts = resampleTrail(pts,sm);
  const n = pts.length; if(n<2) return;
  const LIFE = trailLifeFor(trailId);
  const T = TRAILS.find(t=>t.id===trailId)||TRAILS[0];
  const SK2 = skinOf(trailId);                     // a mastered blade may wear its final form
  const colMain = SK2 ? SK2.color : T.color;
  const colLine = SK2 ? (SK2.line||T.line) : T.line;
  const maxW = opts.maxW ?? 20, wk = opts.wk ?? 13;
  const fadeExp = 1.15-.15*sm;
  const now = performance.now();
  const px=[],py=[],nx=[],ny=[],w=[],a=[];
  for(let i=0;i<n;i++){
    const p=pts[i], k=Math.max(0, 1-p.t/LIFE);
    a[i] = Math.pow(k,fadeExp)*clamp(.25+p.sp*.7,.25,1);
    w[i] = (2+Math.min(maxW,p.sp*wk))*Math.pow(k,.55)+.5;
    px[i]=p.x; py[i]=p.y;
  }
  if(trailId==='liquid')                    // black water breathes
    for(let i=0;i<n;i++) w[i] *= 1+.35*Math.sin(i*.7 + now*.006);
  for(let i=0;i<n;i++){
    const i0=Math.max(0,i-1), i1=Math.min(n-1,i+1);
    const dx=px[i1]-px[i0], dy=py[i1]-py[i0], L=Math.hypot(dx,dy)||1;
    nx[i]=-dy/L; ny[i]=dx/L;
  }
  const baseAF = trailId==='wind' ? .5 : 1; // wind is barely there
  const quad=(color,mul,af=1)=>{
    g.fillStyle=color;
    for(let i=0;i<n-1;i++){
      const al=Math.max(a[i],a[i+1])*af;
      if(al<=.004) continue;
      g.globalAlpha=al;
      g.beginPath();
      g.moveTo(px[i]+nx[i]*w[i]*mul, py[i]+ny[i]*w[i]*mul);
      g.lineTo(px[i+1]+nx[i+1]*w[i+1]*mul, py[i+1]+ny[i+1]*w[i+1]*mul);
      g.lineTo(px[i+1]-nx[i+1]*w[i+1]*mul, py[i+1]-ny[i+1]*w[i+1]*mul);
      g.lineTo(px[i]-nx[i]*w[i]*mul, py[i]-ny[i]*w[i]*mul);
      g.closePath(); g.fill();
    }
  };
  if(T.id==='universe'){                        // GALAXY — same thickness as the rest, starlit
    quad('#8a6cd4', 2.4, .12);                   // soft violet haze — solar/void tier
    quad(colMain,  1);
    quad(colLine,  .42, .9);                     // lavender core, like every bright trail
    for(let i=0;i<n;i++){
      if(a[i]<=.05) continue;
      const h=Math.sin(i*12.9898)*43758.5453, fr=h-Math.floor(h);
      const off=(fr-.5)*1.35;
      const tw=.25+.75*Math.abs(Math.sin(now/230+i*1.7+fr*6.28));
      const sx=px[i]+nx[i]*w[i]*off, sy=py[i]+ny[i]*w[i]*off;
      const s=(1+2.6*fr)*tw;
      g.globalAlpha=a[i]*tw;
      g.strokeStyle=fr>.66?'#e9dcff':fr>.33?'#a98ae8':'#f6f4ff';   // lavender · violet · white
      g.lineWidth=fr>.66?1.3:1; g.lineCap='round';
      g.beginPath();
      g.moveTo(sx-s,sy); g.lineTo(sx+s,sy);
      g.moveTo(sx,sy-s); g.lineTo(sx,sy+s);
      g.stroke();
      if(fr>.78){                                 // four-point nova sparkle
        g.globalAlpha=a[i]*tw*.5;
        g.beginPath();
        g.moveTo(sx-s*.55,sy-s*.55); g.lineTo(sx+s*.55,sy+s*.55);
        g.moveTo(sx+s*.55,sy-s*.55); g.lineTo(sx-s*.55,sy+s*.55);
        g.stroke();
      }
    }
  } else {
    if(trailId==='solar')     quad('#f5c76e', 2.3, .16);  // warm corona
    if(trailId==='void')      quad('#232334', 2.6, .08);  // light dies here
    if(trailId==='lightning') quad('#4db8ff', 2.4, .18);  // electric haze
    quad(colMain, 1, baseAF);
    if(colLine) quad(colLine, .42, .9);                    // bright metal/electric core
  }
  if(trailId==='lightning'){                    // crawling jagged bolts
    for(let i=2;i<n-2;i+=2){
      if(a[i]<.12 || Math.random()<.55) continue;
      g.globalAlpha=a[i]; g.strokeStyle='#eaffff'; g.lineWidth=1.3; g.lineCap='round';
      g.beginPath();
      g.moveTo(px[i-2]+nx[i-2]*rand(-4,4), py[i-2]+ny[i-2]*rand(-4,4));
      g.lineTo(px[i]+nx[i]*rand(-w[i],w[i])*1.4, py[i]+ny[i]*rand(-w[i],w[i])*1.4);
      g.lineTo(px[i+2]+nx[i+2]*rand(-4,4), py[i+2]+ny[i+2]*rand(-4,4));
      g.stroke();
    }
  }
  if(trailId==='time'){                         // clock ticks down the blade
    g.strokeStyle='#6b5326'; g.lineWidth=1.1; g.lineCap='round';
    for(let i=2;i<n-1;i+=3){
      if(a[i]<.08) continue;
      g.globalAlpha=a[i]*.8;
      g.beginPath();
      g.moveTo(px[i]+nx[i]*(w[i]+3), py[i]+ny[i]*(w[i]+3));
      g.lineTo(px[i]+nx[i]*(w[i]+8), py[i]+ny[i]*(w[i]+8));
      g.stroke();
    }
  }
  if(trailId==='bubble'){                       // soap beads riding the stroke
    g.strokeStyle='rgba(159,201,222,.8)'; g.lineWidth=1.1;
    for(let i=3;i<n-1;i+=4){
      if(a[i]<.1) continue;
      g.globalAlpha=a[i]*.7;
      g.beginPath(); g.arc(px[i],py[i],Math.max(2,w[i]*.8),0,TAU); g.stroke();
    }
  }
  if(trailId==='magnet'||trailId==='mirror'){   // a highlight running the blade
    const t=(now/700)%1, i=Math.floor(t*(n-1));
    if(a[i]>.1){
      const s=trailId==='magnet'?5:6;
      g.globalAlpha=a[i]*.35; g.strokeStyle='#ffffff'; g.lineWidth=4; g.lineCap='round';
      g.beginPath(); g.moveTo(px[i]+nx[i]*s, py[i]+ny[i]*s); g.lineTo(px[i]-nx[i]*s, py[i]-ny[i]*s); g.stroke();
      g.globalAlpha=a[i]; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(px[i]+nx[i]*s, py[i]+ny[i]*s); g.lineTo(px[i]-nx[i]*s, py[i]-ny[i]*s); g.stroke();
    }
  }
  if(trailId==='void'){                         // motes sinking into the dark
    g.fillStyle='#cfd2da';
    for(let i=1;i<n-1;i+=2){
      if(a[i]<.1) continue;
      const ph=(now/300+i*.7)%1;
      const side=(i%4<2)?1:-1;
      const off=w[i]*(1.8-ph*1.6);
      g.globalAlpha=a[i]*(1-ph)*.7;
      g.beginPath(); g.arc(px[i]+nx[i]*off*side, py[i]+ny[i]*off*side, 1.2, 0, TAU); g.fill();
    }
  }
  const h=pts[n-1], pr=pts[n-2]||h;
  let dx=h.x-pr.x, dy=h.y-pr.y; const L=Math.hypot(dx,dy);
  if(L>.5){
    dx/=L; dy/=L;
    const hx=-dy, hy=dx, hw=w[n-1];
    g.globalAlpha = Math.min(1, a[n-1]+.1);
    g.fillStyle = T.color;
    g.beginPath();
    g.moveTo(h.x+hx*hw, h.y+hy*hw);
    g.lineTo(h.x+dx*(hw*2.6+6), h.y+dy*(hw*2.6+6));
    g.lineTo(h.x-hx*hw, h.y-hy*hw);
    g.closePath(); g.fill();
  }
  if(opts.glint && opts.speed>.9){
    g.strokeStyle='rgba(255,255,255,.65)';
    g.lineWidth=Math.max(1, w[n-1]*.16); g.lineCap='round';
    const m=Math.min(n-1,10);
    g.beginPath(); g.moveTo(px[n-1-m],py[n-1-m]);
    for(let i=n-m;i<n;i++) g.lineTo(px[i],py[i]);
    g.stroke();
  }
  g.globalAlpha = 1;
}
function drawTrail(){
  if(trail.pts.length>1){
    renderTrailRibbon(ctx, trail.pts, save.trail, {glint:true, speed:ptr.speed});
  } else if(ptr.down){
    ctx.fillStyle=trail.css; ctx.beginPath(); ctx.arc(ptr.x,ptr.y,3,0,TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---- cosmetic swords: the blade in your hand, following the pointer ---- */
const angDiff = (a,b)=>{ let d=(a-b)%TAU; if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; return d; };
let swordAng = -Math.PI/4;
function drawSword(g, x, y){
  const id = save.sword;
  if(id==='none' || !save.swords.includes(id)) return;
  const pts=trail.pts, n=pts.length;
  if(n>3){
    const dx=pts[n-1].x-pts[n-3].x, dy=pts[n-1].y-pts[n-3].y;
    if(Math.hypot(dx,dy)>3) swordAng += angDiff(Math.atan2(dy,dx), swordAng)*.4;
  } else {
    swordAng += angDiff(-Math.PI/4+Math.sin(performance.now()/900)*.12, swordAng)*.06;
  }
  g.save();
  g.translate(x,y); g.rotate(swordAng+Math.PI/2);
  const L=44;
  g.fillStyle = id==='wood'?'#4a3a28' : id==='neon'?'#33424c' : id==='galaxy'?'#1a1a2e' : '#26262c';
  g.fillRect(-2.2,-4,4.4,15);
  g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1;
  for(let k=0;k<3;k++){ g.beginPath(); g.moveTo(-2.2,k*4.5); g.lineTo(2.2,k*4.5+2); g.stroke(); }
  g.fillStyle = id==='wood'?'#5a4630' : id==='galaxy'?'#2a2a44' : '#1c1c22';
  g.beginPath(); g.ellipse(0,-5,6,2.2,0,0,TAU); g.fill();
  g.beginPath();
  g.moveTo(-2.6,-6); g.lineTo(-1.4,-L+4); g.lineTo(0,-L); g.lineTo(1.8,-L+5); g.lineTo(2.6,-6);
  g.closePath();
  if(id==='wood'){
    g.fillStyle='#8a6a42'; g.fill();
    g.strokeStyle='#a98a5f'; g.lineWidth=.9; g.stroke();
  } else if(id==='neon'){
    g.fillStyle='rgba(223,233,239,.85)'; g.fill();
    g.globalAlpha=.5; g.strokeStyle='rgba(127,212,255,.9)'; g.lineWidth=2.2; g.stroke();
    g.globalAlpha=1; g.strokeStyle='#bff0ff'; g.lineWidth=.9; g.stroke();
  } else if(id==='obsidian'){
    g.fillStyle='#0d0d12'; g.fill();
    g.strokeStyle='#cfd4da'; g.lineWidth=1;
    g.beginPath(); g.moveTo(-1.2,-8); g.lineTo(-.4,-L+6); g.stroke();
  } else if(id==='galaxy'){
    g.fillStyle='#141426'; g.fill();
    g.strokeStyle='rgba(138,127,212,.6)'; g.lineWidth=.8; g.stroke();
    g.fillStyle='#e8e4ff';
    for(let k=0;k<6;k++){
      const ty=-9-k*6, tw=.5+.5*Math.sin(performance.now()/300+k*2.1);
      g.globalAlpha=tw*.9;
      g.beginPath(); g.arc(Math.sin(k*7.3)*1.2, ty, .9, 0, TAU); g.fill();
    }
    g.globalAlpha=1;
  }
  g.restore();
}
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = `rgb(${bg[0]|0},${bg[1]|0},${bg[2]|0})`;
  ctx.fillRect(0,0,W,H);
  drawStains();
  const sh = trauma*trauma*clamp(save.settings.shake??1, 0, 1);   // settings: screen shake intensity
  ctx.save();
  if(sh>.0001){
    ctx.translate(W/2+rand(-1,1)*16*sh, H/2+rand(-1,1)*16*sh);
    ctx.rotate(rand(-1,1)*.01*sh);
    ctx.translate(-W/2,-H/2);
  }
  drawProps(); drawFragments(); drawHazards(); drawBossBody(); drawParticleSet(ctx,parts);
  drawSlashes(); drawTrail(); drawFloaters(); drawFlares(); drawBossBar();
  ctx.restore();
  if(flashT>0){
    const a = clamp(flashT/.38, 0, 1);
    ctx.globalCompositeOperation='difference';
    ctx.fillStyle=`rgba(255,255,255,${a})`;
    ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';
    const g = ctx.createRadialGradient(flashX,flashY,0,flashX,flashY,520);
    g.addColorStop(0,`rgba(255,255,255,${.9*a})`);
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  if(vignT>0 && vignMax>0){ // damage feedback: brief vignette pulse from the edges
    const p = 1 - vignT/vignMax;
    let a = vignStr * Math.sin(Math.PI*clamp(p,0,1));
    if(vignGreen) a *= .55 + .45*Math.sin(p*Math.PI*5);   // the medkit breathes: a few soft green pulses
    if(a>.004){
      const R = Math.hypot(W,H)*.5;
      const col = vignRed ? '126,16,22' : vignGreen ? '22,122,54' : '8,8,10';
      const gr = ctx.createRadialGradient(W/2,H/2, R*.5, W/2,H/2, R);
      gr.addColorStop(0, `rgba(${col},0)`);
      gr.addColorStop(1, `rgba(${col},${a.toFixed(3)})`);
      ctx.fillStyle = gr; ctx.fillRect(0,0,W,H);
    }
  }
  if((state==='play'||state==='menu') && save.sword!=='none'){
    drawSword(ctx, ptr.x, ptr.y);
  } else if(!ptr.down && state!=='pause'){
    ctx.strokeStyle='rgba(16,16,16,.55)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(ptr.x,ptr.y,5,0,TAU); ctx.stroke();
    ctx.fillStyle='rgba(16,16,16,.55)';
    ctx.beginPath(); ctx.arc(ptr.x,ptr.y,1.2,0,TAU); ctx.fill();
  }
}

/* =====================================================================
   TRAIL PREVIEW — infinity path · cut demo · speed · zoom
   ===================================================================== */
const PV = { open:false, raf:0, t:0, pts:[], parts:[], trail:'ink', hx:null, hy:0, last:0,
             w:340, h:190, dpr:1, g:null, speed:1, zoom:1, mode:'path', scene:null };

function drawMiniTrail(g, pts, trailId){
  renderTrailRibbon(g, pts, trailId, {maxW:16, wk:11});
}
function pvPath(dt, raw){
  PV.t += dt*1.8;
  const cx=PV.w/2, cy=PV.h/2, a=PV.w*.34;
  const s2=Math.sin(PV.t), c=Math.cos(PV.t), den=1+s2*s2;
  const x=cx+a*c/den, y=cy+a*.55*s2*c/den;
  let sp=1.2;
  if(PV.hx!=null) sp = Math.hypot(x-PV.hx, y-PV.hy)/(raw*1000);
  PV.hx=x; PV.hy=y;
  PV.pts.push({x,y,sp,t:0});
  const fx = TFX[PV.trail];
  if(fx && PV.trail!=='void' && sp>=fx.spdMin && Math.random() < dt*fx.rate*save.settings.fxTrail)
    PV.parts.push(fx.make(x,y));
}
function pvBlobs(d,hx,hy){
  const R=d.r*rand(.5,.8), blobs=[{ox:0,oy:0,r:R*.35}];
  for(let i=0;i<6;i++){
    const an=rand(TAU), rr2=R*rand(.2,.7);
    blobs.push({ox:Math.cos(an)*rr2, oy:Math.sin(an)*rr2, r:R*rand(.12,.28)});
  }
  return blobs;
}
function pvStainColor(id){
  return id==='crimson'?'#c2202e' : id==='frost'?'#a9cde6'
       : id==='gold'?'#c9a227'   : id==='fire'?'#4a3a33'
       : (TRAILS.find(t=>t.id===id)||{}).color||INK;
}
function pvFrags(sc,hx,hy){
  const d=sc.d; let spr;
  if(PV.trail==='fire')        spr=getSpriteTinted(d,'#3a2015',.6);
  else if(PV.trail==='gold')   spr=getSpriteTinted(d,'#caa61e',.5);
  else if(PV.trail==='mirror') spr=getSpriteTinted(d,'#c7ccd2',.35);
  else                          spr=getSprite(d);
  const a=sc.apple, sz=84;
  for(let side=-1;side<=1;side+=2){
    sc.frags.push({ spr:spr.c, size:sz, la:-a.rot, side,
      ice:PV.trail==='frost', suck:PV.trail==='universe', bubble:PV.trail==='bubble',
      x:hx, y:hy, rot:a.rot, vr:side*rand(1.4,2.8), sep:2, life:0, alpha:1,
      vx:side*rand(80,130), vy:a.vy*.3-rand(30,80) });
  }
}
function pvResetScene(){
  PV.scene = { t:0, d:pick(FRUITS), cutDone:false, sweepDone:false, sweep:null, bladeY:0,
               frags:[], stain:null,
               apple:{ x:PV.w*.5+rand(-16,16), y:-50, vy:150, rot:rand(-.4,.4), vr:rand(-.8,.8) } };
}
function pvCut(dt, g){
  if(!PV.scene) pvResetScene();
  const sc = PV.scene;
  sc.t += dt;
  const a = sc.apple;
  if(!sc.cutDone){
    a.y += a.vy*dt; a.rot += a.vr*dt;
    if(!sc.sweep && a.y >= PV.h*.5-8){ sc.sweep={x:PV.w*.5-160}; sc.bladeY=a.y; }
  }
  if(sc.sweep && !sc.sweepDone){
    const sw = sc.sweep;
    sw.x += 1650*dt;
    PV.pts.push({x:sw.x, y:sc.bladeY, sp:1.7, t:0});
    const fx = TFX[PV.trail];
    if(fx && Math.random() < dt*fx.rate*save.settings.fxTrail) PV.parts.push(fx.make(sw.x, sc.bladeY));
    if(!sc.cutDone && sw.x >= a.x){
      sc.cutDone = true;
      const hx=a.x, hy=a.y;
      sc.stain = { x:hx, y:hy, age:0, blobs:pvBlobs(sc.d,hx,hy) };
      pvFrags(sc, hx, hy);
      trailCutFX(PV.parts, hx, hy);
      S.slice(sc.d.r);
    }
    if(sw.x > PV.w*.5+170) sc.sweepDone = true;
  }
  for(const f of sc.frags){
    f.life += dt;
    if(f.suck && f.life<.5){
      const dx=PV.w/2-f.x, dy=sc.bladeY-f.y, L=Math.hypot(dx,dy)||1;
      f.vx=(f.vx+dx/L*2400*dt)*Math.exp(-2.2*dt);
      f.vy=(f.vy+dy/L*2400*dt)*Math.exp(-2.2*dt);
      if(Math.random()<dt*14)
        PV.parts.push({type:'star',x:f.x,y:f.y,vx:rand(-40,40),vy:rand(-40,40),life:.35,max:.35,size:rand(1.5,3),rot:rand(TAU),
              css:pick(['#cbb2ff','#e9dcff','#f6f4ff'])});
    } else if(!f.suck) f.vy += 760*dt;
    f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.vr*dt; f.sep += 60*dt;
    const st=f.suck?.3:.6, wn=f.suck?.3:.5;
    f.alpha = f.life<st ? 1 : clamp(1-(f.life-st)/wn, 0, 1);
  }
  if(sc.stain){
    sc.stain.age += dt;
    const al = (1-sc.stain.age/1.1)*.12;
    if(al>0){
      g.globalAlpha = al; g.fillStyle = pvStainColor(PV.trail);
      g.beginPath();
      for(const b of sc.stain.blobs){ g.moveTo(sc.stain.x+b.ox+b.r, sc.stain.y+b.oy); g.arc(sc.stain.x+b.ox, sc.stain.y+b.oy, b.r, 0, TAU); }
      g.fill(); g.globalAlpha = 1;
    }
  }
  if(!sc.cutDone){
    g.save(); g.translate(a.x,a.y); g.rotate(a.rot);
    const spr = getSprite(sc.d), sz=84;
    g.drawImage(spr.c, -sz/2, -sz/2, sz, sz);
    g.restore();
  }
  for(const f of sc.frags) drawOneFragment(g,f);
  g.globalAlpha = 1;
  if(sc.t>2.9) pvResetScene();
}
function pvFrame(now){
  if(!PV.open) return;
  const raw = clamp((now-PV.last)/1000, .0001, .05); PV.last = now;
  const dt = raw*PV.speed;
  const g = PV.g;
  g.setTransform(PV.dpr,0,0,PV.dpr,0,0);
  g.fillStyle='#fff'; g.fillRect(0,0,PV.w,PV.h);
  g.save();
  g.translate(PV.w/2,PV.h/2); g.scale(PV.zoom,PV.zoom); g.translate(-PV.w/2,-PV.h/2);
  if(PV.mode==='path') pvPath(dt, raw);
  else pvCut(dt, g);
  const LIFE = trailLifeFor(PV.trail);
  for(const q of PV.pts) q.t += dt*1000;
  while(PV.pts.length && PV.pts[0].t>LIFE) PV.pts.shift();
  if(PV.pts.length>90) PV.pts.shift();
  drawMiniTrail(g, PV.pts, PV.trail);
  drawParticleSet(g, PV.parts);
  g.restore();
  if(PV.parts.length>260) PV.parts.splice(0, PV.parts.length-260);
  PV.raf = requestAnimationFrame(pvFrame);
}
function pvZoomLabel(){ return 'ZOOM ×'+(Math.round(PV.zoom*10)/10).toString().replace(/\.0$/,''); }
function openPreview(id){
  S.init(); S.ui();
  PV.trail = id; PV.open = true;
  PV.pts.length = 0; PV.parts.length = 0; PV.hx = null;
  PV.t = rand(TAU); PV.last = performance.now();
  PV.speed = 1; PV.zoom = 1; PV.mode = 'path'; PV.scene = null;
  $('pv-speed').textContent = 'SPEED ×1';
  $('pv-zoom').textContent = 'ZOOM ×1';
  $('pv-cut').textContent = 'CUT DEMO';
  const pcv = $('pv-cv');
  PV.dpr = Math.min(2, window.devicePixelRatio||1);
  pcv.width = PV.w*PV.dpr; pcv.height = PV.h*PV.dpr;
  PV.g = pcv.getContext('2d');
  const T = TRAILS.find(t=>t.id===id)||{};
  $('pv-name').textContent = T.name||'';
  $('pv-hint').textContent = (T.desc||'') + (T.price ? ' · '+T.price+' CUTS' : '');
  show('scr-preview');
  cancelAnimationFrame(PV.raf);
  PV.raf = requestAnimationFrame(pvFrame);
}
function closePreview(){
  PV.open = false;
  cancelAnimationFrame(PV.raf);
  show('scr-shop');
}

/* =====================================================================
   UI
   ===================================================================== */
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on', s.id===id));
}
function syncLives(){
  const el = $('h-lives');
  const n = MODES[mode].custom ? save.custom.lives : MODES[mode].lives;
  if(n===0){ el.style.visibility='hidden'; return; }
  el.style.visibility='visible';
  while(el.children.length<n) el.appendChild(document.createElement('span'));
  while(el.children.length>n) el.removeChild(el.lastChild);
  for(let i=0;i<n;i++) el.children[i].classList.toggle('off', i>=lives);
}
let _m=-1,_c='',_sl='',_sr='';
function syncHUD(){
  if(_m!==runMoney){ _m=runMoney; $('h-money').textContent='¥ '+fmt(runMoney); }
  $('h-money').style.color = goldT>0 ? '#a8861c' : hasRelic('golden') ? '#b8912a' : '';
  const c = combo>=2 ? '×'+combo : '';
  if(_c!==c){ _c=c; $('h-combo').textContent=c; }
  const cb=$('h-cbar');
  if(combo>=2){
    cb.style.visibility='visible';
    cb.firstElementChild.style.transform=`scaleX(${clamp(comboTimer/comboWindow(),0,1)})`;
  } else cb.style.visibility='hidden';
  const dgs = mode==='dungeon' && DG.goal && !DG.cleared
            ? (DG.boss ? 'FLOOR '+DG.lvl+' · SLAY THE MONSTER'
                       : 'FLOOR '+DG.lvl+' · '+Math.min(DG.got,DG.goal.n)+'/'+DG.goal.n)
            : '';
  const sl = goldT>0 ? 'GOLD RUSH ×2'
           : dgs || (save.trail==='crimson' && (MODES[mode].custom ? save.custom.lives : MODES[mode].lives)>0 ? 'BLOOD '+Math.min(crimsonFruit,30-5*tlv('crimson'))+'/'+(30-5*tlv('crimson')) : '');
  if(_sl!==sl){ _sl=sl; $('h-status-l').textContent=sl; }
  const sr = slowT>0 ? 'SLOW' : fastT>0 ? 'TIME ×2' : hasRelic('age') ? 'GOLDEN AGE ×2' : '';
  if(_sr!==sr){ _sr=sr; $('h-status-r').textContent=sr; }
}
function refreshMenuStats(){
  $('menu-stats').textContent = save.stats.cuts>0
    ? `${fmt(save.stats.cuts)} cuts · best combo ×${save.stats.best} · bank ¥${fmt(save.bank)} · ${fmt(save.cutsCur)} unspent cuts`
    : 'nothing cut yet — the blade is waiting';
}
function buildFolds(){
  const mRow = $('fl-mode'); mRow.innerHTML='';
  for(const k in MODES){
    const b = document.createElement('button');
    b.className = 'mode'+(k===mode?' sel':'');
    b.textContent = MODES[k].name;
    b.onclick = ()=>{ mode=k; save.mode=k; S.ui(); persist(); buildFolds(); applyDiff();
                       if(MODES[k].custom){ buildCustom(); show('scr-custom'); }
                       if(MODES[k].dungeon){ buildDungeon(); show('scr-dungeon'); } };
    mRow.appendChild(b);
  }
  $('fh-mode-v').textContent = MODES[mode].name;
  $('fn-mode').textContent = MODES[mode].desc;
  const dRow = $('fl-diff'); dRow.innerHTML='';
  for(const k in DIFFS){
    const b = document.createElement('button');
    b.className = 'mode'+(k===diffKey?' sel':'');
    b.textContent = DIFFS[k].name;
    b.onclick = ()=>{ diffKey=k; save.diff=k; applyDiff(); S.ui(); persist(); buildFolds(); };
    dRow.appendChild(b);
  }
  $('fh-diff-v').textContent = diff().name;
  $('fn-diff').textContent = diff().desc;
}
function toggleFold(id){
  const el = $(id), was = el.classList.contains('open');
  document.querySelectorAll('.fold').forEach(f=>f.classList.remove('open'));
  if(!was) el.classList.add('open');
}
function buildShop(){
  $('shop-bank').textContent = 'BANK ¥ '+fmt(save.bank)+' · CUTS '+fmt(save.cutsCur);
  const el = $('shop-list'); el.innerHTML='';
  const sec = document.createElement('div');
  sec.className='shop-sec'; sec.textContent='UPGRADES — BOUGHT WITH ¥'; el.appendChild(sec);
  UPGRADES.forEach(u=>{
    const lv = save.up[u.id], max = u.vals.length-1;
    const row = document.createElement('div'); row.className='shop-row';
    row.innerHTML =
      `<div class="sr-name">${u.name}</div>
       <div class="sr-desc">${u.desc}<br><span class="cur">${u.fmt(u.vals[lv])}</span></div>
       <div class="pips">${u.vals.map((_,i)=>`<span class="pip${i<=lv?' f':''}"></span>`).join('')}</div>`;
    const btn = document.createElement('button'); btn.className='sr-buy';
    if(lv>=max){ btn.textContent='MAX'; btn.disabled=true; }
    else{
      btn.textContent = '¥ '+fmt(u.prices[lv+1]);
      btn.onclick = ()=>{
        if(save.bank >= u.prices[lv+1]){
          save.bank -= u.prices[lv+1]; save.up[u.id]++;
          S.buy(); persist(); buildShop();
        } else {
          S.thump();
          btn.classList.add('deny'); setTimeout(()=>btn.classList.remove('deny'),300);
        }
      };
    }
    row.appendChild(btn); el.appendChild(row);
  });
  const sec2 = document.createElement('div');
  sec2.className='shop-sec'; sec2.textContent='BLADE TRAILS — BOUGHT WITH CUTS · CLICK A SWATCH TO PREVIEW'; el.appendChild(sec2);
  TRAILS.forEach(t=>{
    const owned = save.trails.includes(t.id), eq = save.trail===t.id;
    const row = document.createElement('div'); row.className='shop-row';
    const chip = document.createElement('button');
    chip.className='chip'; chip.style.background=t.color;
    if(t.line) chip.style.borderColor = t.line;
    chip.onclick = ()=> openPreview(t.id);
    row.appendChild(chip);
    const nameEl = document.createElement('div');
    nameEl.className='sr-name'; nameEl.textContent=t.name; row.appendChild(nameEl);
    const descEl = document.createElement('div');
    descEl.className='sr-desc';
    descEl.textContent = t.desc + (tlv(t.id)>=3 && SKINS[t.id] ? ' · '+SKINS[t.id].name+' SKIN' : '');
    row.appendChild(descEl);
    const lab = document.createElement('button');      // the little bionic tree — THE LAB, this trail only
    lab.className = 'lab-open';
    lab.title = 'THE LAB — '+t.name;
    lab.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">'
      + '<circle cx="8" cy="13.2" r="1.7"/><path d="M8 11.5V8"/><path d="M8 8L4 5M4 5V2.8"/><path d="M8 8L12 5M12 5V2.8"/></svg>';
    lab.onclick = ()=> openLab(t.id);
    row.appendChild(lab);
    const btn = document.createElement('button');
    btn.className='sr-buy'+(eq?' eq':'');
    if(eq){ btn.textContent='IN USE'; btn.disabled=true; }
    else if(owned){
      btn.textContent='EQUIP';
      btn.onclick = ()=>{ save.trail=t.id; setTrail(t.id); S.ui(); persist(); buildShop(); };
    } else {
      btn.textContent = t.price+' CUTS';
      btn.onclick = ()=>{
        if(save.cutsCur >= t.price){
          save.cutsCur -= t.price; save.trails.push(t.id);
          S.buy(); persist(); buildShop();
        } else {
          S.thump();
          btn.classList.add('deny'); setTimeout(()=>btn.classList.remove('deny'),300);
        }
      };
    }
    row.appendChild(btn); el.appendChild(row);
  });

  const sec3 = t=>{ const s3=document.createElement('div'); s3.className='shop-sec'; s3.textContent=t; el.appendChild(s3); };
  sec3('SWORDS — THE BLADE IN YOUR HAND · ¥');
  SWORDS.forEach(sw=>{
    const owned = save.swords.includes(sw.id), eq = save.sword===sw.id;
    const row=document.createElement('div'); row.className='shop-row';
    const chip=document.createElement('button'); chip.className='chip';
    chip.style.background = sw.id==='wood'?'#8a6a42' : sw.id==='neon'?'#7fd4ff'
                          : sw.id==='obsidian'?'#0d0d12' : sw.id==='galaxy'?'#2a2a44' : '#e8e8e8';
    chip.onclick=()=>S.ui();
    row.appendChild(chip);
    const nameEl=document.createElement('div'); nameEl.className='sr-name'; nameEl.textContent=sw.name; row.appendChild(nameEl);
    const descEl=document.createElement('div'); descEl.className='sr-desc'; descEl.textContent=sw.desc; row.appendChild(descEl);
    const btn=document.createElement('button'); btn.className='sr-buy'+(eq?' eq':'');
    if(eq){ btn.textContent='IN HAND'; btn.disabled=true; }
    else if(owned){ btn.textContent='DRAW'; btn.onclick=()=>{ save.sword=sw.id; S.ui(); persist(); buildShop(); }; }
    else if(sw.price===0){ btn.textContent='FREE'; btn.onclick=()=>{ save.swords.push(sw.id); save.sword=sw.id; S.ui(); persist(); buildShop(); }; }
    else{
      btn.textContent='¥ '+fmt(sw.price);
      btn.onclick=()=>{
        if(save.bank>=sw.price){ save.bank-=sw.price; save.swords.push(sw.id); save.sword=sw.id; S.buy(); persist(); buildShop(); }
        else { S.thump(); btn.classList.add('deny'); setTimeout(()=>btn.classList.remove('deny'),300); }
      };
    }
    row.appendChild(btn); el.appendChild(row);
  });

  sec3('RELICS — ONCE-IN-A-LIFETIME FLEXES · ¥');
  RELICS.forEach(rk=>{
    const owned = save.relics.includes(rk.id);
    const row=document.createElement('div'); row.className='shop-row';
    const chip=document.createElement('button'); chip.className='chip';
    chip.style.background = rk.id==='golden' ? '#c9a227' : '#0a0a10';
    chip.onclick=()=>S.ui();
    row.appendChild(chip);
    const nameEl=document.createElement('div'); nameEl.className='sr-name';
    nameEl.textContent = owned ? rk.reveal : rk.name; row.appendChild(nameEl);
    const descEl=document.createElement('div'); descEl.className='sr-desc';
    descEl.textContent = owned ? rk.revealDesc : rk.desc; row.appendChild(descEl);
    const btn=document.createElement('button'); btn.className='sr-buy';
    if(owned){ btn.textContent='HELD'; btn.disabled=true; }
    else{
      btn.textContent='¥ '+fmt(rk.price);
      btn.onclick=()=>{
        if(save.bank>=rk.price){
          save.bank-=rk.price; save.relics.push(rk.id);
          S.buy(); S.stamp(); persist(); buildShop();
          floatText(W/2, H*.4, rk.reveal+' — ACQUIRED', '#a8861c', 16);
        } else { S.thump(); btn.classList.add('deny'); setTimeout(()=>btn.classList.remove('deny'),300); }
      };
    }
    row.appendChild(btn); el.appendChild(row);
  });
}
function buildStatus(){
  const T = TRAILS.find(t=>t.id===save.trail)||{};
  const rows = [
    ['LIFETIME CUTS', fmt(save.stats.cuts)],
    ['AVAILABLE CUTS', fmt(save.cutsCur)],
    ['PLAY TIME', fmtTime(save.stats.time)],
    ['BANK', '¥ '+fmt(save.bank)],
    ['BEST COMBO', '× '+save.stats.best],
    ['RUNS', fmt(save.stats.runs)],
    ['BOMBS SLICED', fmt(save.stats.bombs)],
    ['CURRENT BLADE', T.name||'SUMI'],
    ['MODE / DIFFICULTY', MODES[mode].name+' · '+diff().name],
  ];
  $('status-list').innerHTML =
    rows.map(([k,v])=>`<div class="set-row"><span>${k}</span><b>${v}</b></div>`).join('');
}

/* =====================================================================
   TUTORIAL — first-launch walkthrough (MISC ▸ TUTORIAL replays it).
   Fully interactive: real objects fly on the backdrop and cutting them
   is real — same engine, but no money and no lives at stake.
   ===================================================================== */
const TUT = { active:false, step:0, props:[], timer:0 };
const TUT_STEPS = [
  { text:'WELCOME TO <b>SLICED</b>, SAMURAI.<br>HOLD &amp; DRAG — one clean stroke through the air.',
    task:'CUT THE WATERMELON', spawn:[['melon',.5]], need:'cut' },
  { text:'Cuts chain into <b>COMBOS</b> — and every cut pays.<br>Chain these three before they drift away.',
    task:'CUT ALL THREE', spawn:[['pear',.62],['banana',.7],['strawberry',.78]], need:'cut' },
  { text:'Some shapes are <b>dangerous</b>.<br>The bomb costs a life — let it fall away. Never cut it.',
    task:"DON'T CUT THE BOMB", spawn:[['bomb',.42]], need:'wait' },
  { text:'Every cut earns <b>¥</b> and <b>CUT</b> currency.<br><br>THE SHOP sells blade trails, swords, relics and upgrades.<br>STATUS keeps your legend. SETTINGS tunes everything — volumes, pitch, screen shake.',
    need:'next' },
  { text:'That is everything.<br>HOLD &amp; DRAG · P PAUSE · M MUTE<br><br>This walkthrough shows only once — MISC ▸ TUTORIAL replays it.',
    task:'READY', need:'next', last:true },
];
function tutSpawn(id, spd){
  const def = DEFS.find(d=>d.id===id);
  if(!def) return null;
  const p = spawnProp(def, spd);
  p._spd = spd;
  TUT.props.push(p);
  return p;
}
function tutGo(i){
  TUT.step = i; TUT.props.length = 0; TUT.timer = 0;
  const st = TUT_STEPS[i];
  $('tut-step').innerHTML = (st.text||'') + (st.task ? '<span class="tut-task">'+st.task+'</span>' : '');
  $('b-tut-next').style.display = st.need==='next' ? '' : 'none';
  $('b-tut-next').textContent = st.last ? 'DONE' : 'NEXT';
  if(st.spawn) for(const [id,spd] of st.spawn) tutSpawn(id, spd);
  if(st.need==='wait') TUT.timer = 9;   // the bomb falls away long before this
}
function tutAdvance(){
  if(!TUT.active) return;
  if(TUT.step+1 < TUT_STEPS.length) tutGo(TUT.step+1);
  else endTutorial();
}
function tutTick(raw){
  const st = TUT_STEPS[TUT.step];
  if(!st) return;
  if(st.need==='cut'){
    if(!TUT.props.length) return;
    for(let i=0;i<TUT.props.length;i++){
      const p = TUT.props[i];
      if(p.dead && !p._cut){              // slipped away uncut — another one drifts in
        const np = spawnProp(p.def, p._spd); np._spd = p._spd;
        TUT.props[i] = np;
      }
    }
    if(TUT.props.every(p=>p._cut)) tutAdvance();
  } else if(st.need==='wait'){
    TUT.timer -= raw;
    if(TUT.props.every(p=>p.dead) || TUT.timer<=0) tutAdvance();
  }
}
function startTutorial(){
  state = 'menu';
  document.body.classList.remove('playing');
  show('');
  TUT.active = true;
  $('scr-tut').classList.add('on');
  tutGo(0);
}
function endTutorial(){
  TUT.active = false;
  $('scr-tut').classList.remove('on');
  if(save.tut!==true){ save.tut = true; persist(); }   // shown once — replay via MISC
  toMenu();
}
$('b-tut-skip').onclick = ()=>{ S.init(); S.ui(); endTutorial(); };
$('b-tut-next').onclick = ()=>{ S.init(); S.ui(); tutAdvance(); };

/* ---- misc: object list (QA gallery) & dev mode ---- */
let devOpen = false;
function syncMisc(){
  const btn=$('b-dev'), entry=$('dev-entry'), msg=$('dev-msg');
  if(save.dev){
    btn.textContent='DEACTIVATE'; btn.disabled=false;
    entry.style.display='none';
    msg.textContent='DEV MODE — EVERYTHING UNLOCKED';
    msg.className='dev-msg ok';
  } else {
    btn.textContent='ENABLE'; btn.disabled=false;
    entry.style.display = devOpen ? 'flex' : 'none';
    if(!devOpen){ msg.textContent=''; msg.className='dev-msg'; }
  }
}
function applyDevUnlock(){
  TRAILS.forEach(t=>{ if(!save.trails.includes(t.id)) save.trails.push(t.id); });
  SWORDS.forEach(s=>{ if(!save.swords.includes(s.id)) save.swords.push(s.id); });
  RELICS.forEach(r=>{ if(!save.relics.includes(r.id)) save.relics.push(r.id); });
  UPGRADES.forEach(u=>{ save.up[u.id]=u.vals.length-1; });
  save.bank    = Math.max(save.bank, 100000000);   // ¥100M spending power
  save.cutsCur = Math.max(save.cutsCur, 100000);   // +100k cuts
  save.dev = true;
  goldT = 2;   // the world flushes gold — undeniable confirmation
  persist();
}
function tryDev(){
  const v = $('dev-input').value, msg = $('dev-msg');
  if(v.trim()==='ilovethisbench2022greenbean'){
    applyDevUnlock();
    S.stamp();
    $('dev-input').value=''; $('dev-input').blur();
    syncMisc();
  } else {
    S.thump();
    msg.textContent='THE BLADE DOES NOT RECOGNIZE YOU';
    msg.className='dev-msg bad';
  }
}
function buildObjects(){
  const grid = $('obj-grid'); grid.innerHTML='';
  const list = DEFS.slice().sort((a,b)=>(a.minT-b.minT)||a.name.localeCompare(b.name));
  $('obj-count').textContent = fmt(list.length)+' SHAPES';
  const CELL=72, dpr=Math.min(2,window.devicePixelRatio||1);
  let maxS=0; for(const d of list) maxS=Math.max(maxS, getSprite(d).s);
  const k = Math.min(1, 62/maxS);               // one shared scale — true relative sizes
  for(const d of list){
    const cell=document.createElement('div');
    cell.className='obj-cell'+(d.dangerous?' danger':'');
    const c=document.createElement('canvas');
    c.width=CELL*dpr; c.height=CELL*dpr;
    c.style.width=c.style.height=CELL+'px';
    const g=c.getContext('2d');
    g.setTransform(dpr,0,0,dpr,0,0);
    const spr=getSprite(d), sz=spr.s*k;
    g.drawImage(spr.c,(CELL-sz)/2,(CELL-sz)/2,sz,sz);
    cell.appendChild(c);
    const nm=document.createElement('div');
    nm.className='obj-name'; nm.textContent=d.name;
    cell.appendChild(nm);
    const mt=document.createElement('div');
    mt.className='obj-meta';
    mt.textContent = d.pool===false ? 'SPECIAL SPAWN'
      : '¥'+d.value+' · C'+(d.cur??1)+' · '+(d.minT<=0?'START':d.minT+'s');
    cell.appendChild(mt);
    cell.onclick=()=>{                          // launch it into the menu to test it live
      S.ui();
      if(state!=='menu') return;
      spawnProp(d,1);
      floatText(W/2,H*.3,d.name,'#8a8a8a',12);
      show('scr-menu');
    };
    grid.appendChild(cell);
  }
}
$('b-misc').onclick     = ()=>{ S.init(); S.ui(); syncMisc(); show('scr-misc'); };
$('b-misc-back').onclick= ()=>{ S.ui(); refreshMenuStats(); show('scr-menu'); };
$('b-objects').onclick  = ()=>{ S.init(); S.ui(); buildObjects(); show('scr-objects'); };
$('b-tut').onclick      = ()=>{ S.init(); S.ui(); startTutorial(); };
$('b-obj-back').onclick = ()=>{ S.ui(); show('scr-misc'); };
$('b-dev').onclick      = ()=>{ S.init(); S.ui();
  if(save.dev){                                   // dev mode is on — the button turns it off
    save.dev=false; devOpen=false; persist();
    S.thump(); syncMisc();
    const msg=$('dev-msg'); msg.textContent='DEV MODE OFF — UNLOCKS KEPT'; msg.className='dev-msg';
    return;
  }
  devOpen=!devOpen; syncMisc(); if(devOpen) $('dev-input').focus();
};
$('dev-unlock').onclick = tryDev;
$('dev-input').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); tryDev(); } });

/* =====================================================================
   THE LAB — trail mastering · CUSTOM ARCADE config · PERFIS
   ===================================================================== */
const LAB_DESC = {                      // (l) = the level being described — current when omitted
  ink:      l => 'PLAIN BLADE · PAY +'+(4*(l??tlv('ink')))+'%',
  crimson:  l => (30-5*(l??tlv('crimson')))+' FRUITS RESTORE A LIFE',
  ghost:    l => 'COMBO WINDOW ×'+(1.6+.3*(l??tlv('ghost'))).toFixed(1),
  frost:    l => 'SLOW-TIME ×'+(1.5+.2*(l??tlv('frost'))).toFixed(2),
  gold:     l => 'EVERY CUT PAYS ×'+(1.5+.25*(l??tlv('gold'))).toFixed(2),
  fire:     l => 'FIRE KILLS IN '+((.8-.1*(l??tlv('fire')))).toFixed(1)+'S',
  universe: l => 'PULL RADIUS '+(300+70*(l??tlv('universe')))+'PX · FORCE +'+(20*(l??tlv('universe')))+'%',
  lightning:l => 'CHAINS '+(1+(l??tlv('lightning')))+' NEIGHBOR'+((1+(l??tlv('lightning')))>1?'S':''),
  liquid:   l => 'SPLASH RADIUS '+(170+30*(l??tlv('liquid')))+'PX',
  wind:     l => 'SHOVE RADIUS '+(240+50*(l??tlv('wind')))+'PX',
  nature:   l => 'SNARE RADIUS '+(220+45*(l??tlv('nature')))+'PX',
  magnet:   l => 'PULL RADIUS +'+(50*(l??tlv('magnet')))+'PX · FORCE +'+(20*(l??tlv('magnet')))+'%',
  mirror:   l => 'TWIN LINGERS '+((.55+.15*(l??tlv('mirror')))).toFixed(2)+'S · PAY +'+(5*(l??tlv('mirror')))+'%',
  time:     l => 'FREEZE RADIUS '+(260+55*(l??tlv('time')))+'PX',
  chaos:    l => 'EFFECT STRENGTH +'+(12*(l??tlv('chaos')))+'%',
  bubble:   l => 'HALVES FLOAT '+((.62+.08*(l??tlv('bubble')))).toFixed(2)+'S BEFORE POPPING',
  solar:    l => 'EVERY CUT PAYS ×'+(1.25+.15*(l??tlv('solar'))).toFixed(2)
                 +' · FLARE BURNS A '+(150+40*(l??tlv('solar')))+'PX RADIUS',
  void:     l => 'HUNGER RADIUS '+(170+35*(l??tlv('void')))+'PX · PAY +'+(5*(l??tlv('void')))+'%',
};
let LAB_TRAIL = null;                   // the lab now opens for ONE trail at a time
function openLab(id){ S.init(); S.ui(); LAB_TRAIL=id; buildLab(); show('scr-lab'); }
function buildLab(){
  if(!LAB_TRAIL) LAB_TRAIL = save.trail;
  const t = TRAILS.find(x=>x.id===LAB_TRAIL)||TRAILS[0];
  const owned = save.trails.includes(t.id);
  $('lab-bank').textContent = 'CUTS '+fmt(save.cutsCur);
  $('lab-sub').textContent = t.name+' — MASTER THE PATH · THREE LEVELS · PAID IN CUTS'
                           + (owned ? '' : ' · BUY THIS BLADE IN THE SHOP FIRST');
  const el = $('lab-list'); el.innerHTML='';
  const lvl = tlv(t.id), sk = SKINS[t.id], roms = ['I','II','III'];
  for(let i=0;i<3;i++){
    const li = i+1, has = li<=lvl, open = owned && li===lvl+1;
    const row = document.createElement('div');
    row.className = 'lab-node'+(has?' owned':'')+(!owned||li>lvl+1?' locked':'');
    const dot = document.createElement('div'); dot.className='lab-node-dot';
    dot.textContent = roms[i]; row.appendChild(dot);
    const name = document.createElement('div'); name.className='lab-node-name';
    name.textContent = 'MASTERING '+roms[i]; row.appendChild(name);
    const desc = document.createElement('div'); desc.className='lab-node-desc';
    desc.textContent = LAB_DESC[t.id] ? LAB_DESC[t.id](li) : 'SHARPEN THE PATH';
    if(sk && li===3) desc.textContent += ' · SKIN: '+sk.name;
    row.appendChild(desc);
    const btn = document.createElement('button'); btn.className='lab-buy';
    if(!owned){ btn.textContent='LOCKED'; btn.disabled=true; }
    else if(has){ btn.textContent='MASTERED'; btn.disabled=true; btn.classList.add('eq'); }
    else if(open){
      btn.textContent = fmt(TLAB_PRICES[lvl])+' CUTS';
      btn.onclick = ()=>{
        if(save.cutsCur>=TLAB_PRICES[lvl]){
          save.cutsCur -= TLAB_PRICES[lvl];
          save.trailUp[t.id] = lvl+1;
          if(save.trail===t.id) setTrail(t.id);      // a mastered blade recolors live
          S.buy(); persist(); buildLab();
        } else {
          S.thump(); btn.classList.add('deny'); setTimeout(()=>btn.classList.remove('deny'),300);
        }
      };
    } else { btn.textContent='SEALED'; btn.disabled=true; }
    row.appendChild(btn); el.appendChild(row);
  }
  const row = document.createElement('div');        // the skin — the end of the path
  row.className = 'lab-node'+(lvl>=3?' owned':' locked');
  const dot = document.createElement('div'); dot.className='lab-node-dot';
  dot.textContent='◆'; row.appendChild(dot);
  const name = document.createElement('div'); name.className='lab-node-name';
  name.textContent = sk ? sk.name+' SKIN' : 'FINAL FORM'; row.appendChild(name);
  const desc = document.createElement('div'); desc.className='lab-node-desc';
  desc.textContent = lvl>=3 ? 'mastered — the blade wears its final form'
                            : 'unlocks when the third level is mastered';
  row.appendChild(desc);
  const chip = document.createElement('div'); chip.className='lab-skin-chip';
  if(sk){ chip.style.background = sk.color; if(sk.line) chip.style.borderColor = sk.line; }
  row.appendChild(chip);
  el.appendChild(row);
}
/* the lab breathes: parallax layers follow the pointer */
addEventListener('pointermove', e=>{
  const s = $('scr-lab'); if(!s || !s.classList.contains('on')) return;
  s.style.setProperty('--px', (e.clientX/innerWidth-.5).toFixed(3));
  s.style.setProperty('--py', (e.clientY/innerHeight-.5).toFixed(3));
}, true);

/* ---- CUSTOM ARCADE config ---- */
function buildCustom(){
  const el = $('custom-list'); el.innerHTML='';
  const slider = (label,id,min,max,step,fmt2,pc)=>{   // pc=true → percent slider (value/100 stored)
    const d=document.createElement('div'); d.className='set-row';
    const sp=document.createElement('span'); sp.textContent=label; d.appendChild(sp);
    const ct=document.createElement('div'); ct.className='set-ctl';
    const inp=document.createElement('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step;
    inp.value = pc ? Math.round(save.custom[id]*100) : save.custom[id];
    const b=document.createElement('b'); b.textContent=fmt2(save.custom[id]);
    ct.appendChild(inp); ct.appendChild(b); d.appendChild(ct);
    inp.addEventListener('input', ()=>{
      save.custom[id] = pc ? +inp.value/100 : +inp.value;
      b.textContent=fmt2(save.custom[id]);
      applyDiff(); S.ui(); persist();
    });
    el.appendChild(d);
  };
  slider('LIVES','lives',0,9,1,v=>v+(v===0?' · FEARLESS':''));
  slider('OBJECT SIZE','size',60,160,5,v=>Math.round(v*100)+'%',true);
  slider('SPEED','speed',50,200,10,v=>Math.round(v*100)+'%',true);
  slider('GRAVITY','grav',50,160,5,v=>Math.round(v*100)+'%',true);
  slider('SPAWN RATE','spawn',50,250,10,v=>Math.round(v*100)+'%',true);
  slider('CUT TOUGHNESS','tough',50,200,10,v=>Math.round(v*100)+'%',true);
  slider('PAY','money',50,500,10,v=>Math.round(v*100)+'%',true);
  const toggle = (label,id)=>{
    const d=document.createElement('div'); d.className='set-row';
    const sp=document.createElement('span'); sp.textContent=label; d.appendChild(sp);
    const b=document.createElement('button'); b.className='btn'; b.style.padding='9px 16px';
    b.textContent = save.custom[id]?'ON':'OFF';
    b.onclick = ()=>{ save.custom[id]=!save.custom[id]; b.textContent=save.custom[id]?'ON':'OFF'; S.ui(); persist(); };
    const ct=document.createElement('div'); ct.className='set-ctl'; ct.appendChild(b); d.appendChild(ct);
    el.appendChild(d);
  };
  toggle('BOMBS','bombs'); toggle('MISSES COST LIVES','miss');
  const og = $('custom-objs'); og.innerHTML='';
  DEFS.forEach(d2=>{
    if(d2.pool===false) return;
    const b=document.createElement('button'); b.className='cobj'+(d2.dangerous?' danger':'');
    const on = !save.custom.off.includes(d2.id);
    b.classList.toggle('on', on); b.textContent=d2.name;
    b.onclick = ()=>{
      const i=save.custom.off.indexOf(d2.id);
      if(i>=0) save.custom.off.splice(i,1); else save.custom.off.push(d2.id);
      b.classList.toggle('on', save.custom.off.indexOf(d2.id)<0);
      S.ui(); persist();
    };
    og.appendChild(b);
  });
}

/* ---- PERFIS: named saves — switch anytime, nothing is ever lost ---- */
function switchPerfil(name){
  if(name===perfil || !reg[name]) return;
  persist();                       // the current perfil is safely stored
  perfil = name;
  try{ localStorage.setItem(ACTIVE_KEY, perfil); }catch(e){}
  location.reload();               // the world reshapes around the new blade
}
function newPerfil(){
  persist();
  let n=1; while(reg['PERFIL '+n]) n++;
  perfil = 'PERFIL '+n;
  reg[perfil] = freshSave();        // a fresh start — base game, nothing unlocked
  saveRegistry();
  try{ localStorage.setItem(ACTIVE_KEY, perfil); }catch(e){}
  location.reload();
}
function dropPerfil(name){
  if(name===perfil || !reg[name]) return;
  delete reg[name]; saveRegistry(); buildPerfil();
}
function buildPerfil(){
  const el = $('perfil-list'); el.innerHTML='';
  for(const name of Object.keys(reg)){
    const d = document.createElement('div'); d.className='perfil-row';
    const main = document.createElement('div'); main.className='perfil-main';
    const nm = document.createElement('div'); nm.className='perfil-name';
    nm.textContent = name;
    if(name===perfil){ const tag=document.createElement('span'); tag.className='on-tag'; tag.textContent='— ACTIVE'; nm.appendChild(tag); }
    main.appendChild(nm);
    if(name!==perfil){
      const st = reg[name].stats||{};
      const meta=document.createElement('div'); meta.className='perfil-meta';
      meta.textContent = fmt(st.cuts||0)+' CUTS MADE · BEST ×'+(st.best||0)+' · ¥ '+fmt(reg[name].bank||0);
      main.appendChild(meta);
    }
    d.appendChild(main);
    if(name!==perfil){
      const sw=document.createElement('button'); sw.className='btn'; sw.style.padding='10px 16px'; sw.textContent='SWITCH';
      sw.onclick=()=>{ S.stamp(); switchPerfil(name); };
      d.appendChild(sw);
      const del=document.createElement('button'); del.className='btn'; del.style.padding='10px 13px'; del.textContent='×';
      del.onclick=()=>{ S.thump(); dropPerfil(name); };
      d.appendChild(del);
    }
    el.appendChild(d);
  }
}
/* THE LAB now lives inside the SHOP — one little bionic tree beside each trail */
$('b-lab-back').onclick   = ()=>{ S.ui(); buildShop(); show('scr-shop'); };
$('b-dg-back').onclick     = ()=>{ S.ui(); show('scr-menu'); };
$('b-perfil').onclick     = ()=>{ S.init(); S.ui(); buildPerfil(); show('scr-perfil'); };
$('b-perfil-back').onclick= ()=>{ S.ui(); syncMisc(); show('scr-misc'); };
$('b-perfil-new').onclick = ()=>{ S.init(); S.stamp(); newPerfil(); };
$('b-custom-back').onclick= ()=>{ S.ui(); refreshMenuStats(); show('scr-menu'); };

/* ---- settings ---- */
const SMOOTH_NAMES = ['ROUGH','STANDARD','SMOOTH','SILK'];
function applySettings(){
  const s = save.settings;
  document.documentElement.style.setProperty('--bs', s.btnScale);
  document.documentElement.style.setProperty('--ts', s.textScale);
  document.body.classList.toggle('hide-menu-texts', !!s.hideTexts);
  S.setVolume(s.volume);
  S.setPitchVar((s.pitchVar??6)/100);
}
function syncSettingsUI(){
  const s = save.settings;
  $('s-vol').value = Math.round(s.volume*100);  $('v-vol').textContent = Math.round(s.volume*100)+'%';
  $('s-mvol').value = Math.round(s.musicVol*100);  $('v-mvol').textContent = Math.round(s.musicVol*100)+'%';
  $('s-mmvol').value = Math.round(s.menuVol*100);  $('v-mmvol').textContent = Math.round(s.menuVol*100)+'%';
  $('s-mivol').value = Math.round(s.matchVol*100); $('v-mivol').textContent = Math.round(s.matchVol*100)+'%';
  $('s-pvar').value = Math.round(s.pitchVar);      $('v-pvar').textContent = '±'+Math.round(s.pitchVar)+'%';
  $('s-shk').value = Math.round(s.shake*100);      $('v-shk').textContent = Math.round(s.shake*100)+'%';
  $('s-tut').textContent = save.tut===true ? 'SHOW AGAIN' : 'NEVER SHOW AGAIN';
  $('s-btn').value = Math.round(s.btnScale*100); $('v-btn').textContent = Math.round(s.btnScale*100)+'%';
  $('s-txt').value = Math.round(s.textScale*100);$('v-txt').textContent = Math.round(s.textScale*100)+'%';
  $('s-hide').classList.toggle('on', !!s.hideTexts);
  $('s-fxt').value = Math.round(s.fxTrail*100);  $('v-fxt').textContent = Math.round(s.fxTrail*100)+'%';
  $('s-fxc').value = Math.round(s.fxCut*100);    $('v-fxc').textContent = Math.round(s.fxCut*100)+'%';
  $('s-sm').value = clamp(Math.round(s.smooth),0,3);
  $('v-sm').textContent = SMOOTH_NAMES[clamp(Math.round(s.smooth),0,3)];
}
function wireSettings(){
  const bind=(id,fn)=>{ const el=$(id);
    el.addEventListener('input', e=>{ fn(e.target.value); applySettings(); syncSettingsUI(); persist(); });
    el.addEventListener('change', ()=>S.ui());
  };
  bind('s-vol', v=> save.settings.volume = v/100);
  bind('s-mvol',  v=> save.settings.musicVol = v/100);
  bind('s-mmvol', v=> save.settings.menuVol  = v/100);
  bind('s-mivol', v=> save.settings.matchVol = v/100);
  bind('s-pvar',  v=> save.settings.pitchVar = +v);
  bind('s-shk',   v=> save.settings.shake    = v/100);
  bind('s-btn', v=> save.settings.btnScale = v/100);
  bind('s-txt', v=> save.settings.textScale = v/100);
  bind('s-fxt', v=> save.settings.fxTrail = v/100);
  bind('s-fxc', v=> save.settings.fxCut = v/100);
  bind('s-sm',  v=> save.settings.smooth = clamp(+v,0,3));
  $('s-hide').onclick = ()=>{
    save.settings.hideTexts = !save.settings.hideTexts;
    S.ui(); applySettings(); syncSettingsUI(); persist();
  };
  $('s-tut').onclick = ()=>{
    save.tut = !(save.tut===true);
    S.ui(); syncSettingsUI(); persist();
  };
}

/* ---- wiring ---- */
 $('b-start').onclick    = ()=>{ S.init(); S.ui();
                                 if(MODES[mode].dungeon){ buildDungeon(); show('scr-dungeon'); }
                                 else startRun(); };
 $('b-shop').onclick     = ()=>{ S.init(); S.ui(); buildShop(); show('scr-shop'); };
 $('b-back').onclick     = ()=>{ S.ui(); refreshMenuStats(); show('scr-menu'); };
 $('b-settings').onclick = ()=>{ S.init(); S.ui(); show('scr-settings'); };
 $('b-set-back').onclick = ()=>{ S.ui(); refreshMenuStats(); show('scr-menu'); };
 $('b-status').onclick   = ()=>{ S.init(); S.ui(); buildStatus(); show('scr-status'); };
 $('b-stat-back').onclick= ()=>{ S.ui(); refreshMenuStats(); show('scr-menu'); };
 $('b-again').onclick    = ()=>{ S.ui();
                                 if(mode==='dungeon') startDungeonLevel(clamp(dgNext ? DG.lvl+1 : (DG.lvl||1), 1, 10));
                                 else startRun(); };
 $('b-menu').onclick     = ()=>{ S.ui(); toMenu(); };
 $('b-resume').onclick   = ()=>{ S.ui(); togglePause(); };
 $('b-quit').onclick     = ()=>{ S.ui(); bankRun(); toMenu(); };
 $('b-pv-close').onclick = closePreview;
 $('scr-preview').addEventListener('pointerdown', e=>{ if(e.target.id==='scr-preview') closePreview(); });
 $('fh-mode').addEventListener('click', ()=>{ S.init(); S.ui(); toggleFold('fold-mode'); });
 $('fh-diff').addEventListener('click', ()=>{ S.init(); S.ui(); toggleFold('fold-diff'); });

 $('pv-speed').onclick = ()=>{
  const arr=[1,2,4];
  PV.speed = arr[(arr.indexOf(PV.speed)+1)%arr.length];
  $('pv-speed').textContent = 'SPEED ×'+PV.speed;
  S.ui();
};
 $('pv-zoom').onclick = ()=>{
  const arr=[1,1.5,2];
  PV.zoom = arr[(arr.indexOf(PV.zoom)+1)%arr.length] || 1;
  $('pv-zoom').textContent = pvZoomLabel();
  S.ui();
};
 $('pv-cut').onclick = ()=>{
  PV.mode = PV.mode==='cut' ? 'path' : 'cut';
  PV.scene = null; PV.pts.length=0;
  $('pv-cut').textContent = PV.mode==='cut' ? 'INFINITY' : 'CUT DEMO';
  S.ui();
};
 $('pv-cv').addEventListener('wheel', e=>{
  e.preventDefault();
  PV.zoom = clamp(PV.zoom*(e.deltaY>0?.9:1.11), .6, 2.6);
  $('pv-zoom').textContent = pvZoomLabel();
}, {passive:false});

addEventListener('keydown', e=>{
  if(e.key==='p'||e.key==='P'||e.key==='Escape'){
    if(state==='play'||state==='pause') togglePause();
  }
  if(e.key==='m'||e.key==='M'){
    S.init();
    const m = S.toggleMute();
    floatText(W/2, H*.35, m?'MUTED':'SOUND ON', '#8a8a8a', 12);
  }
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && state==='play') togglePause();
});
/* =====================================================================
   TITLE FX — small pre-sliced fruit decals behind the wordmark, plus
   a live katana cut through "SLICED" whenever the menu appears
   (page load, or returning from a run — quick shop/settings peeks
   don't re-trigger it). Self-wiring: paste below the MUSIC block.
   ===================================================================== */
const TITLE_FX = (()=>{
  const menu = $('scr-menu');
  const row  = menu ? menu.querySelector('.title-row') : null;
  const h1   = row ? row.querySelector('h1') : null;
  const seal = row ? row.querySelector('.seal') : null;
  if(!row || !h1) return {};

  row.style.position = 'relative';
  h1.style.position='relative'; h1.style.zIndex=2;
  if(seal){ seal.style.position='relative'; seal.style.zIndex=2; }

  /* ---- decal canvas: small pre-sliced fruits behind the title ---- */
  const HPAD=64, VPAD=44;
  const dcv=document.createElement('canvas'), dg=dcv.getContext('2d');
  dcv.style.cssText='position:absolute;z-index:1;pointer-events:none;';
  row.appendChild(dcv);

  const decals=[];
  for(let i=0;i<7;i++){
    const zone=i%3;                        // 0 above · 1 below · 2 flanks
    let fx,fy;
    if(zone===0){ fx=rand(.08,.92); fy=rand(.05,.2); }
    else if(zone===1){ fx=rand(.08,.92); fy=rand(.8,.95); }
    else { fx=(i%2? rand(-.1,.02) : rand(.98,1.1)); fy=rand(.28,.74); }
    decals.push({ def:pick(FRUITS), fx, fy, size:rand(34,62),
                  rot:rand(-.7,.7), cut:rand(-.9,.9), a:rand(.1,.2) });
  }
  const strokes=[];
  for(let i=0;i<3;i++)
    strokes.push({ fx:rand(.05,.95), fy:rand(.08,.92), len:rand(26,54),
                   ang:rand(-.6,.6), a:rand(.06,.12) });

  let dW=0,dH=0;
  function drawDecals(sep, specks){
    dg.clearRect(0,0,dW,dH);
    for(const s of strokes){                       // faint old-cut scars
      const x=s.fx*dW, y=s.fy*dH;
      dg.globalAlpha=s.a; dg.strokeStyle=INK; dg.lineWidth=1;
      dg.beginPath();
      dg.moveTo(x-Math.cos(s.ang)*s.len/2, y-Math.sin(s.ang)*s.len/2);
      dg.lineTo(x+Math.cos(s.ang)*s.len/2, y+Math.sin(s.ang)*s.len/2);
      dg.stroke();
    }
    for(const d of decals){                       // split-fruit watermarks
      const x=d.fx*dW, y=d.fy*dH, sp=getSprite(d.def);
      dg.save(); dg.translate(x,y); dg.rotate(d.rot);
      dg.globalAlpha=d.a*.5; dg.fillStyle=INK;    // soft stain beneath
      dg.beginPath(); dg.arc(0,0,d.size*.3,0,TAU); dg.fill();
      const gap=2+sep*6;
      for(let side=-1; side<=1; side+=2){
        dg.save(); dg.rotate(d.cut);
        dg.beginPath();
        if(side>0) dg.rect(-170,.5,340,170); else dg.rect(-170,-170.5,340,170);
        dg.clip();
        dg.translate(0, side*gap);
        dg.rotate(-d.cut);
        dg.globalAlpha=d.a;
        dg.drawImage(sp.c, -d.size/2, -d.size/2, d.size, d.size);
        dg.restore();
      }
      dg.restore();
    }
    if(specks && specks.a>0){                     // transient ink flecks
      dg.globalAlpha=specks.a*.55; dg.fillStyle=INK;
      for(const s of specks.list){
        dg.beginPath(); dg.arc(s.x,s.y,s.r,0,TAU); dg.fill();
      }
    }
    dg.globalAlpha=1;
  }
  function layout(){
    const r=row.getBoundingClientRect();
    dW=Math.round(r.width+HPAD*2); dH=Math.round(r.height+VPAD*2);
    const dpr=Math.min(2, window.devicePixelRatio||1);
    dcv.width=dW*dpr; dcv.height=dH*dpr;
    dcv.style.width=dW+'px'; dcv.style.height=dH+'px';
    dcv.style.left=(-HPAD)+'px'; dcv.style.top=(-VPAD)+'px';
    dg.setTransform(dpr,0,0,dpr,0,0);
    drawDecals(0,null);
  }
  function invalidate(){
    if(up && !animating && up.parentNode){ up.remove(); lo.remove(); up=lo=null; }
  }
  layout();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ invalidate(); layout(); });
  setTimeout(()=>{ invalidate(); layout(); }, 800);   // after webfonts settle

  /* ---- the live cut: slash sweep + clipped halves of the wordmark ---- */
  const box=document.createElement('div');
  box.style.cssText='position:absolute;inset:0;z-index:4;pointer-events:none;';
  row.appendChild(box);
  const slash=document.createElement('div');
  slash.style.cssText='position:absolute;height:2.5px;background:'+INK+';border-radius:2px;transform-origin:0 50%;z-index:4;';
  box.appendChild(slash);
  let up=null, lo=null, geo=null, animating=false;

  function build(){
    if(up) return;
    const rr=row.getBoundingClientRect(), hr=h1.getBoundingClientRect();
    geo={ L:hr.left-rr.left, T:hr.top-rr.top, W:hr.width, H:hr.height };
    const mk=clip=>{
      const c=h1.cloneNode(true);
      c.style.cssText='position:absolute;margin:0;visibility:hidden;pointer-events:none;z-index:3;'
        +'left:'+geo.L+'px;top:'+geo.T+'px;width:'+geo.W+'px;'
        +'clip-path:'+clip+';-webkit-clip-path:'+clip+';will-change:transform;';
      box.appendChild(c); return c;
    };
    up=mk('polygon(0 0, 100% 0, 100% 32%, 0 68%)');
    lo=mk('polygon(0 68%, 100% 32%, 100% 100%, 0 100%)');
    const dy=-.36*geo.H;
    geo.ang=Math.atan2(dy, geo.W);
    geo.nx=-Math.sin(geo.ang); geo.ny=Math.cos(geo.ang);
    slash.style.width=(Math.hypot(geo.W,dy)+70)+'px';
    slash.style.left=(geo.L-35)+'px';
    slash.style.top=(geo.T+.68*geo.H)+'px';
  }
  function playCut(){
    if(animating) return;
    animating=true;
    build();
    const rot='rotate('+(geo.ang*180/Math.PI)+'deg)';
    slash.style.transition='none';
    slash.style.opacity='1';
    slash.style.transform=rot+' scaleX(0)';
    void slash.offsetWidth;                       // sweep in…
    slash.style.transition='transform .17s cubic-bezier(.3,.7,.4,1)';
    slash.style.transform=rot+' scaleX(1)';

    setTimeout(()=>{                              // …CUT.
      h1.style.visibility='hidden';
      up.style.visibility='visible'; lo.style.visibility='visible';
      S.slice(60);
      const D=Math.max(6, geo.H*.1);
      up.style.transition='transform .38s cubic-bezier(.22,1,.36,1)';
      lo.style.transition='transform .38s cubic-bezier(.22,1,.36,1)';
      up.style.transform='translate('+(-geo.nx*D).toFixed(1)+'px,'+(-geo.ny*D).toFixed(1)+'px) rotate(-1deg)';
      lo.style.transform='translate('+( geo.nx*D).toFixed(1)+'px,'+( geo.ny*D).toFixed(1)+'px) rotate(1deg)';
      slash.style.transition='opacity .3s ease .1s';
      slash.style.opacity='0';
      if(seal){                                   // the seal stamps in on impact
        seal.style.animation='none'; void seal.offsetWidth;
        seal.style.animation='stampIn .5s cubic-bezier(.22,1.6,.36,1) 1 backwards';
        setTimeout(()=>S.stamp(),110);
      }
      const specks={a:1,list:[]};                 // ink flecks along the cut
      for(let i=0;i<6;i++){
        const t=rand(.12,.88), o=(Math.random()<.5?-1:1)*rand(4,18);
        specks.list.push({
          x:geo.L+geo.W*t+HPAD+geo.nx*o,
          y:geo.T+geo.H*(.68-.36*t)+VPAD+geo.ny*o,
          r:rand(1,2.6)
        });
      }
      const t0=performance.now();                // decals shudder apart with it
      (function loop(){
        const t=(performance.now()-t0)/1000;
        const sep = t<.38? t/.38 : t<.56? 1 : Math.max(0, 1-(t-.56)/.55);
        specks.a = Math.max(0, 1-t/1.05);
        drawDecals(sep, specks);
        if(t<1.1) requestAnimationFrame(loop); else drawDecals(0,null);
      })();

      setTimeout(()=>{                            // hold… then heal clean
        up.style.transition='transform .55s cubic-bezier(.6,.05,.25,1)';
        lo.style.transition='transform .55s cubic-bezier(.6,.05,.25,1)';
        up.style.transform='translate(0,0) rotate(0deg)';
        lo.style.transform='translate(0,0) rotate(0deg)';
        setTimeout(()=>{
          h1.style.visibility='';
          up.style.visibility='hidden'; lo.style.visibility='hidden';
          animating=false;
        },580);
      },560);
    },185);
  }

  addEventListener('resize', ()=>{ invalidate(); layout(); });

  /* ---- trigger: on load & when returning from a run ---- */
  let shown=false, lastState=null;
  setInterval(()=>{
    const on=menu.classList.contains('on');
    if(on && !shown){
      shown=true;
      if(lastState!=='menu') setTimeout(playCut, 420);
    } else if(!on && shown){ shown=false; }
    lastState=state;
  },150);

  return { playCut };
})();
/* =====================================================================
   MAIN LOOP
   ===================================================================== */
try{ if(document.fonts) document.fonts.load('700 20px "Permanent Marker"'); }catch(e){}
applyDiff();
applySettings();
syncSettingsUI();
wireSettings();
refreshMenuStats();
syncLives();
buildFolds();
applyDiff();                          // gravity honors the saved difficulty & custom rules from the start
if(save.tut!==true) startTutorial();   // the very first open greets you with the blade
let last = performance.now();
function frame(now){
  const raw = Math.min(.05, Math.max(.0001, (now-last)/1000));
  last = now;
  update(raw);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
