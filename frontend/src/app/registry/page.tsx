"use client";
import { useState } from "react";
import { Search, X, Lock, Unlock, FileCheck, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Badge, Card, CardContent, Input, Select, Separator } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ── Types & seed data ───────────────────────────────────────────────── */
type LienStatus = "PLEDGED" | "ISSUED" | "RELEASED" | "VOID";

interface Receipt {
  id: string; depositor: string; commodity: string; grade: string;
  weightKg: number; ghsValue: number; usdValue: number;
  lienStatus: LienStatus; sha256: string;
  moisture: number; consignmentOrigin: string; lendingBank: string;
  loanRef: string; issuedAt: string; lienDate: string; lienOfficer: string;
  collateralVerified: string;
}

const RECEIPTS: Receipt[] = [
  { id:"MRS-2026-0891", depositor:"Savanna Growers Co-op",  commodity:"Yellow Maize", grade:"Grade 1", weightKg:24260, ghsValue:192840, usdValue:13418, lienStatus:"PLEDGED",  sha256:"9f8c2a71a4e4d...", moisture:12.4, consignmentOrigin:"Sawugu District · GPS verified", lendingBank:"GCB Bank PLC", loanRef:"GCB-AG-99418", issuedAt:"01 Oct 2026", lienDate:"30 Sep 2026", lienOfficer:"Office E. Manuah · signed digitally", collateralVerified:"01 Oct 2026 · registry hash matches depot record" },
  { id:"MRS-2026-0888", depositor:"Norton Farmers Union",   commodity:"Soybeans",     grade:"Grade 1", weightKg:19740, ghsValue:281100, usdValue:19894, lienStatus:"ISSUED",   sha256:"1b92d6cc4f8f1a...", moisture:11.8, consignmentOrigin:"Tamale North · GPS verified", lendingBank:"Stanbic Bank", loanRef:"STB-AG-44201", issuedAt:"29 Sep 2026", lienDate:"28 Sep 2026", lienOfficer:"Office K. Asante · signed digitally", collateralVerified:"29 Sep 2026 · registry hash matches depot record" },
  { id:"MRS-2026-0876", depositor:"Obewua Cooperative",     commodity:"Paddy Rice",   grade:"Grade 2", weightKg:31100, ghsValue:228018, usdValue:14309, lienStatus:"RELEASED", sha256:"a177112a4c2d16a...", moisture:13.1, consignmentOrigin:"Bawku East · GPS verified", lendingBank:"—", loanRef:"—", issuedAt:"27 Sep 2026", lienDate:"—", lienOfficer:"—", collateralVerified:"27 Sep 2026 · registry hash matches depot record" },
  { id:"MRS-2026-0864", depositor:"Dagbon Grain Network",   commodity:"White Maize",  grade:"Grade 1", weightKg:22480, ghsValue:179065, usdValue:11254, lienStatus:"ISSUED",   sha256:"77a42c85b3d1a19...", moisture:12.0, consignmentOrigin:"Yendi District · GPS verified", lendingBank:"Cal Bank", loanRef:"CAL-AG-30021", issuedAt:"25 Sep 2026", lienDate:"24 Sep 2026", lienOfficer:"Office P. Boateng · signed digitally", collateralVerified:"25 Sep 2026 · registry hash matches depot record" },
  { id:"MRS-2026-0849", depositor:"Northern Women in Grain",commodity:"Sorghum",      grade:"Grade 1", weightKg:16920, ghsValue:128995, usdValue:8276,  lienStatus:"PLEDGED",  sha256:"4a8b7f1d3e2c9a...", moisture:11.5, consignmentOrigin:"Savelugu · GPS verified", lendingBank:"Fidelity Bank", loanRef:"FID-AG-10293", issuedAt:"22 Sep 2026", lienDate:"21 Sep 2026", lienOfficer:"Office A. Yakubu · signed digitally", collateralVerified:"22 Sep 2026 · registry hash matches depot record" },
];

const LIEN_BADGE: Record<LienStatus, { variant: "pledged"|"issued"|"released"|"void"; label: string }> = {
  PLEDGED:  { variant: "pledged",  label: "PLEDGED" },
  ISSUED:   { variant: "issued",   label: "ISSUED" },
  RELEASED: { variant: "released", label: "RELEASED" },
  VOID:     { variant: "void",     label: "VOID" },
};

