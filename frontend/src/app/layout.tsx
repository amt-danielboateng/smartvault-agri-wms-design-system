import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartVault Agri-WMS",
  description: "Offline-first warehouse management for agricultural cooperatives",
  manifest: "/manifest.json",
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
