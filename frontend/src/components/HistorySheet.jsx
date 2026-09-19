import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { tasks as tasksApi } from "@/lib/apiClient";
import { CheckCircle2, Loader2, XCircle, Square, Clock } from "lucide-react";

const ICON = {
  completed: { i: CheckCircle2, c: "text-emerald-accent" },
  running: { i: Loader2, c: "text-primary animate-spin" },
  awaiting_approval: { i: Clock, c: "text-amber-accent" },
  error: { i: XCircle, c: "text-rose-accent" },
  stopped: { i: Square, c: "text-muted-foreground" },
  queued: { i: Clock, c: "text-muted-foreground" },
};

export default function HistorySheet({ open, onOpenChange, onSelect, refreshKey }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (open) tasksApi.list().then((r) => setItems(r.data)).catch(() => {});
  }, [open, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[340px] sm:w-[380px] p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="font-heading">Task History</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto scrollbar-thin p-3 space-y-2 h-[calc(100vh-60px)]">
          {items.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No tasks yet.</div>}
          {items.map((t) => {
            const ic = ICON[t.status] || ICON.queued;
            return (
              <button
                key={t.id} data-testid={`history-item-${t.id}`}
                onClick={() => { onSelect(t); onOpenChange(false); }}
                className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-2">
                  <ic.i className={`h-4 w-4 mt-0.5 shrink-0 ${ic.c}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] line-clamp-2 leading-snug">{t.goal}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {t.model === "gemini" ? "Gemini 3.1" : "Claude 4.6"} · {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
