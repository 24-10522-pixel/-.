/* ─────────────────────────────────────────
   app.js — 떠오르는 반달 튜토리얼 스크립트
   ───────────────────────────────────────── */

/* ══════════════════════════════════════
   1. 별 (Stars) 생성
══════════════════════════════════════ */
(function createStars() {
  const container = document.getElementById('stars');
  if (!container) return;
  for (let i = 0; i < 150; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      --dur: ${(Math.random() * 4 + 2).toFixed(1)}s;
      --op: ${(Math.random() * 0.6 + 0.2).toFixed(2)};
      animation-delay: ${(Math.random() * 5).toFixed(1)}s;
    `;
    container.appendChild(star);
  }
})();


/* ══════════════════════════════════════
   2. 진행도 바 & 사이드 도트 네비게이션
══════════════════════════════════════ */
const progressBar = document.getElementById('progress-bar');
const dots = Array.from(document.querySelectorAll('.side-nav .dot'));
const steps = Array.from(document.querySelectorAll('section.step'));

function getScrollProgress() {
  const scrollTop = window.scrollY;
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  return Math.min(100, (scrollTop / docH) * 100);
}

function getActiveSection() {
  let active = 0;
  steps.forEach((sec, i) => {
    const rect = sec.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.4) active = i;
  });
  return active;
}

function onScroll() {
  progressBar.style.width = getScrollProgress() + '%';

  const activeIdx = getActiveSection();
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === activeIdx);
  });
}

window.addEventListener('scroll', onScroll, { passive: true });


/* ══════════════════════════════════════
   3. 스크롤 리빌 애니메이션
══════════════════════════════════════ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(
  '.info-card, .score-card, .wc-card, .strategy-item, .phase-item, .sum-item, .score-bonus, .combo-tips'
).forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});


/* ══════════════════════════════════════
   4. 인터랙티브 미니 게임 (Step 4)
══════════════════════════════════════ */

// 달의 위상 순서
const PHASES = [
  { emoji: '🌑', name: '신월', idx: 0 },
  { emoji: '🌒', name: '초승달', idx: 1 },
  { emoji: '🌓', name: '상현달', idx: 2 },
  { emoji: '🌔', name: '상현망간', idx: 3 },
  { emoji: '🌕', name: '보름달', idx: 4 },
  { emoji: '🌖', name: '하현망간', idx: 5 },
  { emoji: '🌗', name: '하현달', idx: 6 },
  { emoji: '🌘', name: '그믐달', idx: 7 },
];

// 보름달 쌍 (합치면 보름달이 되는 인덱스 쌍)
const FULL_MOON_PAIRS = [
  [1, 7], // 초승달 + 그믐달
  [2, 6], // 상현달 + 하현달
  [3, 5], // 상현망간 + 하현망간
];

// 3×3 보드 인접 관계 (가로·세로)
const ADJACENCY = {
  0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
  3: [0, 4, 6], 4: [1, 3, 5, 7], 5: [2, 4, 8],
  6: [3, 7], 7: [4, 6, 8], 8: [5, 7],
};

let board = Array(9).fill(null);   // null | { phaseIdx, owner }
let hand = [];
let selectedHandIdx = null;
let score = 0;
let enemyTurnPending = false;

const handEl = document.getElementById('tg-hand');
const boardEl = document.getElementById('tg-board');
const scoreEl = document.getElementById('tg-score');
const feedbackEl = document.getElementById('tg-feedback');
const resetBtn = document.getElementById('tg-reset');
const instructionsEl = document.getElementById('tg-instructions');

function randomPhase() {
  return Math.floor(Math.random() * PHASES.length);
}

function drawHand() {
  hand = [];
  // 초반에는 연속된 위상을 주어 콤보를 쉽게 만들 수 있도록
  const start = Math.floor(Math.random() * 6);
  hand.push(start, (start + 1) % 8, (start + 2) % 8);
}

function renderHand() {
  handEl.innerHTML = '';
  hand.forEach((phaseIdx, i) => {
    if (phaseIdx === null) return;
    const card = document.createElement('div');
    card.className = 'hand-card' + (selectedHandIdx === i ? ' selected' : '');
    card.dataset.idx = i;
    card.title = PHASES[phaseIdx].name;
    card.innerHTML = `<span style="font-size:1.8rem">${PHASES[phaseIdx].emoji}</span>
      <span style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:.55rem;color:#8a96c4">${PHASES[phaseIdx].name}</span>`;
    card.addEventListener('click', () => selectCard(i));
    handEl.appendChild(card);
  });
}

