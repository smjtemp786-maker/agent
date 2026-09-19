import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import { Cpu, ShieldCheck } from "lucide-react";

export default function SettingsDialog({ open, onOpenChange }) {
  const [settings, setSettings] = useState({ default_model: "claude", approval_for_medium: false });

  useEffect(() => {
    if (open) api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [open]);

  const save = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.put("/settings", patch);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Could not save settings");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Settings & Permissions</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label className="flex items-center gap-1.5 mb-2 text-sm"><Cpu className="h-4 w-4 text-primary" /> Default model</Label>
            <div className="flex gap-2">
              {[{ id: "claude", l: "Claude Sonnet 4.6" }, { id: "gemini", l: "Gemini 3.1 Pro" }].map((m) => (
                <button
                  key={m.id} data-testid={`settings-model-${m.id}`}
                  onClick={() => save({ default_model: m.id })}
                  className={`flex-1 text-xs font-medium py-2 rounded-xl border transition-colors ${
                    settings.default_model === m.id ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  {m.l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <div className="text-sm font-medium">Ask before medium-risk actions</div>
                <div className="text-[11px] text-muted-foreground">Typing into forms, downloads</div>
              </div>
            </div>
            <Switch
              data-testid="settings-medium-approval"
              checked={!!settings.approval_for_medium}
              onCheckedChange={(v) => save({ approval_for_medium: v })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            High-risk actions (running code, deleting files, payments) always require explicit approval and cannot be disabled.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
