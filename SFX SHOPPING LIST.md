# SLICED — SFX Shopping List 🗡️🔊

Everything the game currently plays, and what real sound to gather for it.
You already own the hard part (the fruit cuts + ice cut + both music tracks) —
the rest of the game is still running on tiny synthesized placeholders.

**Current state:** `Fruit_Cut01–05.wav` ✅ · `Ice_Cube_Cut01.wav` ✅ · `Main_Menu_SLICED.mp3` ✅ · `In-match SCLICED.mp3` ✅ · everything else = synth.

**Where files go:** `Assets/SFX/Fruit SFX/` · `Assets/SFX/Object SFX/` · `Assets/SFX/Game sfx/` · `Assets/SFX/UI sfx/`

---

## TIER 1 — THE CORE (heard every run, biggest polish impact)

| # | Sound | Triggered by | Placeholder today | What to gather |
|---|-------|--------------|-------------------|----------------|
| 1 | **Fruit cuts** ×5    | every fruit cut   | ✅ **HAVE** (Fruit_Cut01–05) | — |
| 2 | **Ice cube cut**     | ICE BLOCK cut     | ✅ **HAVE** | — |
| 3 | **Generic object slash** ×4–5            | toast, cheese, pizza, burger, mushroom, carrot, garlic, fork, croissant… (every non-fruit object without its own sfx) | synth `slice` |      a dry katana *swish-through* with a subtle impact — ~120–200ms, several takes. Most-heard sound after the fruit cuts. |
| 4 | **UI click**         | EVERY button, fold, chip in menus/shop | synth `ui` | tiny dry tick/click, 30–60ms, 2–3 variants |
| 5 | **Life lost   hit**  | missing a fruit, bomb hit | synth `hit` | soft gut-punch thud ~250ms + **1 harsher variant for the last life** (screen pulses red there) |
| 6 | **Combo note set**   | every scoring cut, pitch climbs with combo | synth `combo` | one clean melodic note (marimba/kalimba/koto pluck), ~150ms, **C major pentatonic** — the game pitch-shifts it up the ladder |
| 7 | **Buy success**      | shop purchases (upgrades, trails, swords, relics) | synth `buy` | bright two-note chime, ~300ms |
| 8 | **Buy denied**       | not enough money (button shakes red) | synth `thump` | dull low thud, ~150ms |
| 9 | **Seal stamp**       | game-over seal, relic acquired, title 斬 stamp, dev unlock | synth `stamp` | deep wax-seal stamp with woody tail, ~400ms — the game's most dramatic UI moment |

## TIER 2 — OBJECT ONE-SHOTS (rare spawns = big personality moments)

| # | Sound | Triggered by | Placeholder | What to gather |
|---|-------|--------------|-------------|----------------|
| 10 | **Bomb explosion** | bomb cut | synth `boom` | full boom: crack + body + rumble, ~600ms. Loudest event in the game. |
| 11 | **Balloon pop** | balloon cut, bubble-trail pops, burn-outs | synth `pop` | classic balloon pop, ~80ms |
| 12 | **Coin chime** | COIN cut, PRECISE bonus, GOLD-trail sparkle | synth `coin` | bright metallic ting, ~250ms |
| 13 | **Wine glass shatter** | WINE GLASS cut | synth `shatter` | real glass smash, ~400ms |
| 14 | **Soda fizz** | FIZZ bottle cut (spray shoves neighbors) | synth `fizz` | carbonated spritz, ~500ms |
| 15 | **Piano chord** | PIANO cut (the big ¥220 object) | synth `chord` | out-of-tune upright chord + wood crack, ~1.2s |
| 16 | **Rubber duck squeak** ×2 | duck cut + bounce squeaks | synth `duck` | squeaky-toy squeaks, 2–3 pitches |
| 17 | **Mouse squeak** ×2 | mouse cut + mid-air jinks | synth `squeak` | tiny rodent squeaks, 2 takes |
| 18 | **Wet squish** | FISH and EYE cuts | synth `squish` | wet squelch, ~150ms (celery + wet cloth trick) |
| 19 | **Electric zap** | LIGHT BULB cut, LIGHTNING trail arc-cuts | synth `zap` | short electric zap, ~150ms |
| 20 | **Firecracker crackle** | FIRECRACKER cut, fire burn-outs | synth `crackle` | crackling burst, ~300ms |
| 21 | **Clock tick** | TIME trail cuts, TIME ×2 rapid ticking | synth `tick` | single tick, ~50ms, 2 variants |
| 22 | **Riser whoosh** | CLOCK & TEAPOT cuts | synth `riser` | quick metallic/steam riser, ~350ms |
| 23 | **Heal shimmer** | **MED KIT +1 LIFE** (green vignette!), MIRROR gleam | synth `shimmer` | soft glassy chime, ~300ms — your new signature moment |
| 24 | **Golden chime** | GOLDEN APPLE cut | synth `gold` | 3-note harp/glock sparkle, ~700ms |
| 25 | **Steam puff** | COFFEE & TEAPOT smoke bursts | (smoke only) | gentle steam puff, ~400ms — optional |

