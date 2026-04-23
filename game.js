// ==========================================================================
// CAN YOU GET PAST THE CHEF!
// A simple maze game: a pizza 🍕 collects toppings while avoiding a chef 👨‍🍳.
//
// The whole game is one file so it's easy to read. The sections below are
// labeled in BIG COMMENT BLOCKS so you can find them. Try reading them in
// order from top to bottom.
// ==========================================================================


// --------------------------------------------------------------------------
// 1. SETTINGS — change these to tweak the game!
// --------------------------------------------------------------------------

const TILE_SIZE = 40;           // how big each maze square is, in pixels
const PLAYER_MOVE_DELAY = 90;   // how fast the pizza can move (smaller = faster)
const CHEF_MOVE_DELAY   = 400;  // starting chef speed on level 1 (smaller = faster)
const CHEF_SMARTNESS    = 0.75; // starting chef smartness on level 1.
                                // 0 = fully random, 1 = always chases the pizza.
                                // 0.75 means he chases 75% of the time and
                                // picks a random legal direction the other 25%.
// Each new level makes the chef a little faster and a little smarter.
// Level 2's chef speed = CHEF_MOVE_DELAY - CHEF_SPEEDUP_PER_LEVEL, and so on.
const CHEF_SPEEDUP_PER_LEVEL    = 80;    // ms shaved off CHEF_MOVE_DELAY per level
const CHEF_SMARTNESS_PER_LEVEL  = 0.1;   // extra smartness per level (capped at 1.0)
const STARTING_LIVES    = 3;    // how many lives you start with
const STAR_POWER_SECONDS = 5;   // how long star mode lasts
const POINTS_PER_TOPPING = 10;  // score for each topping
const POINTS_FOR_CHEF    = 25;  // score for bonking the chef while starred
const WIN_BONUS          = 50;  // score for completing the level

// Sound — flip to true to silence all sound effects (useful for classrooms!)
const MUTED = false;

// Visual "juice" (small polish effects) — each knob is a number of frames
// or milliseconds. Set any of them to 0 to turn that effect off.
const SHAKE_FRAMES   = 10;   // how many frames the screen shakes when you get hit
const SHAKE_PIXELS   = 6;    // maximum jitter distance in pixels
const FLASH_MS       = 250;  // how long a "you picked up a topping!" flash lasts
const STAR_PULSE_MIN = 0.75; // smallest pizza size multiplier during star mode
const STAR_PULSE_MAX = 1.10; // largest pizza size multiplier during star mode

// Particles + floating score text — eye-candy that sprays out of every pickup.
const PARTICLE_COUNT  = 14;   // how many little circles fly out on a pickup/hit
const FLOAT_TEXT_MS   = 800;  // how long a "+10" number floats before fading
const HIT_FLASH_MS    = 80;   // brief red full-canvas flash on a life-loss hit
const BANNER_MS       = 900;  // how long the "STAR POWER!" banner lingers

// Maze colors — change these to re-theme the restaurant
const WALL_COLOR       = "#cc0000";  // red walls
const WALL_HIGHLIGHT   = "#ff4444";  // lighter red stripe on top of walls
const BACKGROUND_COLOR = "#000000";  // black background


// --------------------------------------------------------------------------
// 2. THE LEVELS — one string per row for each level. Each character is a square.
//
//    Legend:
//      1 = wall        X = spike (danger!)
//      0 = empty floor S = star power-up
//      P = pepperoni   @ = pizza starting spot
//      O = olive       E = chef (enemy) starting spot
//      C = cheese
//
//    Rules:
//      - Every row in a level must have the same length.
//      - Every level's border must be all 1s so the walls close in.
//      - Each level should have at least one P, O, and C (the three toppings)
//        so "collect all toppings" works.
//
//    Add your own level by appending another array of strings to LEVELS.
// --------------------------------------------------------------------------

