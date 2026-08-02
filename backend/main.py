"""
灵垛（LingDuo）后端入口
FastAPI + AgentScope 2.0 + @cratefit/pack MCP 工具
"""
import json
import logging
import os
import sys

# 确保 backend 目录在最前面，避免 tools 包名冲突
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from agent import PackAgent
from pack_api import calculate_packing, compare_algorithms, get_pallet_standards, get_container_standards

load_dotenv()
logger = logging.getLogger(__name__)

app = FastAPI(title="灵垛 LingDuo Agent API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

_agent: PackAgent | None = None
ITEM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]


def get_agent() -> PackAgent:
    global _agent
    if _agent is None:
        _agent = PackAgent()
    return _agent


# ============================================================================
# SSE Chat — 核心接口，AIChatPanel 调用
# ============================================================================


async def _sse_chat(message: str, history: list[dict] | None = None):
    """SSE 事件流"""
    try:
        agent = get_agent()
        async for event in agent.chat(message, history=history):
            t = event["type"]
            c = event.get("content")

            if t == "text":
                yield f"event: thinking\ndata: {json.dumps({'text': c}, ensure_ascii=False)}\n\n"
            elif t == "config":
                # 为 items 添加颜色
                if isinstance(c, dict) and "items" in c:
                    for i, item in enumerate(c["items"]):
                        if "color" not in item:
                            item["color"] = ITEM_COLORS[i % len(ITEM_COLORS)]
                yield f"event: config\ndata: {json.dumps(c, ensure_ascii=False)}\n\n"
            elif t == "done":
                yield f"event: done\ndata: {json.dumps({'message': '完成'}, ensure_ascii=False)}\n\n"
            elif t == "error":
                yield f"event: error\ndata: {json.dumps({'message': c}, ensure_ascii=False)}\n\n"
                return
    except Exception as e:
        logger.exception("SSE error")
        yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"


@app.post("/api/chat")
async def chat(request: Request):
    """AI 对话接口 (SSE)"""
    body = await request.json()
    message = body.get("message", "").strip()
    history = body.get("history")
    if not message:
        return JSONResponse(status_code=400, content={"error": "消息不能为空"})

    return StreamingResponse(
        _sse_chat(message, history=history),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ============================================================================
# Direct Tool API
# ============================================================================


@app.post("/api/tools/{tool_name}")
async def call_tool(tool_name: str, request: Request):
    """直接调用工具"""
    body = await request.json()

    tools = {
        "calculate_packing": calculate_packing,
        "compare_algorithms": compare_algorithms,
        "get_pallet_standards": get_pallet_standards,
        "get_container_standards": get_container_standards,
    }

    if tool_name not in tools:
        return JSONResponse(status_code=404, content={"error": f"未知工具: {tool_name}"})

    try:
        result = tools[tool_name](**body)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "lingduo-agent"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
