# GitRoll API Analysis & Integration Guide

## Overview

GitRoll is a code quality analysis platform (built on SonarQube-style metrics) that scans GitHub repositories for **bugs**, **code smells**, and **vulnerabilities**. This document details the API endpoints discovered via HAR file analysis and proposes an architecture for downloading all issues across scanned repos.

---

## Authentication

GitRoll uses **Firebase Authentication** with GitHub OAuth as the provider.

### Auth Flow
1. User signs in via GitHub OAuth
2. Firebase returns a JWT `idToken`
3. Token is passed implicitly via browser session cookies (no explicit `Authorization` header needed for the GitRoll API itself)
4. Firebase Identity Toolkit is used to validate the token:
   ```
   POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=<firebase_api_key>
   Body: { "idToken": "<firebase_jwt>" }
   ```

### Key Auth Fields
- **Firebase Project**: `gitroll`
- **API Key**: `<firebase_api_key>`
- **Tenant ID**: `ind-users-yrz2c` (for individual users)
- **Provider**: `github.com`

> **Note**: The GitRoll API endpoints observed did NOT require explicit auth headers — they relied on browser session cookies. For a standalone app, you'd likely need to authenticate via Firebase first and maintain the session, or check if GitRoll exposes an API key/token mechanism.

---

## API Endpoints

### Base URL
```
https://gitroll.io/api
```

### 1. User Profile Ranking

```
GET /api/reg-ind-users/profile/{userId}/ranking
```

**Response:**
```json
{
  "time": 1774210062733,
  "regional": {
    "nAhead": 203,
    "total": 439,
    "top": 0.4624,
    "country": "US",
    "countryName": "United States"
  }
}
```

---

### 2. Repo Scan Summary

```
GET /api/repo-scan/{scanId}
```

Returns high-level metrics for a single scanned repository.

**Response:**
```json
{
  "user": "example-user",
  "repo": "example-repo",
  "rid": "R_kgDORX4DCg",
  "granter": "github:example-user",
  "repoDate": 1774118678000,
  "stars": 0,
  "forks": 0,
  "qualityGatePassed": true,
  "measures": {
    "bugs": { "metric": "bugs", "value": "7", "bestValue": false },
    "reliability_rating": { "metric": "reliability_rating", "value": "2.0", "bestValue": false },
    "code_smells": { "metric": "code_smells", "value": "138", "bestValue": false },
    "security_rating": { "metric": "security_rating", "value": "1.0", "bestValue": true },
    "vulnerabilities": { "metric": "vulnerabilities", "value": "0", "bestValue": true },
    "ncloc": { "metric": "ncloc", "value": "27476" },
    "ncloc_language_distribution": { "metric": "ncloc_language_distribution", "value": "css=98;js=567;ts=26811" },
    "sqale_rating": { "metric": "sqale_rating", "value": "1.0", "bestValue": true }
  },
  "langs": [
    { "ncloc": 26811, "name": "TypeScript" },
    { "ncloc": 567, "name": "JavaScript" },
    { "ncloc": 98, "name": "CSS" }
  ],
  "badPractices": [
    {
      "name": "dep-dirs",
      "value": ["session-streamer-server/node_modules"],
      "impactSoftwareQuality": "MAINTAINABILITY",
      "severity": "BLOCKER"
    }
  ]
}
```

**Key Metrics:**
| Metric | Description |
|---|---|
| `bugs` | Number of bugs found |
| `code_smells` | Number of code smells |
| `vulnerabilities` | Number of vulnerabilities |
| `reliability_rating` | 1.0 (best) to 5.0 (worst) |
| `security_rating` | 1.0 (best) to 5.0 (worst) |
| `sqale_rating` | Maintainability rating |
| `ncloc` | Non-commented lines of code |
| `qualityGatePassed` | Whether repo passes the quality gate |

---

### 3. Issues (Bugs, Code Smells, Vulnerabilities)

```
GET /api/repo-scan/{scanId}/issues?p={page}&ps={pageSize}
```

**Query Parameters:**
| Param | Description | Example |
|---|---|---|
| `p` | Page number (1-indexed) | `1` |
| `ps` | Page size | `10` |
| `types` | Filter by issue type | `BUG`, `CODE_SMELL`, `VULNERABILITY` |
| `facets` | Request facet aggregations | `tags,impactSeverities,types` |