const LEVELS = [
  // ---------- LEVEL 1 — the warm-up restaurant ----------
  [
    "111111111111111",
    "1@0000000000001",
    "101010101010101",
    "100000P0000C001",
    "101010101010101",
    "100000S00000001",
    "101010101010101",
    "10O00000X000001",
    "101010101010101",
    "10000000000X0E1",
    "111111111111111",
  ],

  // ---------- LEVEL 2 — tighter lanes, more spikes ----------
  [
    "111111111111111",
    "1@000X00000O001",
    "101110111011101",
    "10000000S000001",
    "101010101010101",
    "10P0X000X000X01",
    "101010101010101",
    "10000000000C001",
    "101110111011101",
    "10X0000E00000X1",
    "111111111111111",
  ],

  // ---------- LEVEL 3 — the boss kitchen ----------
  [
    "111111111111111",
    "1@0X0000000X001",
    "111010111010111",
    "100P00000000O01",
    "101010111010101",
    "100X00S00X00001",
    "101010111010101",
    "10000X000X0C001",
    "111010111010111",
    "10X0000E000X001",
    "111111111111111",
  ],
];

// ROWS and COLS are locked to level 1's size. For simplicity all levels in
// LEVELS must be the same width and height — the canvas is sized once.
const ROWS = LEVELS[0].length;
const COLS = LEVELS[0][0].length;

// `MAZE` is the level we're currently playing. startGame() swaps it when the
// player advances. Keeping the name "MAZE" means the rest of the code
// (collision checks, drawing, etc.) didn't need to change — it still reads
// from a single level's grid.
let MAZE = LEVELS[0];
let currentLevel = 0;


// --------------------------------------------------------------------------
// 3. GAME STATE — the stuff that changes while the game runs.
// --------------------------------------------------------------------------

let player;             // { col, row, startCol, startRow }
let chef;               // { col, row, startCol, startRow }
let toppings;           // array of { col, row, emoji }
let spikes;             // array of { col, row }
let star;               // { col, row } or null once collected
let score;
let lives;
let starPowerEndsAt;    // timestamp in ms when star power expires (0 = off)
let gameOver;           // true once the win/lose screen is showing
let lastPlayerMoveTime; // used to throttle the pizza so it doesn't teleport
let lastChefMoveTime;   // used to throttle the chef
let keysHeld;           // object remembering which keys are pressed right now

// Visual effects state — short-lived stuff that makes the game feel crunchier.
let shakeFramesLeft;    // counts down to 0; while >0, the canvas gets jittered
let flashes;            // array of { col, row, endsAt } for recent pickups
let particles;          // array of { x, y, vx, vy, color, endsAt, bornAt, life }
let floatTexts;         // array of { text, x, y, vy, color, endsAt, bornAt }
let hitFlashEndsAt;     // timestamp until which we paint a red full-canvas flash
let bannerText;         // short string shown across the canvas, or ""
let bannerEndsAt;       // when the banner disappears


// --------------------------------------------------------------------------
// 4. SET UP THE CANVAS AND GRAB HUD ELEMENTS
// --------------------------------------------------------------------------

const canvas = document.getElementById("gameCanvas");
canvas.width  = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;
const ctx = canvas.getContext("2d");

const scoreEl          = document.getElementById("score");
const bestEl           = document.getElementById("best");
const levelEl          = document.getElementById("level");
const livesEl          = document.getElementById("lives");
const starTimerEl      = document.getElementById("star-timer");
const starSecsEl       = document.getElementById("star-seconds");
const winScreen        = document.getElementById("win-screen");        // FINAL win (after last level)
const loseScreen       = document.getElementById("lose-screen");
const levelClearScreen = document.getElementById("level-clear-screen"); // between levels


// --------------------------------------------------------------------------
// 4b. HIGH SCORE — remembered between visits using the browser's localStorage.
//
// localStorage is a tiny notebook the browser keeps for this page. Whatever
// we save there stays even after you close the tab or reboot the computer.
// We only save one thing: a single number under the key BEST_KEY.
// --------------------------------------------------------------------------

const BEST_KEY = "pizzaChefBestScore";

function loadBestScore() {
  try {
    const stored = localStorage.getItem(BEST_KEY);
    const n = parseInt(stored, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    // Some browsers (private mode, strict settings) throw here. That's fine —
    // we just won't remember scores this session.
    return 0;
  }
}

function saveBestScore(n) {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* ignore */ }
}

// If the final score beats the stored best, save it and bump the HUD.
function maybeUpdateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    saveBestScore(bestScore);
  }
  bestEl.textContent = bestScore;
}

let bestScore = loadBestScore();


// --------------------------------------------------------------------------
// 5. START / RESTART — set up a fresh game by reading the MAZE strings.
// --------------------------------------------------------------------------

