import os
import json
import asyncio
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from db import db
from auth import auth_router, get_current_user, seed_admin, ensure_indexes
import agent_core
import agent_tools as T

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("javsh")

app = FastAPI(title="Javsh AI Agent")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "Javsh AI Agent API", "status": "online"}


# ---------------- Tasks ----------------
class TaskCreate(BaseModel):
    goal: str
    model: str = "claude"
    auto_start: bool = True


class ApprovalInput(BaseModel):
    decision: str  # once | always | reject


def public_task(t: dict) -> dict:
    t.pop("_id", None)
    return t


@api.post("/tasks")
async def create_task(data: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": task_id,
        "user_id": user["id"],
        "goal": data.goal,
        "model": data.model,
        "status": "queued",
        "progress": 0,
        "current_action": "Queued",
        "plan": [],
        "allowed_tools": [],
        "artifacts": [],
        "result": None,
        "pending_approval": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(dict(doc))
    if data.auto_start:
        asyncio.create_task(agent_core.run_task(task_id))
    return public_task(doc)


@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tasks


@api.get("/tasks/{task_id}")
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t


@api.post("/tasks/{task_id}/start")
async def start_task(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    if t["status"] in ("running", "awaiting_approval"):
        return {"ok": True, "already": True}
    asyncio.create_task(agent_core.run_task(task_id))
    return {"ok": True}


@api.post("/tasks/{task_id}/stop")
async def stop_task(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    agent_core.STOP_FLAGS[task_id] = True
    agent_core.resolve_decision(task_id, "reject")
    return {"ok": True}


@api.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, data: ApprovalInput, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    decision = "always" if data.decision == "always" else ("once" if data.decision == "once" else "reject")
    agent_core.resolve_decision(task_id, decision)
    return {"ok": True, "decision": decision}


@api.get("/tasks/{task_id}/events")
async def task_events(task_id: str, request: Request):
    # Auth via cookie/header (SSE-friendly)
    user = await get_current_user(request)
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    q: asyncio.Queue = asyncio.Queue()
    agent_core.QUEUES[task_id] = q

    async def gen():
        # replay history first
        history = await db.task_events.find({"task_id": task_id}, {"_id": 0}).sort("seq", 1).to_list(1000)
        for ev in history:
            yield f"data: {json.dumps(ev)}\n\n"
        # then live
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(ev)}\n\n"
                    if ev.get("type") == "status" and ev.get("data", {}).get("status") in ("completed", "error", "stopped"):
                        yield f"data: {json.dumps({'type': 'done'})}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            if agent_core.QUEUES.get(task_id) is q:
                agent_core.QUEUES.pop(task_id, None)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                                      "Connection": "keep-alive"})


@api.get("/tasks/{task_id}/timeline")
async def task_timeline(task_id: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    events = await db.task_events.find({"task_id": task_id}, {"_id": 0}).sort("seq", 1).to_list(1000)
    return events


@api.get("/tasks/{task_id}/files/{filename}")
async def download_file(task_id: str, filename: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    p = T.workspace_for(task_id) / Path(filename).name
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(p), filename=p.name)


# ---------------- Devices (MVP registry) ----------------
class DeviceConnect(BaseModel):
    name: str
    platform: str  # android | ios | desktop


@api.post("/devices/connect")
async def connect_device(data: DeviceConnect, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": data.name,
        "platform": data.platform,
        "status": "pending",
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.devices.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api.get("/devices")
async def list_devices(user: dict = Depends(get_current_user)):
    return await db.devices.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)


@api.delete("/devices/{device_id}")
async def delete_device(device_id: str, user: dict = Depends(get_current_user)):
    await db.devices.delete_one({"id": device_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------- Settings / permissions ----------------
class SettingsInput(BaseModel):
    default_model: Optional[str] = None
    approval_for_medium: Optional[bool] = None
    theme: Optional[str] = None


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        s = {"user_id": user["id"], "default_model": "claude",
             "approval_for_medium": False, "theme": "dark"}
    return s


@api.put("/settings")
async def update_settings(data: SettingsInput, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["user_id"] = user["id"]
    await db.settings.update_one({"user_id": user["id"]}, {"$set": update}, upsert=True)
    return await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})


app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_admin()
    logger.info("Javsh AI Agent started")


@app.on_event("shutdown")
async def shutdown():
    pass
