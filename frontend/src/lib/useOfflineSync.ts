"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type IntakeTransaction } from "@/lib/db";
import { apiFetch } from "@/lib/auth";

async function pushTransaction(tx: IntakeTransaction): Promise<boolean> {
  try {
    const res = await apiFetch("/api/intake/transactions/", {
      method: "POST",
      body: JSON.stringify({
        farmer_id:        tx.farmerId,
        commodity:        tx.commodity,
        weight_kg:        tx.weightKg,
        moisture_percent: tx.moisturePercent,
        warehouse:        tx.warehouseId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type SyncStatus = "idle" | "syncing" | "error";

export function useOfflineSync() {
  const [pending, setPending]   = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const isSyncing = useRef(false);

  async function refreshPending() {
    const count = await db.intakeTransactions.where("synced").equals(0).count();
    setPending(count);
  }

  const flush = useCallback(async () => {
    if (isSyncing.current || !navigator.onLine) return;
    isSyncing.current = true;
    setSyncStatus("syncing");

    try {
      // Dexie stores booleans as 0/1 in IndexedDB
      const unsynced = await db.intakeTransactions.where("synced").equals(0).toArray();
      let anyFailed = false;

      for (const tx of unsynced) {
        const ok = await pushTransaction(tx);
        if (ok) {
          await db.intakeTransactions.update(tx.id!, { synced: true });
        } else {
          anyFailed = true;
        }
      }

      setSyncStatus(anyFailed ? "error" : "idle");
    } catch {
      setSyncStatus("error");
    } finally {
      isSyncing.current = false;
      await refreshPending();
    }
  }, []);

  useEffect(() => {
    refreshPending();

    const onOnline  = () => flush();
    const onOffline = () => refreshPending();

    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);

    if (navigator.onLine) flush();

    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush]);

  return { pending, syncStatus, flush };
}
