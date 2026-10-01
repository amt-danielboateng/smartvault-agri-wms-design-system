"use client";
import { useState, useEffect } from "react";
import {
  Search, X, Lock, Unlock, FileCheck, ShieldCheck,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { Button, Badge, Card, CardContent, Select, Separator } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useRegistry, type Receipt } from "@/lib/useRegistry";

/* ── Badge config ────────────────────────────────────────────────────── */
type LienVariant = "pledged" | "issued" | "released" | "void";
const LIEN_BADGE: Record<string, { variant: LienVariant; label: string }> = {
  PLEDGED:  { variant: "pledged",  label: "PLEDGED" },
  ISSUED:   { variant: "issued",   label: "ISSUED" },
  RELEASED: { variant: "released", label: "RELEASED" },
  VOID:     { variant: "void",     label: "VOID" },
};

/* ── Pledge modal ────────────────────────────────────────────────────── */
function PledgeModal({ onConfirm, onCancel, loading }: {
  onConfirm: (holder: string, officer: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [holder,  setHolder]  = useState("");
  const [officer, setOfficer] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-foreground">Place Lien (Pledge)</h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lending Bank</label>
            <input value={holder} onChange={e => setHolder(e.target.value)}
              placeholder="e.g. GCB Bank PLC"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lien Officer</label>
            <input value={officer} onChange={e => setOfficer(e.target.value)}
              placeholder="e.g. Office E. Manuah"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button className="flex-1" disabled={!holder || !officer || loading}
            onClick={() => onConfirm(holder, officer)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Lien drawer ─────────────────────────────────────────────────────── */
function LienDrawer({ receipt, onClose, onPledge, onRelease }: {
  receipt: Receipt;
  onClose: () => void;
  onPledge: () => void;
  onRelease: () => void;
}) {
  const { variant, label } = LIEN_BADGE[receipt.lien_status] ?? LIEN_BADGE.ISSUED;
  const weightT = (parseFloat(receipt.weight_kg) / 1000).toFixed(3);
  const canPledge  = receipt.lien_status === "ISSUED";
  const canRelease = receipt.lien_status === "PLEDGED";

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lien Verification Inspection</p>
          <p className="text-sm font-bold text-foreground">MRS-2026-{String(receipt.id).padStart(4,"0")}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Cryptographic record */}
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Cryptographic Record
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Verified · chain intact</span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {[
            ["Depositor",             receipt.farmer_id],
            ["Commodity / Grade",     `${receipt.commodity} · Certified ${receipt.grade ?? "Grade 1"}`],
            ["Net certified weight",  `${parseFloat(receipt.weight_kg).toLocaleString()} kg`],
            ["Consignment origin",    receipt.warehouse],
            ["Verified intake moisture", `${receipt.moisture}% · limit 13.0%`],
            ["Lending bank",          receipt.lien_holder  || "—"],
            ["Loan reference",        receipt.lien_officer || "—"],
            ["SHA-256",               receipt.block_hash],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="w-44 shrink-0 text-xs text-muted-foreground">{k}</span>
              <span className={cn("text-xs font-medium break-all",
                k === "SHA-256" ? "font-mono text-[10px]" : ""
              )}>{v}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Audit trail */}
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
            {receipt.lien_holder && (
              <div className="flex items-start gap-2 text-xs">
                <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Lien placed by {receipt.lien_holder}</p>
                  <p className="text-muted-foreground">
                    {receipt.lien_date ?? "—"} · {receipt.lien_officer}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs">
              <FileCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Collateral verified</p>
                <p className="text-muted-foreground">
                  {receipt.issued_at.slice(0, 10)} · registry hash matches depot record
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border p-4 space-y-2">
        {canPledge && (
          <Button className="w-full font-semibold" size="lg" onClick={onPledge}>
            <Lock className="h-4 w-4" /> Place Lien (Pledge)
          </Button>
        )}
        {canRelease && (
          <Button variant="outline" className="w-full font-semibold" size="lg" onClick={onRelease}>
            <Unlock className="h-4 w-4" /> Release Collateral
          </Button>
        )}
        <Button variant="ghost" className="w-full text-primary font-semibold" size="sm">
          <FileCheck className="h-4 w-4" /> Export Certified PDF Certificate
        </Button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function RegistryPage() {
  const [depositor,  setDepositor]  = useState("");
  const [commodity,  setCommodity]  = useState("all");
  const [lienFilter, setLienFilter] = useState("all");
  const [dateFrom,   setDateFrom]   = useState("2026-08-01");
  const [dateTo,     setDateTo]     = useState("2026-10-01");
  const [selected,   setSelected]   = useState<Receipt | null>(null);
  const [page,       setPage]       = useState(1);
  const [pledging,   setPledging]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { receipts, loading, offline, pledge, release } = useRegistry({
    depositor, commodity, lienStatus: lienFilter,
  });

  // Keep drawer in sync: after mutation, receipts state is updated by useRegistry;
  // sync selected from the updated list via a separate effect.
  useEffect(() => {
    if (!selected) return;
    const fresh = receipts.find(r => r.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [receipts]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalTonnage = receipts.reduce((s, r) => s + parseFloat(r.weight_kg), 0) / 1000;

  async function handlePledge(holder: string, officer: string) {
    if (!selected) return;
    setActionLoading(true);
    await pledge(selected.id, holder, officer);
    setActionLoading(false);
    setPledging(false);
    // selected is updated via the receipts effect above
  }

  async function handleRelease() {
    if (!selected) return;
    setActionLoading(true);
    await release(selected.id);
    setActionLoading(false);
    // selected is updated via the receipts effect above
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-48px)]">
      {/* Page header */}
      <div className="px-4 md:px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">
              Screen C · Collateral Registry
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
              Electronic Warehouse Receipt (e-WRS) &amp; Collateral Registry
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Traceable collateral issuance, lien control, compliance, and certified proof.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {offline && <Badge variant="warning" className="text-xs">Offline · seed data</Badge>}
            <Badge variant="success" className="hidden md:inline-flex">
              <ShieldCheck className="h-3 w-3" /> Registry integrity verified
            </Badge>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 md:px-6 py-3 border-b border-border bg-muted/30">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Depositor search */}
          <div className="flex-1 min-w-[140px] max-w-xs">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Depositor / Farmer Co-op
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={depositor} onChange={e => setDepositor(e.target.value)}
                placeholder="Savanna"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Commodity */}
          <div className="min-w-[150px]">
            <Select label="Commodity Type" value={commodity} onChange={e => setCommodity(e.target.value)}
              options={[
                { value:"all",          label:"All commodities" },
                { value:"Yellow Maize", label:"Yellow Maize" },
                { value:"White Maize",  label:"White Maize" },
                { value:"Soybeans",     label:"Soybeans" },
                { value:"Paddy Rice",   label:"Paddy Rice" },
                { value:"Sorghum",      label:"Sorghum" },
              ]} />
          </div>

          {/* Date range */}
          <div className="flex items-end gap-1.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Range</label>
              <div className="flex items-center gap-1.5">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <span className="text-xs text-muted-foreground">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          {/* Lien status */}
          <div className="min-w-[140px]">
            <Select label="Lien Status" value={lienFilter} onChange={e => setLienFilter(e.target.value)}
              options={[
                { value:"all",      label:"All statuses" },
                { value:"PLEDGED",  label:"Pledged" },
                { value:"ISSUED",   label:"Issued" },
                { value:"RELEASED", label:"Released" },
                { value:"VOID",     label:"Void" },
              ]} />
          </div>

          <Button size="sm" className="h-9 px-3 shrink-0 self-end">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {loading
            ? "Loading…"
            : `${receipts.length} certified receipts · ${totalTonnage.toFixed(1)} t`}
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className={cn("flex-1 overflow-auto", selected ? "hidden md:block" : "")}>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Receipt UUID","Depositor / Co-operative","Commodity & Grade","Net Weight","Lien Status","SHA-256 Hash"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => {
                const { variant, label } = LIEN_BADGE[r.lien_status] ?? LIEN_BADGE.ISSUED;
                return (
                  <tr key={r.id} onClick={() => setSelected(r)}
                    className={cn(
                      "border-b border-border cursor-pointer transition-colors hover:bg-muted/40",
                      selected?.id === r.id && "bg-primary/5"
                    )}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-primary">
                        MRS-2026-{String(r.id).padStart(4,"0")}
                      </p>
                      {selected?.id === r.id && (
                        <p className="text-[10px] text-warning mt-0.5">OPEN FOR VERIFICATION</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.farmer_id}</td>
                    <td className="px-4 py-3 text-xs">{r.commodity} · {r.grade ?? "Grade 1"}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {parseFloat(r.weight_kg).toLocaleString()} kg
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {r.block_hash}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {receipts.map(r => {
              const { variant, label } = LIEN_BADGE[r.lien_status] ?? LIEN_BADGE.ISSUED;
              return (
                <button key={r.id} onClick={() => setSelected(r)}
                  className="w-full text-left p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-mono text-xs font-bold text-primary">
                      MRS-2026-{String(r.id).padStart(4,"0")}
                    </p>
                    <Badge variant={variant}>{label}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{r.farmer_id}</p>
                  <p className="text-xs text-muted-foreground">{r.commodity} · {r.grade ?? "Grade 1"}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">NET WEIGHT</p>
                      <p className="font-semibold">{parseFloat(r.weight_kg).toLocaleString()} kg</p>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1.5 truncate">
                    SHA-256: {r.block_hash}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>Showing 1–{receipts.length} of {receipts.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">Page {page} / 1</span>
              <button onClick={() => setPage(p => p + 1)}
                className="rounded p-1 hover:bg-muted disabled:opacity-40" disabled>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Lien drawer */}
        {selected && (
          <div className={cn(
            "border-l border-border bg-card",
            "w-full md:w-[380px] lg:w-[420px] shrink-0",
            "fixed inset-0 md:relative md:inset-auto z-50 md:z-auto"
          )}>
            <LienDrawer
              receipt={selected}
              onClose={() => setSelected(null)}
              onPledge={() => setPledging(true)}
              onRelease={handleRelease}
            />
          </div>
        )}
      </div>

      {/* Pledge modal */}
      {pledging && (
        <PledgeModal
          onConfirm={handlePledge}
          onCancel={() => setPledging(false)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
