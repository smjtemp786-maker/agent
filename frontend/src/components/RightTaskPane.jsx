import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Clock, CheckCircle2, Loader2, XCircle, ListTree, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toolMeta, RISK_STYLE } from "@/lib/toolMeta";

const STATUS_META = {
  queued: { label: "Queued", cls: "text-muted-foreground bg-muted" },
  running: { label: "Running", cls: "text-primary bg-primary/10" },
  awaiting_approval: { label: "Needs Approval", cls: "text-amber-accent bg-amber-500/10" },
  completed: { label: "Completed", cls: "text-emerald-accent bg-emerald-500/10" },
  stopped: { label: "Stopped", cls: "text-muted-foreground bg-muted" },
  error: { label: "Error", cls: "text-rose-accent bg-rose-500/10" },
  idle: { label: "Idle", cls: "text-muted-foreground bg-muted" },
};

function ApprovalCard({ approval, onApprove, busy }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.06] p-4 shadow-lg"
      data-testid="approval-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <ShieldAlert className="h-4 w-4 text-amber-accent" />
        </div>
        <div>
          <div className="text-sm font-bold">Approval required</div>
          <div className="text-[10px] font-mono uppercase text-amber-accent">
            {approval.risk} risk action
          </div>
        </div>
      </div>
      <p className="text-[13px] text-foreground mb-1">The agent wants to:</p>
      <p className="text-[13px] font-medium mb-2">{approval.description}</p>
      {approval.details?.code && (
        <pre className="text-[10px] font-mono bg-card border border-border rounded-lg p-2 mb-3 max-h-28 overflow-auto scrollbar-thin whitespace-pre-wrap">
          {approval.details.code}
        </pre>
      )}
      <div className="grid grid-cols-1 gap-2">
        <Button size="sm" onClick={() => onApprove("once")} disabled={busy} data-testid="allow-once-button" className="h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allow Once"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => onApprove("always")} disabled={busy} data-testid="allow-always-button" className="h-9">
            Allow Always
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onApprove("reject")} disabled={busy} data-testid="reject-button" className="h-9">
            Reject
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function RightTaskPane({ task, status, progress, currentAction, events, approval, onApprove, approveBusy }) {
  const sm = STATUS_META[status] || STATUS_META.idle;
  const steps = events.filter((e) => e.type === "reasoning");
  const running = status === "running" || status === "awaiting_approval";

  return (
    <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0 border-l border-border/70 flex flex-col bg-card/30">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Task Control</span>
        <span data-testid="task-status-badge" className={`text-[10px] font-semibold px-2 py-1 rounded-full ${sm.cls}`}>
          {sm.label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {!task && (
          <div className="text-center py-10">
            <ListTree className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No active task.<br />Start one from the console.</p>
          </div>
        )}

        {task && (
          <>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Goal</div>
              <div className="text-[13px] leading-snug line-clamp-3">{task.goal}</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                   : status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-accent" />
                   : status === "error" ? <XCircle className="h-3.5 w-3.5 text-rose-accent" />
                   : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span data-testid="current-action">{currentAction || "—"}</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <AnimatePresence>
              {approval && <ApprovalCard approval={approval} onApprove={onApprove} busy={approveBusy} />}
            </AnimatePresence>

            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <ListTree className="h-3 w-3" /> Execution Steps ({steps.length})
              </div>
              <div className="space-y-1.5" data-testid="execution-steps">
                {steps.length === 0 && <div className="text-xs text-muted-foreground">Planning…</div>}
                {steps.map((e, i) => {
                  const meta = toolMeta(e.data.action);
                  const isLast = i === steps.length - 1;
                  const active = isLast && running;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`mt-0.5 h-5 w-5 rounded-md flex items-center justify-center shrink-0 border ${
                        active ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}>
                        {active ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                         : <CheckCircle2 className="h-3 w-3 text-emerald-accent" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium">{meta.label}</span>
                          <span className={`text-[9px] px-1 rounded border ${RISK_STYLE[e.data.risk] || RISK_STYLE.low}`}>
                            {e.data.risk}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{e.data.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Timeline
              </div>
              <div className="relative pl-4 space-y-2 border-l border-border/70">
                {events.filter((e) => ["status", "tool", "approval_required", "result"].includes(e.type)).map((e, i) => {
                  const t = new Date(e.ts).toLocaleTimeString();
                  let label = "";
                  if (e.type === "status") label = e.data.message;
                  else if (e.type === "tool") label = `${toolMeta(e.data.action).label} ${e.data.result?.error ? "failed" : "done"}`;
                  else if (e.type === "approval_required") label = `Approval requested: ${e.data.action}`;
                  else if (e.type === "result") label = "Final result ready";
                  return (
                    <div key={i} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                      <div className="text-[11px] leading-tight">{label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{t}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {status === "error" && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-accent shrink-0 mt-0.5" />
                <div className="text-[12px]">{task.result || "An error occurred."}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
