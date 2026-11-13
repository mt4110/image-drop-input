import base64
import os
import socket
from urllib.parse import urlsplit

target = "veil-tell-pr-control.test:443"
proxy = urlsplit(os.environ["HTTPS_PROXY"])
token = base64.b64encode(f"{proxy.username}:{proxy.password}".encode()).decode()
with socket.create_connection((proxy.hostname, proxy.port), timeout=5) as conn:
    conn.sendall(
        f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
        f"Proxy-Authorization: Basic {token}\r\n\r\n".encode()
    )
    with conn.makefile("rb") as reply:
        status = reply.readline(1024).split()[1]
assert status == b"403", status
print(f"Control CONNECT {target}: HTTP 403")
