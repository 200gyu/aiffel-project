const SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const btnRestart = document.getElementById('btn-restart');

let board = [];
let currentPlayer = BLACK;
let gameOver = false;
let lastMove = null;
let hoverPos = null;

let cellSize, padding, stoneRadius;

function initBoard() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  currentPlayer = BLACK;
  gameOver = false;
  lastMove = null;
  hoverPos = null;
  modalOverlay.classList.add('hidden');
  updateStatus();
  resizeCanvas();
}

function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displaySize = Math.floor(rect.width);

  canvas.width = displaySize * dpr;
  canvas.height = displaySize * dpr;
  canvas.style.width = displaySize + 'px';
  canvas.style.height = displaySize + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  padding = displaySize * 0.06;
  cellSize = (displaySize - padding * 2) / (SIZE - 1);
  stoneRadius = cellSize * 0.43;

  draw();
}

function gridX(col) { return padding + col * cellSize; }
function gridY(row) { return padding + row * cellSize; }

function draw() {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  ctx.fillStyle = '#E6A15C';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#3a2a10';
  ctx.lineWidth = 1;
  for (let i = 0; i < SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(gridX(i), gridY(0));
    ctx.lineTo(gridX(i), gridY(SIZE - 1));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gridX(0), gridY(i));
    ctx.lineTo(gridX(SIZE - 1), gridY(i));
    ctx.stroke();
  }

  const starPoints = [3, 7, 11];
  ctx.fillStyle = '#3a2a10';
  for (const r of starPoints) {
    for (const c of starPoints) {
      ctx.beginPath();
      ctx.arc(gridX(c), gridY(r), cellSize * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (hoverPos && !gameOver && board[hoverPos.row][hoverPos.col] === EMPTY) {
    drawStone(hoverPos.row, hoverPos.col, currentPlayer, 0.35);
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c], 1);
      }
    }
  }

  if (lastMove) {
    const x = gridX(lastMove.col);
    const y = gridY(lastMove.row);
    ctx.fillStyle = board[lastMove.row][lastMove.col] === BLACK ? '#ff4444' : '#ff4444';
    ctx.beginPath();
    ctx.arc(x, y, stoneRadius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStone(row, col, player, alpha) {
  const x = gridX(col);
  const y = gridY(row);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (alpha === 1) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  if (player === BLACK) {
    const grad = ctx.createRadialGradient(x - stoneRadius * 0.3, y - stoneRadius * 0.3, stoneRadius * 0.1, x, y, stoneRadius);
    grad.addColorStop(0, '#555');
    grad.addColorStop(1, '#111');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(x - stoneRadius * 0.3, y - stoneRadius * 0.3, stoneRadius * 0.1, x, y, stoneRadius);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#bbb');
    ctx.fillStyle = grad;
  }

  ctx.beginPath();
  ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getGridPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.round((x - padding) / cellSize);
  const row = Math.round((y - padding) / cellSize);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  return { row, col };
}

function placeStone(row, col) {
  if (gameOver || board[row][col] !== EMPTY) return;

  board[row][col] = currentPlayer;
  lastMove = { row, col };

  if (checkWin(row, col, currentPlayer)) {
    gameOver = true;
    draw();
    showResult(currentPlayer === BLACK ? '흑돌 승리!' : '백돌 승리!');
    return;
  }

  if (isBoardFull()) {
    gameOver = true;
    draw();
    showResult('무승부!');
    return;
  }

  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  updateStatus();
  draw();
}

function checkWin(row, col, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    count += countDirection(row, col, dr, dc, player);
    count += countDirection(row, col, -dr, -dc, player);
    if (count === 5) return true;
  }
  return false;
}

function countDirection(row, col, dr, dc, player) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === player) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

function isBoardFull() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === EMPTY) return false;
    }
  }
  return true;
}

function updateStatus() {
  if (currentPlayer === BLACK) {
    statusEl.className = 'status black-turn';
    statusText.textContent = '흑돌 차례';
  } else {
    statusEl.className = 'status white-turn';
    statusText.textContent = '백돌 차례';
  }
}

function showResult(message) {
  modalMessage.textContent = message;
  modalOverlay.classList.remove('hidden');
}

canvas.addEventListener('click', (e) => {
  const pos = getGridPos(e.clientX, e.clientY);
  if (pos) placeStone(pos.row, pos.col);
});

canvas.addEventListener('mousemove', (e) => {
  hoverPos = getGridPos(e.clientX, e.clientY);
  if (!gameOver) draw();
});

canvas.addEventListener('mouseleave', () => {
  hoverPos = null;
  if (!gameOver) draw();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getGridPos(touch.clientX, touch.clientY);
  if (pos) {
    hoverPos = pos;
    draw();
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (hoverPos) {
    placeStone(hoverPos.row, hoverPos.col);
    hoverPos = null;
  }
}, { passive: false });

btnRestart.addEventListener('click', initBoard);

window.addEventListener('resize', resizeCanvas);

initBoard();
