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


// --------------------------------------------------------------------------
// 4. SET UP THE CANVAS AND GRAB HUD ELEMENTS
// --------------------------------------------------------------------------

const canvas = document.getElementById("gameCanvas");
canvas.width  = COLS * TILE_SIZE;
canvas.height = ROWS * TILE_SIZE;
const ctx = canvas.getContext("2d");

const scoreEl     = document.getElementById("score");
const livesEl     = document.getElementById("lives");
const starTimerEl = document.getElementById("star-timer");
const starSecsEl  = document.getElementById("star-seconds");
const winScreen   = document.getElementById("win-screen");
const loseScreen  = document.getElementById("lose-screen");


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
      toppings.splice(i, 1);
      score += POINTS_PER_TOPPING;
    }
  }

  // Star: start star power!
  if (star && sameTile(player, star)) {
    star = null;
    starPowerEndsAt = performance.now() + STAR_POWER_SECONDS * 1000;
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
    document.getElementById("final-score-win").textContent = score;
    winScreen.classList.remove("hidden");
  }

  updateHUD();
}

// Called when the pizza touches the chef (without star) or a spike
function loseLife() {
  lives -= 1;

  if (lives <= 0) {
    gameOver = true;
    document.getElementById("final-score-lose").textContent = score;
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

  // 3. Paint pickups and hazards
  for (const t of toppings) drawEmoji(t.emoji, t.col, t.row, TILE_SIZE * 0.6);
  for (const sp of spikes)  drawEmoji("⚠️", sp.col, sp.row, TILE_SIZE * 0.7);
  if (star) drawEmoji("⭐", star.col, star.row);

  // 4. Paint the chef
  drawEmoji("👨‍🍳", chef.col, chef.row);

  // 5. Paint the pizza (with a glow if star power is active)
  if (isStarActive()) {
    ctx.shadowColor = "#ffcc00";
    ctx.shadowBlur  = 20;
  }
  drawEmoji("🍕", player.col, player.row);
  ctx.shadowBlur = 0;
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


// --------------------------------------------------------------------------
// 15. GO! — kick off the first game and start the loop.
// --------------------------------------------------------------------------

startGame();
gameLoop();
