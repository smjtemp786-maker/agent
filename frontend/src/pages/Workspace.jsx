import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import TopNav from "@/components/TopNav";
import LeftChatPane from "@/components/LeftChatPane";
import CenterPreviewPane from "@/components/CenterPreviewPane";
import RightTaskPane from "@/components/RightTaskPane";
import HistorySheet from "@/components/HistorySheet";
import SettingsDialog from "@/components/SettingsDialog";
import AboutDialog from "@/components/AboutDialog";
import { API, tasks as tasksApi } from "@/lib/apiClient";
import { toast } from "sonner";

const TERMINAL = ["completed", "error", "stopped"];

export default function Workspace() {
  const [goal, setGoal] = useState("");
  const [model, setModel] = useState("claude");

  const [task, setTask] = useState(null);
  const [events, setEvents] = useState([]);
  const [screen, setScreen] = useState(null);
  const [status, setStatus] = useState("idle");
  const [currentAction, setCurrentAction] = useState("");
  const [approval, setApproval] = useState(null);
  const [result, setResult] = useState(null);
  const [approveBusy, setApproveBusy] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const esRef = useRef(null);
  const running = status === "running" || status === "awaiting_approval" || status === "queued";

  const closeStream = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
  };
  useEffect(() => () => closeStream(), []);

  const applyEvent = useCallback((ev) => {
    if (ev.type === "done") { closeStream(); setHistoryKey((k) => k + 1); return; }
    setEvents((prev) => [...prev, ev]);
    switch (ev.type) {
      case "status":
        setStatus(ev.data.status);
        if (ev.data.message) setCurrentAction(ev.data.message);
        if (ev.data.status === "running") setApproval(null);
        if (TERMINAL.includes(ev.data.status)) { setApproval(null); }
        break;
      case "reasoning":
        setCurrentAction(ev.data.status);
        setStatus((s) => (s === "awaiting_approval" ? s : "running"));
        break;
      case "screen":
        setScreen(ev.data);
        break;
      case "tool":
        setApproval(null);
        break;
      case "approval_required":
        setApproval(ev.data);
        setStatus("awaiting_approval");
        break;
      case "result":
        setResult({ summary: ev.data.summary, artifacts: ev.data.artifacts || [] });
        break;
      default:
        break;
    }
  }, []);

  const openStream = useCallback((id) => {
    closeStream();
    const es = new EventSource(`${API}/tasks/${id}/events`, { withCredentials: true });
    es.onmessage = (e) => {
      try { applyEvent(JSON.parse(e.data)); } catch (err) {}
    };
    es.onerror = () => { /* keep-alive; browser auto-reconnects */ };
    esRef.current = es;
  }, [applyEvent]);

  const resetState = () => {
    setEvents([]); setScreen(null); setApproval(null); setResult(null);
    setCurrentAction(""); setStatus("idle");
  };

  const startTask = async () => {
    if (!goal.trim()) return;
    resetState();
    setStatus("queued");
    try {
      const { data } = await tasksApi.create(goal.trim(), model);
      setTask(data);
      setGoal("");
      openStream(data.id);
      setHistoryKey((k) => k + 1);
    } catch (e) {
      toast.error("Could not start task");
      setStatus("idle");
    }
  };

  const stopTask = async () => {
    if (!task) return;
    try { await tasksApi.stop(task.id); } catch (e) {}
    setStatus("stopped");
    closeStream();
  };

  const onApprove = async (decision) => {
    if (!task) return;
    setApproveBusy(true);
    try {
      await tasksApi.approve(task.id, decision);
      setApproval(null);
      if (decision !== "reject") setStatus("running");
    } catch (e) {
      toast.error("Could not send decision");
    } finally {
      setApproveBusy(false);
    }
  };

  const selectTask = async (t) => {
    closeStream();
    resetState();
    setTask(t);
    setStatus(t.status);
    setCurrentAction(t.current_action || "");
    try {
      const { data } = await tasksApi.timeline(t.id);
      data.forEach((ev) => {
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "screen") setScreen(ev.data);
        if (ev.type === "result") setResult({ summary: ev.data.summary, artifacts: ev.data.artifacts || [] });
        if (ev.type === "approval_required") setApproval(ev.data);
      });
    } catch (e) {}
    if (!TERMINAL.includes(t.status)) openStream(t.id);
    else setApproval(null);
  };

  const newTask = () => { closeStream(); resetState(); setTask(null); setGoal(""); };

  const feed = useMemo(() => {
    const items = [];
    if (task) items.push({ kind: "goal", text: task.goal });
    events.forEach((e) => {
      if (e.type === "reasoning") items.push({ kind: "reasoning", ...e.data });
      else if (e.type === "tool") items.push({ kind: "tool", ...e.data });
    });
    return items;
  }, [events, task]);

  const progress = useMemo(() => {
    if (status === "completed") return 100;
    const steps = events.filter((e) => e.type === "reasoning").length;
    return Math.min(95, steps * 6 + (running ? 5 : 0));
  }, [events, status, running]);

  const stage = useMemo(() => {
    if (status === "completed") return "COMPLETE";
    const steps = events.filter((e) => e.type === "reasoning").length;
    if (steps <= 1) return "PLAN";
    if (status === "awaiting_approval") return "ACT";
    return running ? "ACT" : "OBSERVE";
  }, [events, status, running]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <TopNav
        running={running}
        onNew={newTask}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <LeftChatPane
          goal={goal} setGoal={setGoal} model={model} setModel={setModel}
          running={running} onStart={startTask} onStop={stopTask}
          feed={feed} result={result} taskId={task?.id} hasTask={!!task}
        />
        <div className="hidden md:flex flex-1 min-w-0">
          <CenterPreviewPane
            screen={screen} running={running} stage={stage} events={events} currentAction={currentAction}
          />
        </div>
        <div className="hidden lg:flex">
          <RightTaskPane
            task={task} status={status} progress={progress} currentAction={currentAction}
            events={events} approval={approval} onApprove={onApprove} approveBusy={approveBusy}
          />
        </div>
      </div>

      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} onSelect={selectTask} refreshKey={historyKey} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}
