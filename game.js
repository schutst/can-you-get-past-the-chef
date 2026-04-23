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
const CHEF_MOVE_DELAY   = 400;  // how fast the chef moves  (smaller = faster)
const CHEF_SMARTNESS    = 0.75; // 0 = fully random, 1 = always chases the pizza.
                                // 0.75 means he chases 75% of the time and
                                // picks a random legal direction the other 25%.
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

// Maze colors — change these to re-theme the restaurant
const WALL_COLOR       = "#cc0000";  // red walls
const WALL_HIGHLIGHT   = "#ff4444";  // lighter red stripe on top of walls
const BACKGROUND_COLOR = "#000000";  // black background


// --------------------------------------------------------------------------
// 2. THE MAZE — one string per row. Each character is a square.
//
//    Legend:
//      1 = wall        X = spike (danger!)
//      0 = empty floor S = star power-up
//      P = pepperoni   @ = pizza starting spot
//      O = olive       E = chef (enemy) starting spot
//      C = cheese
//
//    Rule: every row must have the same length, and the border must be all 1s
//    so the walls close in.
// --------------------------------------------------------------------------

const MAZE = [
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
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;


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


// --------------------------------------------------------------------------
// 4. SET UP THE CANVAS AND GRAB HUD ELEMENTS
// --------------------------------------------------------------------------

const canvas = document.getElementById("gameCanvas");
canvas.width  = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;
const ctx = canvas.getContext("2d");

const scoreEl     = document.getElementById("score");
const bestEl      = document.getElementById("best");
const livesEl     = document.getElementById("lives");
const starTimerEl = document.getElementById("star-timer");
const starSecsEl  = document.getElementById("star-seconds");
const winScreen   = document.getElementById("win-screen");
const loseScreen  = document.getElementById("lose-screen");


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

function startGame() {
  // Reset everything back to starting values
  player   = { col: 0, row: 0 };
  chef     = { col: 0, row: 0 };
  toppings = [];
  spikes   = [];
  star     = null;
  score    = 0;
  lives    = STARTING_LIVES;
  starPowerEndsAt    = 0;
  gameOver           = false;
  lastPlayerMoveTime = 0;
  lastChefMoveTime   = 0;
  keysHeld           = {};
  shakeFramesLeft    = 0;
  flashes            = [];

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

  // Hide win/lose screens and refresh the HUD
  winScreen.classList.add("hidden");
  loseScreen.classList.add("hidden");
  bestEl.textContent = bestScore;    // keep the "Best" number in sync
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
  if (now - lastChefMoveTime < CHEF_MOVE_DELAY) return;

  const legal = legalDirectionsFrom(chef.col, chef.row);
  if (legal.length === 0) { lastChefMoveTime = now; return; } // boxed in

  // Roll the dice: do we chase this turn, or wander?
  const chase = Math.random() < CHEF_SMARTNESS;

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
      // Remember where the topping was so we can flash the tile yellow
      flashes.push({
        col: toppings[i].col,
        row: toppings[i].row,
        endsAt: performance.now() + FLASH_MS,
      });
      toppings.splice(i, 1);
      score += POINTS_PER_TOPPING;
      playBlip();  // happy pickup sound
    }
  }

  // Star: start star power!
  if (star && sameTile(player, star)) {
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
      chef.col = chef.startCol;
      chef.row = chef.startRow;
      score += POINTS_FOR_CHEF;
    } else {
      loseLife();
      return;
    }
  }

  // Win condition: no toppings left on the map
  if (toppings.length === 0) {
    score += WIN_BONUS;
    gameOver = true;
    maybeUpdateBestScore();
    document.getElementById("final-score-win").textContent = score;
    document.getElementById("best-score-win").textContent  = bestScore;
    winScreen.classList.remove("hidden");
    playFanfare();  // victory trumpet!
  }

  updateHUD();
}

// Called when the pizza touches the chef (without star) or a spike
function loseLife() {
  lives -= 1;
  playBuzz();  // sad "ouch" sound
  shakeFramesLeft = SHAKE_FRAMES;  // kick off the screen-shake

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

function draw() {
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
  const now = performance.now();
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

document.getElementById("restartBtn").addEventListener("click", startGame);
document.getElementById("playAgainWinBtn").addEventListener("click", startGame);
document.getElementById("playAgainLoseBtn").addEventListener("click", startGame);

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

