import os
import json
import asyncio
import re
from datetime import datetime, timezone

from db import db
import agent_tools as T

MODEL_MAP = {
    "claude": ("anthropic", "claude-sonnet-4-6"),
    "gemini": ("gemini", "gemini-3.1-pro-preview"),
}

MAX_STEPS = 16

# In-memory runtime state (per running task)
QUEUES: dict = {}            # task_id -> asyncio.Queue for live SSE events
APPROVAL_EVENTS: dict = {}   # task_id -> asyncio.Event
APPROVAL_RESULT: dict = {}   # task_id -> decision string
STOP_FLAGS: dict = {}        # task_id -> bool
BROWSERS: dict = {}          # task_id -> BrowserSession

TOOL_CATALOG = """
BROWSER (real headless Chromium):
- browser_navigate {"url": "example.com"}  -> open a page
- browser_search {"query": "..."}          -> web search, returns result list
- browser_extract_text {}                  -> visible text of current page
- browser_extract_links {}                 -> links on current page
- browser_click {"text": "Next"}           -> click element containing text
- browser_type {"selector": "input[name=q]", "text": "..."}
- browser_screenshot {}                    -> capture current screen

FILES (task workspace):
- file_list {}
- file_read {"filename": "data.txt"}
- file_write {"filename": "notes.txt", "content": "..."}

DOCUMENTS:
- create_csv {"filename": "jobs.csv", "columns": ["A","B"], "rows": [["1","2"], ...]}
- create_xlsx {"filename": "jobs.xlsx", "columns": [...], "rows": [[...], ...]}
- create_docx {"filename": "report.docx", "title": "...", "content": "line1\\nline2"}
- create_pdf {"filename": "report.pdf", "title": "...", "content": "..."}

CODE (sandboxed python, 60s):
- run_python {"code": "print(1+1)"}   (HIGH RISK - requires human approval)

FINISH:
- finish {"summary": "what you accomplished for the user"}
"""

SYSTEM_TEMPLATE = """You are Javsh AI Agent, an autonomous computer-use agent that completes real multi-step tasks for users.

You operate in a strict loop: OBSERVE -> THINK/PLAN -> ACT -> OBSERVE -> VERIFY -> COMPLETE.
Each turn you MUST respond with ONE single JSON object and NOTHING else:

{{
  "thought": "one short sentence of safe reasoning (no secrets, no private chain-of-thought dumps)",
  "status": "a 2-5 word user-facing status like 'Searching the web'",
  "action": "<tool_name>",
  "action_input": {{ ... }}
}}

Available tools:
{tools}

Rules:
- Use real tools to actually accomplish the goal. Do NOT fabricate data — extract it from real pages.
- Prefer browser_search then browser_navigate + browser_extract_text/links to gather real information.
- When you have gathered enough data, produce the requested artifact (csv/xlsx/docx/pdf).
- VERIFY your work (e.g. file_list to confirm a file exists) before finishing.
- When the goal is fully done, use the "finish" action with a helpful summary.
- Keep going step by step; never output multiple JSON objects. Output ONLY the JSON object.
"""


async def emit(task_id: str, etype: str, data: dict):
    seq = int(datetime.now(timezone.utc).timestamp() * 1000)
    doc = {"task_id": task_id, "seq": seq, "type": etype, "data": data,
           "ts": datetime.now(timezone.utc).isoformat()}
    await db.task_events.insert_one({k: v for k, v in doc.items()})
    doc.pop("_id", None)
    q = QUEUES.get(task_id)
    if q:
        await q.put(doc)


async def set_task(task_id: str, **fields):
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({"id": task_id}, {"$set": fields})


def parse_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = text.rstrip("`").rstrip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


async def execute_tool(task_id: str, action: str, ai: dict):
    if action.startswith("browser_"):
        bs = BROWSERS.get(task_id)
        if not bs:
            bs = T.BrowserSession()
            BROWSERS[task_id] = bs
        if action == "browser_navigate":
            res = await bs.navigate(ai.get("url", ""))
        elif action == "browser_search":
            res = await bs.search(ai.get("query", ""))
        elif action == "browser_extract_text":
            res = await bs.extract_text()
        elif action == "browser_extract_links":
            res = await bs.extract_links()
        elif action == "browser_click":
            res = await bs.click(ai.get("text", ""))
        elif action == "browser_type":
            res = await bs.type_text(ai.get("selector", ""), ai.get("text", ""))
        elif action == "browser_screenshot":
            res = {"captured": True}
        else:
            res = {"error": "unknown browser tool"}
        # push a live screenshot to the center pane after every browser action
        try:
            shot = await bs.screenshot_b64()
            await emit(task_id, "screen", {"image": shot, "url": getattr(bs.page, "url", "")})
        except Exception:
            pass
        return res

    if action == "file_list":
        return T.file_list(task_id)
    if action == "file_read":
        return T.file_read(task_id, ai.get("filename", ""))
    if action == "file_write":
        return T.file_write(task_id, ai.get("filename", "note.txt"), ai.get("content", ""))
    if action == "create_csv":
        return T.create_csv(task_id, ai.get("filename", "data.csv"), ai.get("columns", []), ai.get("rows", []))
    if action == "create_xlsx":
        return T.create_xlsx(task_id, ai.get("filename", "data.xlsx"), ai.get("columns", []), ai.get("rows", []))
    if action == "create_docx":
        return T.create_docx(task_id, ai.get("filename", "report.docx"), ai.get("title", ""), ai.get("content", ""))
    if action == "create_pdf":
        return T.create_pdf(task_id, ai.get("filename", "report.pdf"), ai.get("title", ""), ai.get("content", ""))
    if action == "run_python":
        return T.run_python(task_id, ai.get("code", ""))
    return {"error": f"Unknown tool: {action}"}


