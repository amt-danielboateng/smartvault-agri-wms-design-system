"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Wheat, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  const { login }               = useAuth();
  const router                  = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.replace("/intake");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
            <Wheat className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-foreground">SmartVault Agri-WMS</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Operator sign-in</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <Input
            label="Username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
            error={error || undefined}
          />
          <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          SmartVault Agri-WMS · Offline-first warehouse management
        </p>
      </div>
    </div>
  );
}
