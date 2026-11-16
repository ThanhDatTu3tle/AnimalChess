// AI: negamax + alpha-beta + iterative deepening.
import {
  CELLS, COLS, WATER, TRAP, DEN_CELL, RAT, TIGER, LION, ELEPHANT,
  genMoves, colOf, rowOf, boardKey,
} from './rules.js';

const VALUE = [0, 520, 220, 320, 420, 560, 850, 950, 1000];
const WIN = 100000;

// Điểm vị trí cho quân của người chơi 0 (tiến về hang ở hàng 8, cột 3)
const POS = new Int16Array(CELLS);
for (let i = 0; i < CELLS; i++) {
  const c = colOf(i), r = rowOf(i);
  const dist = Math.abs(c - 3) + (8 - r);
  let s = r * 6 + (11 - dist) * 5;
  if (dist <= 2) s += 60;
  if (dist === 1) s += 90;
  POS[i] = s;
}
const mirror = (i) => CELLS - 1 - i;

export function evaluate(board) {
  let s = 0;
  let hasRat0 = false, hasRat1 = false, el0 = false, el1 = false;
  for (let i = 0; i < CELLS; i++) {
    const v = board[i];
    if (v === 0) continue;
    if (v > 0) {
      s += VALUE[v] + POS[i];
      if (TRAP[i] === 1) s -= VALUE[v] >> 2; // đứng trong bẫy địch rất nguy hiểm
      if (v === RAT) hasRat0 = true; else if (v === ELEPHANT) el0 = true;
    } else {
      s -= VALUE[-v] + POS[mirror(i)];
      if (TRAP[i] === 0) s += VALUE[-v] >> 2;
      if (v === -RAT) hasRat1 = true; else if (v === -ELEPHANT) el1 = true;
    }
  }
  // Voi không còn chuột địch để sợ thì mạnh hơn
  if (el0 && !hasRat1) s += 150;
  if (el1 && !hasRat0) s -= 150;
  return s;
}

function orderScore(board, m) {
  const t = m >> 6;
  const cap = board[t];
  let s = 0;
  if (cap !== 0) s += 1000 + VALUE[cap > 0 ? cap : -cap] * 4 - VALUE[Math.abs(board[m & 63])] / 8;
  if (t === DEN_CELL[0] || t === DEN_CELL[1]) s += 50000;
  return s;
}

/**
 * @param board Int8Array
 * @param turn 0|1
 * @param opts { level: 1|2|3, seen: {key: count} }
 */
export function findBestMove(board, turn, opts = {}) {
  const level = opts.level ?? 2;
  const seen = opts.seen ?? {};
  const maxDepth = level === 1 ? 2 : level === 2 ? 4 : 9;
  const timeLimit = level === 1 ? 150 : level === 2 ? 500 : 1400;
  const noise = level === 1 ? 120 : level === 2 ? 12 : 4;
  const start = Date.now();
  let nodes = 0, aborted = false;
  const b = Int8Array.from(board);

  function search(turn, depth, alpha, beta, ply) {
    // kiểm tra kết thúc
    if (b[DEN_CELL[0]] < 0) return turn === 1 ? WIN - ply : -(WIN - ply);
    if (b[DEN_CELL[1]] > 0) return turn === 0 ? WIN - ply : -(WIN - ply);
    if (depth <= 0) {
      const e = evaluate(b);
      return turn === 0 ? e : -e;
    }
    if ((++nodes & 2047) === 0 && Date.now() - start > timeLimit) { aborted = true; return 0; }
    const moves = genMoves(b, turn, []);
    if (moves.length === 0) return -(WIN - ply);
    if (moves.length > 1) {
      const sc = moves.map((m) => orderScore(b, m));
      const order = moves.map((_, i) => i).sort((x, y) => sc[y] - sc[x]);
      const sorted = order.map((i) => moves[i]);
      for (let i = 0; i < moves.length; i++) moves[i] = sorted[i];
    }
    let best = -Infinity;
    for (let k = 0; k < moves.length; k++) {
      const m = moves[k], f = m & 63, t = m >> 6;
      const cap = b[t];
      b[t] = b[f]; b[f] = 0;
      const v = -search(1 - turn, depth - 1, -beta, -alpha, ply + 1);
      b[f] = b[t]; b[t] = cap;
      if (aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  let rootMoves = genMoves(b, turn, []);
  if (rootMoves.length === 0) return null;
  // nhiễu cố định theo nước để máy không đi y hệt mỗi ván
  const jitter = new Map(rootMoves.map((m) => [m, (Math.random() - 0.5) * noise]));
  rootMoves.sort((x, y) => orderScore(b, y) - orderScore(b, x));
  let bestMove = rootMoves[0];
  let bestScore = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity, curBest = null, curScore = -Infinity;
    const scored = [];
    for (const m of rootMoves) {
      const f = m & 63, t = m >> 6;
      const cap = b[t];
      b[t] = b[f]; b[f] = 0;
      let v = -search(1 - turn, depth - 1, -Infinity, -alpha, 1);
      if (Math.abs(v) < WIN - 100) {
        const rep = seen[boardKey(b, 1 - turn)] | 0;
        v += jitter.get(m) - rep * 180; // tránh lặp nước
      }
      b[f] = b[t]; b[t] = cap;
      if (aborted) break;
      scored.push([m, v]);
      if (v > curScore) { curScore = v; curBest = m; }
      if (v > alpha) alpha = v;
    }
    if (aborted) break;
    bestMove = curBest; bestScore = curScore;
    scored.sort((x, y) => y[1] - x[1]);
    rootMoves = scored.map((x) => x[0]);
    if (curScore > WIN - 100) break; // đã thấy thắng
  }
  return { move: bestMove, score: bestScore, nodes };
}
