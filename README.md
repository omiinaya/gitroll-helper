# GitRoll Report Exporter

Export bugs, code smells, and vulnerabilities from your GitRoll-scanned repos into JSON files, then optionally create GitHub issues with checkboxes to track fixes.

## Requirements

- Node.js 18+ (uses built-in `fetch`)
- A GitRoll account with scanned repos
- A GitHub token (only if using `create-issues.mjs`)

## Quick Start

```bash
cp .env.example .env
# Edit .env with your user ID
node export-reports.mjs        # Export reports to JSON
node create-issues.mjs         # Create GitHub issues from reports
```

## Configuration

Edit `.env`:

```
GITROLL_USER_ID=AbCdEfGhIjKlMnOpQrStUv
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### How to get your GitRoll User ID

Go to your GitRoll profile page in the browser. The URL looks like:

```
https://gitroll.io/profile/AbCdEfGhIjKlMnOpQrStUv
```

Copy everything after `profile/` — that's your user ID. It's a random string, not your GitHub username.

### How to get a GitHub Token

1. Go to https://github.com/settings/tokens
2. Generate a new **classic** token with `repo` scope
3. Copy the `ghp_...` value

Only needed for `create-issues.mjs`. The exporter script doesn't need a GitHub token.

## Scripts

### `export-reports.mjs`

Fetches scan data from GitRoll and saves one JSON file per repo to `./reports/`.

```bash
node export-reports.mjs                         # Auto-discovers repos from profile
node export-reports.mjs <scanId1> <scanId2> ... # Pass scan IDs manually
```

Each report includes:
- Repo summary (quality gate, ratings, languages)
- Full issue details when available (file, line, severity, message, tags)
- Summary metrics for older scans where detailed issues aren't served by the API

### `create-issues.mjs`

Reads reports from `./reports/` and creates/updates GitHub issues.

```bash
node create-issues.mjs            # All repos
node create-issues.mjs my-repo    # Filter to repos matching "my-repo"
```

For each repo:
- **Detailed findings** → 1 issue per category (bugs, code smells, vulnerabilities) with checkboxes grouped by file
- **Summary only** → 1 combined issue with metric counts

Skips repos with 0 issues. Updates existing issues on re-run instead of creating duplicates.

### Example issue

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

## Output

```
reports/
  _index.json                    # Overview of all repos
  example-user_example-repo.json # One file per repo
  example-user_another-repo.json
  ...
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `0 scan IDs found` | Pass scan IDs manually as arguments to `export-reports.mjs` |
| `HTTP 429` | Rate limited — wait and retry |
| GitHub `403` | Token needs `repo` scope |
| Issues have no details | Older GitRoll scans only have summary metrics, not per-issue breakdowns |
