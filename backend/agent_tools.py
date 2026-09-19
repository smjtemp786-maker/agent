import os
import asyncio
import base64
import subprocess
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).parent / "workspace"
WORKSPACE_ROOT.mkdir(exist_ok=True)

# Risk levels used by the approval system
TOOL_RISK = {
    "browser_navigate": "low",
    "browser_search": "low",
    "browser_extract_text": "low",
    "browser_extract_links": "low",
    "browser_click": "low",
    "browser_type": "medium",
    "browser_screenshot": "low",
    "file_list": "low",
    "file_read": "low",
    "file_write": "medium",
    "create_xlsx": "medium",
    "create_csv": "medium",
    "create_docx": "medium",
    "create_pdf": "medium",
    "run_python": "high",
    "finish": "low",
}

# Actions that always pause for human approval unless "allow always" granted
APPROVAL_REQUIRED = {"run_python"}

DOC_TOOLS = {"file_write", "create_xlsx", "create_csv", "create_docx", "create_pdf"}


def workspace_for(task_id: str) -> Path:
    p = WORKSPACE_ROOT / task_id
    p.mkdir(parents=True, exist_ok=True)
    return p


class BrowserSession:
    """One headless Chromium page per task, lazily launched."""

    def __init__(self):
        self._pw = None
        self.browser = None
        self.page = None

    async def _ensure(self):
        if self.page:
            return
        from playwright.async_api import async_playwright
        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        ctx = await self.browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        )
        self.page = await ctx.new_page()

    async def navigate(self, url: str):
        await self._ensure()
        if not url.startswith("http"):
            url = "https://" + url
        await self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(1.2)
        return {"url": self.page.url, "title": await self.page.title()}

    async def search(self, query: str):
        await self._ensure()
        url = "https://duckduckgo.com/html/?q=" + query.replace(" ", "+")
        await self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await asyncio.sleep(1.2)
        results = await self.page.evaluate(
            """() => {
                const out = [];
                document.querySelectorAll('.result__body, .result').forEach(r => {
                    const a = r.querySelector('.result__a, a.result__url, a');
                    const s = r.querySelector('.result__snippet');
                    if (a) out.push({title: a.innerText.trim(), url: a.href, snippet: s ? s.innerText.trim() : ''});
                });
                return out.slice(0, 15);
            }"""
        )
        return {"query": query, "results": results}

    async def extract_text(self):
        await self._ensure()
        text = await self.page.evaluate("() => document.body.innerText")
        return {"text": text[:6000], "url": self.page.url}

    async def extract_links(self):
        await self._ensure()
        links = await self.page.evaluate(
            """() => Array.from(document.querySelectorAll('a')).map(a => ({text: a.innerText.trim(), href: a.href})).filter(l => l.text && l.href).slice(0, 60)"""
        )
        return {"links": links, "url": self.page.url}

    async def click(self, text: str):
        await self._ensure()
        try:
            await self.page.get_by_text(text, exact=False).first.click(timeout=8000)
            await asyncio.sleep(1.0)
            return {"clicked": text, "url": self.page.url}
        except Exception as e:
            return {"error": f"Could not click '{text}': {str(e)[:200]}"}

    async def type_text(self, selector: str, text: str):
        await self._ensure()
        try:
            await self.page.fill(selector, text, timeout=8000)
            return {"typed": text, "selector": selector}
        except Exception as e:
            return {"error": f"Could not type into '{selector}': {str(e)[:200]}"}

    async def screenshot_b64(self):
        await self._ensure()
        raw = await self.page.screenshot(type="jpeg", quality=55, full_page=False)
        return base64.b64encode(raw).decode("ascii")

    async def close(self):
        try:
            if self.browser:
                await self.browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass
        self.page = None
        self.browser = None
        self._pw = None


# ---------- File tools ----------
def file_list(task_id: str):
    ws = workspace_for(task_id)
    return {"files": [f.name for f in ws.iterdir() if f.is_file()]}


def file_read(task_id: str, filename: str):
    p = workspace_for(task_id) / Path(filename).name
    if not p.exists():
        return {"error": "File not found"}
    return {"filename": p.name, "content": p.read_text(errors="ignore")[:6000]}


def file_write(task_id: str, filename: str, content: str):
    p = workspace_for(task_id) / Path(filename).name
    p.write_text(content)
    return {"filename": p.name, "bytes": p.stat().st_size}


# ---------- Document tools ----------
def create_csv(task_id: str, filename: str, columns, rows):
    import csv
    if not filename.endswith(".csv"):
        filename += ".csv"
    p = workspace_for(task_id) / Path(filename).name
    with open(p, "w", newline="") as f:
        w = csv.writer(f)
        if columns:
            w.writerow(columns)
        for r in rows:
            w.writerow(r if isinstance(r, list) else [r.get(c, "") for c in columns])
    return {"filename": p.name, "rows": len(rows)}


def create_xlsx(task_id: str, filename: str, columns, rows):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    if not filename.endswith(".xlsx"):
        filename += ".xlsx"
    p = workspace_for(task_id) / Path(filename).name
    wb = Workbook()
    ws = wb.active
    ws.title = "Data"
    if columns:
        ws.append(columns)
        for cell in ws[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="2563EB")
    for r in rows:
        ws.append(r if isinstance(r, list) else [r.get(c, "") for c in columns])
    for col in ws.columns:
        width = max((len(str(c.value)) for c in col if c.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(width + 4, 50)
    wb.save(p)
    return {"filename": p.name, "rows": len(rows)}


def create_docx(task_id: str, filename: str, title: str, content: str):
    from docx import Document
    if not filename.endswith(".docx"):
        filename += ".docx"
    p = workspace_for(task_id) / Path(filename).name
    doc = Document()
    if title:
        doc.add_heading(title, level=0)
    for para in str(content).split("\n"):
        if para.strip():
            doc.add_paragraph(para)
    doc.save(p)
    return {"filename": p.name}


def create_pdf(task_id: str, filename: str, title: str, content: str):
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    if not filename.endswith(".pdf"):
        filename += ".pdf"
    p = workspace_for(task_id) / Path(filename).name
    doc = SimpleDocTemplate(str(p), pagesize=letter)
    styles = getSampleStyleSheet()
    flow = []
    if title:
        flow.append(Paragraph(title, styles["Title"]))
        flow.append(Spacer(1, 12))
    for para in str(content).split("\n"):
        if para.strip():
            flow.append(Paragraph(para, styles["Normal"]))
            flow.append(Spacer(1, 6))
    doc.build(flow)
    return {"filename": p.name}


# ---------- Code execution (sandboxed to workspace) ----------
def run_python(task_id: str, code: str):
    ws = workspace_for(task_id)
    script = ws / "_agent_script.py"
    script.write_text(code)
    try:
        proc = subprocess.run(
            ["python", str(script)],
            cwd=str(ws), capture_output=True, text=True, timeout=60,
        )
        return {
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-2000:],
            "exit_code": proc.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Execution timed out (60s limit)"}
    except Exception as e:
        return {"error": str(e)[:400]}


ARTIFACT_EXTS = {".xlsx", ".csv", ".docx", ".pdf", ".txt", ".json", ".png", ".jpg", ".md", ".html"}


def scan_artifacts(task_id: str):
    ws = workspace_for(task_id)
    out = []
    for f in ws.iterdir():
        if f.is_file() and f.name != "_agent_script.py" and f.suffix.lower() in ARTIFACT_EXTS:
            out.append({"name": f.name, "size": f.stat().st_size, "ext": f.suffix.lower().lstrip(".")})
    return out