function renderBoard() {
  boardEl.innerHTML = '';
  board.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'board-cell';
    div.dataset.idx = i;

    if (cell) {
      div.classList.add(cell.owner === 'player' ? 'occupied' : 'enemy');
      div.textContent = PHASES[cell.phaseIdx].emoji;
      div.title = PHASES[cell.phaseIdx].name + (cell.owner === 'enemy' ? ' (반달)' : '');
    } else if (selectedHandIdx !== null) {
      div.classList.add('droppable');
      div.addEventListener('click', () => placeCard(i));
    }

    boardEl.appendChild(div);
  });
}

function selectCard(idx) {
  if (hand[idx] === null) return;
  selectedHandIdx = idx;
  setInstruction('🌙 보드의 빈 칸을 클릭해 카드를 놓으세요!');
  renderHand();
  renderBoard();
}

function placeCard(cellIdx) {
  if (selectedHandIdx === null) return;
  if (board[cellIdx] !== null) return;

  const phaseIdx = hand[selectedHandIdx];
  board[cellIdx] = { phaseIdx, owner: 'player' };
  hand[selectedHandIdx] = null;
  selectedHandIdx = null;

  // 새 카드 보충
  const remaining = hand.filter(h => h !== null).length;
  if (remaining < 3) {
    const emptySlot = hand.findIndex(h => h === null);
    if (emptySlot !== -1) hand[emptySlot] = randomPhase();
  }

  // 점수 계산
  const gained = calcScore(cellIdx, 'player');
  if (gained > 0) {
    score += gained;
    updateScore();
    showFeedback(gained, cellIdx);
  }

  renderHand();
  renderBoard();

  // AI 턴
  setTimeout(enemyTurn, 900);
}

function calcScore(cellIdx, owner) {
  let pts = 0;
  const cell = board[cellIdx];
  if (!cell) return 0;

  const neighbors = ADJACENCY[cellIdx];
  let bestCombo = [];

  // 위상 쌍 & 보름달 쌍 검사
  neighbors.forEach(nIdx => {
    const n = board[nIdx];
    if (!n) return;

    if (n.phaseIdx === cell.phaseIdx) {
      pts += 1; // 위상 쌍
    }
    // 보름달 쌍 검사
    FULL_MOON_PAIRS.forEach(pair => {
      if ((pair[0] === cell.phaseIdx && pair[1] === n.phaseIdx) ||
          (pair[1] === cell.phaseIdx && pair[0] === n.phaseIdx)) {
        pts += 2;
      }
    });
  });

  // 달 주기 콤보 (3+ 연속)
  const comboChain = findLongestCycle(cellIdx);
  if (comboChain.length >= 3) {
    pts += comboChain.length;
    // 콤보 시각 효과
    comboChain.forEach(idx => {
      const el = boardEl.querySelector(`[data-idx="${idx}"]`);
      if (el) {
        el.classList.remove('combo-highlight');
        void el.offsetWidth; // reflow
        el.classList.add('combo-highlight');
      }
    });
    bestCombo = comboChain;
  }

  return pts;
}

// BFS로 달 주기 연속 체인 탐색
function findLongestCycle(startIdx) {
  let best = [];

  function dfs(path, visited) {
    if (path.length > best.length) best = [...path];
    const last = path[path.length - 1];
    const lastPhase = board[last].phaseIdx;

    ADJACENCY[last].forEach(nIdx => {
      if (visited.has(nIdx)) return;
      const n = board[nIdx];
      if (!n) return;
      // 다음 위상인지 확인 (circular)
      if (n.phaseIdx === (lastPhase + 1) % 8) {
        visited.add(nIdx);
        dfs([...path, nIdx], visited);
        visited.delete(nIdx);
      }
    });

    // 이전 방향도 탐색 (체인의 시작 확장)
    if (path.length === 1) {
      ADJACENCY[last].forEach(nIdx => {
        if (visited.has(nIdx)) return;
        const n = board[nIdx];
        if (!n) return;
        if (n.phaseIdx === (lastPhase - 1 + 8) % 8) {
          // 역방향으로 이어지면 이 노드를 앞에 붙여서 정방향으로 전환
          const newStart = nIdx;
          const newVisited = new Set([...visited, newStart, last]);
          dfsForward([newStart, last], newVisited);
        }
      });
    }
  }

  function dfsForward(path, visited) {
    if (path.length > best.length) best = [...path];
    const last = path[path.length - 1];
    const lastPhase = board[last].phaseIdx;
    ADJACENCY[last].forEach(nIdx => {
      if (visited.has(nIdx)) return;
      const n = board[nIdx];
      if (!n) return;
      if (n.phaseIdx === (lastPhase + 1) % 8) {
        visited.add(nIdx);
        dfsForward([...path, nIdx], visited);
        visited.delete(nIdx);
      }
    });
  }

  const visited = new Set([startIdx]);
  dfs([startIdx], visited);
  return best;
}

