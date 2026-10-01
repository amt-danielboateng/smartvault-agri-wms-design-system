"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth";

export interface Receipt {
  id:           number;
  transaction:  number;
  farmer_id:    string;
  commodity:    string;
  grade:        string;
  weight_kg:    string;
  moisture:     string;
  warehouse:    string;
  lien_status:  "ISSUED" | "PLEDGED" | "RELEASED" | "VOID";
  lien_holder:  string;
  lien_officer: string;
  lien_date:    string | null;
  block_hash:   string;
  issued_at:    string;
}

/* Seed fallback matching the Figma registry screen */
const SEED: Receipt[] = [
  { id:1, transaction:1, farmer_id:"Savanna Growers Co-op",  commodity:"Yellow Maize", grade:"Grade 1", weight_kg:"24260.00", moisture:"12.40", warehouse:"Tamale Central Depot", lien_status:"PLEDGED",  lien_holder:"GCB Bank PLC",  lien_officer:"Office E. Manuah", lien_date:"2026-09-30", block_hash:"9f8c2a71a4e4d...", issued_at:"2026-10-01T14:36:00Z" },
  { id:2, transaction:2, farmer_id:"Norton Farmers Union",   commodity:"Soybeans",     grade:"Grade 1", weight_kg:"19740.00", moisture:"11.80", warehouse:"Tamale Central Depot", lien_status:"ISSUED",   lien_holder:"",              lien_officer:"",                lien_date:null,         block_hash:"1b92d6cc4f8f1a...", issued_at:"2026-09-29T11:20:00Z" },
  { id:3, transaction:3, farmer_id:"Obewua Cooperative",     commodity:"Paddy Rice",   grade:"Grade 2", weight_kg:"31100.00", moisture:"13.10", warehouse:"Kumasi Grain Hub",     lien_status:"RELEASED", lien_holder:"",              lien_officer:"",                lien_date:null,         block_hash:"a177112a4c2d16a...", issued_at:"2026-09-27T09:15:00Z" },
  { id:4, transaction:4, farmer_id:"Dagbon Grain Network",   commodity:"White Maize",  grade:"Grade 1", weight_kg:"22480.00", moisture:"12.00", warehouse:"Tamale Central Depot", lien_status:"ISSUED",   lien_holder:"",              lien_officer:"",                lien_date:null,         block_hash:"77a42c85b3d1a19...", issued_at:"2026-09-25T08:00:00Z" },
  { id:5, transaction:5, farmer_id:"Northern Women in Grain",commodity:"Sorghum",      grade:"Grade 1", weight_kg:"16920.00", moisture:"11.50", warehouse:"Techiman Aggregation Centre", lien_status:"PLEDGED", lien_holder:"Fidelity Bank", lien_officer:"Office A. Yakubu", lien_date:"2026-09-21", block_hash:"4a8b7f1d3e2c9a...", issued_at:"2026-09-22T10:30:00Z" },
];

interface Filters {
  depositor: string;
  commodity: string;
  lienStatus: string;
}

export function useRegistry(filters: Filters) {
  const [receipts, setReceipts]   = useState<Receipt[]>(SEED);
  const [loading, setLoading]     = useState(false);
  const [offline, setOffline]     = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.depositor)  params.set("farmer_id",   filters.depositor);
      if (filters.commodity !== "all")   params.set("commodity",  filters.commodity);
      if (filters.lienStatus !== "all")  params.set("lien_status", filters.lienStatus);

      const res = await apiFetch(`/api/receipts/?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.results ?? data);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [filters.depositor, filters.commodity, filters.lienStatus]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const pledge = useCallback(async (id: number, lien_holder: string, lien_officer: string) => {
    const res = await apiFetch(`/api/receipts/${id}/pledge/`, {
      method: "PATCH",
      body:   JSON.stringify({ lien_holder, lien_officer }),
    });
    if (res.ok) {
      const updated: Receipt = await res.json();
      setReceipts(rs => rs.map(r => r.id === id ? updated : r));
    }
    return res.ok;
  }, []);

  const release = useCallback(async (id: number) => {
    const res = await apiFetch(`/api/receipts/${id}/release/`, { method: "PATCH" });
    if (res.ok) {
      const updated: Receipt = await res.json();
      setReceipts(rs => rs.map(r => r.id === id ? updated : r));
    }
    return res.ok;
  }, []);

  return { receipts, loading, offline, pledge, release, refetch: fetch_ };
}
