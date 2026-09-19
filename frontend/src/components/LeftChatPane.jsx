import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Square, Bot, User, Sparkles, Brain, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toolMeta, RISK_STYLE, EXT_ICON } from "@/lib/toolMeta";
import { tasks as tasksApi } from "@/lib/apiClient";

const MODELS = [
  { id: "claude", label: "Claude Sonnet 4.6", tag: "Default" },
  { id: "gemini", label: "Gemini 3.1 Pro", tag: "Fast" },
];

const EXAMPLES = [
  "Search the web for the latest remote React developer jobs and build an Excel sheet with company, role and URL.",
  "Research the top 5 electric cars of 2026 and create a comparison PDF report.",
  "Find current weather in London, Tokyo and New York and save it to a CSV file.",
];

function GoalBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="flex gap-2 max-w-[85%] flex-row-reverse">
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-white" />
        </div>
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm">
          {text}
        </div>
      </div>
    </div>
  );
}

function ReasoningItem({ item }) {
  const meta = toolMeta(item.action);
  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 rounded-full bg-elevated border border-border flex items-center justify-center shrink-0">
        <Brain className="h-3.5 w-3.5 text-purple-accent" />
      </div>
      <div className="space-y-1.5 max-w-[90%]">
        <div className="text-[13px] leading-relaxed text-foreground">{item.thought}</div>
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${RISK_STYLE[item.risk] || RISK_STYLE.low}`}>
          <meta.icon className="h-3 w-3" /> {item.status}
        </div>
      </div>
    </div>
  );
}

function ToolResultCard({ item }) {
  const meta = toolMeta(item.action);
  const res = item.result || {};
  let summary = "";
  if (res.error) summary = `⚠ ${res.error}`;
  else if (res.results) summary = `${res.results.length} results found`;
  else if (res.links) summary = `${res.links.length} links collected`;
  else if (res.rows !== undefined) summary = `${res.rows} rows written`;
  else if (res.filename) summary = `Saved ${res.filename}`;
  else if (res.text) summary = `${res.text.length} chars read`;
  else if (res.url) summary = res.url;
  else if (res.exit_code !== undefined) summary = `exit ${res.exit_code}`;
  return (
    <div className="ml-9 rounded-xl border border-border bg-card/60 px-3 py-2 flex items-center gap-2">
      <div className="h-6 w-6 rounded-md bg-elevated flex items-center justify-center shrink-0">
        <meta.icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium">{meta.label}</div>
        <div className="text-[11px] text-muted-foreground font-mono truncate">{summary}</div>
      </div>
    </div>
  );
}

function ResultCard({ result, taskId }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
      <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="space-y-2 max-w-[90%]">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed">
          {result.summary}
        </div>
        {result.artifacts?.length > 0 && (
          <div className="space-y-1.5">
            {result.artifacts.map((a) => {
              const Icon = EXT_ICON[a.ext] || Download;
              return (
                <a
                  key={a.name} href={tasksApi.fileUrl(taskId, a.name)} target="_blank" rel="noreferrer"
                  data-testid={`artifact-${a.name}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 hover:border-primary transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function LeftChatPane({
  goal, setGoal, model, setModel, running, onStart, onStop, feed, result, taskId, hasTask,
}) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [feed, result]);

  return (
    <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-border/70 flex flex-col bg-card/30">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Agent Console</span>
        <div className="flex gap-1 p-0.5 bg-elevated rounded-lg">
          {MODELS.map((m) => (
            <button
              key={m.id} data-testid={`model-${m.id}`} onClick={() => !running && setModel(m.id)}
              disabled={running}
              className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                model === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
              title={m.label}
            >
              {m.id === "claude" ? "Claude 4.6" : "Gemini 3.1"}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {!hasTask && (
          <div className="h-full flex flex-col items-center justify-center text-center px-2 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">What should I do for you?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Describe a goal in plain words. I'll handle the steps.
              </p>
            </div>
            <div className="w-full space-y-2 mt-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i} data-testid={`example-${i}`} onClick={() => setGoal(ex)}
                  className="w-full text-left text-[12px] leading-snug rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {feed.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {item.kind === "goal" && <GoalBubble text={item.text} />}
              {item.kind === "reasoning" && <ReasoningItem item={item} />}
              {item.kind === "tool" && <ToolResultCard item={item} />}
            </motion.div>
          ))}
        </AnimatePresence>
        {result && <ResultCard result={result} taskId={taskId} />}
      </div>

      <div className="p-3 border-t border-border/60">
        <div className="relative rounded-2xl border border-border bg-card focus-within:border-primary transition-colors">
          <Textarea
            data-testid="goal-input" value={goal} onChange={(e) => setGoal(e.target.value)}
            placeholder="Give the agent a goal…" disabled={running}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !running) { e.preventDefault(); onStart(); }
            }}
            className="min-h-[64px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 text-sm pr-12"
          />
          <div className="absolute right-2 bottom-2">
            {running ? (
              <Button size="icon" variant="destructive" onClick={onStop} data-testid="stop-agent-button" className="h-9 w-9 rounded-xl">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon" onClick={onStart} disabled={!goal.trim()} data-testid="start-agent-button"
                className="h-9 w-9 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