// How fast the chef moves on a given level (levels past 1 speed him up).
// Clamped at 100ms so he can never become completely frantic.
function chefDelayFor(levelIdx) {
  return Math.max(100, CHEF_MOVE_DELAY - levelIdx * CHEF_SPEEDUP_PER_LEVEL);
}

// How smart the chef is on a given level (levels past 1 make him smarter).
// Clamped at 1.0 so the math never goes beyond "always chase".
function chefSmartnessFor(levelIdx) {
  return Math.min(1.0, CHEF_SMARTNESS + levelIdx * CHEF_SMARTNESS_PER_LEVEL);
}

// startGame(opts):
//   opts.keepScore  — true if continuing to the next level (keep score & lives)
//   opts.levelIndex — which level to load (defaults to 0 for a brand new run)
function startGame(opts = {}) {
  const keepScore = !!opts.keepScore;
  currentLevel = (typeof opts.levelIndex === "number") ? opts.levelIndex : 0;
  MAZE = LEVELS[currentLevel];

  // Reset per-game stuff (or keep it if we're just advancing a level)
  player   = { col: 0, row: 0 };
  chef     = { col: 0, row: 0 };
  toppings = [];
  spikes   = [];
  star     = null;
  if (!keepScore) {
    score = 0;
    lives = STARTING_LIVES;
  }
  starPowerEndsAt    = 0;
  gameOver           = false;
  lastPlayerMoveTime = 0;
  lastChefMoveTime   = 0;
  keysHeld           = {};
  shakeFramesLeft    = 0;
  flashes            = [];
  particles          = [];
  floatTexts         = [];
  hitFlashEndsAt     = 0;
  bannerText         = "";
  bannerEndsAt       = 0;

  // Walk through the maze characters and place everything in the world
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAZE[row][col];
      if (ch === "@") { player.col = col; player.row = row; }
      if (ch === "E") { chef.col   = col; chef.row   = row; }
      if (ch === "P") toppings.push({ col, row, emoji: "🍖" });
      if (ch === "O") toppings.push({ col, row, emoji: "⚫" });
      if (ch === "C") toppings.push({ col, row, emoji: "🧀" });
      if (ch === "X") spikes.push({ col, row });
      if (ch === "S") star = { col, row };
    }
  }

  // Remember the starting tiles so we can respawn later
  player.startCol = player.col;
  player.startRow = player.row;
  chef.startCol   = chef.col;
  chef.startRow   = chef.row;

  // Hide win/lose/between-level screens and refresh the HUD
  winScreen.classList.add("hidden");
  loseScreen.classList.add("hidden");
  levelClearScreen.classList.add("hidden");
  bestEl.textContent  = bestScore;             // keep the "Best" number in sync
  levelEl.textContent = (currentLevel + 1);    // "Level: 2" etc.
  updateHUD();
}


// --------------------------------------------------------------------------
// 6. HELPERS — tiny useful functions.
// --------------------------------------------------------------------------

// True if a tile is a wall (or off the edge of the maze)
function isWall(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return MAZE[row][col] === "1";
}

// True if two things are on the same square
function sameTile(a, b) {
  return a.col === b.col && a.row === b.row;
}

// True while star power is active
function isStarActive() {
  return performance.now() < starPowerEndsAt;
}


// --------------------------------------------------------------------------
// 7. PLAYER MOVEMENT — reads the keyboard and moves the pizza one tile.
// --------------------------------------------------------------------------

function tryMovePlayer(now) {
  // Throttle: only move every PLAYER_MOVE_DELAY ms so holding a key isn't instant
  if (now - lastPlayerMoveTime < PLAYER_MOVE_DELAY) return;

  // Figure out which direction is being pressed (arrow keys OR WASD)
  let dCol = 0, dRow = 0;
  if (keysHeld.ArrowUp    || keysHeld.w) dRow = -1;
  if (keysHeld.ArrowDown  || keysHeld.s) dRow =  1;
  if (keysHeld.ArrowLeft  || keysHeld.a) dCol = -1;
  if (keysHeld.ArrowRight || keysHeld.d) dCol =  1;

  // No key = no move
  if (dCol === 0 && dRow === 0) return;

  // Don't allow diagonals — if both are set, prefer horizontal
  if (dCol !== 0 && dRow !== 0) dRow = 0;

  const newCol = player.col + dCol;
  const newRow = player.row + dRow;

  // Blocked by a wall? Do nothing.
  if (isWall(newCol, newRow)) return;

  // Move!
  player.col = newCol;
  player.row = newRow;
  lastPlayerMoveTime = now;

  // Did we bump into something interesting?
  checkPlayerCollisions();
}


