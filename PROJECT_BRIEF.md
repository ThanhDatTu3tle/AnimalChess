# Cờ Thú 3D — Tóm tắt dự án

File này tóm tắt toàn bộ những gì đã làm và đã quyết định trong phiên làm việc đầu tiên (16–17/11/2026), để tiếp tục phát triển trên máy khác mà không cần đọc lại cuộc trò chuyện cũ.

- Repo: https://github.com/ThanhDatTu3tle/AnimalChess (nhánh `master`)
- Hosting: Netlify, kết nối với repo GitHub, tự deploy khi push

## 1. Yêu cầu gốc

Game cờ thú (Dou Shou Qi) chạy trên trình duyệt, chơi với bạn bè hoặc với máy.

- Luật chơi: giữ luật mặc định.
- Map 3D: rừng rậm, sông, cầu bắc ngang giữa map; hai bên là hai biome khác nhau để phân biệt lãnh địa.
- Quân thú: model 3D phong cách hoạt hình, trông như chiến binh, mỗi con cầm một vũ khí theo đặc tính; hai phe có nét riêng dễ phân biệt.
- Bẫy, hang, cây cỏ, sông: cũng phong cách hoạt hình.
- Tông màu tươi sáng.
- Cách làm: build thử trước, rồi cải thiện dần.

## 2. Chạy dự án

Cần Node 20.19+ hoặc 22+ (Vite 8 yêu cầu).

| Lệnh | Tác dụng |
| --- | --- |
| `npm install` | Cài thư viện (lần đầu sau khi clone) |
| `npm run dev` | Chạy dev ở `http://localhost:5183` |
| `npm run dev:lan` | Như trên nhưng mở cho máy khác cùng mạng LAN |
| `npm run build` | Build production ra thư mục `dist` |
| `npm test` | Kiểm tra luật + cho AI tự đấu 6 ván |

Tham số URL tiện cho việc thử:

- `?mode=ai` / `?mode=pvp` / `?mode=demo` — vào thẳng ván, bỏ qua menu. Thêm `&side=1` để cầm phe Sa Mạc Đỏ khi đấu máy.
- `?room=MÃ` — vào phòng online có sẵn (đây cũng là dạng link mời bạn bè).
- `?create=MÃ` — tạo phòng online với mã chỉ định.

## 3. Công nghệ

- **Vite 8** + JavaScript thuần (ES modules), không dùng framework.
- **Three.js** cho 3D. Toàn bộ model dựng bằng code từ khối cơ bản (không có file model/texture ngoài).
- **PeerJS** (WebRTC) cho chơi online ngang hàng.
- Font Baloo 2 tải từ Google Fonts.

## 4. Cấu trúc mã nguồn

| File | Vai trò |
| --- | --- |
| `index.html` | Giao diện HTML/CSS: HUD, menu, bảng online, bảng luật, bảng kết quả |
| `src/main.js` | Điều phối: renderer, camera, vòng lặp, trạng thái ván, đi quân + hiệu ứng, chuột, HUD, online, undo |
| `src/rules.js` | Luật chơi thuần (không phụ thuộc đồ hoạ): bàn cờ, sinh nước đi, ăn quân, thắng thua |
| `src/ai.js` | AI: negamax + alpha-beta + iterative deepening, hàm lượng giá |
| `src/aiWorker.js` | Chạy AI trong Web Worker để không giật hình |
| `src/net.js` | Lớp `Net`: tạo/vào phòng qua PeerJS |
| `src/scene/helpers.js` | Vật liệu toon, cache geometry, hàm `mesh`/`group`, `mergeStatic`, quy đổi toạ độ |
| `src/scene/world.js` | Map: nền đất, sông (shader), cầu, ô cờ, bẫy, hang, cây cối, mây; hằng `TEAM` |
| `src/scene/animals.js` | Dựng 8 loại quân thú + vũ khí + huy hiệu cấp bậc |
| `test/selfplay.mjs` | Test luật và AI tự đấu |
| `vite.config.js` | `base: './'` để bản build chạy ở mọi đường dẫn |
| `netlify.toml` | Lệnh build và thư mục publish cho Netlify |

