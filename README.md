# 🍕 Can You Get Past The Chef! 👨‍🍳

A simple browser game where you control a smiling pepperoni pizza collecting toppings in a restaurant maze — while avoiding a hungry chef!

Built with plain **HTML + CSS + JavaScript**. No frameworks, no build step, no server required.

---

## 🎮 How to Play

1. You are the 🍕 pizza.
2. Collect all three toppings: 🍖 pepperoni, ⚫ olive, 🧀 cheese.
3. Avoid the 👨‍🍳 chef — if he catches you, you lose a life.
4. Avoid ⚠️ spikes — they also cost a life.
5. Grab the ⭐ star for 5 seconds of **star power** — during star mode, touching the chef sends him back to the kitchen.
6. Collect all toppings to **clear a level**.
7. There are **three levels** — the chef gets faster and smarter each one.
8. You start with 3 lives. If all lives are lost, the chef wins.
9. The game remembers your **best score** ever, even after you close the tab. Beat it!
10. Grab toppings in quick succession to build a **combo** — each one multiplies your score up to **x5**. The HUD bar shows how long you have before the chain breaks. Getting hit resets the combo.

### Controls

- **Arrow keys** — move up / down / left / right
- **WASD** — same, just a different hand
- **Restart** button — start over any time

---

## ▶️ How to Run

Pick whichever is easier:

### Option 1 — Just double-click
Open `index.html` in a web browser (Chrome, Firefox, Edge, or Safari). The game runs immediately. Nothing to install.

### Option 2 — Tiny local server
If your browser ever acts weird about local files, open a terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

---

## 📂 What's in this folder

```
can-you-get-past-the-chef/
├── index.html   ← the page structure
├── style.css    ← how it looks (colors, fonts, layout)
├── game.js      ← all the game logic
└── README.md    ← this file
```

Four files. That's the whole game.

---

## 🛠️ How to change the game

Open `game.js` in any text editor (Notepad, VS Code, whatever). The very top of the file has a section called **SETTINGS** — that's where the knobs live.

### 1. Make the pizza faster or slower
```js
const PLAYER_MOVE_DELAY = 90;
```
Smaller number = faster. Try `50` for speedy-pizza mode, `200` for slow-mo.

### 2. Make the chef faster or slower
```js
const CHEF_MOVE_DELAY = 400;
```
Try `200` to make the chef actually scary.

### 2b. Make the chef smarter or dumber
```js
const CHEF_SMARTNESS = 0.75;
```
How often the chef actively chases the pizza instead of wandering randomly.
- `0` — fully random (original behavior, easiest)
- `0.5` — chases half the time
- `0.75` — default; chases most of the time but still surprises you
- `1` — always chases (hardest)

### 3. Start with more (or fewer!) lives
```js
const STARTING_LIVES = 3;
```
Change to `5` for easier mode, or `1` for nightmare mode.

### 4. Longer star power
```js
const STAR_POWER_SECONDS = 5;
```
Bump it to `10` for double the pizza-rage time.

### 4b. Mute the sound effects
```js
const MUTED = false;
```
Flip to `true` to play without beeps (classrooms, late at night, etc.).
The beeps are all made live by the browser — there are no audio files.

### 4c. Tweak the "juice" (little polish effects)
```js
const SHAKE_FRAMES   = 10;   // screen-shake length when you get hit
const SHAKE_PIXELS   = 6;    // how far the shake jiggles
const FLASH_MS       = 250;  // yellow flash length on topping pickup
const STAR_PULSE_MIN = 0.75; // smallest pizza scale during star mode
const STAR_PULSE_MAX = 1.10; // largest pizza scale during star mode
const PARTICLE_COUNT = 14;   // how many circles fly out on a pickup / hit
const FLOAT_TEXT_MS  = 800;  // how long a "+10" number floats before fading
const HIT_FLASH_MS   = 80;   // full-canvas red flash on a life-loss hit
const BANNER_MS      = 900;  // how long the "STAR POWER!" banner stays
const BOB_PIXELS     = 2;    // idle-bob height for pizza & chef
const CHEF_SCARY_RANGE = 3;  // tiles — chef shows 😠 within this range
const SQUASH_MS      = 260;  // pizza squash animation length on a hit
const LEVEL_INTRO_MS = 1500; // how long the "Level N: Name" card shows
const COMBO_WINDOW_MS = 2500;// time between pickups to keep a combo alive
const COMBO_MAX       = 5;   // hard cap on the combo multiplier
```
Set any of these to `0` to disable that effect. Crank them up for
extra chaos.

