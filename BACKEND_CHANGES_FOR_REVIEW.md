# Các Thay Đổi Backend Cần Người Phụ Trách Backend Review

File này ghi lại các thay đổi đã chạm vào backend/test trong lúc sửa lỗi demo frontend. Các thay đổi này thuộc phạm vi backend, nên cần người phụ trách backend review, chấp nhận hoặc tự triển khai lại trước khi nộp bài.

## Các File Đã Chạm Vào

- `backend/api_bridge.py`
- `backend/peer_node.py`
- `tests/test_peer.py`

## 1. Xử Lý Trùng TCP Port

File: `backend/api_bridge.py`

### Đã thay đổi gì

Thêm import:

```python
import socket
```

Thêm hàm kiểm tra port:

```python
def _is_port_available(port: int) -> bool:
```

Hàm này kiểm tra port local có đang bị chiếm hay không bằng hai cách:

- thử kết nối tới `127.0.0.1:<port>`;
- thử bind vào `0.0.0.0:<port>`.

Trong endpoint `POST /register`, thêm kiểm tra port hợp lệ:

```python
if body.port < 1024 or body.port > 65535:
    fail("port must be in range 1024-65535")
```

Thêm kiểm tra port đã được peer khác trong API bridge dùng chưa:

```python
for node in app.state.peer_nodes.values():
    if node.port == body.port:
        fail(f"port {body.port} is already in use", code=409)
```

Thêm kiểm tra port có đang bị hệ điều hành/process khác chiếm không:

```python
if not _is_port_available(body.port):
    fail(f"port {body.port} is already in use", code=409)
```

### Vì sao cần sửa

Nếu hai cửa sổ trình duyệt đăng ký hai user khác nhau nhưng nhập cùng TCP port, chỉ peer đầu tiên có thể bind port đó. Peer thứ hai sẽ lỗi hoặc có trạng thái không rõ ràng.

### Hành vi mong muốn

Khi port đã được dùng, backend trả:

```text
409 Conflict
port <port> is already in use
```

Frontend có thể bắt lỗi này, tự thử port tiếp theo và hiển thị cho người dùng biết port thực tế đã được cấp.

## 2. Đồng Bộ Group Khi Tạo Nhóm

File: `backend/api_bridge.py`

### Đã thay đổi gì

Thêm request model:

```python
class GroupCreateRequest(BaseModel):
    from_id: str
    group_id: str
    name: str
    member_ids: List[str]
```

Thêm endpoint:

```python
@app.post("/group/create")
async def create_group(body: GroupCreateRequest):
```

Endpoint này:

- kiểm tra `group_id`, tên nhóm và `member_ids`;
- lấy peer người tạo nhóm bằng `from_id`;
- không cho phép `member_ids` chứa chính người gửi;
- gửi WebSocket event tới từng thành viên trong nhóm:

```python
{
    "type": "GROUP_CREATED",
    "group_id": body.group_id,
    "name": body.name,
    "from_id": node.peer_id,
    "from_username": node.username,
    "member_ids": body.member_ids,
    "timestamp": time.time(),
}
```

### Vì sao cần sửa

Trước đó, khi A tạo nhóm gồm B và C, chỉ A thấy nhóm vì thông tin group chỉ lưu trong `localStorage` của frontend A. B và C có thể nhận tin nhắn nhóm nhưng không thấy nhóm trong sidebar, nên không thể chủ động mở group chat.

### Hành vi mong muốn

Khi A tạo nhóm có B và C:

- A thấy nhóm ngay.
- Backend gửi event `GROUP_CREATED` cho B và C.
- B và C tự thêm nhóm vào sidebar/localStorage.

## 3. Không Cho Tin Nhắn Nhóm Lọt Vào Chat Riêng

File: `backend/peer_node.py`

### Đã thay đổi gì

Sửa hàm:

```python
def get_messages(self, peer_id: str = None) -> list:
```

Trước đây hàm lấy toàn bộ `inbox`, sau đó lọc theo `from_id` / `to_id`. Vì tin nhắn nhóm cũng có `from_id`, nên tin nhắn nhóm từ A có thể bị hiện trong chat riêng giữa B và A.

Đã đổi sang loại bỏ message có `group_id` trước:

```python
msgs = [m for m in self.inbox if not m.get("group_id")]
```

Sau đó mới lọc tin nhắn 1-1 theo peer:

```python
if m.get("from_id") == peer_id or m.get("to_id") == peer_id
```

### Vì sao cần sửa

Khi A gửi tin trong nhóm A-B-C, phía B/C không được thấy nội dung đó trong chat riêng với A. Tin nhắn nhóm phải nằm ở group chat, không nằm ở private chat.

### Hành vi mong muốn

- `/messages/{peer_id}` chỉ trả tin nhắn 1-1.
- `/messages/group/{group_id}` chỉ trả tin nhắn nhóm.
- Tin nhắn nhóm do A gửi không xuất hiện trong private chat giữa B và A.

## 4. Thêm Test Regression Cho Lỗi Group/Private Chat

File: `tests/test_peer.py`

### Đã thay đổi gì

Thêm assertion trong `test_group_broadcast`:

```python
private_msgs = bob.get_messages(alice.peer_id)
assert not any(m.get("content") == "group hello" for m in private_msgs)
```

### Vì sao cần sửa

Test này đảm bảo tin nhắn nhóm không bị lọt vào lịch sử chat riêng.

## Kết Quả Kiểm Tra

Đã chạy:

```bash
npm run build
.\venv\Scripts\python.exe -m pytest tests -q
```

Kết quả:

```text
frontend build: success
pytest: 39 passed, 2 warnings
```

## Ghi Chú Cho Người Phụ Trách Backend

Các thay đổi trên xử lý các lỗi tích hợp thật, nhưng vì chúng chạm vào backend nên cần backend owner kiểm tra lại. Có thể chọn một trong các hướng:

- chấp nhận các thay đổi này;
- tự triển khai lại cùng hành vi ở nhánh backend;
- hoặc đưa ra contract/API chính thức khác để frontend làm theo.

Frontend đã có một số fallback tạm thời, nhưng cách sửa đúng lâu dài vẫn nên nằm ở backend:

- trả `409 Conflict` rõ ràng khi TCP port bị trùng hoặc đang bận;
- có cơ chế đồng bộ group metadata hoặc event `GROUP_CREATED`;
- tách riêng lịch sử tin nhắn 1-1 và tin nhắn nhóm.