// --------------------------------------------------------------------------
// 8. CHEF MOVEMENT — mostly chases the pizza, but sometimes wanders.
//
// The chef uses a very simple kind of AI called a "greedy chase":
//   * Most of the time, he looks at all 4 directions, throws out the ones
//     that run into a wall, and picks the one that gets him CLOSEST to
//     the pizza (measured in "Manhattan distance" = cols apart + rows apart).
//   * The rest of the time (1 - CHEF_SMARTNESS) he picks any legal
//     direction at random, so he's beatable and a little unpredictable.
// --------------------------------------------------------------------------

// Collect every direction from (col, row) that doesn't bump into a wall.
function legalDirectionsFrom(col, row) {
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  const legal = [];
  for (const [dCol, dRow] of dirs) {
    if (!isWall(col + dCol, row + dRow)) legal.push([dCol, dRow]);
  }
  return legal;
}

// Manhattan distance: how many tiles apart two spots are, ignoring walls.
function manhattan(aCol, aRow, bCol, bRow) {
  return Math.abs(aCol - bCol) + Math.abs(aRow - bRow);
}

function moveChef(now) {
  if (now - lastChefMoveTime < chefDelayFor(currentLevel)) return;

  const legal = legalDirectionsFrom(chef.col, chef.row);
  if (legal.length === 0) { lastChefMoveTime = now; return; } // boxed in

  // Roll the dice: do we chase this turn, or wander?
  const chase = Math.random() < chefSmartnessFor(currentLevel);

  let chosen;
  if (chase) {
    // Greedy chase: pick the direction with the smallest distance to the pizza.
    // If two directions tie, we pick one of them at random so the chef doesn't
    // always prefer, say, "up" over "left" in a tie.
    let bestDist = Infinity;
    let bestDirs = [];
    for (const [dCol, dRow] of legal) {
      const d = manhattan(chef.col + dCol, chef.row + dRow, player.col, player.row);
      if (d < bestDist) {
        bestDist = d;
        bestDirs = [[dCol, dRow]];
      } else if (d === bestDist) {
        bestDirs.push([dCol, dRow]);
      }
    }
    chosen = bestDirs[Math.floor(Math.random() * bestDirs.length)];
  } else {
    // Wander: just pick any legal direction at random.
    chosen = legal[Math.floor(Math.random() * legal.length)];
  }

  chef.col += chosen[0];
  chef.row += chosen[1];
  lastChefMoveTime = now;

  // Did the chef just walk onto the pizza?
  checkPlayerCollisions();
}


// --------------------------------------------------------------------------
// 9. COLLISIONS — what happens when the pizza and something else share a tile.
// --------------------------------------------------------------------------

