"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { access, isReady } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;
    if (!access && pathname !== "/login") {
      router.replace("/login");
    }
  }, [access, isReady, pathname, router]);

  // Don't flash protected content before redirect
  if (!isReady) return null;
  if (!access && pathname !== "/login") return null;

  return <>{children}</>;
}
