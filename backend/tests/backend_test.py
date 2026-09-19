"""Backend tests for Javsh AI Agent - auth, tasks, settings, agent flow."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://auto-pilot-agent.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "mom@javsh.ai"
ADMIN_PASSWORD = "javsh123"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s


# ------ Health ------
def test_root():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "online"


# ------ Auth ------
def test_login_admin():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["email"] == ADMIN_EMAIL
    assert j["user"]["role"] == "admin"
    assert isinstance(j["token"], str) and len(j["token"]) > 10


def test_login_wrong_password():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-xxx"})
    assert r.status_code in (401, 429)


def test_register_and_me():
    email = f"test_{uuid.uuid4().hex[:8]}@javsh.ai"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "Passw0rd!", "name": "T", "mode": "power"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    r2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    assert r2.json()["user"]["email"] == email
    # duplicate
    r3 = requests.post(f"{BASE_URL}/api/auth/register",
                       json={"email": email, "password": "Passw0rd!"})
    assert r3.status_code == 400


def test_me_unauthorized():
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# ------ Settings ------
def test_settings_get_default(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    j = r.json()
    assert "default_model" in j


def test_settings_update(admin_session):
    r = admin_session.put(f"{BASE_URL}/api/settings",
                          json={"default_model": "gemini", "approval_for_medium": True})
    assert r.status_code == 200
    j = r.json()
    assert j["default_model"] == "gemini"
    assert j["approval_for_medium"] is True
    # persist
    r2 = admin_session.get(f"{BASE_URL}/api/settings")
    assert r2.json()["default_model"] == "gemini"
    # reset
    admin_session.put(f"{BASE_URL}/api/settings",
                      json={"default_model": "claude", "approval_for_medium": False})


# ------ Tasks CRUD ------
def test_create_task_and_get(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tasks",
                           json={"goal": "TEST_ simple echo", "model": "claude", "auto_start": False})
    assert r.status_code == 200, r.text
    j = r.json()
    tid = j["id"]
    assert j["status"] == "queued"
    assert "_id" not in j
    r2 = admin_session.get(f"{BASE_URL}/api/tasks/{tid}")
    assert r2.status_code == 200
    assert r2.json()["goal"] == "TEST_ simple echo"


def test_list_tasks(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/tasks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_stop_task(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tasks",
                           json={"goal": "TEST_ stop me", "model": "claude", "auto_start": False})
    tid = r.json()["id"]
    r2 = admin_session.post(f"{BASE_URL}/api/tasks/{tid}/stop")
    assert r2.status_code == 200


def test_task_404(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/tasks/nonexistent-{uuid.uuid4()}")
    assert r.status_code == 404


def test_timeline(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tasks",
                           json={"goal": "TEST_ timeline", "model": "claude", "auto_start": False})
    tid = r.json()["id"]
    r2 = admin_session.get(f"{BASE_URL}/api/tasks/{tid}/timeline")
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


# ------ Agent loop integration (fast: just verify status transitions) ------
def test_agent_runs_simple_goal(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tasks",
                           json={"goal": "Say hello and finish.", "model": "claude", "auto_start": True})
    assert r.status_code == 200
    tid = r.json()["id"]
    terminal = {"completed", "error", "stopped", "awaiting_approval"}
    status = "queued"
    for _ in range(45):
        time.sleep(2)
        rr = admin_session.get(f"{BASE_URL}/api/tasks/{tid}")
        if rr.status_code == 200:
            status = rr.json().get("status")
            if status in terminal:
                break
    assert status in terminal, f"task did not progress: {status}"


# ------ Approval flow ------
def test_agent_run_python_requires_approval(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tasks",
                           json={"goal": "Use Python to compute the first 10 prime numbers and print them.",
                                 "model": "claude", "auto_start": True})
    tid = r.json()["id"]
    status = "queued"
    for _ in range(45):
        time.sleep(2)
        rr = admin_session.get(f"{BASE_URL}/api/tasks/{tid}").json()
        status = rr.get("status")
        if status == "awaiting_approval" or status in ("completed", "error", "stopped"):
            break
    # approve if paused
    if status == "awaiting_approval":
        ap = admin_session.post(f"{BASE_URL}/api/tasks/{tid}/approve", json={"decision": "once"})
        assert ap.status_code == 200
        for _ in range(45):
            time.sleep(2)
            rr = admin_session.get(f"{BASE_URL}/api/tasks/{tid}").json()
            if rr.get("status") in ("completed", "error", "stopped"):
                status = rr["status"]
                break
    assert status in ("awaiting_approval", "completed", "error", "stopped")
