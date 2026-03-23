import { NextResponse } from "next/server";

const GITROLL_API = "https://gitroll.io/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: scanId } = await params;
  if (!scanId) return NextResponse.json({ error: "scanId required" }, { status: 400 });

  // Fetch summary
  const summaryRes = await fetch(`${GITROLL_API}/repo-scan/${scanId}`);
  if (!summaryRes.ok) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }
  const summary = await summaryRes.json();

  // Fetch issues by type
  async function fetchIssues(type: string) {
    const all = [];
    let page = 1;
    let total = Infinity;
    while (all.length < total) {
      const url = new URL(`${GITROLL_API}/repo-scan/${scanId}/issues`);
      url.searchParams.set("p", String(page));
      url.searchParams.set("ps", "50");
      url.searchParams.set("types", type);
      const res = await fetch(url.toString());
      if (!res.ok) break;
      const data = await res.json();
      total = data.total;
      all.push(...(data.issues ?? []));
      page++;
      if ((data.issues ?? []).length === 0) break;
    }
    return all;
  }

  const bugs = await fetchIssues("BUG");
  const codeSmells = await fetchIssues("CODE_SMELL");
  const vulnerabilities = await fetchIssues("VULNERABILITY");

  return NextResponse.json({
    scanId,
    slug: `${summary.user}/${summary.repo}`,
    qualityGatePassed: summary.qualityGatePassed,
    metrics: {
      bugs: parseInt(summary.measures?.bugs?.value ?? "0"),
      codeSmells: parseInt(summary.measures?.code_smells?.value ?? "0"),
      vulnerabilities: parseInt(summary.measures?.vulnerabilities?.value ?? "0"),
      reliabilityRating: parseFloat(summary.measures?.reliability_rating?.value ?? "0"),
      securityRating: parseFloat(summary.measures?.security_rating?.value ?? "0"),
      sqaleRating: parseFloat(summary.measures?.sqale_rating?.value ?? "0"),
      ncloc: parseInt(summary.measures?.ncloc?.value ?? "0"),
    },
    languages: summary.langs ?? [],
    issues: { bugs, codeSmells, vulnerabilities },
    hasDetails: bugs.length + codeSmells.length + vulnerabilities.length > 0,
  });
}
