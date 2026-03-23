"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  Wind,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  FileCode,
  Star,
} from "lucide-react";

interface Issue {
  component: string;
  severity: string;
  message: string;
  tags: string[];
  type: string;
  textRange?: { startLine: number; endLine: number; startOffset: number; endOffset: number };
}

interface DetailData {
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
    ncloc: number;
  };
  languages: { name: string; ncloc: number }[];
  issues: { bugs: Issue[]; codeSmells: Issue[]; vulnerabilities: Issue[] };
  hasDetails: boolean;
}

type Tab = "bugs" | "codeSmells" | "vulnerabilities";

export default function RepoDetail() {
  const router = useRouter();
  const params = useParams();
  const scanId = params.scanId as string;
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("bugs");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/repos/${scanId}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.metrics.bugs === 0 && d.metrics.codeSmells > 0) setTab("codeSmells");
        if (d.metrics.bugs === 0 && d.metrics.codeSmells === 0 && d.metrics.vulnerabilities > 0) setTab("vulnerabilities");
      }
      setLoading(false);
    }
    load();
  }, [scanId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Repo not found</p>
          <button onClick={() => router.push("/dashboard")} className="text-primary hover:underline text-sm">Back to dashboard</button>
        </div>
      </div>
    );
  }

  const issues = data.issues[tab] ?? [];
  const tabCounts = { bugs: data.metrics.bugs, codeSmells: data.metrics.codeSmells, vulnerabilities: data.metrics.vulnerabilities };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{data.slug}</h1>
          </div>
          <a
            href={`https://github.com/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Quality Gate" value={data.qualityGatePassed ? "PASS" : "FAIL"} pass={data.qualityGatePassed} />
          <MetricCard label="Bugs" value={data.metrics.bugs} warn={data.metrics.bugs > 0} />
          <MetricCard label="Code Smells" value={data.metrics.codeSmells} warn={data.metrics.codeSmells > 0} />
          <MetricCard label="Vulnerabilities" value={data.metrics.vulnerabilities} danger={data.metrics.vulnerabilities > 0} />
          <MetricCard label="Reliability" value={`${data.metrics.reliabilityRating}/5`} />
          <MetricCard label="Security" value={`${data.metrics.securityRating}/5`} />
          <MetricCard label="Lines" value={data.metrics.ncloc.toLocaleString()} />
        </div>

        {/* Languages */}
        {data.languages.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {data.languages.map((lang) => (
              <div key={lang.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm">
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-foreground">{lang.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{lang.ncloc.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Issues */}
        {data.hasDetails ? (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              <TabButton active={tab === "bugs"} onClick={() => setTab("bugs")} icon={<Bug className="w-4 h-4" />} label="Bugs" count={tabCounts.bugs} color="text-warning" />
              <TabButton active={tab === "codeSmells"} onClick={() => setTab("codeSmells")} icon={<Wind className="w-4 h-4" />} label="Code Smells" count={tabCounts.codeSmells} color="text-info" />
              <TabButton active={tab === "vulnerabilities"} onClick={() => setTab("vulnerabilities")} icon={<ShieldAlert className="w-4 h-4" />} label="Vulnerabilities" count={tabCounts.vulnerabilities} color="text-danger" />
            </div>

            {/* Issue List */}
            {issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
                No {tab === "codeSmells" ? "code smells" : tab} found
              </div>
            ) : (
              <div className="space-y-2">
                {groupByFile(issues).map(({ file, items }) => (
                  <div key={file} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm text-foreground">{file}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((issue, i) => (
                        <div key={i} className="px-4 py-3 flex items-start gap-3">
                          <SeverityBadge severity={issue.severity} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{issue.message}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {issue.textRange && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  L{issue.textRange.startLine}{issue.textRange.startLine !== issue.textRange.endLine ? `-${issue.textRange.endLine}` : ""}
                                </span>
                              )}
                              {issue.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {issue.tags.map((tag) => (
                                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <p className="text-muted-foreground">Detailed issue breakdown is not available for this scan (older scan data).</p>
            <p className="text-sm text-muted-foreground">The summary metrics above are still accurate.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function groupByFile(issues: Issue[]) {
  const map: Record<string, Issue[]> = {};
  for (const issue of issues) {
    const file = issue.component?.split(":").slice(1).join(":") || "unknown";
    if (!map[file]) map[file] = [];
    map[file].push(issue);
  }
  return Object.entries(map).map(([file, items]) => ({ file, items }));
}

function MetricCard({ label, value, pass, warn, danger }: { label: string; value: string | number; pass?: boolean; warn?: boolean; danger?: boolean }) {
  let color = "text-foreground";
  if (pass === true) color = "text-success";
  if (pass === false) color = "text-danger";
  if (danger) color = "text-danger";
  else if (warn) color = "text-warning";

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    BLOCKER: "bg-danger/20 text-danger",
    CRITICAL: "bg-danger/15 text-danger",
    MAJOR: "bg-warning/20 text-warning",
    MINOR: "bg-info/15 text-info",
    INFO: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${styles[severity] ?? styles.INFO}`}>
      {severity}
    </span>
  );
}

function TabButton({ active, onClick, icon, label, count, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active ? `${color} border-current` : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className={`text-xs tabular-nums ${active ? "" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}