function checkPlayerCollisions() {
  // Toppings: collect and add score
  for (let i = toppings.length - 1; i >= 0; i--) {
    if (sameTile(player, toppings[i])) {
      const t = toppings[i];
      // Remember where the topping was so we can flash the tile yellow
      flashes.push({ col: t.col, row: t.row, endsAt: performance.now() + FLASH_MS });
      // 🎆 Juice: colored burst + floating "+10"
      const { x, y } = tileCenter(t.col, t.row);
      spawnBurst(x, y, toppingColor(t.emoji), PARTICLE_COUNT);
      spawnFloatText("+" + POINTS_PER_TOPPING, x, y, "#fff");
      toppings.splice(i, 1);
      score += POINTS_PER_TOPPING;
      playBlip();  // happy pickup sound
    }
  }

  // Star: start star power!
  if (star && sameTile(player, star)) {
    const { x, y } = tileCenter(star.col, star.row);
    spawnBurst(x, y, "#ffe14b", PARTICLE_COUNT * 2);   // bigger yellow burst
    showBanner("STAR POWER!");
    star = null;
    starPowerEndsAt = performance.now() + STAR_POWER_SECONDS * 1000;
    playArpeggio();  // rising "power up!" sound
  }

  // Spikes: ouch
  for (const sp of spikes) {
    if (sameTile(player, sp)) {
      loseLife();
      return;
    }
  }

  // Chef: either we win (star mode) or we lose a life
  if (sameTile(player, chef)) {
    if (isStarActive()) {
      // Pizza smacks the chef back to the kitchen
      const { x, y } = tileCenter(chef.col, chef.row);
      spawnBurst(x, y, "#ffd24b", PARTICLE_COUNT + 6);  // gold burst
      spawnFloatText("+" + POINTS_FOR_CHEF, x, y, "#ffd24b");
      chef.col = chef.startCol;
      chef.row = chef.startRow;
      score += POINTS_FOR_CHEF;
    } else {
      loseLife();
      return;
    }
  }

  // Win condition: no toppings left on the level
  if (toppings.length === 0) {
    score += WIN_BONUS;
    playFanfare();  // victory trumpet!
    gameOver = true;

    const nextLevel = currentLevel + 1;
    if (nextLevel < LEVELS.length) {
      // Between-levels: show a "Level Cleared!" screen. Score and lives carry over.
      document.getElementById("level-clear-score").textContent = score;
      document.getElementById("next-level-number").textContent = nextLevel + 1;
      levelClearScreen.classList.remove("hidden");
    } else {
      // That was the last level — grand finale.
      maybeUpdateBestScore();
      document.getElementById("final-score-win").textContent = score;
      document.getElementById("best-score-win").textContent  = bestScore;
      winScreen.classList.remove("hidden");
    }
  }

  updateHUD();
}

// Called when the pizza touches the chef (without star) or a spike
function loseLife() {
  lives -= 1;
  playBuzz();  // sad "ouch" sound
  shakeFramesLeft = SHAKE_FRAMES;  // kick off the screen-shake
  hitFlashEndsAt  = performance.now() + HIT_FLASH_MS;
  // 🎆 Red burst where the pizza was standing
  const { x, y } = tileCenter(player.col, player.row);
  spawnBurst(x, y, "#ff5050", PARTICLE_COUNT + 6);

  if (lives <= 0) {
    gameOver = true;
    maybeUpdateBestScore();
    document.getElementById("final-score-lose").textContent = score;
    document.getElementById("best-score-lose").textContent  = bestScore;
    loseScreen.classList.remove("hidden");
    return;
  }

  // Respawn pizza AND chef back at their starting spots
  player.col = player.startCol;
  player.row = player.startRow;
  chef.col   = chef.startCol;
  chef.row   = chef.startRow;

  updateHUD();
}


// --------------------------------------------------------------------------
// 10. HUD UPDATE — paint the score, lives, and star timer at the top.
// --------------------------------------------------------------------------

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives > 0 ? "❤️".repeat(lives) : "💀";

  if (isStarActive()) {
    const remaining = Math.ceil((starPowerEndsAt - performance.now()) / 1000);
    starSecsEl.textContent = remaining;
    starTimerEl.classList.remove("hidden");
  } else {
    starTimerEl.classList.add("hidden");
  }
}


// --------------------------------------------------------------------------
// 11. DRAWING — paint the whole scene every frame.
// --------------------------------------------------------------------------

// Tiny helper: draw an emoji centered inside a tile
function drawEmoji(emoji, col, row, size = TILE_SIZE * 0.8) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    emoji,
    col * TILE_SIZE + TILE_SIZE / 2,
    row * TILE_SIZE + TILE_SIZE / 2
  );
}

// Track the previous frame's timestamp so particle physics can use real dt.
let lastFrameAt = 0;