#### All Issues (paginated)
```
GET /api/repo-scan/FfCX1JPrp3vuMbZEmeIQ/issues?p=1&ps=10
```

#### Filter by Type
```
GET /api/repo-scan/{scanId}/issues?p=1&ps=10&types=BUG
GET /api/repo-scan/{scanId}/issues?p=1&ps=10&types=CODE_SMELL
GET /api/repo-scan/{scanId}/issues?p=1&ps=10&types=VULNERABILITY
```

#### With Facets (for summary counts)
```
GET /api/repo-scan/{scanId}/issues?p=1&ps=1&facets=tags,impactSeverities,types
```

**Response:**
```json
{
  "total": 145,
  "p": 1,
  "ps": 10,
  "paging": { "pageIndex": 1, "pageSize": 10, "total": 145 },
  "effortTotal": 932,
  "issues": [
    {
      "component": "FfCX1JPrp3vuMbZEmeIQ:jest.setup.js",
      "project": "FfCX1JPrp3vuMbZEmeIQ",
      "severity": "CRITICAL",
      "message": "Unexpected empty method 'observe'.",
      "messageFormattings": [],
      "tags": ["suspicious"],
      "type": "CODE_SMELL",
      "textRange": {
        "startLine": 21,
        "endLine": 21,
        "startOffset": 12,
        "endOffset": 14
      }
    }
  ],
  "components": [
    {
      "key": "FfCX1JPrp3vuMbZEmeIQ:jest.setup.js",
      "enabled": true,
      "qualifier": "FIL",
      "name": "jest.setup.js",
      "longName": "jest.setup.js",
      "path": "jest.setup.js"
    }
  ],
  "facets": []
}
```

**Issue Object Fields:**
| Field | Description |
|---|---|
| `component` | `{scanId}:{filePath}` — file where issue was found |
| `severity` | `BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR`, `INFO` |
| `message` | Human-readable issue description |
| `type` | `BUG`, `CODE_SMELL`, or `VULNERABILITY` |
| `tags` | Array of tags: `suspicious`, `cwe`, `accessibility`, `react`, `performance`, `brain-overload`, etc. |
| `textRange` | Exact location: `startLine`, `endLine`, `startOffset`, `endOffset` |

**Facet Response (when requested):**
```json
"facets": [
  {
    "property": "types",
    "values": [
      { "val": "CODE_SMELL", "count": 138 },
      { "val": "BUG", "count": 7 },
      { "val": "VULNERABILITY", "count": 0 }
    ]
  },
  {
    "property": "impactSeverities",
    "values": [
      { "val": "HIGH", "count": 18 },
      { "val": "MEDIUM", "count": 57 },
      { "val": "LOW", "count": 80 }
    ]
  },
  {
    "property": "tags",
    "values": [
      { "val": "react", "count": 91 },
      { "val": "type-dependent", "count": 62 }
    ]
  }
]
```

---

### 4. Source Code Retrieval

```
GET /api/repo-scan/{scanId}/code?path={filePath}&revision={commitSha}
```

Returns the raw source code of a file at a specific revision.

**Example:**
```
GET /api/repo-scan/FfCX1JPrp3vuMbZEmeIQ/code?path=jest.setup.js&revision=0fb667572cef7b3c96513894099aedab004cd43d
```

**Response:** Raw file contents (plain text).

---

### 5. Embedded Code Viewer

```
GET /emgithub?private=true&repoScanId={scanId}&path={filePath}&revision={sha}&startLine={start}&endLine={end}
```

Returns an HTML embed showing a code snippet with highlighted lines (used for issue previews).

---

## Data Flow: How the App Works

```
User Profile Page
  └─ Lists all repo scan IDs (embedded in page/Next.js RSC data)
      └─ For each scan ID:
          ├─ GET /api/repo-scan/{scanId}         → summary metrics
          └─ GET /api/repo-scan/{scanId}/issues   → paginated issues
              ├─ &types=BUG
              ├─ &types=CODE_SMELL
              └─ &types=VULNERABILITY
```

---

## Proposed App Architecture

### Goal
Download all bugs, code smells, and vulnerabilities from every scanned repo for a given user.

### Step 1: Discover Scan IDs

The profile page at `https://gitroll.io/profile/{userId}/repos` lists all repos. The scan IDs are embedded in the Next.js RSC payload or loaded dynamically. Two approaches:

