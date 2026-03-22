"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to scan profile");
      }

      const data = await res.json();
      sessionStorage.setItem("gitroll-scan", JSON.stringify(data));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
            <GitBranch className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">GitRoll Helper</h1>
          <p className="text-muted-foreground text-lg">
            Export bugs, code smells &amp; vulnerabilities from your GitRoll scans
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="profile" className="text-sm font-medium text-muted-foreground">
              GitRoll Profile URL
            </label>
            <div className="relative">
              <input
                id="profile"
                type="text"
                placeholder="https://gitroll.io/profile/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </form>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Paste your GitRoll profile link to get started.</p>
          <p>
            Find it at{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">
              gitroll.io/profile/...
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