## 5. Quy ước quan trọng trong code

**Bàn cờ** (`rules.js`)

- 7 cột × 9 hàng, ô = `r * 7 + c`. `Int8Array(63)`: `0` trống, `+rank` quân phe 0, `-rank` quân phe 1.
- Phe 0 = **Rừng Xanh** (hàng 0–2, đi trước). Phe 1 = **Sa Mạc Đỏ** (hàng 6–8).
- Cấp: Chuột 1, Mèo 2, Chó 3, Sói 4, Báo 5, Hổ 6, Sư tử 7, Voi 8.
- Nước đi mã hoá thành số: `from | (to << 6)`.
- Sông: cột 1, 2, 4, 5 ở hàng 3–5. Hang: (3,0) và (3,8). Bẫy: ba ô quanh mỗi hang.

**Toạ độ 3D** (`helpers.js`)

- `x = c - 3`, `z = 4 - r`. Hàng 0 (Rừng Xanh) nằm ở phía `+z`, gần camera mặc định.
- `TILE_Y = 0.07` là mặt ô cờ, `WATER_Y = -0.2` là mặt nước.
- Model thú quay mặt về `+z` cục bộ; phe 0 xoay π để hướng về địch.

**Gộp mesh** (`mergeStatic`)

- Sau khi dựng xong, các mesh tĩnh cùng vật liệu được gộp lại để giảm draw call (từ ~3000 xuống ~980).
- Node nào cần chuyển động phải gắn `userData.dyn = true` **trước** khi gộp, nếu không sẽ bị gộp chết vào nền.

**Trạng thái ván** (`main.js`, biến `game`)

- `mode`: `menu` | `ai` | `pvp` | `demo` | `online`. `human`: phe của người chơi (dùng ở `ai` và `online`).
- `winner`: `-1` chưa xong, `0`/`1` phe thắng, `2` hoà.
- `seen`: đếm số lần mỗi thế cờ xuất hiện (dùng cho luật hoà và để AI tránh lặp).

**Hook debug** (chỉ có ở bản dev): `window.__dbg` chứa `scene, camera, renderer, game, controls, pieces, frame, playMove, select, net`. Dùng `__dbg.frame()` để tự bước khung hình khi `requestAnimationFrame` không chạy (tab ẩn).

## 6. Những gì đã có

**Luật chơi**

- Đi 1 ô ngang/dọc; quân bằng hoặc mạnh hơn ăn quân yếu hơn.
- Chuột hạ được Voi, Voi không ăn được Chuột.
- Chỉ Chuột bơi; quân dưới nước và trên bờ không ăn nhau.
- Sư tử và Hổ nhảy sông ngang/dọc, bị chặn nếu có Chuột trên đường.
- Quân trong bẫy đối phương mất hết sức mạnh.
- Không vào hang nhà. Thắng khi vào hang địch, ăn hết quân, hoặc đối phương hết nước đi.
- Thế cờ lặp lại 3 lần thì hoà (bổ sung, không thuộc luật gốc).

**Chế độ chơi**

- Đấu máy: 3 độ khó (Dễ độ sâu 2, Vừa độ sâu 4, Khó tới độ sâu 9 trong 1,4 giây), chọn được phe.
- Hai người chung máy.
- Online qua phòng: chủ phòng là Rừng Xanh, khách là Sa Mạc Đỏ và được lật camera về phía mình.
- Xem máy đấu máy.

**Hình ảnh**

