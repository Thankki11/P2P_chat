# P2P Chat System — Technical Report

---

## 1. System Architecture

> Describe the overall system: bootstrap server, peer nodes, REST API bridge, and React frontend. Include a diagram if possible.

---

## 2. Message Protocol

> Describe the protocol.py message types, encoding/decoding strategy, and how messages flow between peers over TCP sockets.

---

## 3. Peer Discovery

> Explain how peers register with the bootstrap server, receive the peer list, and establish direct TCP connections.

---

## 4. Error Handling & Testing

### 4.1 Error handling

Frontend xu ly loi theo 4 nhom chinh. Nhom thu nhat la loi REST API. Tat ca request di qua `frontend/src/services/api.js`; ham `apiErrorMessage()` doc loi FastAPI dang `detail.message` hoac `detail` string de hien thi message ngan gon tren toast. Neu backend tra ve `peer not registered`, frontend xoa `peer_id`, `username`, `peer_port` trong localStorage va dua nguoi dung ve man hinh dang nhap. Cach nay tranh trang thai UI bi ket khi API bridge restart va session peer trong backend khong con ton tai.

Khi dang ky peer, backend kiem tra TCP port truoc khi tao `PeerNode`. Neu port nam ngoai khoang 1024-65535 hoac dang duoc process/peer khac su dung, API tra loi ro rang. Frontend bat loi `409 Conflict` dang `port ... is already in use`, tu dong thu port tiep theo toi da 20 lan, luu port thuc te vao `localStorage` va hien thong bao cho nguoi dung biet port da duoc doi.

Nhom thu hai la mat ket noi WebSocket. Hook `useWebSocket(userId, onMessage)` tu dong tao ket noi toi `/ws/{peer_id}` theo cung host voi Vite. Khi socket dong ngoai y muon, hook reconnect voi exponential backoff 1s, 2s, 4s va toi da 30s; loi socket chi log warning, khong lam crash React. Khi backend gui `PING`, frontend tra lai `PONG` de giu ket noi on dinh. Khi unmount, hook dong socket va xoa timer reconnect de tranh memory leak.

Nhom thu ba la peer offline. Khi nguoi dung dong tab/cua so, `AppLayout` goi `logoutUser(currentUserId)` bang `sendBeacon('/api/logout')`. Backend co the dung tin hieu nay de dung PeerNode cua peer do; peer con lai se cap nhat danh sach peer qua polling `/peers` moi 5 giay va qua event `PEER_STATUS` neu backend push. UI merge trang thai `PEER_STATUS` vao danh sach peer hien thi nen dot online/offline doi nhanh hon polling khi server co event.

Nhom thu tu la delivery/store-forward. Khi gui tin, `ChatWindow` va `GroupChat` them optimistic bubble ngay lap tuc voi `delivered: false`. Neu API tra thanh cong, bubble duoc cap nhat `msg_id`, `timestamp`, `delivered`. Neu nguoi nhan offline, backend co the tra `queued`; frontend giu bubble voi trang thai queued. Khi backend day `STORE_FWD_RECV`, cua so chat refetch history. Khi co `MSG_DELIVERED`, frontend cap nhat bubble tu queued sang delivered theo `msg_id`.

### 4.2 Test results

| Kich ban thu nghiem | Ket qua mong doi | Ket qua thuc te |
| --- | --- | --- |
| Build frontend | Vite build thanh cong, khong loi compile | `npm run build` thanh cong |
| Backend regression | Test suite backend/API pass | `39 passed, 2 warnings` bang Python 3.11 venv |
| Dang nhap | `POST /register` tra `peer_id`, UI vao `/chat` | Proxy `/api/register` tra HTTP 200 |
| Chat 1-1 real-time | Tin den qua WS lam chat refetch, khong can refresh trang | `NEW_MESSAGE` va `STORE_FWD_RECV` da duoc xu ly trong `AppLayout`/`ChatWindow` |
| Group broadcast | Tin nhom hien trong group chat, nguoi gui hien ten | `GroupChat` gui `/group/send`, refetch khi WS event co `group_id` |
| Peer offline/online | Dong tab peer A thi peer B thay doi dot online/offline | Frontend gui `/api/logout` khi `pagehide/beforeunload`, peer list polling 5s |
| Toast + unread badge | Tin den khi dang o chat khac hien toast va tang badge | `unreadByPeer` va toast stack da hoan thien |
| Dark mode | Toggle dark/light va luu preference qua refresh | `theme` luu trong localStorage, class `dark` ap dung len document |
| Responsive 375px | Sidebar thu gon, co nut mo sidebar tren mobile | `AppLayout` dung mobile overlay sidebar |

Chi tiet cac test case duoc ghi trong `docs/test_results.md`. Anh chup man hinh va video demo se duoc chen sau khi quay demo nop bai.

### 4.3 Limitations and future work

He thong hien tai tap trung vao chat text va demo P2P trong moi truong local. Cac han che con lai gom: chua ma hoa end-to-end noi dung tin nhan, chua co xac thuc nguoi dung that, chua ho tro file transfer, chua co persistent database cho lich su chat sau khi server restart, va co che group dang duoc frontend quan ly local nen khi doi may/browser se mat danh sach nhom. Trong tuong lai co the them encryption theo khoa cong khai cua peer, luu history bang SQLite/PostgreSQL, dong bo group metadata qua backend, them upload file qua chunked transfer, va them test E2E Playwright cho cac luong dang nhap/chat/offline/responsive.
