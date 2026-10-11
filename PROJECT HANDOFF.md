# SLICED — PROJECT HANDOFF 🗡️
*State of the game + everything a fresh chat needs to know. Written after the big expansion session.*

## THE GAME
Minimalist samurai slicing game (fruit-ninja style, black ink on white world).
Pure **HTML + CSS + vanilla JS** — no frameworks, no build step, no libraries.
Open `Game/index.html` directly in a browser (file://) — everything is local.

## FILES
- `Game/index.html` — all screens (menu, shop, settings, status, misc, objects, preview, lab, dungeon, custom, perfis, tutorial overlay, pause, over)
- `Game/script.js` — the entire game (~4400 lines, heavily commented, systems separated by banner comments)
- `Game/style.css` — includes the dark LAB theme (glitch + parallax) + tutorial + perfil + dungeon (boss floor cells, horns, pulse) + lab-tree styles
- `Game/headless-test.js` — **Node regression harness** (runs the real game with a DOM shim + simulated cuts). Run: `node Game\headless-test.js` → expect `PASS`. Extend it when adding features! (The object-gallery loop must click **obj-cell elements only** — blind button-clicking now trips DUNGEON/BEGIN/AGAIN.)
- `Game/SFX SHOPPING LIST.md` — the audio shopping list (36 entries, Tier 4 still missing)
- `Assets/Music/` — `Main_Menu_SLICED.mp3`, `In-match SCLICED.mp3` (real filename has that typo — referenced as-is)
- `Assets/Objects/` — 21 black-silhouette PNGs (with transparency + padding)
- `Assets/SFX/` — `Fruit SFX/` (Fruit_Cut01–05.wav), `Object SFX/`, `Trail SFX/`, `UI sfx/`, `Game sfx/` (**EMPTY — Tier 4 not yet gathered**)

## ⚠️ CRITICAL OPERATIONAL FACTS
1. **The user PLAYS from `C:\Sliced Backup folder\Sciled\`** — a second copy of the game! After every change, remind them to sync:
   `Copy-Item "c:\Games i made\Sciled\Game\script.js","c:\Games i made\Sciled\Game\index.html","c:\Games i made\Sciled\Game\style.css" -Destination "C:\Sliced Backup folder\Sciled\Game\" -Force`
   (only the files that changed) — **plus Ctrl+F5** (stale cache fooled us twice).
2. Only the workspace `c:\Games i made\Sciled` is writable by the agent (reads of the backup folder are fine).
3. **Browsers throw on `playbackRate` outside ~0.06–16** — this once froze the game (combo ladder 13.45× × pitch slider 25% = 16.7×). All rates are now clamped to 0.25–8 and audio setup is try/catch-armored. Never trust a rate above 8.
4. Paths in code use `%20` for spaces; localStorage keys: `sliced-v1` (active save), `sliced-v1-profiles` (perfil registry), `sliced-v1-active` (perfil name).

## AUDIO ENGINE (`S` IIFE in script.js)
- `SAMPLES` map: key → {files[], vol (uniform .6, only boom .85), cap (ms, cuts long files), fade (zapTrail only)}.
- `playSample(key, rate)`: shuffled-deck file choice, **player pool** (`freePlayer`, up to 10 clones per key → sounds overlap, never cut each other off), pitchSpread from settings, caps pause clones, synth fallback if file missing.
- `M.fruitCut`/`M.ice` call `playSample('fruit'/'ice')`; combo method pitch-climbs its sample (`Math.min(2, 2^(st/12))`).
- Music: self-driving state watcher; volumes follow settings sliders (musicVol, menuVol, matchVol).
- Settings audio: SFX VOLUME, MUSIC VOLUME, MENU THEME, IN-MATCH, SFX PITCH VARIATION (±0–25%, slider `s-pvar`), SCREEN SHAKE, TUTORIAL AUTOPLAY.

## VISUAL SYSTEMS
- **Canvas**: `cv.style.width/height` pinned to viewport in `resize()` (DPR fix — don't remove!).
- **Object art**: DEFS entries have `img:'File.png'` + `ib:[x,y,w,h]` (measured content bbox) → `getSprite()` draws the PNG scaled to the hitbox (2r); ink drawing = fallback. Sprite cache + `OBJ_IMG` loader with cache invalidation on load.
- **Materials**: `jag:true` → jagged cut halves (shared 12-point teeth profile, scaled per object in `drawOneFragment`: amp=f.size*.085, span=f.size*.55); `shard:'#css'` → shard burst on cut (ink-outlined). Egg (#fff shells) / wine glass / ice = shatter tier (wine+ice lost `fragment:false`, they get halves now).
- **GALAXY trail**: internal id **`'universe'`** (kept for save compat) but display name GALAXY — standard ribbon thickness, animated lavender/violet/white stars, purple nova cut (solar's explosion recolored, zero yellow), `zapTrail` (0.22s + fade) for lightning chains only.

## GAMEPLAY SYSTEMS
- **DEFS registry** (~46 objects): flags include `r` (radius/hitbox), `sm` (sprite size mult), `w`/`minT` (spawn weight/unlock time), `rare`, `fruit` (uses fruitCut WAVs + missPenalty), `sfx` (named audio key), `jag`, `shard`, `img/ib`, `onCut`, `spawn/update` (custom physics), `live` (drawn every frame), `fragment:false` (no halves), `missPenalty`, `tough` (swing speed req), `mass`, `dangerous` (bomb), `pool:false` (never spawns). **PINEAPPLE** `onCut` bursts leaf spikes (0.5 dmg); **CACTUS** (new) bursts a full radial spike ring like the boss's spin attack (1 dmg, cuttable spikes).
- **HAZARDS** (`hz` array, all modes): spikes/ants/bulbs/shards with `warnT` telegraphs (dashed red circle), `cut` = blade passes needed (purple spikes need 5, cracks drawn per hit), `dmg` 1 or 0.5 (`hurtPlayer` — two halves = one life, `halfT` decay, `invulnT` i-frames). Damage gated by `hazGate()` (ZEN/CHAOS/ENDLESS safe; CUSTOM honors its miss knob).
- **DUNGEON** (`MODES.dungeon` + `save.dungeon {unlocked, done}`): normal rules + difficulty folds, 10 floors, goals in `DG_LEVELS` (5 pineapples → 75 fruits → … → 300 objects), `startDungeonLevel/dgCount/dgClear`, HUD goal counter in `h-status-l`, results title via `overTitle` (`go-title`), floor grid `scr-dungeon` (5×2 numbers; boss cells 3/6/9 = escalating horns + pulsing red/black gradient; b3 = white text + BEGIN-hover red).
- **THE OBJECT MONSTER** (floors 3/6/9, tier 1/2/3 via `TP`): a rotating ball built from the real object sprites, cut to hurt (HP bar, `bossHit/bossDie`), 6 attacks (`spikes` static field w/ purple 5-pass spikes, `shake` fruitfall+medkits (`_drop` props — uncut fruit = 0.5 dmg), `bulbs` shatter at mid-screen into cuttable shards, `bombs` strafing bomb rain, `ants` cursor-chasing swarm, `spin` border-circling spike flurry). Tier scaling: warn 1.35→0.5s, recovery 2.5→0.75s, combos chain from tier 2. `spawnT=1e9` stops volleys while he lives.
- **CUSTOM mode**: `MODES.custom` + `save.custom` {lives,size,speed,grav,spawn,tough,money,bombs,miss,off[]} — helper `cMul(k)` applies knobs in pickDef/spawnProp/volley/GRAV/tough/pay/lives/miss. Config UI: `buildCustom()` (percent sliders store value/100!). Mode fold click on CUSTOM opens `scr-custom`.
- **THE LAB (per-trail trees)**: opened ONLY from the SHOP — a small `.lab-open` bionic-tree button beside every trail row (`openLab(id)` → `buildLab()` shows that trail's 3 levels + skin node; black buttons, white outlines/text, sharp corners). `save.trailUp` 0–3, `tlv(id)`, `TLAB_PRICES=[400,1200,3600]` CUTS. **SKINS**: `SKINS` map + `skinOf/trailCss/skinned` — level 3 auto-unlocks the blade's final form (nature → AUTUMN etc.); recolors ribbon (`renderTrailRibbon` colMain/colLine), `trail.css`, and key ambient FX (`skinned()` in `drawParticleSet`).
- **PERFIS**: `reg` (registry), `perfil` (active name), `switchPerfil/newPerfil/dropPerfil` (persist current → switch → `location.reload()`), `buildPerfil()` in `scr-perfil`. Old single save auto-adopted as "PERFIL 1".
- **Tutorial**: `TUT`/`TUT_STEPS` — 5 steps, spawn real objects on the menu backdrop, waits for real cuts (`p._cut` flag set in `cut()`), respawns missed fruit; first launch only (`save.tut`), SKIP button, MISC ▸ TUTORIAL ▸ REVIEW replays, settings toggle `s-tut`.
- **Dev mode**: password `ilovethisbench2022greenbean` → unlocks everything; DEACTIVATE button reverses it (non-destructive: unlocks kept).
- **Modes**: classic/zen/chaos/precision/endless/dungeon + custom. Difficulties easy/normal/hard/samurai/sensei (DIFFS multipliers + `applyDiff()` sets GRAV; called at boot + on diff/custom changes). DUNGEON fold click & BEGIN open the floor grid; AGAIN replays the floor (or advances after a clear).
- **SOLAR buff**: every cut leaves a burning flare zone (`flares`, radius 150+40×tlv) that ignites everything it touches (not bombs) — LAB widens it.

## STILL TO DO (open threads)
1. **Tier 4 SFX** (the `Game sfx/` folder is empty): game-over sting, bomb fuse hiss (on bomb spawn — gameplay readability!), slow-time engage, TIME ×2 start, combo-break, best-combo milestone. Wiring points exist; synth/silence currently handle them.
2. Sync reminder to the backup folder after ANY change (see critical facts) + Ctrl+F5.
3. Optional polish ideas mentioned before: heavy-swing whoosh sound, itch.io/Steam page assets (banner, screenshots, devlog copy).

## CONVENTIONS
- Code style: compact, comment banners per system, em-dash comments, no build tooling.
- Every sound is a named key on `S`/`M`; per-object sounds via `sfx:'key'`.
- `cut()` money/combo guarded by `state==='play'` — menu cuts are safe/visual (object list + tutorial rely on this).
- Validation ritual after every change: `node --check "Game\script.js"` + `node "Game\headless-test.js"` (extend the harness for new features), then the sync reminder.

*Point the new chat at this file and continue exactly where we left off.* 🗡️
