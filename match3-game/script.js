// ============================================================
// 미니 3매치 퍼즐 - 게임 로직
// ============================================================

const GRID_SIZE = 7;
const EMOJIS = ["🐱", "🐶", "🐰", "🦊", "🐻"];
const GAME_DURATION = 60; // 초
const MATCH_SCORE = { 3: 300, 4: 500, 5: 800 }; // 매치 길이별 점수 (5 이상은 800으로 고정)

// ------------------------------------------------------------
// 상태 변수
// ------------------------------------------------------------
let board = []; // board[row][col] = emoji 문자열
let score = 0;
let timeLeft = GAME_DURATION;
let timerId = null;
let selectedCell = null; // { row, col } 또는 null
let inputLocked = false; // 애니메이션/처리 중에는 입력을 막음

// ------------------------------------------------------------
// DOM 참조
// ------------------------------------------------------------
const boardEl = document.getElementById("game-board");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const resultModal = document.getElementById("result-modal");
const finalScoreEl = document.getElementById("final-score");
const resetBtn = document.getElementById("reset-btn");

// ============================================================
// 초기화
// ============================================================

function initGame() {
  score = 0;
  timeLeft = GAME_DURATION;
  selectedCell = null;
  inputLocked = false;
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  resultModal.classList.add("hidden");

  board = createInitialBoard();
  renderBoard();

  if (timerId) clearInterval(timerId);
  timerId = setInterval(tickTimer, 1000);
}

// 처음 배치 시 이미 3개 이상 매치가 되어 있지 않도록 채워 넣는다.
function createInitialBoard() {
  const newBoard = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const rowArr = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      let emoji;
      do {
        emoji = randomEmoji();
      } while (
        causesMatchAt(newBoard, rowArr, row, col, emoji)
      );
      rowArr.push(emoji);
    }
    newBoard.push(rowArr);
  }
  return newBoard;
}

// 특정 칸에 emoji를 놓았을 때 왼쪽/위쪽 방향으로 이미 3연속이 되는지 확인
// (초기 생성 시 왼쪽 칸과 위쪽 칸은 이미 채워져 있으므로 그 방향만 체크하면 충분)
function causesMatchAt(fullBoard, currentRowArr, row, col, emoji) {
  // 가로 체크: 왼쪽 두 칸이 같은 emoji인가
  if (col >= 2 && currentRowArr[col - 1] === emoji && currentRowArr[col - 2] === emoji) {
    return true;
  }
  // 세로 체크: 위쪽 두 칸이 같은 emoji인가
  if (row >= 2 && fullBoard[row - 1][col] === emoji && fullBoard[row - 2][col] === emoji) {
    return true;
  }
  return false;
}

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

// ============================================================
// 렌더링
// ============================================================

function renderBoard() {
  boardEl.innerHTML = "";
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cellEl = document.createElement("div");
      cellEl.className = "cell";
      cellEl.dataset.row = row;
      cellEl.dataset.col = col;
      cellEl.textContent = board[row][col];
      cellEl.addEventListener("click", onCellClick);
      boardEl.appendChild(cellEl);
    }
  }
}

function getCellEl(row, col) {
  return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// ============================================================
// 입력 처리 (선택 & 스왑)
// ============================================================

function onCellClick(e) {
  if (inputLocked) return;

  const row = Number(e.currentTarget.dataset.row);
  const col = Number(e.currentTarget.dataset.col);

  if (!selectedCell) {
    // 첫 번째 선택
    selectedCell = { row, col };
    getCellEl(row, col).classList.add("selected");
    return;
  }

  // 같은 칸을 다시 클릭하면 선택 취소
  if (selectedCell.row === row && selectedCell.col === col) {
    getCellEl(row, col).classList.remove("selected");
    selectedCell = null;
    return;
  }

  if (isAdjacent(selectedCell, { row, col })) {
    const first = selectedCell;
    getCellEl(first.row, first.col).classList.remove("selected");
    selectedCell = null;
    attemptSwap(first, { row, col });
  } else {
    // 인접하지 않으면 새 칸을 선택 대상으로 교체
    getCellEl(selectedCell.row, selectedCell.col).classList.remove("selected");
    selectedCell = { row, col };
    getCellEl(row, col).classList.add("selected");
  }
}

function isAdjacent(a, b) {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1); // 상하좌우만 허용 (대각선 금지)
}

