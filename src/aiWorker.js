import { findBestMove } from './ai.js';

self.onmessage = (e) => {
  const { id, board, turn, level, seen } = e.data;
  const res = findBestMove(Int8Array.from(board), turn, { level, seen });
  self.postMessage({ id, move: res ? res.move : null });
};
