"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import {
  ArrowLeft,
  Play,
  Bug,
  Wind,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
  Github,
} from "lucide-react";

interface Repo {
  scanId: string;
  slug: string;
  qualityGatePassed: boolean;
  metrics: {
    bugs: number;
    codeSmells: number;
    vulnerabilities: number;
    reliabilityRating: number;
    securityRating: number;
    sqaleRating: number;
  };
  issues?: {
    bugs: Record<string, unknown>[];
    codeSmells: Record<string, unknown>[];
    vulnerabilities: Record<string, unknown>[];
  };
}

interface LogEntry {
  id: number;
  type: "info" | "created" | "updated" | "skip" | "error" | "done";
  repo?: string;
  category?: string;
  message: string;
  url?: string;
}

export default function CreateIssuesPage() {
  return (
    <SessionProvider>
      <CreateIssuesInner />
    </SessionProvider>
  );
}

function CreateIssuesInner() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Set<string>>(new Set(["bugs", "codeSmells", "vulnerabilities"]));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const raw = sessionStorage.getItem("gitroll-scan");
    if (!raw) {
      router.push("/");
      return;
    }
    const data = JSON.parse(raw);
    setRepos(data.repos);
    setSelectedRepos(new Set(data.repos.map((r: Repo) => r.scanId)));
    setLoadingRepos(false);
  }, [router]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function addLog(entry: Omit<LogEntry, "id">) {
    setLogs((prev) => [...prev, { ...entry, id: idRef.current++ }]);
  }

  async function handleRun() {
    if (running || !session?.accessToken) return;
    setRunning(true);
    setLogs([]);
    setSummary(null);

    // Fetch detailed issues for selected repos
    addLog({ type: "info", message: `Fetching issue details for ${selectedRepos.size} repos...` });

    const detailedRepos: Repo[] = [];
    const selectedReposList = repos.filter((r) => selectedRepos.has(r.scanId));

    for (const repo of selectedReposList) {
      try {
        addLog({ type: "info", message: `  Fetching ${repo.slug}...` });
        const res = await fetch(`/api/repos/${repo.scanId}`);
        if (res.ok) {
          const detail = await res.json();
          detailedRepos.push({ ...repo, issues: detail.issues });
        } else {
          detailedRepos.push(repo);
        }
      } catch {
        detailedRepos.push(repo);
      }
    }

    addLog({ type: "info", message: `Creating issues for ${detailedRepos.length} repos...\n` });

    const cats = Array.from(categories);

    try {
      const res = await fetch("/api/create-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: detailedRepos.map((r) => ({
            slug: r.slug,
            issues: r.issues ?? { bugs: [], codeSmells: [], vulnerabilities: [] },
            metrics: r.metrics,
          })),
          categories: cats,
        }),
      });

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
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.type === "done") {
              setSummary({
                created: data.totalCreated,
                updated: data.totalUpdated,
                skipped: data.totalSkipped,
                failed: data.totalFailed,
              });
              addLog({
                type: "done",
                message: `\nDone! Created: ${data.totalCreated} | Updated: ${data.totalUpdated} | Skipped: ${data.totalSkipped} | Failed: ${data.totalFailed}`,
              });
            } else if (data.type === "skip") {
              addLog({ type: "skip", repo: data.repo, category: data.category, message: `  ${data.repo} [${data.category}] — skipped (${data.reason})` });
            } else if (data.type === "error") {
              addLog({ type: "error", repo: data.repo, category: data.category, message: `  ${data.repo} [${data.category}] — FAILED: ${data.error}` });
            } else {
              const catLabel = data.category === "bugs" ? "bugs" : data.category === "codeSmells" ? "code smells" : "vulnerabilities";
              addLog({
                type: data.type,
                repo: data.repo,
                category: data.category,
                message: `  ${data.repo} [${catLabel}] — ${data.type}`,
                url: data.url,
              });
            }
          }
        }
      }
    } catch (err) {
      addLog({ type: "error", message: `Fatal error: ${err instanceof Error ? err.message : "Unknown"}` });
    }

    setRunning(false);
  }

  function toggleRepo(scanId: string) {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(scanId)) next.delete(scanId);
      else next.add(scanId);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (loadingRepos) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Create GitHub Issues</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Config */}
          <div className="lg:col-span-1 space-y-6">
            {/* Auth */}
            {!session ? (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">GitHub Auth</h2>
                <p className="text-sm text-muted-foreground">Sign in to create issues on your repos.</p>
                <button
                  onClick={() => signIn("github")}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  <Github className="w-4 h-4" />
                  Sign in with GitHub
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Github className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{session.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Categories</h2>
              <div className="space-y-2">
                <CategoryToggle active={categories.has("bugs")} onToggle={() => toggleCategory("bugs")} icon={<Bug className="w-4 h-4" />} label="Bugs" color="text-warning" />
                <CategoryToggle active={categories.has("codeSmells")} onToggle={() => toggleCategory("codeSmells")} icon={<Wind className="w-4 h-4" />} label="Code Smells" color="text-info" />
                <CategoryToggle active={categories.has("vulnerabilities")} onToggle={() => toggleCategory("vulnerabilities")} icon={<ShieldAlert className="w-4 h-4" />} label="Vulnerabilities" color="text-danger" />
              </div>
            </div>

            {/* Run */}
            <button
              onClick={handleRun}
              disabled={running || !session || selectedRepos.size === 0 || categories.size === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Running..." : `Create Issues (${selectedRepos.size} repos)`}
            </button>

            {/* Repo Selection */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Repos</h2>
                <button
                  onClick={() => setSelectedRepos(selectedRepos.size === repos.length ? new Set() : new Set(repos.map((r) => r.scanId)))}
                  className="text-xs text-primary hover:underline"
                >
                  {selectedRepos.size === repos.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {repos.map((repo) => (
                  <label
                    key={repo.scanId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRepos.has(repo.scanId)}
                      onChange={() => toggleRepo(repo.scanId)}
                      className="rounded border-border"
                    />
                    <span className="flex-1 truncate">{repo.slug}</span>
                    <span className="text-xs text-muted-foreground">
                      {repo.metrics.bugs + repo.metrics.codeSmells + repo.metrics.vulnerabilities}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Logs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Log</h2>
                {running && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
              <div ref={logRef} className="h-[600px] overflow-y-auto p-4 font-mono text-sm space-y-0.5">
                {logs.length === 0 && !running && (
                  <p className="text-muted-foreground text-center py-8">
                    Click &quot;Create Issues&quot; to start.
                  </p>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="log-line flex items-start gap-2 py-0.5">
                    <LogIcon type={log.type} />
                    <span className={
                      log.type === "error" ? "text-danger" :
                      log.type === "created" ? "text-success" :
                      log.type === "updated" ? "text-info" :
                      log.type === "skip" ? "text-muted-foreground" :
                      log.type === "done" ? "text-success font-bold" :
                      "text-foreground/80"
                    }>
                      {log.message}
                    </span>
                    {log.url && (
                      <a href={log.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {summary && (
              <div className="grid grid-cols-4 gap-3">
                <SummaryCard label="Created" value={summary.created} color="text-success" />
                <SummaryCard label="Updated" value={summary.updated} color="text-info" />
                <SummaryCard label="Skipped" value={summary.skipped} color="text-muted-foreground" />
                <SummaryCard label="Failed" value={summary.failed} color="text-danger" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LogIcon({ type }: { type: string }) {
  switch (type) {
    case "created": return <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />;
    case "updated": return <CheckCircle2 className="w-3.5 h-3.5 text-info mt-0.5 shrink-0" />;
    case "error": return <XCircle className="w-3.5 h-3.5 text-danger mt-0.5 shrink-0" />;
    case "skip": return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />;
    case "done": return <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />;
    default: return <span className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0">›</span>;
  }
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function CategoryToggle({
  active,
  onToggle,
  icon,
  label,
  color,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer">
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className="rounded border-border"
      />
      <span className={active ? color : "text-muted-foreground"}>{icon}</span>
      <span className="text-sm">{label}</span>
    </label>
  );
}
