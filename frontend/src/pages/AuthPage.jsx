import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Sparkles, ShieldCheck, Zap, Heart } from "lucide-react";
import { toast } from "sonner";

const MODES = [
  { id: "mom", label: "Mom Mode", desc: "Simple & guided", icon: Heart },
  { id: "power", label: "Power User", desc: "Fast & flexible", icon: Zap },
  { id: "developer", label: "Developer", desc: "Full control", icon: ShieldCheck },
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("mom");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res =
      tab === "login"
        ? await login(email, password)
        : await register({ email, password, name: name || "Explorer", mode });
    setLoading(false);
    if (!res.ok) toast.error(res.error);
  };

  const fillDemo = () => {
    setEmail("mom@javsh.ai");
    setPassword("javsh123");
    setTab("login");
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* Brand panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 agent-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-heading text-xl font-bold leading-none">Javsh AI Agent</div>
              <div className="text-xs text-muted-foreground mt-1">Autonomous computer-use agent</div>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="font-heading text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
              Give the agent a goal,
              <span className="block text-primary">not a list of clicks.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Tell Javsh what you want in plain words. It plans, browses the real web, runs code,
              and builds your files — pausing to ask you before anything risky.
            </p>
            <div className="grid grid-cols-1 gap-3 pt-2">
              {[
                { i: Sparkles, t: "Plans multi-step tasks automatically" },
                { i: ShieldCheck, t: "Asks permission before risky actions" },
                { i: Zap, t: "Builds real Excel, PDF & Word files" },
              ].map((f, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-elevated flex items-center justify-center">
                    <f.i className="h-4 w-4 text-primary" />
                  </div>
                  <span>{f.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-rose-accent" />
            Dedicated to 90's Moms and the young generation.
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-lg font-bold">Javsh AI Agent</span>
          </div>

          <div className="flex gap-1 p-1 bg-elevated rounded-xl mb-6">
            {["login", "register"].map((t) => (
              <button
                key={t}
                data-testid={`auth-tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 text-sm font-medium py-2 rounded-lg capitalize transition-colors ${
                  tab === t ? "bg-card shadow text-foreground" : "text-muted-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name" data-testid="auth-name-input" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Priya"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" required data-testid="auth-email-input"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" required data-testid="auth-password-input"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              />
            </div>

            {tab === "register" && (
              <div className="space-y-2">
                <Label>Choose your mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <button
                      type="button" key={m.id} data-testid={`mode-${m.id}`}
                      onClick={() => setMode(m.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        mode === m.id ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <m.icon className="h-4 w-4 mb-1 text-primary" />
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit" disabled={loading} data-testid="auth-submit-button"
              className="w-full h-11 text-sm font-semibold"
            >
              {loading ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <button
            data-testid="demo-fill-button" onClick={fillDemo}
            className="mt-4 w-full text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Use demo admin account →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