- Rừng Xanh: cọ, cây tán tròn, bụi, hoa, nấm, đá. Sa Mạc Đỏ: xương rồng, núi đá tầng, cây keo, đụn cát.
- Sông chảy ngang có shader nước hoạt hình, thác đầu nguồn, lá súng; ba cột đất giữa sông là ba cây cầu gỗ.
- Bẫy là hố chông; hang là hố tối có vòng sáng màu đội và cờ hiệu.
- Quân thú chibi, giáp + băng đầu + bệ đứng theo màu đội (xanh ngọc `#18b884` / đỏ cam `#f2503c`), huy hiệu số cấp trên đầu.
- Vũ khí: Chuột dao găm, Mèo vuốt sắt, Chó kiếm + khiên, Sói rìu hai lưỡi, Báo giáo, Hổ đại kiếm, Sư tử đinh ba + vương miện, Voi búa tạ.

**Thao tác và hiệu ứng**

- Bấm quân rồi bấm ô để đi; kéo để xoay camera, lăn chuột để zoom.
- Vòng chọn quân, chấm xanh ô đi được, vòng đỏ ô ăn được, đánh dấu nước vừa đi, hover ô.
- Quân nhảy khi đi, vung vũ khí khi ăn, quân bị ăn xoay và tan thành khói; phe thắng nhảy ăn mừng.
- Thanh trạng thái hiện lượt đi và gợi ý về quân đang chọn.
- Nút Đi lại (không dùng được khi online), bảng Luật, bật/tắt âm thanh (âm tổng hợp bằng WebAudio).

## 7. Quyết định đã chốt

- **Sói (4) trên Chó (3)** theo luật quốc tế. Một số bộ cờ Việt Nam xếp ngược lại; chưa đổi vì chưa có yêu cầu.
- **Online dùng PeerJS** với máy chủ ghép phòng công cộng miễn phí, để game vẫn là trang tĩnh, không cần server riêng.
- **Model dựng bằng code** thay vì file 3D ngoài, để dễ chỉnh và không phụ thuộc tài nguyên.
- **Hosting Netlify** nối với GitHub.

## 8. Hạn chế đã biết

- Quân phe mình quay lưng về camera (vì hướng mặt về địch).
- Online: chưa vào lại được ván đang dở khi rớt mạng; chưa có máy chủ trung chuyển (TURN) nên một số mạng công ty hoặc 4G có thể không kết nối được.
- Chưa có nút xin thua / xin hoà.
- Chế độ hai người chung máy không tự lật camera theo lượt.
- Khoảng 980 draw call mỗi khung hình; chưa đo trên máy yếu hoặc điện thoại.
- File JS sau build khoảng 720 kB (chưa tách chunk).

## 9. Tình trạng kiểm thử

- Đã kiểm: luật và AI (`npm test`), đi quân, ăn quân, chọn phe, luật hoà, kết nối online hai tab — đều qua mô phỏng bằng `window.__dbg`.
- Chưa kiểm: thao tác chuột thật trên mọi nút, âm thanh, độ mượt thực tế, online giữa hai máy khác mạng, giao diện trên điện thoại.

## 10. Deploy

- Netlify đọc `netlify.toml`: chạy `npm run build`, phát thư mục `dist`, Node 22.
- Lỗi đã gặp: lần deploy đầu qua GitHub không có cấu hình build nên Netlify phát thẳng mã nguồn; trình duyệt không tải được `import 'three'` và mọi nút trong menu đều không phản hồi. `netlify.toml` sinh ra để sửa lỗi này.
- Mỗi lần push lên `master`, Netlify tự build và deploy lại.

## 11. Hướng phát triển tiếp

Chưa có thứ tự ưu tiên; chờ góp ý sau khi chơi thử.

- Tinh chỉnh hình ảnh theo góp ý (model từng con, màu, tốc độ hiệu ứng, bố cục menu).
- Online: vào lại ván khi rớt mạng, nút xin thua, máy chủ TURN.
- Tối ưu cho điện thoại và máy yếu.
- Tuỳ chọn đổi thứ bậc Chó/Sói.