**Option A — Scrape the profile page:**
- Fetch `https://gitroll.io/profile/{userId}/repos`
- Parse the HTML/RSC data for `repo-scan/{scanId}` references

**Option B — Know scan IDs externally:**
- If you control the repos, you may already know the scan IDs
- Or use the GitHub repo node IDs (the `rid` field) as a reference

### Step 2: Fetch Repo Summaries

```typescript
for (const scanId of scanIds) {
  const summary = await fetch(`https://gitroll.io/api/repo-scan/${scanId}`);
  // summary.bugs, summary.code_smells, summary.vulnerabilities
}
```

### Step 3: Download All Issues (Paginated)

```typescript
async function downloadAllIssues(scanId: string, type?: string) {
  const allIssues = [];
  let page = 1;
  let total = Infinity;

  while (allIssues.length < total) {
    const url = new URL(`https://gitroll.io/api/repo-scan/${scanId}/issues`);
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', '100'); // max page size (test this)
    if (type) url.searchParams.set('types', type);

    const res = await fetch(url);
    const data = await res.json();
    total = data.total;
    allIssues.push(...data.issues);
    page++;
  }

  return allIssues;
}

// Download by category
const bugs = await downloadAllIssues(scanId, 'BUG');
const codeSmells = await downloadAllIssues(scanId, 'CODE_SMELL');
const vulns = await downloadAllIssues(scanId, 'VULNERABILITY');
```

### Step 4: (Optional) Fetch Source Code Context

For each issue, fetch the offending source code:

```typescript
const { component, textRange } = issue;
// component format: "{scanId}:{filePath}"
const filePath = component.split(':').slice(1).join(':');
const code = await fetch(
  `https://gitroll.io/api/repo-scan/${scanId}/code?path=${filePath}&revision=${commitSha}`
);
```

---

## Proposed Output Data Model

```typescript
interface ScanSummary {
  scanId: string;
  user: string;
  repo: string;
  qualityGatePassed: boolean;
  bugs: number;
  codeSmells: number;
  vulnerabilities: number;
  reliabilityRating: number;
  securityRating: number;
  ncloc: number;
  languages: { name: string; ncloc: number }[];
}

interface Issue {
  scanId: string;
  filePath: string;
  type: 'BUG' | 'CODE_SMELL' | 'VULNERABILITY';
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  message: string;
  tags: string[];
  line: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  sourceCode?: string; // fetched separately
}

interface RepoReport {
  summary: ScanSummary;
  bugs: Issue[];
  codeSmells: Issue[];
  vulnerabilities: Issue[];
}
```

---

## Example: Full Extraction Script (Pseudocode)

```typescript
async function extractUserReport(userId: string) {
  // 1. Get scan IDs from profile
  const scanIds = await getScanIdsFromProfile(userId);

  // 2. For each repo
  const reports: RepoReport[] = [];
  for (const scanId of scanIds) {
    // Get summary
    const summary = await fetchRepoSummary(scanId);

    // Get all issues by type
    const bugs = await downloadAllIssues(scanId, 'BUG');
    const codeSmells = await downloadAllIssues(scanId, 'CODE_SMELL');
    const vulns = await downloadAllIssues(scanId, 'VULNERABILITY');

    reports.push({
      summary,
      bugs,
      codeSmells,
      vulnerabilities: vulns,
    });
  }

  return reports;
}
```

---

## Rate Limiting & Considerations

- **No explicit rate limiting observed** in the HAR files, but be respectful
- The API appears to be **read-only** — no mutation endpoints were observed
- **Pagination** is required for repos with many issues (some repos had 145+ issues)
- The `facets` parameter is useful for getting **summary counts without fetching all issues**
- **`badPractices`** field in scan summary highlights things like committed `node_modules` or `.env` files
- The `effortTotal` field in issues response represents estimated remediation time (in minutes?)

---

## Unknowns / Open Questions

1. **Max page size (`ps`)**: Tested with `ps=10` and `ps=1`. Need to test if `ps=100` or higher works
2. **Auth for private repos**: The HAR shows `private=true` on the emgithub endpoint. Firebase auth tokens may be required for private repo scans
3. **Scan ID discovery**: No direct "list all scans" API was observed — scan IDs come from the profile page rendering
4. **Rate limits**: Not observed but likely exist
5. **Webhook/real-time updates**: Firestore long-poll connections were observed, suggesting real-time updates when scans complete