function draw() {
  // Real elapsed-time since the last paint, clamped so tab-switching doesn't
  // produce a giant leap that would launch particles into orbit.
  const now   = performance.now();
  const dtMs  = Math.min(50, now - (lastFrameAt || now));
  lastFrameAt = now;

  // Save the canvas state so we can translate (shake) without affecting HUD math
  ctx.save();

  // ✨ SCREEN-SHAKE: if the player was just hit, jitter the whole canvas
  // a few pixels for a handful of frames. ctx.translate shifts everything
  // we draw afterwards.
  if (shakeFramesLeft > 0) {
    const dx = (Math.random() - 0.5) * 2 * SHAKE_PIXELS;
    const dy = (Math.random() - 0.5) * 2 * SHAKE_PIXELS;
    ctx.translate(dx, dy);
    shakeFramesLeft -= 1;
  }

  // 1. Paint the background
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Paint the walls
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAZE[row][col] === "1") {
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        // little highlight stripe so walls feel pixel-arty
        ctx.fillStyle = WALL_HIGHLIGHT;
        ctx.fillRect(col * TILE_SIZE + 2, row * TILE_SIZE + 2, TILE_SIZE - 4, 4);
      }
    }
  }

  // ✨ TILE FLASHES: a quick yellow square where a topping was just grabbed.
  // We fade each flash out based on how much time it has left.
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    const remaining = f.endsAt - now;
    if (remaining <= 0) {
      flashes.splice(i, 1);                    // expired, remove it
      continue;
    }
    const alpha = remaining / FLASH_MS;        // 1.0 → 0.0 as it fades
    ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
    ctx.fillRect(f.col * TILE_SIZE, f.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  // 3. Paint pickups and hazards
  for (const t of toppings) drawEmoji(t.emoji, t.col, t.row, TILE_SIZE * 0.6);
  for (const sp of spikes)  drawEmoji("⚠️", sp.col, sp.row, TILE_SIZE * 0.7);
  if (star) drawEmoji("⭐", star.col, star.row);

  // 4. Paint the chef
  drawEmoji("👨‍🍳", chef.col, chef.row);

  // 5. Paint the pizza.
  //    - While star power is on, the pizza PULSES (grows and shrinks with time)
  //      and also glows yellow. We use a sine wave of the clock so the pulse
  //      is smooth and repeats forever.
  let pizzaSize = TILE_SIZE * 0.8;
  if (isStarActive()) {
    // Math.sin returns a number between -1 and 1. We massage it to go
    // between STAR_PULSE_MIN and STAR_PULSE_MAX instead.
    const wave = (Math.sin(now / 120) + 1) / 2;     // 0.0 → 1.0
    const scale = STAR_PULSE_MIN + wave * (STAR_PULSE_MAX - STAR_PULSE_MIN);
    pizzaSize = TILE_SIZE * 0.8 * scale;
    ctx.shadowColor = "#ffcc00";
    ctx.shadowBlur  = 20;
  }
  drawEmoji("🍕", player.col, player.row, pizzaSize);
  ctx.shadowBlur = 0;

  // 6. Paint particles + floating score text on top of the scene.
  updateAndDrawEffects(dtMs);

  // 7. Red full-canvas flash the moment a life is lost.
  drawHitFlash();

  // 8. Big centred banner ("STAR POWER!") if one is active.
  drawBanner();

  // Restore the canvas so the next frame starts with no translate
  ctx.restore();
}


// --------------------------------------------------------------------------
// 12. MAIN LOOP — runs forever. Moves things, then redraws the scene.
// --------------------------------------------------------------------------

function gameLoop() {
  if (!gameOver) {
    const now = performance.now();
    tryMovePlayer(now);
    moveChef(now);
    updateHUD();
  }
  draw();
  requestAnimationFrame(gameLoop);
}


// --------------------------------------------------------------------------
// 13. KEYBOARD — remember which keys are pressed or released.
// --------------------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  // Normalize letter keys to lowercase (so W and w both work)
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keysHeld[k] = true;

  // Stop arrow keys from scrolling the page
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keysHeld[k] = false;
});


// --------------------------------------------------------------------------
// 14. RESTART BUTTONS — wire every "play again" button to startGame().
// --------------------------------------------------------------------------

// "Restart" and "Play Again" both reset everything back to level 1.
document.getElementById("restartBtn").addEventListener("click",      () => startGame());
document.getElementById("playAgainWinBtn").addEventListener("click", () => startGame());
document.getElementById("playAgainLoseBtn").addEventListener("click",() => startGame());

// "Next Level" keeps the current score & lives and loads the next maze.
document.getElementById("nextLevelBtn").addEventListener("click", () => {
  startGame({ keepScore: true, levelIndex: currentLevel + 1 });
});

// "Reset Best Score" wipes the remembered best score back to 0.
function resetBestScore() {
  bestScore = 0;
  saveBestScore(0);
  bestEl.textContent = 0;
  document.getElementById("best-score-win").textContent  = 0;
  document.getElementById("best-score-lose").textContent = 0;
}
document.getElementById("resetBestWinBtn").addEventListener("click", resetBestScore);
document.getElementById("resetBestLoseBtn").addEventListener("click", resetBestScore);