## TIER 3 — BLADE / TRAIL PERSONALITY

| # | Sound | Triggered by | Placeholder | What to gather |
|---|-------|--------------|-------------|----------------|
| 26 | **Fire ignite** | FIRE trail touching anything | synth `ignite` | ignition whoosh, ~300ms |
| 27 | **Void suck** | UNIVERSE trail cut / collapse | synth `voids` | reversed implosion suck, ~400ms |
| 28 | **Wind whoosh** | WIND trail big swings (shoves objects) | synth `whoosh` | airy whoosh, ~300ms |
| 29 | **Leaf rustle** | NATURE trail cuts | synth `rustle` | soft leaf rustle, ~200ms |
| 30 | **Heavy swing whoosh** | very fast strokes | none (silent!) | optional: blade whoosh — makes fast slicing feel *physical* |

## TIER 4 — SYSTEM STINGERS (silent or borrowed today)

| # | Sound | Triggered by | Today | What to gather |
|---|-------|--------------|-------|----------------|
| 31 | **Game-over sting** | last life lost (music fades, seal stamps) | only the stamp | short somber koto/shakuhachi note, ~1.5s |
| 32 | **Bomb fuse hiss** | bomb spawn (silent today!) | none | 2s hiss — *gameplay readability*: hearing the bomb early saves lives |
| 33 | **Slow-time engage** | slow-motion moment | none | deep whoosh + pitch-drop, ~400ms |
| 34 | **TIME ×2 start** | time-speed doubling | just ticks | rising whirr, ~400ms |
| 35 | **Combo-break** | meter draining to zero | none | tiny descending "tsk" |
| 36 | **Best-combo milestone** | passing your record mid-run | none | optional sparkle sting |

---

## 🛠️ Gathering & recording guidelines

- **Length = responsiveness.** One-shot cuts ≤ 200ms, UI ≤ 100ms. Long tails make the game feel sluggish.
- **Variations matter more than fidelity.** 3–5 takes of anything heard often — the game pitch-varies and shuffles them automatically (same as the fruit cuts).
- **Format:** WAV, 44.1kHz, **mono** for cuts/ticks, stereo only for the boom/whoosh. Trim silence — attacks must land on the exact frame.
- **Loudness:** peaks around **−6 dBFS**, all at the same level, so nothing randomly overpowers anything. Bomb loudest; UI ticks quietest.
- **Style:** dry, close-mic'd — fits the black-ink aesthetic. Avoid big reverb tails.
- **Naming:** match folder + purpose so wiring is trivial, e.g. `Object SFX/Bomb_Boom.wav`, `Object SFX/Medkit_Heal.wav`, `UI sfx/UI_Click_01.wav`, `Game sfx/Game_Over_Sting.wav`.

## 📍 Where to source (free)
- **Kenney.nl** — CC0 packs (impact / UI / audio bundles)
- **freesound.org** — filter by CC0 ("katana slash", "watermelon cut", "glass shatter"…)
- **Sonniss GDC bundles** — free pro game-audio bundles
- **itch.io** — search "SFX pack", many cheap/CC0 packs
- **Record your own** — real knife through watermelon near a phone mic; layer a celery snap + wet-towel whip for extra *snick*.

## 🔌 Integration (when you're ready)
Every sound is a named key in the game's audio system (`slice`, `boom`, `ui`, `combo`…) and every object declares which one it plays — so wiring gathered files in is quick, exactly like the fruit cuts and ice cube were done.