async def request_approval(task_id: str, action: str, ai: dict, risk: str):
    descriptions = {
        "run_python": "Execute Python code in the sandbox terminal",
        "file_delete": "Delete a file from the workspace",
    }
    approval = {
        "action": action,
        "risk": risk,
        "description": descriptions.get(action, f"Run tool: {action}"),
        "details": ai,
    }
    await set_task(task_id, status="awaiting_approval", pending_approval=approval)
    await emit(task_id, "approval_required", approval)

    ev = asyncio.Event()
    APPROVAL_EVENTS[task_id] = ev
    try:
        await asyncio.wait_for(ev.wait(), timeout=300)
    except asyncio.TimeoutError:
        return "reject"
    finally:
        APPROVAL_EVENTS.pop(task_id, None)
    decision = APPROVAL_RESULT.pop(task_id, "reject")
    await set_task(task_id, status="running", pending_approval=None)
    return decision


def resolve_decision(task_id: str, decision: str):
    APPROVAL_RESULT[task_id] = decision
    ev = APPROVAL_EVENTS.get(task_id)
    if ev:
        ev.set()


async def run_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        return
    STOP_FLAGS[task_id] = False
    provider, model = MODEL_MAP.get(task.get("model", "claude"), MODEL_MAP["claude"])
    allowed_always = set(task.get("allowed_tools", []))

    await set_task(task_id, status="running", progress=5, current_action="Planning the task")
    await emit(task_id, "status", {"status": "running", "stage": "PLAN", "message": "Understanding your goal"})

    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"task-{task_id}",
        system_message=SYSTEM_TEMPLATE.format(tools=TOOL_CATALOG),
    ).with_model(provider, model)

    async def complete(text):
        out = []
        async for ev in chat.stream_message(UserMessage(text=text)):
            if isinstance(ev, TextDelta):
                out.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        return "".join(out)

    observation = (
        f"USER GOAL: {task['goal']}\n\n"
        "Begin now. Respond with a single JSON object choosing your first action."
    )

    try:
        for step in range(1, MAX_STEPS + 1):
            if STOP_FLAGS.get(task_id):
                await set_task(task_id, status="stopped", current_action="Stopped by user")
                await emit(task_id, "status", {"status": "stopped", "message": "Agent stopped by user"})
                return

            raw = await complete(observation)
            parsed = parse_json(raw)
            if not parsed or "action" not in parsed:
                observation = ("Your last reply was not a valid single JSON object. "
                               "Respond ONLY with the required JSON object.")
                continue

            action = parsed.get("action")
            ai = parsed.get("action_input", {}) or {}
            thought = parsed.get("thought", "")
            status_msg = parsed.get("status", action)
            risk = T.TOOL_RISK.get(action, "low")

            progress = min(90, int(step / MAX_STEPS * 90) + 5)
            await set_task(task_id, current_action=status_msg, progress=progress)
            await emit(task_id, "reasoning", {"step": step, "thought": thought,
                                              "status": status_msg, "action": action, "risk": risk})

            if action == "finish":
                summary = ai.get("summary", "Task complete.")
                artifacts = T.scan_artifacts(task_id)
                await set_task(task_id, status="completed", progress=100,
                               current_action="Completed", result=summary, artifacts=artifacts)
                await emit(task_id, "result", {"summary": summary, "artifacts": artifacts})
                await emit(task_id, "status", {"status": "completed", "message": "Task completed"})
                return

            # Human approval gate
            if action in T.APPROVAL_REQUIRED and action not in allowed_always:
                await emit(task_id, "status", {"status": "awaiting_approval",
                                               "message": f"Approval required: {action}"})
                decision = await request_approval(task_id, action, ai, risk)
                if decision == "reject":
                    await emit(task_id, "tool", {"action": action, "risk": risk,
                               "approved": False, "result": {"rejected": True}})
                    observation = (f"The user REJECTED the '{action}' action. "
                                   "Do not attempt it again. Find an alternative approach or finish.")
                    continue
                if decision == "always":
                    allowed_always.add(action)
                    await set_task(task_id, allowed_tools=list(allowed_always))
                await emit(task_id, "status", {"status": "running", "message": "Approved, continuing"})

            # Execute
            await emit(task_id, "tool_start", {"action": action, "risk": risk, "input": ai})
            try:
                result = await execute_tool(task_id, action, ai)
            except Exception as e:
                result = {"error": str(e)[:400]}

            artifacts = T.scan_artifacts(task_id)
            if artifacts:
                await set_task(task_id, artifacts=artifacts)
            await emit(task_id, "tool", {"action": action, "risk": risk, "approved": True,
                                         "result": result, "artifacts": artifacts})

            obs_result = json.dumps(result)[:5000]
            observation = (f"OBSERVATION from {action}: {obs_result}\n\n"
                           "Verify progress, then respond with your next single JSON action "
                           "(or 'finish' if the goal is fully achieved).")

        # ran out of steps
        artifacts = T.scan_artifacts(task_id)
        await set_task(task_id, status="completed", progress=100,
                       current_action="Reached step limit",
                       result="Reached the maximum number of steps. See artifacts and timeline.",
                       artifacts=artifacts)
        await emit(task_id, "result", {"summary": "Reached step limit.", "artifacts": artifacts})
        await emit(task_id, "status", {"status": "completed", "message": "Finished (step limit)"})
    except Exception as e:
        await set_task(task_id, status="error", current_action="Error", result=str(e)[:500])
        await emit(task_id, "status", {"status": "error", "message": str(e)[:300]})
    finally:
        bs = BROWSERS.pop(task_id, None)
        if bs:
            await bs.close()
        STOP_FLAGS.pop(task_id, None)
