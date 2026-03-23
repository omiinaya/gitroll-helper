import { NextResponse } from "next/server";

const GITROLL_API = "https://gitroll.io/api";

export async function POST(req: Request) {
  const { profileUrl } = await req.json();

  const match = profileUrl.match(/gitroll\.io\/profile\/([A-Za-z0-9_-]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitRoll profile URL" }, { status: 400 });
  }
  const userId = match[1];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "status", message: "Fetching profile page..." });

        const pageRes = await fetch(`https://gitroll.io/profile/${userId}`);
        if (!pageRes.ok) {
          send({ type: "error", message: "Failed to fetch GitRoll profile" });
          controller.close();
          return;
        }
        const html = await pageRes.text();
        const ids = [
          ...new Set(
            [...html.matchAll(/taskId[^A-Za-z0-9]{0,10}([A-Za-z0-9]{15,25})/g)].map((m) => m[1])
          ),
        ];

        if (ids.length === 0) {
          send({ type: "error", message: "No scanned repos found" });
          controller.close();
          return;
        }

        send({ type: "status", message: `Found ${ids.length} repos. Fetching details...` });

        const repos = [];
        for (let i = 0; i < ids.length; i++) {
          const scanId = ids[i];
          try {
            const res = await fetch(`${GITROLL_API}/repo-scan/${scanId}`);
            if (!res.ok) {
              send({ type: "skip", index: i + 1, total: ids.length, scanId, message: `skipped (HTTP ${res.status})` });
              continue;
            }
            const data = await res.json();
            const slug = `${data.user}/${data.repo}`;
            repos.push({
              scanId,
              user: data.user,
              repo: data.repo,
              slug,
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
            send({ type: "repo", index: i + 1, total: ids.length, slug });
          } catch {
            send({ type: "skip", index: i + 1, total: ids.length, scanId, message: "failed" });
          }
        }

        send({ type: "done", userId, totalRepos: repos.length, repos });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
