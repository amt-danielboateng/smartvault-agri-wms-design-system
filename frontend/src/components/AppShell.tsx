"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wheat, BarChart2, FileText, Wifi, WifiOff, RefreshCw, MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { useOfflineSync } from "@/lib/useOfflineSync";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/intake",    label: "Gate Intake",    short: "Intake",    Icon: Wheat },
  { href: "/telemetry", label: "Silo Telemetry", short: "Telemetry", Icon: BarChart2 },
  { href: "/registry",  label: "e-WRS Registry", short: "Registry",  Icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const { pending, syncStatus, flush } = useOfflineSync();
  const { username } = useAuth();

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : "??";
  const depot = username
    ? `${username.charAt(0).toUpperCase()}${username.slice(1)} Depot`
    : "Select Depot";

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  type SyncVariant = "online" | "syncing" | "offline";
  const syncVariant: SyncVariant = !online ? "offline" : pending > 0 ? "syncing" : "online";
  const syncLabel = !online
    ? `Offline · ${pending} batches pending sync`
    : pending > 0
    ? `Syncing · ${pending} queued`
    : "Online";
  const syncDot = !online ? "bg-critical" : pending > 0 ? "bg-warning" : "bg-success";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col bg-sidebar border-r border-white/10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Wheat className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">SmartVault</p>
            <p className="text-[11px] text-white/50">Gate Intake & Produce Grading</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary/20 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Sync status */}
        <div className="p-3 border-t border-white/10">
          <Badge variant={syncVariant} className="w-full justify-center text-xs py-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", syncDot)} />
            {syncLabel}
          </Badge>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header bar */}
        <header className="bg-header flex items-center justify-between px-4 py-2.5 gap-3">
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Wheat className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-white">SmartVault</span>
          </div>

          {/* Desktop: spacer */}
          <div className="hidden md:block" />

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            {/* Depot selector */}
            <button className="hidden md:flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 transition-colors">
              <MapPin className="h-3 w-3 text-white/70" />
              {depot}
              <ChevronDown className="h-3 w-3 text-white/50" />
            </button>

            {/* Sync badge */}
            <Badge variant={syncVariant} className="hidden md:inline-flex text-xs">
              <span className={cn("h-1.5 w-1.5 rounded-full", syncDot)} />
              {syncLabel}
            </Badge>

            {/* Mobile sync */}
            <span className="md:hidden">
              {syncVariant === "online"
                ? <Wifi className="h-4 w-4 text-success" />
                : syncVariant === "syncing"
                ? <RefreshCw className="h-4 w-4 text-warning animate-spin" onClick={flush} />
                : <WifiOff className="h-4 w-4 text-critical" />}
            </span>

            {/* Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* ── Bottom nav (mobile) ───────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 flex border-t border-border bg-card z-40">
          {NAV.map(({ href, short, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                pathname.startsWith(href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {short}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
