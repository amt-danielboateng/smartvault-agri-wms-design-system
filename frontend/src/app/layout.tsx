import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShellClient } from "@/components/AppShellClient";

export const metadata: Metadata = {
  title: "SmartVault Agri-WMS",
  description: "Offline-first warehouse management for agricultural cooperatives",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthGuard>
            <AppShellClient>{children}</AppShellClient>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}