### 5. Change the maze colors
Still near the top of `game.js`:
```js
const WALL_COLOR       = "#cc0000";  // red
const BACKGROUND_COLOR = "#000000";  // black
```
Try `"#00aaff"` for blue walls, or `"#001133"` for a dark blue background. Google "hex color picker" to find any color you want.

### 6. Add more toppings (or move things around!)
Find the `LEVELS` section in `game.js`. It's an array of level objects:

```js
const LEVELS = [
  {
    name: "Classic Pizzeria",
    theme: {
      wallColor:     "#cc0000",
      wallHighlight: "#ff4444",
      bgColor:       "#000000",
      floorPattern:  "solid",
    },
    grid: [
      "111111111111111",
      "1@0000000000001",
      ...
    ],
  },
  ...
];
```

- `name` is shown in the "Level N: …" intro card.
- `theme.floorPattern` is one of:
  - `"solid"` — plain coloured floor (like the classic pizzeria)
  - `"checker"` — alternating squares; needs `theme.floorPatternAlt` too
  - `"neon"` — dark floor with glowing outlines; needs `theme.floorOutline`
- `grid` is the maze, same rules as before.

Each character in a level is one square of the maze:

| Character | Means |
|-----------|-------|
| `1` | wall |
| `0` | empty floor |
| `P` | 🍖 pepperoni topping |
| `O` | ⚫ olive topping |
| `C` | 🧀 cheese topping |
| `X` | ⚠️ spike (dangerous!) |
| `S` | ⭐ star power-up |
| `@` | where the pizza starts |
| `E` | where the chef starts |

Want more pepperoni? Change any `0` to a `P`. Want to move the chef? Change his `E` to a new spot (and turn the old one back into `0`).

⚠️ Rules to remember:
- **Every row must be the same length** (15 characters in the default levels).
- **Every level must be the same size as the others** (11 × 15 in the default game).
- **The outside edge must all be `1`s** or the walls won't close.
- **Each level needs at least one `P`, `O`, and `C`** (the three toppings).

### 7. Tune how the chef gets harder each level
```js
const CHEF_SPEEDUP_PER_LEVEL   = 80;   // ms shaved off CHEF_MOVE_DELAY per level
const CHEF_SMARTNESS_PER_LEVEL = 0.1;  // extra CHEF_SMARTNESS per level (cap 1.0)
```
Each new level, the chef moves a little faster and chases a little more
often. Crank these numbers up for brutal difficulty spikes, or down to
zero if you want every level to play the same.

---

## 🧑‍💻 How the code is organized

`game.js` is split into labeled sections, in the order they run:

1. **SETTINGS** — all the numbers and colors you can change
2. **THE LEVELS** — the three mazes, drawn as strings
3. **GAME STATE** — things that change while playing (score, positions)
4. **SET UP THE CANVAS** — get ready to draw
4b. **HIGH SCORE** — read and write the best-ever score with `localStorage`
5. **START / RESTART** — what happens when a new game (or new level) begins
6. **HELPERS** — tiny utility functions
7. **PLAYER MOVEMENT** — reading the keyboard and moving the pizza
8. **CHEF MOVEMENT** — greedy chase, mixed with a little randomness
9. **COLLISIONS** — what happens when two things touch
10. **HUD UPDATE** — refresh the score / lives / star timer
11. **DRAWING** — paint the scene (with screen-shake + tile flash + pulsing pizza)
11b. **DRAWING — THE PIZZA FACE** — how each part of the pizza (crust, cheese, pepperoni, eyes, mouth) is drawn with canvas
12. **MAIN LOOP** — runs forever
13. **KEYBOARD** — remember which keys are held
14. **RESTART BUTTONS** — wire up the buttons
15. **GO!** — start the first game
16. **SOUND EFFECTS** — little beeps made with the Web Audio API (no audio files!)
17. **PARTICLES + FLOATING TEXT** — tiny physics engine for the burst/pop effects

Every section has comments in plain English. Read it top to bottom and it should all make sense.

---

## 🎉 Have fun!

Tinker. Break things. Fix things. That's how you learn. 🍕
