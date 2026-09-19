import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bot, Heart, ShieldCheck, Globe, FileSpreadsheet, Terminal } from "lucide-react";

const RISK_TABLE = [
  { action: "Open website / Web search", level: "Auto", cls: "text-emerald-accent" },
  { action: "Read / list files", level: "Auto", cls: "text-emerald-accent" },
  { action: "Create files & documents", level: "Auto", cls: "text-emerald-accent" },
  { action: "Type into forms", level: "Medium", cls: "text-amber-accent" },
  { action: "Run code in terminal", level: "Ask", cls: "text-rose-accent" },
  { action: "Delete files / payments", level: "Confirm", cls: "text-rose-accent" },
];

export default function AboutDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            Javsh AI Agent
          </DialogTitle>
          <DialogDescription className="sr-only">About Javsh AI Agent and its permission policy</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An autonomous computer-use agent. Give it a goal in plain words — it plans, browses
            the real web, runs code, and builds your files, pausing to ask before anything risky.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{ i: Globe, t: "Browses web" }, { i: FileSpreadsheet, t: "Builds files" }, { i: Terminal, t: "Runs code" }].map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-2.5">
                <f.i className="h-4 w-4 mx-auto text-primary mb-1" />
                <div className="text-[10px]">{f.t}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-semibold flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Permission policy
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              {RISK_TABLE.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-[12px] ${i % 2 ? "bg-card" : "bg-elevated"}`}>
                  <span>{r.action}</span>
                  <span className={`font-mono text-[10px] font-semibold ${r.cls}`}>{r.level}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Heart className="h-3.5 w-3.5 text-rose-accent" />
            Dedicated to 90's Moms and the young generation.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