/* ── Lien drawer ─────────────────────────────────────────────────────── */
function LienDrawer({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const { variant, label } = LIEN_BADGE[receipt.lienStatus];
  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Drawer header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lien Verification Inspection</p>
          <p className="text-sm font-bold text-foreground">{receipt.id}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Cryptographic record */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cryptographic Record</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Verified · chain intact</span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </div>

        {/* Details grid */}
        <div className="space-y-2 text-sm">
          {[
            ["Depositor",           receipt.depositor],
            ["Commodity / Grade",   `${receipt.commodity} · Certified ${receipt.grade}`],
            ["Net certified weight",`${receipt.weightKg.toLocaleString()} kg`],
            ["Consignment origin",  receipt.consignmentOrigin],
            ["Verified intake moisture", `${receipt.moisture}% · limit 13.0%`],
            ["Lending bank",        receipt.lendingBank],
            ["Loan reference",      receipt.loanRef],
            ["SHA-256",             receipt.sha256],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="w-44 shrink-0 text-muted-foreground text-xs">{k}</span>
              <span className={cn("text-xs font-medium break-all", k === "SHA-256" ? "font-mono text-[10px]" : "")}>{v}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Temperature compliance */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Temperature compliance &amp; audit trail</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Current temperature compliant</p>
                <p className="text-muted-foreground">26.7°C · 30/30 days within certified envelope</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Lien placed by {receipt.lendingBank}</p>
                <p className="text-muted-foreground">{receipt.lienDate} · {receipt.lienOfficer}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <FileCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Collateral verified</p>
                <p className="text-muted-foreground">{receipt.collateralVerified}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer actions */}
      <div className="border-t border-border p-4 space-y-2">
        <Button className="w-full font-semibold" size="lg">
          <Lock className="h-4 w-4" /> Place Lien (Pledge)
        </Button>
        <Button variant="outline" className="w-full font-semibold" size="lg">
          <Unlock className="h-4 w-4" /> Release Collateral
        </Button>
        <Button variant="ghost" className="w-full text-primary font-semibold" size="sm">
          <FileCheck className="h-4 w-4" /> Export Certified PDF Certificate
        </Button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function RegistryPage() {
  const [depositor, setDepositor]   = useState("");
  const [commodity, setCommodity]   = useState("all");
  const [lienFilter, setLienFilter] = useState("all");
  const [selected, setSelected]     = useState<Receipt | null>(null);
  const [page, setPage]             = useState(1);

  const filtered = RECEIPTS.filter(r =>
    (depositor === "" || r.depositor.toLowerCase().includes(depositor.toLowerCase())) &&
    (commodity === "all" || r.commodity.toLowerCase().includes(commodity)) &&
    (lienFilter === "all" || r.lienStatus === lienFilter)
  );

  const totalTonnage = filtered.reduce((s, r) => s + r.weightKg, 0) / 1000;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-48px)]">
      {/* Page header */}
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Screen C · Collateral Registry</p>
            <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
              Electronic Warehouse Receipt (e-WRS) &amp; Collateral Registry
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Traceable collateral issuance, lien control, compliance, and certified proof.
            </p>
          </div>
          <Badge variant="success" className="shrink-0 mt-1 hidden md:inline-flex">
            <ShieldCheck className="h-3 w-3" /> Registry integrity verified
          </Badge>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 md:px-6 py-3 border-b border-border bg-muted/30">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px] max-w-xs">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Depositor / Farmer Co-op
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={depositor}
                onChange={e => setDepositor(e.target.value)}
                placeholder="Savanna"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Commodity Type"
              value={commodity}
              onChange={e => setCommodity(e.target.value)}
              options={[
                { value:"all",          label:"All commodities" },
                { value:"yellow maize", label:"Yellow Maize" },
                { value:"white maize",  label:"White Maize" },
                { value:"soybeans",     label:"Soybeans" },
                { value:"paddy rice",   label:"Paddy Rice" },
                { value:"sorghum",      label:"Sorghum" },
              ]}
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Lien Status"
              value={lienFilter}
              onChange={e => setLienFilter(e.target.value)}
              options={[
                { value:"all",      label:"All statuses" },
                { value:"PLEDGED",  label:"Pledged" },
                { value:"ISSUED",   label:"Issued" },
                { value:"RELEASED", label:"Released" },
                { value:"VOID",     label:"Void" },
              ]}
            />
          </div>
          <Button size="sm" className="h-9 px-3 shrink-0 self-end">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length} certified receipts · {totalTonnage.toFixed(1)} t
        </p>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table / card list */}
        <div className={cn("flex-1 overflow-auto", selected ? "hidden md:block" : "")}>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Receipt UUID","Depositor / Co-operative","Commodity & Grade","Net Weight","Valuation","Lien Status","SHA-256 Hash"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const { variant, label } = LIEN_BADGE[r.lienStatus];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={cn(
                      "border-b border-border cursor-pointer transition-colors hover-row",
                      selected?.id === r.id && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-primary">{r.id}</p>
                      {selected?.id === r.id && (
                        <p className="text-[10px] text-warning mt-0.5">OPEN FOR VERIFICATION</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.depositor}</td>
                    <td className="px-4 py-3 text-xs">{r.commodity} · {r.grade}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{r.weightKg.toLocaleString()} kg</td>
                    <td className="px-4 py-3 text-xs">
                      <p>GHS {r.ghsValue.toLocaleString()}</p>
                      <p className="text-muted-foreground">USD {r.usdValue.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {r.sha256}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map(r => {
              const { variant, label } = LIEN_BADGE[r.lienStatus];
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-mono text-xs font-bold text-primary">{r.id}</p>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{r.depositor}</p>
                  <p className="text-xs text-muted-foreground">{r.commodity} · {r.grade}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">NET WEIGHT</p>
                      <p className="font-semibold">{r.weightKg.toLocaleString()} kg</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">GHS VALUE</p>
                      <p className="font-semibold">{r.ghsValue.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1.5 truncate">SHA-256: {r.sha256}</p>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>Showing 1–{filtered.length} of 152</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))}
                className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">Page {page} / 31</span>
              <button onClick={() => setPage(p => Math.min(31, p+1))}
                className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled={page === 31}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Lien drawer — right panel on desktop, full-screen on mobile */}
        {selected && (
          <div className={cn(
            "border-l border-border bg-card",
            "w-full md:w-[380px] lg:w-[420px] shrink-0",
            "fixed inset-0 md:relative md:inset-auto z-50 md:z-auto"
          )}>
            <LienDrawer receipt={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
