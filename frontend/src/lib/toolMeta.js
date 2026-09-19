import {
  Globe, Search, FileText, FileSpreadsheet, FileType2, Link2,
  MousePointerClick, Keyboard, Camera, FolderOpen, FilePlus, Terminal,
  CheckCircle2, FileDown,
} from "lucide-react";

export const TOOL_META = {
  browser_navigate: { label: "Open Page", icon: Globe },
  browser_search: { label: "Web Search", icon: Search },
  browser_extract_text: { label: "Read Page", icon: FileText },
  browser_extract_links: { label: "Collect Links", icon: Link2 },
  browser_click: { label: "Click Element", icon: MousePointerClick },
  browser_type: { label: "Type Text", icon: Keyboard },
  browser_screenshot: { label: "Screenshot", icon: Camera },
  file_list: { label: "List Files", icon: FolderOpen },
  file_read: { label: "Read File", icon: FileText },
  file_write: { label: "Write File", icon: FilePlus },
  create_csv: { label: "Create CSV", icon: FileSpreadsheet },
  create_xlsx: { label: "Create Excel", icon: FileSpreadsheet },
  create_docx: { label: "Create Word Doc", icon: FileType2 },
  create_pdf: { label: "Create PDF", icon: FileDown },
  run_python: { label: "Run Python", icon: Terminal },
  finish: { label: "Completed", icon: CheckCircle2 },
};

export const toolMeta = (a) => TOOL_META[a] || { label: a, icon: Terminal };

export const RISK_STYLE = {
  low: "text-emerald-accent bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-accent bg-amber-500/10 border-amber-500/20",
  high: "text-rose-accent bg-rose-500/10 border-rose-500/20",
};

export const EXT_ICON = {
  xlsx: FileSpreadsheet, csv: FileSpreadsheet, docx: FileType2,
  pdf: FileDown, txt: FileText, json: FileText, md: FileText,
};