function showFeedback(pts, cellIdx) {
  const chain = findLongestCycle(cellIdx);
  let msg = '';
  if (chain.length >= 5) msg = `🔥 대콤보! 달 주기 ${chain.length}장 = +${chain.length}점 + 추가 +${pts - chain.length}점!`;
  else if (chain.length >= 3) msg = `⭐ 달 주기 콤보! ${chain.length}장 연속! +${pts}점`;
  else if (pts >= 2) msg = `✨ 보름달 쌍! +${pts}점`;
  else if (pts === 1) msg = `👍 위상 쌍! +1점`;
  else msg = `+${pts}점`;

  feedbackEl.textContent = msg;
  setTimeout(() => { if (feedbackEl.textContent === msg) feedbackEl.textContent = ''; }, 2500);
}

function updateScore() {
  scoreEl.textContent = score;
  scoreEl.style.textShadow = '0 0 30px var(--gold)';
  setTimeout(() => scoreEl.style.textShadow = '0 0 20px var(--gold)', 400);
}

function enemyTurn() {
  // 반달: 빈 칸 찾아서 무작위 카드 배치
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
  if (empty.length === 0) {
    endGame();
    return;
  }

  // 반달은 플레이어의 콤보 체인 중간을 끊으려 시도
  let targetCell = null;
  for (let idx of empty) {
    // 이 칸에 놓으면 플레이어의 콤보가 끊기는지 확인
    const neighbors = ADJACENCY[idx];
    let playerNeighborCount = 0;
    neighbors.forEach(n => {
      if (board[n] && board[n].owner === 'player') playerNeighborCount++;
    });
    if (playerNeighborCount >= 2) {
      targetCell = idx;
      break;
    }
  }
  if (targetCell === null) {
    targetCell = empty[Math.floor(Math.random() * empty.length)];
  }

  const enemyPhase = randomPhase();
  board[targetCell] = { phaseIdx: enemyPhase, owner: 'enemy' };
  renderBoard();

  // 보드 꽉 찼으면 종료
  if (board.every(c => c !== null)) {
    setTimeout(endGame, 600);
  } else {
    setInstruction('👉 카드를 선택하고 보드에 배치해 달 주기 콤보를 완성하세요!');
  }
}

function endGame() {
  // 보드 소유 보너스
  const owned = board.filter(c => c && c.owner === 'player').length;
  const enemyOwned = board.filter(c => c && c.owner === 'enemy').length;
  score += owned;
  updateScore();

  let msg = '';
  if (score > enemyOwned + owned) {
    msg = `🎉 게임 종료! 최종 점수 ${score}점 (보드 보너스 +${owned}점 포함). 훌륭합니다!`;
  } else {
    msg = `게임 종료! 최종 점수 ${score}점. 다시 도전해보세요!`;
  }
  setInstruction(msg);
  feedbackEl.textContent = '';
}

function setInstruction(text) {
  instructionsEl.textContent = text;
}

function initGame() {
  board = Array(9).fill(null);
  score = 0;
  selectedHandIdx = null;
  scoreEl.textContent = '0';
  feedbackEl.textContent = '';
  drawHand();
  renderHand();
  renderBoard();
  setInstruction('달의 위상 순서대로 빈 칸에 카드를 배치해 3장 이상 콤보를 완성해보세요!');
}

if (resetBtn) resetBtn.addEventListener('click', initGame);
initGame();


/* ══════════════════════════════════════
   5. 스무스 앵커 스크롤
══════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
