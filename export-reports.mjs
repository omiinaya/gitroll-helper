import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const GITROLL_BASE = "https://gitroll.io/api";

function loadEnv() {
  try {
    const envFile = readFileSync(".env", "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (val && !process.env[key]) process.env[key] = val;
    }
  } catch {}
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSummary(scanId) {
  return fetchJSON(`${GITROLL_BASE}/repo-scan/${scanId}`);
}

async function fetchAllIssues(scanId, type) {
  const all = [];
  const pageSize = 50;
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const url = new URL(`${GITROLL_BASE}/repo-scan/${scanId}/issues`);
    url.searchParams.set("p", String(page));
    url.searchParams.set("ps", String(pageSize));
    if (type) url.searchParams.set("types", type);

    const data = await fetchJSON(url.toString());
    total = data.total;
    all.push(...(data.issues || []));
    page++;

    if ((data.issues || []).length === 0) break;
    await sleep(200);
  }

  return all;
}

async function exportRepo(scanId, outDir) {
  const summary = await fetchSummary(scanId);
  const slug = `${summary.user}/${summary.repo}`;
  const m = summary.measures || {};

  // Try to get detailed issues
  const bugs = await fetchAllIssues(scanId, "BUG");
  await sleep(300);
  const codeSmells = await fetchAllIssues(scanId, "CODE_SMELL");
  await sleep(300);
  const vulnerabilities = await fetchAllIssues(scanId, "VULNERABILITY");

  const hasDetails = bugs.length + codeSmells.length + vulnerabilities.length > 0;

  const report = {
    scanId,
    repo: slug,
    qualityGatePassed: summary.qualityGatePassed,
    languages: summary.langs || [],
    badPractices: summary.badPractices || [],
    metrics: {
      bugs: parseInt(m.bugs?.value ?? "0"),
      codeSmells: parseInt(m.code_smells?.value ?? "0"),
      vulnerabilities: parseInt(m.vulnerabilities?.value ?? "0"),
      reliabilityRating: parseFloat(m.reliability_rating?.value ?? "0"),
      securityRating: parseFloat(m.security_rating?.value ?? "0"),
      sqaleRating: parseFloat(m.sqale_rating?.value ?? "0"),
      ncloc: parseInt(m.ncloc?.value ?? "0"),
    },
    detailStatus: hasDetails ? "available" : "unavailable (older scan - only summary metrics available)",
    issues: {
      bugs,
      codeSmells,
      vulnerabilities,
    },
    totals: {
      bugs: hasDetails ? bugs.length : parseInt(m.bugs?.value ?? "0"),
      codeSmells: hasDetails ? codeSmells.length : parseInt(m.code_smells?.value ?? "0"),
      vulnerabilities: hasDetails ? vulnerabilities.length : parseInt(m.vulnerabilities?.value ?? "0"),
    },
  };

  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "_");
  const outPath = join(outDir, `${safeSlug}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  const detailStr = hasDetails
    ? `${report.totals.bugs} bugs, ${report.totals.codeSmells} smells, ${report.totals.vulnerabilities} vulns`
    : `summary only: ${report.metrics.bugs} bugs, ${report.metrics.codeSmells} smells, ${report.metrics.vulnerabilities} vulns`;

  console.log(`  ${slug} => ${detailStr}`);

  return report;
}

async function fetchScanIds(userId) {
  console.log(`Fetching scan IDs for user ${userId}...`);
  const res = await fetch(`https://gitroll.io/profile/${userId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching profile page`);
  const html = await res.text();
  const matches = html.matchAll(/taskId[^A-Za-z0-9]{0,10}([A-Za-z0-9]{15,25})/g);
  const ids = [...new Set([...matches].map((m) => m[1]))];
  console.log(`  Found ${ids.length} scan IDs`);
  return ids;
}

async function main() {
  loadEnv();

  const userId = process.env.GITROLL_USER_ID;
  if (!userId) {
    console.error("Error: GITROLL_USER_ID not set in .env or environment.");
    console.error("  Set it to the ID from your profile URL: gitroll.io/profile/<ID>");
    process.exit(1);
  }

  const outDir = join(process.cwd(), "reports");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // CLI args override: pass scan IDs directly to skip discovery
  let scanIds = process.argv.slice(2);
  if (scanIds.length === 0) {
    scanIds = await fetchScanIds(userId);
  }

  if (scanIds.length === 0) {
    console.error("No scan IDs found. Check your GITROLL_USER_ID.");
    process.exit(1);
  }

  console.log(`Exporting ${scanIds.length} repos...\n`);

  const index = [];
  for (let i = 0; i < scanIds.length; i++) {
    const id = scanIds[i];
    try {
      const report = await exportRepo(id, outDir);
      index.push({
        repo: report.repo,
        qualityGate: report.qualityGatePassed ? "PASS" : "FAIL",
        details: report.detailStatus,
        bugs: report.totals.bugs,
        codeSmells: report.totals.codeSmells,
        vulnerabilities: report.totals.vulnerabilities,
      });
    } catch (e) {
      console.error(`  FAILED ${id}: ${e.message}`);
      index.push({ scanId: id, error: e.message });
    }
    if (i < scanIds.length - 1) await sleep(500);
  }

  const withDetails = index.filter((r) => r.details === "available").length;
  const summaryOnly = index.filter(
    (r) => r.details && r.details.startsWith("unavailable")
  ).length;

  writeFileSync(
    join(outDir, "_index.json"),
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalRepos: index.length,
        withFullDetails: withDetails,
        summaryOnly,
        repos: index,
      },
      null,
      2
    )
  );

  console.log(`\nDone. Reports in ${outDir}/`);
  console.log(`  ${withDetails} repos with full issue details`);
  console.log(`  ${summaryOnly} repos with summary metrics only`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
