"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface LogEntry {
  id: number;
  type: "status" | "repo" | "skip" | "error" | "done";
  message: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const router = useRouter();
  const logRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  function addLog(type: LogEntry["type"], message: string) {
    setLogs((prev) => [...prev, { type, message, id: idRef.current++ }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");
    setLogs([]);
    setProgress({ current: 0, total: 0 });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileUrl: url.trim() }),
      });

      if (!res.ok) throw new Error("Failed to start scan");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "status") {
            addLog("status", data.message);
          } else if (data.type === "repo") {
            setProgress({ current: data.index, total: data.total });
            addLog("repo", `[${data.index}/${data.total}] ${data.slug}`);
          } else if (data.type === "skip") {
            addLog("skip", `[${data.index}/${data.total}] ${data.scanId} — ${data.message}`);
          } else if (data.type === "error" && !data.repos) {
            addLog("error", data.message);
            setError(data.message);
          } else if (data.type === "done") {
            addLog("done", `Done! ${data.totalRepos} repos loaded.`);
            sessionStorage.setItem("gitroll-scan", JSON.stringify(data));
            setTimeout(() => router.push("/dashboard"), 800);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      addLog("error", msg);
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

          {error && !loading && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </form>

        {/* Scanning Log */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Scanning
              </span>
              {progress.total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {progress.current}/{progress.total}
                  </span>
                </div>
              )}
            </div>
            <div ref={logRef} className="max-h-48 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-1.5">
                  {log.type === "done" ? (
                    <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                  ) : log.type === "error" ? (
                    <AlertCircle className="w-3 h-3 text-danger mt-0.5 shrink-0" />
                  ) : (
                    <span className="w-3 text-center text-muted-foreground mt-0.5 shrink-0">
                      {log.type === "repo" ? "+" : log.type === "skip" ? "!" : "·"}
                    </span>
                  )}
                  <span
                    className={
                      log.type === "error"
                        ? "text-danger"
                        : log.type === "done"
                        ? "text-success"
                        : log.type === "skip"
                        ? "text-muted-foreground"
                        : "text-foreground/80"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Paste your GitRoll profile link to get started.</p>
            <p>
              Find it at{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                gitroll.io/profile/...
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
