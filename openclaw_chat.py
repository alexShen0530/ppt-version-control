import json
import os
import uuid

import websocket
from dotenv import load_dotenv
import config

load_dotenv()

OPENCLAW_WS_URL = config.OPENCLAW_WS_URL
OPENCLAW_TOKEN = config.OPENCLAW_TOKEN
OPENCLAW_SESSION_KEY = "agent:main:main"


def send_request(ws, method, params):
    request_id = str(uuid.uuid4())
    print(f"[发送] method={method}, id={request_id}", flush=True)
    ws.send(json.dumps({
        "type": "req",
        "id": request_id,
        "method": method,
        "params": params,
    }, ensure_ascii=False))
    return request_id


def receive_frame(ws):
    raw = ws.recv()
    print(f"[接收] {raw}", flush=True)
    return json.loads(raw)


def wait_response(ws, request_id):
    while True:
        frame = receive_frame(ws)
        if frame.get("type") == "res" and frame.get("id") == request_id:
            if not frame.get("ok"):
                raise RuntimeError(frame.get("error", frame))
            return frame.get("payload", {})


def message_text(message):
    content = (message or {}).get("content", "")
    if isinstance(content, str):
        return content
    return "".join(
        item.get("text", "")
        for item in content
        if isinstance(item, dict) and item.get("type") == "text"
    )


def chat(question):
    if not OPENCLAW_WS_URL or not OPENCLAW_TOKEN:
        raise RuntimeError("请在 .env 中配置 OPENCLAW_WS_URL 和 OPENCLAW_TOKEN")

    print("[连接] 正在建立 WebSocket 连接...", flush=True)
    ws = websocket.create_connection(OPENCLAW_WS_URL, timeout=120)
    print("[连接] WebSocket 已连接", flush=True)
    try:
        connect_id = send_request(ws, "connect", {
            "minProtocol": 4,
            "maxProtocol": 4,
            "role": "operator",
            "scopes": ["operator.read", "operator.write"],
            "client": {
                "id": "cli",
                "version": "1.0.0",
                "platform": "python",
                "mode": "operator",
            },
            "caps": [],
            "commands": [],
            "permissions": {},
            "auth": {"token": OPENCLAW_TOKEN},
        })
        wait_response(ws, connect_id)
        print("[握手] OpenClaw 鉴权成功", flush=True)

        send_id = send_request(ws, "chat.send", {
            "sessionKey": OPENCLAW_SESSION_KEY,
            "message": question,
            "deliver": False,
            "idempotencyKey": str(uuid.uuid4()),
        })
        send_result = wait_response(ws, send_id)
        run_id = send_result.get("runId")
        print(f"[任务] 已受理，runId={run_id}，等待回答...", flush=True)

        while True:
            frame = receive_frame(ws)
            if frame.get("type") != "event" or frame.get("event") != "chat":
                continue

            payload = frame.get("payload", {})
            if run_id and payload.get("runId") != run_id:
                continue
            if payload.get("state") == "final":
                return message_text(payload.get("message"))
            if payload.get("state") in {"error", "aborted"}:
                raise RuntimeError(payload.get("error") or payload.get("state"))
    finally:
        print("[连接] 关闭 WebSocket", flush=True)
        ws.close()


if __name__ == "__main__":
    question = input("问题: ").strip()
    if question:
        print("回答:", chat(question))
