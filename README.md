# GitRoll Helper

Export bugs, code smells & vulnerabilities from your GitRoll-scanned repos, then create GitHub issues to track fixes.

## Quick Start (Web UI)

```bash
cd webui
cp .env.example .env.local
# Fill in GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET (see below)
npm run dev
```

Open http://localhost:5188, sign in with GitHub, paste your GitRoll profile URL, and go.

### GitHub OAuth Setup

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Set **Homepage URL** to `http://localhost:5188`
3. Set **Callback URL** to `http://localhost:5188/api/auth/callback/github`
4. Copy the Client ID and Client Secret into `.env.local`
5. Generate a secret: `openssl rand -base64 32` → paste as `NEXTAUTH_SECRET`

## Quick Start (CLI)

```bash
cp .env.example .env
# Edit .env with your user ID and GitHub token
node export-reports.mjs        # Export reports to JSON
node create-issues.mjs         # Create GitHub issues from reports
```

### CLI Configuration

Edit `.env`:

```
GITROLL_USER_ID=<everything after profile/ in your GitRoll URL>
GITHUB_TOKEN=<ghp_... classic token with repo scope>
```

## CLI Scripts

### `export-reports.mjs`

Fetches scan data from GitRoll and saves one JSON file per repo to `./reports/`.

```bash
node export-reports.mjs                         # Auto-discovers repos from profile
node export-reports.mjs <scanId1> <scanId2> ... # Pass scan IDs manually
```

### `create-issues.mjs`

Reads reports from `./reports/` and creates/updates GitHub issues.

```bash
node create-issues.mjs            # All repos
node create-issues.mjs my-repo    # Filter to repos matching "my-repo"
```

For each repo:
- **Detailed findings** → 1 issue per category (bugs, code smells, vulnerabilities) with checkboxes grouped by file
- **Summary only** → 1 combined issue with metric counts

Updates existing issues on re-run instead of creating duplicates.

### Example Issue

```
Title: [GitRoll] 122 Code Smells Found

## 122 Code Smells Found

| Metric | Value |
|--------|-------|
| Code Smells | 122 |
| Maintainability Rating | 1/5 |
| Lines of Code | 10,565 |

### `src/app/admin/audit/page.tsx`
- [ ] **MAJOR** L47 — Remove this useless assignment to variable "setFilters" `cwe`, `unused`
- [ ] **MINOR** L52 — Unexpected empty method 'render' `suspicious`

### `src/lib/api-auth.ts`
- [ ] **CRITICAL** L6 — Refactor this function to reduce its Cognitive Complexity `brain-overload`
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `0 scan IDs found` | Pass scan IDs manually as arguments to `export-reports.mjs` |
| `HTTP 429` | Rate limited — wait and retry |
| GitHub `403` | Token needs `repo` scope |
| Issues have no details | Older GitRoll scans only have summary metrics, not per-issue breakdowns |
| OAuth callback error | Make sure callback URL matches exactly (`http://localhost:5188/api/auth/callback/github`) in GitHub OAuth app settings |