// --------------------------------------------------------------------------
// 15. GO! — kick off the first game and start the loop.
// --------------------------------------------------------------------------

startGame();
gameLoop();


// ==========================================================================
// 16. SOUND EFFECTS — made from scratch with the Web Audio API.
//
// No sound files! Every beep in this game is built live by the browser
// using tiny "oscillators" — little math machines that wiggle the speaker.
//
// 🎓 MINI LESSON: how a computer makes a sound
//
//   1. An OscillatorNode produces a repeating wave at a certain frequency.
//      Higher frequency (more wiggles per second) = higher pitch.
//      440 Hz is the musical note "A". 880 Hz is the A one octave higher.
//
//   2. A GainNode is a volume knob. If we just connect the oscillator
//      straight to the speakers, the sound starts and stops with a nasty
//      CLICK. So instead we ramp the volume UP at the start and DOWN at
//      the end. That smooth curve is called an "envelope".
//
//   3. The "type" of the oscillator changes the tone colour:
//        "sine"     — smooth and flutey
//        "square"   — chunky retro video-game
//        "triangle" — softer chip-tune
//        "sawtooth" — buzzy and bright
//
//   4. Pitches we use (in Hz), roughly:
//        C = 523, E = 659, G = 784, C(high) = 1047
//      Play C-E-G-C in a row and you get a happy arpeggio.
//
// Browsers block audio until the user touches the page (anti-spam rule),
// so we create the AudioContext lazily on the first sound.
// --------------------------------------------------------------------------

let audioCtx = null;

// Lazily create the AudioContext. Returns null if sound is muted or the
// browser doesn't support Web Audio.
function getAudio() {
  if (MUTED) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;           // very old browser
    audioCtx = new Ctx();
  }
  // Some browsers start the context "suspended" — wake it up.
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Play one note. This is the building block the four sound effects use.
//
//   freq     : pitch in Hz (e.g. 440 = note A)
//   duration : how long the note lasts, in seconds
//   type     : oscillator shape ("sine", "square", "triangle", "sawtooth")
//   volume   : 0.0 (silent) to 1.0 (loud). Small values, please!
//   startAt  : when to play it, in seconds from now (for chords/sequences)
function beep(freq, duration, type = "square", volume = 0.15, startAt = 0) {
  const ctx = getAudio();
  if (!ctx) return;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  // Envelope: ramp UP quickly, then ramp DOWN to silence before stopping.
  // Without this ramp you hear a "click" at the start and end of each note.
  const t0 = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);    // fade in
  gain.gain.linearRampToValueAtTime(0, t0 + duration);     // fade out

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// 🍖 Happy blip when you grab a topping. Short high "ding".
function playBlip() {
  beep(880, 0.08, "square", 0.15);   // A5
}

// ⚠️ Sad low buzz when you lose a life. Two gross low notes back-to-back.
function playBuzz() {
  beep(180, 0.18, "sawtooth", 0.18, 0);
  beep(120, 0.25, "sawtooth", 0.18, 0.15);
}

// ⭐ Rising arpeggio when you grab the star — C, E, G, high C.
function playArpeggio() {
  const notes = [523, 659, 784, 1047];   // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    beep(freq, 0.12, "triangle", 0.18, i * 0.08);
  });
}

// 🎉 Short fanfare when you win — a cheerful triad.
function playFanfare() {
  // Play the triad three times, rising each time.
  beep(523, 0.15, "square", 0.18, 0.00);   // C5
  beep(659, 0.15, "square", 0.18, 0.15);   // E5
  beep(784, 0.30, "square", 0.18, 0.30);   // G5
  beep(1047, 0.45, "square", 0.18, 0.45);  // C6 (held longer)
}


