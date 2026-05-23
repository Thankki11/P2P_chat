# Bug Report — P2P Chat Backend
Generated: 2026-05-23T14:22:29.921020

## Summary
- Total: 36 | Passed: 29 | Failed: 7 | Errors: 0

## Failed Tests

### test_register_success
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:45: in test_register_success
    resp = await client.post("/register", json={
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1892: in post
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(request,
```

### test_get_peers
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:68: in test_get_peers
    resp = await client.get("/peers")
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1801: in get
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(request, auth=auth, follow_
```

### test_send_empty_content
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:77: in test_send_empty_content
    resp = await client.post("/send", json={
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1892: in post
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(request, a
```

### test_send_to_unknown_peer
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:85: in test_send_to_unknown_peer
    resp = await client.post("/send", json={
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1892: in post
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(request,
```

### test_group_send_empty_members
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:96: in test_group_send_empty_members
    resp = await client.post("/group/send", json={
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1892: in post
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.sen
```

### test_get_messages
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:104: in test_get_messages
    resp = await client.get("/messages/some-peer-id")
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1801: in get
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(request
```

### test_get_group_messages
- Error: E   KeyError: 'peer_node'
- Body:
```

..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\starlette\datastructures.py:699: in __getattr__
    return self._state[key]
E   KeyError: 'peer_node'

During handling of the above exception, another exception occurred:
tests\test_api.py:113: in test_get_group_messages
    resp = await client.get("/messages/group/g1")
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1801: in get
    return await self.request(
..\..\..\AppData\Local\Programs\Python\Python312\Lib\site-packages\httpx\_client.py:1574: in request
    return await self.send(reque
```

## Action Required
- Fix: backend/peer_node.py
