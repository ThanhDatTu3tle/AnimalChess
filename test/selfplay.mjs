import assert from 'node:assert';
import * as R from '../src/rules.js';
import { findBestMove } from '../src/ai.js';

const b = R.initialBoard();
const at = (c, r) => b[R.idx(c, r)];
assert.equal(at(0, 0), R.TIGER); assert.equal(at(6, 0), R.LION);
assert.equal(at(0, 8), -R.LION); assert.equal(at(6, 8), -R.TIGER);
assert.equal(at(6, 2), R.RAT); assert.equal(at(0, 6), -R.RAT);
assert.equal(at(0, 2), R.ELEPHANT); assert.equal(at(6, 6), -R.ELEPHANT);
assert.equal(R.genMoves(b, 0).length, R.genMoves(b, 1).length);

// nhảy sông + chuột chặn
const e = new Int8Array(R.CELLS);
e[R.idx(1, 2)] = R.LION; e[R.idx(0, 0)] = -R.CAT;
let ms = R.movesFrom(e, 0, R.idx(1, 2)).map(R.moveTo);
assert(ms.includes(R.idx(1, 6)), 'lion jumps vertical');
e[R.idx(1, 4)] = -R.RAT;
ms = R.movesFrom(e, 0, R.idx(1, 2)).map(R.moveTo);
assert(!ms.includes(R.idx(1, 6)), 'rat blocks');
// ngang
const h = new Int8Array(R.CELLS);
h[R.idx(0, 4)] = -R.TIGER; h[R.idx(3, 4)] = R.DOG;
assert(R.movesFrom(h, 1, R.idx(0, 4)).map(R.moveTo).includes(R.idx(3, 4)), 'tiger jumps & captures');
// chuột/voi, nước/bờ, bẫy
assert(R.canCapture(R.RAT, R.idx(0, 2), R.ELEPHANT, R.idx(0, 3), 0));
assert(!R.canCapture(R.ELEPHANT, R.idx(0, 2), R.RAT, R.idx(0, 3), 0));
assert(!R.canCapture(R.RAT, R.idx(1, 3), R.ELEPHANT, R.idx(0, 3), 0), 'rat from water');
assert(!R.canCapture(R.CAT, R.idx(0, 3), R.RAT, R.idx(1, 3), 0), 'cannot attack into water');
assert(R.canCapture(R.RAT, R.idx(1, 3), R.RAT, R.idx(1, 4), 0));
assert(R.canCapture(R.RAT, R.idx(2, 1), R.ELEPHANT, R.idx(2, 0), 0), 'trapped');
assert(!R.canCapture(R.CAT, R.idx(2, 7), R.DOG, R.idx(2, 8), 0), 'own trap gives no weakness');

let wins = [0, 0], draws = 0, t0 = Date.now();
for (let g = 0; g < 6; g++) {
  const board = R.initialBoard(); let turn = 0, w = -1, n = 0; const seen = {};
  while (w < 0 && n < 400) {
    const res = findBestMove(board, turn, { level: g % 2 ? 2 : 1, seen });
    assert(R.genMoves(board, turn).includes(res.move), 'legal');
    R.applyMove(board, res.move); turn = 1 - turn; n++;
    const k = R.boardKey(board, turn); seen[k] = (seen[k] | 0) + 1;
    w = R.winner(board, turn);
  }
  if (w < 0) draws++; else wins[w]++;
  console.log(`game ${g}: winner=${w} plies=${n}`);
}
console.log('wins', wins, 'unfinished', draws, (Date.now() - t0) + 'ms');
const r = findBestMove(R.initialBoard(), 0, { level: 3 });
console.log('hard nodes', r.nodes);
