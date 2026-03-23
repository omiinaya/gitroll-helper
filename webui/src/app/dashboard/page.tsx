"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Bug,
  Wind,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  LayoutGrid,
  List,
  Star,
  GitFork,
} from "lucide-react";

interface RepoMetrics {
  bugs: number;
  codeSmells: number;
  vulnerabilities: number;
  reliabilityRating: number;
  securityRating: number;
  sqaleRating: number;
  ncloc: number;
}

interface Repo {
  scanId: string;
  user: string;
  repo: string;
  slug: string;
  qualityGatePassed: boolean;
  stars: number;
  forks: number;
  metrics: RepoMetrics;
  languages: { name: string; ncloc: number }[];
}

interface ScanData {
  userId: string;
  totalRepos: number;
  repos: Repo[];
}

type FilterType = "all" | "bugs" | "codeSmells" | "vulnerabilities";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<ScanData | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "bugs" | "smells" | "vulns" | "ncloc">("bugs");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const raw = sessionStorage.getItem("gitroll-scan");
    if (!raw) {
      router.push("/");
      return;
    }
    setData(JSON.parse(raw));
  }, [router]);

  const filteredRepos = useCallback(() => {
    if (!data) return [];
    let repos = [...data.repos];

    if (search) {
      const q = search.toLowerCase();
      repos = repos.filter((r) => r.slug.toLowerCase().includes(q));
    }

    if (filter === "bugs") repos = repos.filter((r) => r.metrics.bugs > 0);
    if (filter === "codeSmells") repos = repos.filter((r) => r.metrics.codeSmells > 0);
    if (filter === "vulnerabilities") repos = repos.filter((r) => r.metrics.vulnerabilities > 0);

    repos.sort((a, b) => {
      switch (sortBy) {
        case "name": return a.slug.localeCompare(b.slug);
        case "bugs": return b.metrics.bugs - a.metrics.bugs;
        case "smells": return b.metrics.codeSmells - a.metrics.codeSmells;
        case "vulns": return b.metrics.vulnerabilities - a.metrics.vulnerabilities;
        case "ncloc": return b.metrics.ncloc - a.metrics.ncloc;
        default: return 0;
      }
    });

    return repos;
  }, [data, filter, search, sortBy]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totals = data.repos.reduce(
    (acc, r) => ({
      bugs: acc.bugs + r.metrics.bugs,
      codeSmells: acc.codeSmells + r.metrics.codeSmells,
      vulnerabilities: acc.vulnerabilities + r.metrics.vulnerabilities,
      passed: acc.passed + (r.qualityGatePassed ? 1 : 0),
      failed: acc.failed + (r.qualityGatePassed ? 0 : 1),
    }),
    { bugs: 0, codeSmells: 0, vulnerabilities: 0, passed: 0, failed: 0 }
  );

  const repos = filteredRepos();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <GitBranch className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">GitRoll Helper</h1>
          </div>
          <a
            href="/dashboard/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Create Issues
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Repos" value={data.totalRepos} icon={<GitBranch className="w-4 h-4" />} />
          <StatCard label="Bugs" value={totals.bugs} icon={<Bug className="w-4 h-4" />} color="text-warning" />
          <StatCard label="Code Smells" value={totals.codeSmells} icon={<Wind className="w-4 h-4" />} color="text-info" />
          <StatCard label="Vulnerabilities" value={totals.vulnerabilities} icon={<ShieldAlert className="w-4 h-4" />} color="text-danger" />
          <StatCard
            label="Quality Gate"
            value={`${totals.passed}/${data.totalRepos}`}
            icon={totals.failed > 0 ? <XCircle className="w-4 h-4 text-danger" /> : <CheckCircle2 className="w-4 h-4 text-success" />}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search repos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="flex gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")} icon={<Filter className="w-3.5 h-3.5" />} label="All" />
            <FilterButton active={filter === "bugs"} onClick={() => setFilter("bugs")} icon={<Bug className="w-3.5 h-3.5" />} label="Bugs" count={totals.bugs} />
            <FilterButton active={filter === "codeSmells"} onClick={() => setFilter("codeSmells")} icon={<Wind className="w-3.5 h-3.5" />} label="Smells" count={totals.codeSmells} />
            <FilterButton active={filter === "vulnerabilities"} onClick={() => setFilter("vulnerabilities")} icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Vulns" count={totals.vulnerabilities} />
          </div>
          <div className="flex gap-1 border border-border rounded-lg p-0.5">
            <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sort by:</span>
          {(["bugs", "smells", "vulns", "ncloc", "name"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {s === "ncloc" ? "Size" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Repo List/Grid */}
        {view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map((repo) => (
              <a
                key={repo.scanId}
                href={`/dashboard/${repo.scanId}`}
                className="group block rounded-xl border border-border bg-card p-5 hover:border-ring/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{repo.repo}</h3>
                    <p className="text-xs text-muted-foreground">{repo.user}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {repo.qualityGatePassed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5" /> Pass</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-danger"><XCircle className="w-3.5 h-3.5" /> Fail</span>
                    )}
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <MetricPill icon={<Bug className="w-3 h-3" />} value={repo.metrics.bugs} color="text-warning" />
                  <MetricPill icon={<Wind className="w-3 h-3" />} value={repo.metrics.codeSmells} color="text-info" />
                  <MetricPill icon={<ShieldAlert className="w-3 h-3" />} value={repo.metrics.vulnerabilities} color="text-danger" />
                </div>
                {repo.languages.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {repo.languages.slice(0, 3).map((lang) => (
                      <span key={lang.name} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{lang.name}</span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Repository</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Gate</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Bugs</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Smells</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Vulns</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Lines</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">Langs</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <tr
                    key={repo.scanId}
                    onClick={() => router.push(`/dashboard/${repo.scanId}`)}
                    className="border-b border-border last:border-0 hover:bg-card/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{repo.repo}</div>
                      <div className="text-xs text-muted-foreground">{repo.user}</div>
                    </td>
                    <td className="text-center px-3 py-3">
                      {repo.qualityGatePassed ? (
                        <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-danger mx-auto" />
                      )}
                    </td>
                    <td className={`text-center px-3 py-3 tabular-nums ${repo.metrics.bugs > 0 ? "text-warning" : "text-muted-foreground"}`}>
                      {repo.metrics.bugs}
                    </td>
                    <td className={`text-center px-3 py-3 tabular-nums ${repo.metrics.codeSmells > 0 ? "text-info" : "text-muted-foreground"}`}>
                      {repo.metrics.codeSmells}
                    </td>
                    <td className={`text-center px-3 py-3 tabular-nums ${repo.metrics.vulnerabilities > 0 ? "text-danger" : "text-muted-foreground"}`}>
                      {repo.metrics.vulnerabilities}
                    </td>
                    <td className="text-center px-3 py-3 tabular-nums text-muted-foreground">
                      {repo.metrics.ncloc.toLocaleString()}
                    </td>
                    <td className="text-center px-3 py-3">
                      <div className="flex gap-1 justify-center">
                        {repo.languages.slice(0, 2).map((l) => (
                          <span key={l.name} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{l.name}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {repos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No repos match your filters.</div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
      <div className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function MetricPill({ icon, value, color }: { icon: React.ReactNode; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${value > 0 ? color : "text-muted-foreground"}`}>
      {icon}{value}
    </span>
  );
}

function FilterButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
      }`}
    >
      {icon}{label}
      {count !== undefined && <span className={`ml-0.5 ${active ? "opacity-80" : "text-muted-foreground"}`}>{count}</span>}
    </button>
  );
}
