// Luật Cờ Thú (Dou Shou Qi) — logic thuần, không phụ thuộc đồ hoạ.
// Bàn 7 cột x 9 hàng. Ô = r * 7 + c. Người chơi 0 ở hàng 0..2, người chơi 1 ở hàng 6..8.
// Giá trị ô: 0 = trống, +rank = quân người chơi 0, -rank = quân người chơi 1.

export const COLS = 7;
export const ROWS = 9;
export const CELLS = COLS * ROWS;

export const RAT = 1, CAT = 2, DOG = 3, WOLF = 4, LEOPARD = 5, TIGER = 6, LION = 7, ELEPHANT = 8;

export const ANIMALS = {
  [RAT]: { key: 'rat', name: 'Chuột', emoji: '🐭' },
  [CAT]: { key: 'cat', name: 'Mèo', emoji: '🐱' },
  [DOG]: { key: 'dog', name: 'Chó', emoji: '🐶' },
  [WOLF]: { key: 'wolf', name: 'Sói', emoji: '🐺' },
  [LEOPARD]: { key: 'leopard', name: 'Báo', emoji: '🐆' },
  [TIGER]: { key: 'tiger', name: 'Hổ', emoji: '🐯' },
  [LION]: { key: 'lion', name: 'Sư tử', emoji: '🦁' },
  [ELEPHANT]: { key: 'elephant', name: 'Voi', emoji: '🐘' },
};

export const idx = (c, r) => r * COLS + c;
export const colOf = (i) => i % COLS;
export const rowOf = (i) => (i / COLS) | 0;

export const WATER = new Uint8Array(CELLS);
export const TRAP = new Int8Array(CELLS).fill(-1); // chủ của bẫy
export const DEN = new Int8Array(CELLS).fill(-1); // chủ của hang

for (let r = 3; r <= 5; r++) for (const c of [1, 2, 4, 5]) WATER[idx(c, r)] = 1;
DEN[idx(3, 0)] = 0;
DEN[idx(3, 8)] = 1;
for (const [c, r] of [[2, 0], [4, 0], [3, 1]]) TRAP[idx(c, r)] = 0;
for (const [c, r] of [[2, 8], [4, 8], [3, 7]]) TRAP[idx(c, r)] = 1;

export const DEN_CELL = [idx(3, 0), idx(3, 8)];

// Hàng xóm 4 hướng: NEIGH[i] = [up, down, left, right] hoặc -1
const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]];
export const NEIGH = [];
for (let i = 0; i < CELLS; i++) {
  const c = colOf(i), r = rowOf(i);
  NEIGH.push(DIRS.map(([dc, dr]) => {
    const nc = c + dc, nr = r + dr;
    return nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS ? -1 : idx(nc, nr);
  }));
}

export function initialBoard() {
  const b = new Int8Array(CELLS);
  const p0 = [
    [0, 0, TIGER], [6, 0, LION],
    [1, 1, CAT], [5, 1, DOG],
    [0, 2, ELEPHANT], [2, 2, WOLF], [4, 2, LEOPARD], [6, 2, RAT],
  ];
  for (const [c, r, k] of p0) {
    b[idx(c, r)] = k;
    b[idx(COLS - 1 - c, ROWS - 1 - r)] = -k; // đối xứng tâm
  }
  return b;
}

export const ownerOf = (v) => (v > 0 ? 0 : 1);
export const rankOf = (v) => (v > 0 ? v : -v);

// Quân `att` (rank) của `turn` đứng ở `from` có ăn được quân rank `def` ở `to` không
export function canCapture(att, from, def, to, turn) {
  if (WATER[from] !== WATER[to]) return false; // dưới nước <-> trên bờ không ăn nhau
  if (TRAP[to] === turn) return true; // địch sa bẫy phe mình: mất hết sức mạnh
  if (att === RAT && def === ELEPHANT) return true;
  if (att === ELEPHANT && def === RAT) return false;
  return att >= def;
}

// Nước đi mã hoá: from | (to << 6)
export const mkMove = (from, to) => from | (to << 6);
export const moveFrom = (m) => m & 63;
export const moveTo = (m) => m >> 6;

export function genMoves(board, turn, out = []) {
  out.length = 0;
  for (let i = 0; i < CELLS; i++) {
    const v = board[i];
    if (v === 0 || (v > 0 ? 0 : 1) !== turn) continue;
    const rank = v > 0 ? v : -v;
    const nb = NEIGH[i];
    for (let d = 0; d < 4; d++) {
      let t = nb[d];
      if (t < 0) continue;
      if (WATER[t]) {
        if (rank === RAT) {
          // chuột bơi được
        } else if (rank === TIGER || rank === LION) {
          // nhảy qua sông, bị chặn nếu có chuột trên đường
          let blocked = false;
          while (WATER[t]) {
            if (board[t] !== 0) { blocked = true; break; }
            t = NEIGH[t][d];
          }
          if (blocked) continue;
        } else continue;
      }
      if (DEN[t] === turn) continue; // không vào hang nhà
      const o = board[t];
      if (o !== 0) {
        if ((o > 0 ? 0 : 1) === turn) continue;
        if (!canCapture(rank, i, o > 0 ? o : -o, t, turn)) continue;
      }
      out.push(i | (t << 6));
    }
  }
  return out;
}

export function movesFrom(board, turn, from) {
  return genMoves(board, turn).filter((m) => moveFrom(m) === from);
}

// Áp dụng nước đi lên board (sửa tại chỗ). Trả về quân bị ăn (0 nếu không).
export function applyMove(board, m) {
  const f = m & 63, t = m >> 6;
  const cap = board[t];
  board[t] = board[f];
  board[f] = 0;
  return cap;
}

// Người thắng sau khi `turn` là người sắp đi: -1 nếu chưa xong
export function winner(board, turn) {
  if (board[DEN_CELL[0]] < 0) return 1;
  if (board[DEN_CELL[1]] > 0) return 0;
  let n0 = 0, n1 = 0;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] > 0) n0++;
    else if (board[i] < 0) n1++;
  }
  if (n0 === 0) return 1;
  if (n1 === 0) return 0;
  if (genMoves(board, turn).length === 0) return 1 - turn; // hết nước đi thì thua
  return -1;
}

export function boardKey(board, turn) {
  let s = turn ? 'b' : 'a';
  for (let i = 0; i < CELLS; i++) s += String.fromCharCode(77 + board[i]);
  return s;
}
