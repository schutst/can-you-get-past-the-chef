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
6. Collect all toppings to **win**.
7. You start with 3 lives. If all lives are lost, the chef wins.

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
Find the `MAZE` section in `game.js`. It looks like this:

```js
const MAZE = [
  "111111111111111",
  "1@0000000000001",
  "101010101010101",
  "100000P0000C001",
  ...
];
```

Each character is one square of the maze:

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

⚠️ Two rules to remember:
- **Every row must be the same length** (15 characters in the default maze).
- **The outside edge must all be `1`s** or the walls won't close.

---

## 🧑‍💻 How the code is organized

`game.js` is split into labeled sections, in the order they run:

1. **SETTINGS** — all the numbers and colors you can change
2. **THE MAZE** — the grid, drawn as strings
3. **GAME STATE** — things that change while playing (score, positions)
4. **SET UP THE CANVAS** — get ready to draw
5. **START / RESTART** — what happens when a new game begins
6. **HELPERS** — tiny utility functions
7. **PLAYER MOVEMENT** — reading the keyboard and moving the pizza
8. **CHEF MOVEMENT** — picking a random direction each turn
9. **COLLISIONS** — what happens when two things touch
10. **HUD UPDATE** — refresh the score / lives / star timer
11. **DRAWING** — paint the scene
12. **MAIN LOOP** — runs forever
13. **KEYBOARD** — remember which keys are held
14. **RESTART BUTTONS** — wire up the buttons
15. **GO!** — start the first game
16. **SOUND EFFECTS** — little beeps made with the Web Audio API (no audio files!)

Every section has comments in plain English. Read it top to bottom and it should all make sense.

---

## 🎉 Have fun!

Tinker. Break things. Fix things. That's how you learn. 🍕
