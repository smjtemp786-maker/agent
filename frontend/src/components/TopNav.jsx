import React from "react";
import { useTheme } from "next-themes";
import { Bot, Moon, Sun, History, Settings, LogOut, Plus, Info, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function TopNav({ onNew, onOpenHistory, onOpenSettings, onOpenAbout, running }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-border/80 px-4 flex items-center justify-between glass z-30">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center relative">
          <Bot className="h-5 w-5 text-white" />
          {running && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 live-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>
        <div className="leading-none">
          <div className="font-heading font-bold text-sm">Javsh AI Agent</div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            {running ? "Agent running" : "Ready"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm" variant="secondary" onClick={onNew} data-testid="new-task-button"
          className="gap-1.5 h-9"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Task</span>
        </Button>
        <Button size="icon" variant="ghost" onClick={onOpenHistory} data-testid="history-button" className="h-9 w-9">
          <History className="h-4 w-4" />
        </Button>
        <Button
          size="icon" variant="ghost" data-testid="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-9 w-9"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="user-menu-button"
              className="h-9 w-9 rounded-full bg-elevated flex items-center justify-center text-xs font-semibold border border-border ml-1"
            >
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{user?.name}</span>
              <span className="text-[11px] text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSettings} data-testid="settings-menu-item">
              <Settings className="h-4 w-4 mr-2" /> Settings & Permissions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenAbout} data-testid="about-menu-item">
              <Info className="h-4 w-4 mr-2" /> About Javsh
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Cpu className="h-4 w-4 mr-2" /> Mode: {user?.mode || "mom"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} data-testid="logout-menu-item" className="text-rose-accent">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
