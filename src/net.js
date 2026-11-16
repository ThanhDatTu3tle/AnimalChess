// Chơi online ngang hàng (WebRTC) qua PeerJS. Chủ phòng = Rừng Xanh (0), khách = Sa Mạc Đỏ (1).
import { Peer } from 'peerjs';

const PREFIX = 'cothu3d-room-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export class Net {
  /** handlers: { onReady(code), onOpen(side), onData(msg), onClose(), onError(text) } */
  constructor(handlers) {
    this.h = handlers;
    this.peer = null;
    this.conn = null;
    this.side = 0;
  }

  get connected() { return !!(this.conn && this.conn.open); }

  host(code) {
    this.close();
    this.side = 0;
    const peer = (this.peer = new Peer(PREFIX + code));
    peer.on('open', () => this.h.onReady?.(code));
    peer.on('connection', (conn) => {
      if (this.connected) { conn.on('open', () => conn.close()); return; } // phòng đã đủ 2 người
      this._bind(conn);
    });
    peer.on('error', (e) => this._error(e));
  }

  join(code) {
    this.close();
    this.side = 1;
    const peer = (this.peer = new Peer());
    peer.on('open', () => this._bind(peer.connect(PREFIX + code, { reliable: true })));
    peer.on('error', (e) => this._error(e));
  }

  _bind(conn) {
    this.conn = conn;
    conn.on('open', () => this.h.onOpen?.(this.side));
    conn.on('data', (d) => { if (conn === this.conn) this.h.onData?.(d); });
    conn.on('close', () => { if (conn === this.conn) { this.conn = null; this.h.onClose?.(); } });
  }

  _error(e) {
    const map = {
      'unavailable-id': 'Mã phòng đã có người dùng, hãy tạo phòng khác.',
      'peer-unavailable': 'Không tìm thấy phòng. Kiểm tra lại mã nhé.',
      network: 'Mất kết nối tới máy chủ ghép phòng.',
      'server-error': 'Máy chủ ghép phòng đang lỗi, thử lại sau.',
      'browser-incompatible': 'Trình duyệt không hỗ trợ WebRTC.',
    };
    this.h.onError?.(map[e.type] || 'Lỗi kết nối: ' + (e.type || e.message));
  }

  send(msg) { if (this.connected) this.conn.send(msg); }

  close() {
    const p = this.peer;
    this.peer = null; this.conn = null;
    if (p) p.destroy();
  }
}
