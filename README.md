# P2P Chat System

Ứng dụng chat ngang hàng (peer-to-peer) với **end-to-end encryption** (ECDH P-256 + AES-256-GCM), heartbeat phân tán, store-and-forward, và lưu trữ tin nhắn persistent bằng IndexedDB.

Stack: **Python (FastAPI + raw TCP socket)** cho backend, **React + Vite + Tailwind CSS** cho frontend.

---

## Tính năng chính

- Chat 1-1 và chat nhóm với E2EE — bootstrap chỉ thấy ciphertext, không thể đọc nội dung
- Discovery qua bootstrap server (TCP port 9000) — peer biết nhau bằng host/port
- Heartbeat 2 lớp: tập trung (peer → bootstrap) + phân tán (peer ↔ peer)
- Store-and-forward: tin gửi cho peer offline được queue ở bootstrap, giao khi peer online lại
- IndexedDB persistent — tin nhắn lưu trên đĩa, sống qua nhiều phiên trình duyệt
- Resume identity: đăng nhập lại với username cũ giữ nguyên `peer_id` và lịch sử chat
- Tàng hình mode — chuyển offline mà không cần ngắt kết nối

---

## Yêu cầu

- Python 3.10+
- Node.js 18+
- npm 9+

---

## Cài đặt (lần đầu)

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

---

## Chạy dự án

Mở **3 terminal** riêng biệt theo đúng thứ tự:

**Terminal 1 — Bootstrap server (port 9000)**
```bash
cd backend
python bootstrap_server.py
```

**Terminal 2 — API Bridge (port 8000)**
```bash
cd backend
python api_bridge.py
```

**Terminal 3 — Frontend (port 5173)**
```bash
cd frontend
npm run dev
```

Mở trình duyệt: <http://localhost:5173>

Để demo 2 user: mở 2 tab (1 thường + 1 ẩn danh), đăng ký 2 username khác nhau với port khác nhau (ví dụ 7001 và 7002).

---

## Báo Cáo

| Tài liệu | Mô tả |
|----------|-------|
| [BAO_CAO.md](BAO_CAO.md) | Báo cáo thiết kế dạng Markdown |
| [Báo cáo.pdf](https://drive.google.com/file/d/1vaoOQ0ynwwb7B8fzkrAqRJ1KGCIR8Gst/view?usp=sharing) | Báo cáo PDF hoàn chỉnh |