// ==========================================================================
// 17. PARTICLES + FLOATING TEXT — every fun event spits out some eye-candy.
//
// 🎓 MINI LESSON: how a tiny physics engine works
//
// A "particle" is just a dot with a position and a velocity. Every frame we
// do three things to each one:
//
//   1. MOVE IT:    position += velocity * time-elapsed
//   2. SLOW IT:    velocity.y += gravity   (optional — makes it fall)
//   3. FADE IT:    figure out how "alive" it still is, and paint it with
//                  less and less opacity as it gets older.
//
// When a particle's time is up, we remove it from the list. Do this for a
// few dozen particles at once and you get a satisfying little firework.
//
// Floating text ("+10") is the same idea, just with a letter instead of a
// circle, and we don't apply gravity — we just let it drift up and fade.
// --------------------------------------------------------------------------

// Centre pixel of a tile (col, row). Handy when spawning effects.
function tileCenter(col, row) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

// Pick a nice colour for the burst that matches the topping emoji.
function toppingColor(emoji) {
  if (emoji === "🍖") return "#ff8a4a";   // warm pepperoni orange
  if (emoji === "🧀") return "#ffd24b";   // cheesy yellow
  if (emoji === "⚫") return "#9a7bff";   // olive / purple — readable on black
  return "#ffffff";
}

// Spawn `count` particles flying outward from (x, y) with a random angle and
// speed. Each particle picks up a bit of gravity so the burst feels grounded.
function spawnBurst(x, y, color, count = PARTICLE_COUNT) {
  const now = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;       // random direction
    const speed = 60 + Math.random() * 140;          // pixels per second
    const life  = 350 + Math.random() * 350;         // ms the particle lives
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      bornAt: now,
      endsAt: now + life,
      life,
      radius: 2 + Math.random() * 2.5,
    });
  }
}

// A short piece of text that drifts upward and fades away (e.g. "+10").
function spawnFloatText(text, x, y, color = "#ffffff") {
  const now = performance.now();
  floatTexts.push({
    text, x, y, color,
    vy: -40,                      // pixels per second (negative = up)
    bornAt: now,
    endsAt: now + FLOAT_TEXT_MS,
  });
}

// A big banner across the middle of the canvas (e.g. "STAR POWER!").
function showBanner(text) {
  bannerText   = text;
  bannerEndsAt = performance.now() + BANNER_MS;
}

// Step every particle and floating-text item forward by `dtMs` milliseconds
// and paint them. Called from draw() once per frame.
function updateAndDrawEffects(dtMs) {
  const now = performance.now();
  const dt  = dtMs / 1000;        // convert ms → seconds for nicer physics math
  const GRAVITY = 260;            // pixels per second per second, pulled down

  // --- particles ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (now >= p.endsAt) { particles.splice(i, 1); continue; }

    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += GRAVITY * dt;

    // Older particles fade out: alpha goes from 1.0 → 0.0 over their life
    const alpha = Math.max(0, (p.endsAt - now) / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // --- floating text ---
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = "bold 18px 'Comic Sans MS', sans-serif";
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    if (now >= f.endsAt) { floatTexts.splice(i, 1); continue; }

    f.y += f.vy * dt;             // drift upward
    const alpha = (f.endsAt - now) / FLOAT_TEXT_MS;
    ctx.globalAlpha = alpha;
    // Black outline for readability on any background
    ctx.strokeStyle = "#000";
    ctx.lineWidth   = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle   = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// Paint the one-frame red "you got hit!" full-canvas flash, if one is active.
function drawHitFlash() {
  const now = performance.now();
  if (now < hitFlashEndsAt) {
    const remaining = hitFlashEndsAt - now;
    ctx.fillStyle = `rgba(255, 0, 0, ${(remaining / HIT_FLASH_MS) * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Paint the "STAR POWER!" banner, fading in and out over its lifetime.
function drawBanner() {
  const now = performance.now();
  if (!bannerText || now >= bannerEndsAt) return;
  const remaining = bannerEndsAt - now;
  // Alpha: ramp up in the first 150ms, hold, then ramp down the last 300ms.
  let alpha = 1;
  const age = BANNER_MS - remaining;
  if (age < 150) alpha = age / 150;
  else if (remaining < 300) alpha = remaining / 300;

  ctx.globalAlpha  = alpha;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = "bold 44px 'Comic Sans MS', sans-serif";
  ctx.strokeStyle  = "#000";
  ctx.lineWidth    = 6;
  ctx.strokeText(bannerText, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle    = "#ffe14b";
  ctx.fillText(bannerText, canvas.width / 2, canvas.height / 2);
  ctx.globalAlpha  = 1;
}