function swapCells(a, b) {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

function attemptSwap(a, b) {
  inputLocked = true;
  swapCells(a, b);
  renderBoard();

  const matches = findMatches();

  if (matches.size > 0) {
    // 매치 성공 -> 제거 및 연쇄 처리 진행
    resolveMatches();
  } else {
    // 매치 실패 -> 흔들어 보여준 뒤 원위치로 되돌림
    const cellA = getCellEl(a.row, a.col);
    const cellB = getCellEl(b.row, b.col);
    cellA.classList.add("invalid-swap");
    cellB.classList.add("invalid-swap");

    setTimeout(() => {
      swapCells(a, b); // 되돌리기
      renderBoard();
      inputLocked = false;
    }, 300);
  }
}

// ============================================================
// 매치 판정
// ============================================================

// 가로/세로로 3개 이상 연속된 동일 emoji를 찾아 { matchedCells, runs } 형태로 반환
// matchedCells: "row,col" Set (제거 대상 칸)
// runs: 각 연속 구간의 길이 배열 (점수 계산용)
function findMatches() {
  const matchedCells = new Set();
  const runs = [];

  // 가로 방향 탐색
  for (let row = 0; row < GRID_SIZE; row++) {
    let runStart = 0;
    for (let col = 1; col <= GRID_SIZE; col++) {
      const sameAsPrev = col < GRID_SIZE && board[row][col] === board[row][runStart];
      if (!sameAsPrev) {
        const runLength = col - runStart;
        if (runLength >= 3) {
          runs.push(runLength);
          for (let c = runStart; c < col; c++) {
            matchedCells.add(`${row},${c}`);
          }
        }
        runStart = col;
      }
    }
  }

  // 세로 방향 탐색
  for (let col = 0; col < GRID_SIZE; col++) {
    let runStart = 0;
    for (let row = 1; row <= GRID_SIZE; row++) {
      const sameAsPrev = row < GRID_SIZE && board[row][col] === board[runStart][col];
      if (!sameAsPrev) {
        const runLength = row - runStart;
        if (runLength >= 3) {
          runs.push(runLength);
          for (let r = runStart; r < row; r++) {
            matchedCells.add(`${r},${col}`);
          }
        }
        runStart = row;
      }
    }
  }

  matchedCells.runs = runs;
  return matchedCells;
}

function scoreForRuns(runs) {
  return runs.reduce((sum, len) => sum + (MATCH_SCORE[len] || MATCH_SCORE[5]), 0);
}

// ============================================================
// 매치 제거 -> 중력(낙하) -> 보충 -> 연쇄 체크 루프
// ============================================================

function resolveMatches() {
  const matches = findMatches();

  if (matches.size === 0) {
    // 더 이상 매치가 없으면 처리 종료, 입력 재개
    inputLocked = false;
    return;
  }

  // 1) 점수 반영
  score += scoreForRuns(matches.runs);
  scoreEl.textContent = score;

  // 2) 매치된 칸에 터지는 애니메이션 적용
  matches.forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    const cellEl = getCellEl(r, c);
    if (cellEl) cellEl.classList.add("matched");
  });

  // 애니메이션이 끝난 뒤 실제 데이터에서 제거 -> 낙하 -> 보충 -> 재검사
  setTimeout(() => {
    removeMatchedFromBoard(matches);
    applyGravityAndRefill();
    renderBoard();

    // 연쇄(cascade): 새로 채워진 상태에서 또 매치가 있는지 재확인
    resolveMatches();
  }, 280);
}

// 매치된 칸을 데이터 상에서 null로 비운다 (아직 낙하 전 상태)
function removeMatchedFromBoard(matches) {
  matches.forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    board[r][c] = null;
  });
}

// 각 열마다 아래쪽으로 빈칸 없이 몰아내고(중력), 위쪽 빈칸은 새 emoji로 채운다.
function applyGravityAndRefill() {
  for (let col = 0; col < GRID_SIZE; col++) {
    // 이 열에서 비어있지 않은 emoji들을 아래에서부터 순서대로 모은다.
    const surviving = [];
    for (let row = GRID_SIZE - 1; row >= 0; row--) {
      if (board[row][col] !== null) {
        surviving.push(board[row][col]);
      }
    }

    // 아래쪽부터 채워 넣고(낙하 결과), 남은 위쪽 칸은 새 랜덤 emoji로 보충
    for (let row = GRID_SIZE - 1; row >= 0; row--) {
      const distFromBottom = GRID_SIZE - 1 - row;
      if (distFromBottom < surviving.length) {
        board[row][col] = surviving[distFromBottom];
      } else {
        board[row][col] = randomEmoji(); // 새로 생성된 블록
      }
    }
  }
}

// ============================================================
// 타이머
// ============================================================

function tickTimer() {
  timeLeft -= 1;
  timerEl.textContent = timeLeft;

  if (timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  clearInterval(timerId);
  timerId = null;
  inputLocked = true; // 모든 클릭 차단
  finalScoreEl.textContent = score;
  resultModal.classList.remove("hidden");
}

// ============================================================
// 이벤트 바인딩 & 시작
// ============================================================

resetBtn.addEventListener("click", initGame);

initGame();
