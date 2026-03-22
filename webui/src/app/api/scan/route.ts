import { NextResponse } from "next/server";

const GITROLL_API = "https://gitroll.io/api";

export async function POST(req: Request) {
  const { profileUrl } = await req.json();

  const match = profileUrl.match(/gitroll\.io\/profile\/([A-Za-z0-9_-]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitRoll profile URL" }, { status: 400 });
  }
  const userId = match[1];

  // Fetch profile page to extract scan IDs
  const pageRes = await fetch(`https://gitroll.io/profile/${userId}`);
  if (!pageRes.ok) {
    return NextResponse.json({ error: "Failed to fetch GitRoll profile" }, { status: 502 });
  }
  const html = await pageRes.text();
  const ids = [
    ...new Set(
      [...html.matchAll(/taskId[^A-Za-z0-9]{0,10}([A-Za-z0-9]{15,25})/g)].map((m) => m[1])
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No scanned repos found" }, { status: 404 });
  }

  // Fetch summaries for all repos
  const repos = [];
  for (const scanId of ids) {
    try {
      const res = await fetch(`${GITROLL_API}/repo-scan/${scanId}`);
      if (!res.ok) continue;
      const data = await res.json();
      repos.push({
        scanId,
        user: data.user,
        repo: data.repo,
        slug: `${data.user}/${data.repo}`,
        qualityGatePassed: data.qualityGatePassed,
        granter: data.granter,
        repoDate: data.repoDate,
        stars: data.stars,
        forks: data.forks,
        metrics: {
          bugs: parseInt(data.measures?.bugs?.value ?? "0"),
          codeSmells: parseInt(data.measures?.code_smells?.value ?? "0"),
          vulnerabilities: parseInt(data.measures?.vulnerabilities?.value ?? "0"),
          reliabilityRating: parseFloat(data.measures?.reliability_rating?.value ?? "0"),
          securityRating: parseFloat(data.measures?.security_rating?.value ?? "0"),
          sqaleRating: parseFloat(data.measures?.sqale_rating?.value ?? "0"),
          ncloc: parseInt(data.measures?.ncloc?.value ?? "0"),
        },
        languages: data.langs ?? [],
        badPractices: data.badPractices ?? [],
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ userId, totalRepos: repos.length, repos });
}
