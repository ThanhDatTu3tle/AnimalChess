// Dữ liệu 5 biome: tên phe, màu giáp, màu lông từng con, nền đất, ô cờ, sông và cảnh vật.
// Mỗi phe tự chọn biome cho nửa sân của mình; TEAM[0]/TEAM[1] được cập nhật tại chỗ qua setTeams().
import * as D from './decor.js';

const GOLD = 0xffcc4d;

// fur[rank] = [lông, bụng, ...phụ]. Báo: [.., đốm ngoài, đốm trong]; Hổ: [.., vằn]; Sư tử: [.., bờm, bờm sáng]
export const BIOMES = {
  plains: {
    name: 'Đồng Xanh', emoji: '🌴',
    team: { main: 0x18b884, dark: 0x0c7a57, light: 0x8af5cf, css: '#18b884' },
    orn: { kind: 'leaf', color: 0x7be36b },
    ground: { top: 0x6fc74e, soil: 0x9a6a44 },
    tiles: [0xb4ea74, 0x9fde62], trap: 0xb08a5c,
    rocks: [0x9794a6, 0x86839a, 0xa9a6b8],
    water: { deep: [0.16, 0.66, 0.90], lite: [0.42, 0.87, 0.98], foam: [1, 1, 1], lava: 0 },
    fur: {
      1: [0xa8aebd, 0xe6e8ef], 2: [0xf7ad55, 0xfff1d6], 3: [0xd09a62, 0xf6e3c5], 4: [0x8592ab, 0xeef2f8],
      5: [0xf6c851, 0xfff3cf, 0x6b4320, 0xe09a2e], 6: [0xf79433, 0xfff3e0, 0x2a2233],
      7: [0xf2bd5a, 0xffeec2, 0xb8612a, 0xd17a35], 8: [0x9db4d6, 0xc9d8ee],
    },
    decorate: D.decoratePlains, bank: D.bankPlains,
  },
  desert: {
    name: 'Sa Mạc Đỏ', emoji: '🌵',
    team: { main: 0xf2503c, dark: 0xa52b20, light: 0xffb59a, css: '#f2503c' },
    orn: { kind: 'spike', color: GOLD },
    ground: { top: 0xf1cf85, soil: 0xc98452 },
    tiles: [0xffe9ab, 0xf8da8e], trap: 0xd09a62,
    rocks: [0xc98452, 0xd9925c, 0xe0a068],
    water: { deep: [0.18, 0.62, 0.82], lite: [0.48, 0.86, 0.94], foam: [1, 0.97, 0.9], lava: 0 },
    fur: {
      1: [0xd4b48c, 0xf6e7d2], 2: [0xe9c98a, 0xfff4de], 3: [0xe3a15c, 0xfbe8c8], 4: [0xc9a274, 0xf6ead8],
      5: [0xf2c46a, 0xfff2cf, 0x8a5426, 0xd99a3a], 6: [0xf28a2a, 0xfff0dc, 0x3a2420],
      7: [0xe8b45a, 0xfff0c8, 0x9c4a1c, 0xc4682a], 8: [0xc8ab92, 0xeadbcd],
    },
    decorate: D.decorateDesert, bank: D.bankDesert,
  },
  snow: {
    name: 'Băng Tuyết', emoji: '❄️',
    team: { main: 0x3b9df0, dark: 0x1f62b0, light: 0xc9ecff, css: '#2f8ee6' },
    orn: { kind: 'spike', color: 0xbfeaff },
    ground: { top: 0xf2f9ff, soil: 0x9fb7c9 },
    tiles: [0xe6f3fc, 0xd2e6f5], trap: 0xa7bfd3,
    rocks: [0xc9d6e2, 0xb3c3d1, 0xe6eef5],
    water: { deep: [0.40, 0.74, 0.92], lite: [0.80, 0.95, 1.0], foam: [1, 1, 1], lava: 0 },
    // chuột bạch, mèo trắng, chó husky, sói Bắc Cực, báo tuyết, hổ trắng, sư tử trắng, voi ma mút
    fur: {
      1: [0xf1f3f8, 0xffffff], 2: [0xe8edf4, 0xffffff], 3: [0x9aa8b8, 0xffffff], 4: [0xe2e8f0, 0xffffff],
      5: [0xe4e8ee, 0xffffff, 0x5c6472, 0xaab3c0], 6: [0xf6f4ef, 0xffffff, 0x2a2233],
      7: [0xf2e9d8, 0xffffff, 0xe0d2b4, 0xece2cc], 8: [0x8a5a3c, 0xb98a68],
    },
    decorate: D.decorateSnow, bank: D.bankSnow,
  },
  forest: {
    name: 'Rừng Thẳm', emoji: '🌲',
    team: { main: 0x2f7a3c, dark: 0x1a4d25, light: 0xa6e08f, css: '#2f7a3c' },
    orn: { kind: 'leaf', color: 0x3f8f3a },
    ground: { top: 0x3f8f4a, soil: 0x6a4630 },
    tiles: [0x8cc276, 0x7ab565], trap: 0x8a6a48,
    rocks: [0x6f7d6a, 0x5d6b58, 0x82907a],
    water: { deep: [0.08, 0.46, 0.48], lite: [0.28, 0.72, 0.64], foam: [0.85, 1, 0.9], lava: 0 },
    // lông sẫm màu; Báo là báo đen
    fur: {
      1: [0x7a7064, 0xc4b8a8], 2: [0x6a5a4c, 0xd6c6ae], 3: [0x7a5234, 0xe0c8a4], 4: [0x5a6474, 0xc3cad4],
      5: [0x3a3440, 0x5a5262, 0x26222c, 0x4a4252], 6: [0xd0702a, 0xfff0dc, 0x1e1a22],
      7: [0xc49450, 0xf3e2bc, 0x5a3418, 0x7a4a22], 8: [0x7d8a96, 0xa9b6c2],
    },
    decorate: D.decorateForest, bank: D.bankForest,
  },
  volcano: {
    name: 'Núi Lửa', emoji: '🌋',
    team: { main: 0x4a3b4f, dark: 0x2a2030, light: 0xff9a3c, css: '#d9480f', badge: '#4a3b4f' },
    orn: { kind: 'spike', color: 0xff6a1a },
    ground: { top: 0x5b4d57, soil: 0x3b2f38 },
    tiles: [0xc9bfc3, 0xb7acb1], trap: 0x6e5560,
    rocks: [0x3d3340, 0x4a3f4e, 0x2f2832],
    water: { deep: [0.20, 0.40, 0.52], lite: [0.40, 0.60, 0.70], foam: [1, 0.6, 0.3], lava: 1 },
    // lông tro than; báo đốm dung nham, hổ vằn lửa, sư tử bờm lửa
    fur: {
      1: [0x5a5260, 0x9a90a0], 2: [0x3a3440, 0x7a7080], 3: [0x6a5450, 0xb09890], 4: [0x48424e, 0x9a94a0],
      5: [0x4a3c44, 0x8a7a82, 0xff7a1a, 0xffc23a], 6: [0x3a3238, 0x8a7a80, 0xff6a1a],
      7: [0x8a4a30, 0xd6a080, 0xff6a1a, 0xffa42a], 8: [0x5e5664, 0x8e8696],
    },
    decorate: D.decorateVolcano, bank: D.bankVolcano,
  },
};
export const BIOME_IDS = Object.keys(BIOMES);
export const DEFAULT_BIOMES = ['plains', 'desert'];

/** Thông tin phe hiện tại (được thay tại chỗ, các module khác giữ tham chiếu) */
export const TEAM = [{}, {}];
export function setTeams(b0, b1) {
  [b0, b1].forEach((id, i) => {
    const B = BIOMES[id];
    for (const k of Object.keys(TEAM[i])) delete TEAM[i][k];
    Object.assign(TEAM[i], B.team, { id, name: B.name, emoji: B.emoji, fur: B.fur, orn: B.orn, badge: B.team.badge || B.team.css });
  });
}
setTeams(...DEFAULT_BIOMES);

/** Biome của khách bị đổi nếu trùng chủ phòng: lấy biome kế tiếp trong danh sách */
export const distinctFrom = (b, taken) => (b !== taken ? b : BIOME_IDS[(BIOME_IDS.indexOf(b) + 1) % BIOME_IDS.length]);
