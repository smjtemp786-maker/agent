import React, { useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Terminal, Globe, Radio, Maximize2, Bot } from "lucide-react";
import { toolMeta } from "@/lib/toolMeta";

const STAGES = ["OBSERVE", "PLAN", "ACT", "VERIFY", "COMPLETE"];

function LoopViz({ stage, running }) {
  const activeIdx = STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      {STAGES.map((s, i) => {
        const active = i === activeIdx && running;
        const done = i < activeIdx || (!running && stage === "COMPLETE");
        return (
          <React.Fragment key={s}>
            <div
              className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                active ? "border-primary bg-primary/15 text-primary animate-pulse"
                : done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-accent"
                : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {i < STAGES.length - 1 && <div className="h-px w-3 bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CenterPreviewPane({ screen, running, stage, events, currentAction }) {
  const [tab, setTab] = useState("screen");
  const toolLogs = events.filter((e) => ["tool", "tool_start", "reasoning"].includes(e.type));

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      <div className="h-11 shrink-0 border-b border-border/60 px-3 flex items-center justify-between glass">
        <div className="flex gap-1">
          {[
            { id: "screen", label: "Live Screen", icon: Monitor },
            { id: "log", label: "Activity Log", icon: Terminal },
          ].map((t) => (
            <button
              key={t.id} data-testid={`view-tab-${t.id}`} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                tab === t.id ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {running && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 live-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </div>
        )}
      </div>

      {tab === "screen" && (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* URL bar */}
          <div className="flex items-center gap-2 rounded-t-xl border border-border bg-card px-3 py-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <div className="flex-1 flex items-center gap-2 bg-elevated rounded-md px-2.5 py-1 text-xs text-muted-foreground font-mono truncate">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{screen?.url || "about:blank"}</span>
            </div>
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          <div className="flex-1 rounded-b-xl border border-t-0 border-border bg-elevated overflow-hidden relative flex items-center justify-center">
            {screen?.image ? (
              <motion.img
                key={screen.image.slice(0, 32)}
                initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}
                src={`data:image/jpeg;base64,${screen.image}`}
                alt="Live agent screen" data-testid="live-screen-image"
                className="w-full h-full object-contain object-top"
              />
            ) : (
              <div className="text-center px-6 agent-grid w-full h-full flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className={`h-8 w-8 text-primary ${running ? "animate-pulse" : ""}`} />
                </div>
                <div className="font-heading font-semibold text-sm">
                  {running ? currentAction || "Agent is working…" : "Live computer preview"}
                </div>
                <div className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {running ? "The browser view appears here as the agent works."
                   : "Start a task to watch the agent operate the browser in real time."}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3">
            <LoopViz stage={stage} running={running} />
          </div>
        </div>
      )}

      {tab === "log" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 font-mono text-xs space-y-1.5 bg-[#0a0d16] dark:bg-[#0a0d16]">
          {toolLogs.length === 0 && <div className="text-muted-foreground">No activity yet.</div>}
          {toolLogs.map((e, i) => {
            const t = new Date(e.ts).toLocaleTimeString();
            if (e.type === "reasoning") {
              const meta = toolMeta(e.data.action);
              return (
                <div key={i} className="text-slate-400">
                  <span className="text-slate-600">{t}</span>{" "}
                  <span className="text-purple-400">think</span>{" "}
                  {e.data.status} <span className="text-slate-600">({meta.label})</span>
                </div>
              );
            }
            if (e.type === "tool") {
              const meta = toolMeta(e.data.action);
              const err = e.data.result?.error;
              return (
                <div key={i} className={err ? "text-rose-400" : "text-emerald-400"}>
                  <span className="text-slate-600">{t}</span>{" "}
                  <span>{err ? "error" : "done"}</span>{" "}
                  {meta.label} {err ? `- ${err}` : ""}
                </div>
              );
            }
            return (
              <div key={i} className="text-sky-400">
                <span className="text-slate-600">{t}</span> run {toolMeta(e.data.action).label}…
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
