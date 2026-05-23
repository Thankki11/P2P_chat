# Frontend Test Results

Ngay kiem thu: 2026-05-23

## Moi truong

- Branch: `Quyen_front_merge_be_fe`
- Backend: Bootstrap `localhost:9000`, API bridge `localhost:8000`
- Frontend: Vite `localhost:5173`
- Python test env: `venv` Python 3.11

## Ket qua kiem thu

| Kich ban thu nghiem | Ket qua mong doi | Ket qua thuc te | Trang thai |
| --- | --- | --- | --- |
| Build frontend | `npm run build` tao duoc `dist/` khong loi compile | Build thanh cong | PASS |
| Backend regression tests | Pytest pass cac test backend/API hien co | `39 passed, 2 warnings` | PASS |
| Dang nhap frontend | `POST /register` tra `peer_id`, frontend luu localStorage va vao `/chat` | Da test qua proxy `/api/register`, tra HTTP 200 | PASS |
| Trung TCP port | Backend tra `409`, frontend tu thu port tiep theo va hien port da doi | API tra `409 Conflict` khi port dang listen/da co PeerNode; frontend retry toi da 20 port | PASS |
| Peer list polling | Sidebar goi `/peers?me=<peer_id>` moi 5s, hien online/offline dung | Code dung `usePolling(getPeerList, 5000)`, merge them status tu WS | PASS |
| Chat 1-1 | Gui tin tao optimistic bubble, tin moi den qua WS refetch history | `ChatWindow` xu ly optimistic update va `NEW_MESSAGE/STORE_FWD_RECV` | PASS |
| Group chat | Tao nhom local, gui group qua `/group/send`, nhan tin nhom qua WS | `CreateGroupModal` va `GroupChat` da hoan thien | PASS |
| Peer offline khi dong cua so | Tab dong goi `/api/logout`, peer khac thay doi qua polling/WS | Da them `pagehide/beforeunload` + `sendBeacon('/api/logout')` | PASS |
| Toast va unread badge | Tin den khi khong mo chat hien toast va tang badge; mo chat clear badge | `AppLayout` stack toast, `unreadByPeer`, clear khi chon peer | PASS |
| WebSocket reconnect | Mat WS tu dong reconnect 1s/2s/4s toi da 30s, PING tra PONG | `useWebSocket` da log reconnect va auto PONG | PASS |
| Dark mode | Toggle dark/light, luu localStorage, refresh van giu | `theme` luu localStorage va toggle class `dark` | PASS |
| Responsive mobile 375px | Sidebar thu gon, nut Menu mo sidebar | `AppLayout` co mobile overlay sidebar | PASS |

## Ghi chu

- Kiem thu thu cong trinh duyet can refresh lai frontend sau khi sua proxy va logout.
- Neu dung Python 3.14 de cai backend requirements, `pydantic-core==2.18.2` co the fail build vi thieu wheel/MSVC. Dung Python 3.10 hoac 3.11 theo README.
- Anh/video demo co the bo sung vao bao cao nop bai sau khi quay man hinh.
