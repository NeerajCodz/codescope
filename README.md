﻿# CodeScope

CodeScope is a web-based tool that helps developers quickly understand the architecture, dependencies, and risks of a GitHub repository. Instead of manually exploring files, CodeScope analyzes the codebase and presents its structure through interactive visualizations, making complex systems easier to reason about.

The tool builds a dependency and call graph by parsing imports and function calls, then layers on insights such as complexity hotspots, dead code heuristics, architectural patterns, and potential security risks. Multiple visual views allow users to explore the same system from different angles, from high-level structure to detailed relationships.

All analysis runs directly in the browser, with a lightweight serverless proxy used only for GitHub API access. This keeps setup minimal, protects user code, and enables fast exploration. CodeScope is designed for onboarding, audits, refactoring decisions, and understanding unfamiliar codebases—fast, visual, and without friction.

Repository: https://github.com/NeerajCodz/codespace

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Core modules](#core-modules)
- [API routes](#api-routes)
- [Architecture](#architecture)
- [Use cases](#use-cases)
- [Limitations](#limitations)
- [Environment variables](#environment-variables)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Export & import](#export--import)
- [Security & privacy](#security--privacy)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Multi‑view architecture visualization**: Force graph, cluster graph, treemap, matrix, dendrogram, sankey, bundle, and arc diagram.
- **Dependency graph + call tracking**: Import links + function call edges with call counts and line numbers.
- **Patterns & anti‑patterns**: Heuristic detection of common architectural patterns.
- **Security scan**: Detects hard‑coded secrets, SQL injection risk, XSS risk, and dynamic code execution.
- **Code health**: Complexity‑weighted score with hotspots.
- **Dead code heuristic**: Flags top‑level functions with no detected call sites.
- **Export & share**: Download JSON/CSV or share the analysis URL.
- **Private‑repo support**: OAuth login or a personal access token.

## How it works

1. The UI collects a GitHub repo (and optional token).
2. The serverless proxy at `/api/proxy` forwards GitHub API requests and relays rate‑limit headers.
3. The browser analyzes files: parses functions/variables, builds a dependency graph, computes complexity, and surfaces security findings.
4. Results are cached in `sessionStorage` and can be exported or imported.

## Tech stack

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4** + Radix UI
- **d3** for visualizations

## Architecture

CodeScope uses a client-first analysis pipeline:

1. **Fetch**: The GitHub client requests repository tree + file contents through a proxy endpoint.
2. **Parse**: The parser extracts functions, variables, imports, and call sites. Complexity and security heuristics run per file.
3. **Model**: The analyzer builds a dependency graph, aggregates patterns, and computes summary stats.
4. **Visualize**: D3-based views render multiple representations of the same graph data.
5. **Explore**: Side panels and modals show focused details (functions, variables, connections, health, and risks).

## Use cases

- **Onboarding**: Understand an unfamiliar codebase quickly.
- **Architecture reviews**: Spot coupling, hotspots, and layered structure issues.
- **Refactoring**: Identify dead code, high-complexity files, and overused utilities.
- **Security sweeps**: Flag obvious risks such as hard‑coded secrets or dynamic code execution.
- **Dependency analysis**: Visualize import graphs and function-call relationships.

## Limitations

- Heuristic analysis; false positives are possible.
- Dynamic imports and runtime reflection may not be captured.
- Extremely large repositories are partially sampled for performance.
- Client-side parsing focuses on supported file types and syntax patterns.

## Project structure

```
app/
	analysis/
		loading.tsx
		page.tsx
	api/
		auth/github/route.ts
		proxy/route.ts
	globals.css
	layout.tsx
	page.tsx
components/
	analysis/
		canvas.tsx
		header.tsx
		health-ring.tsx
		loading.tsx
		right-panel.tsx
		sidebar.tsx
		stats-grid.tsx
		structure-outline.tsx
		tree-view.tsx
		visualizations/
			arc.tsx
			bundle.tsx
			cluster-graph.tsx
			dendrogram.tsx
			force-graph.tsx
			matrix.tsx
			sankey.tsx
			treemap.tsx
	context/
		analysis-context.tsx
	handles/
		resize-handle.tsx
	landing/
		ambient-background.tsx
		faq.tsx
		features.tsx
		footer.tsx
		header.tsx
		hero.tsx
		input-form.tsx
		workflow.tsx
	modals/
		code-health-modal.tsx
		connection-details-modal.tsx
		drill-down-modal.tsx
		export-modal.tsx
		file-preview-modal.tsx
		function-details-modal.tsx
		node-details-modal.tsx
		pr-modal.tsx
		privacy-modal.tsx
		rate-limit-modal.tsx
		unused-functions-modal.tsx
		variable-details-modal.tsx
		download/
			download-modal.tsx
			share-modal.tsx
		features/
			apis-modal.tsx
			dependencies-modal.tsx
		import/
			import-modal.tsx
	providers/
		providers.tsx
	ui/
		accordion.tsx
		badge.tsx
		button.tsx
		card.tsx
		dialog.tsx
		input.tsx
		label.tsx
		scroll-area.tsx
		separator.tsx
		switch.tsx
		tabs.tsx
		toast.tsx
		toaster.tsx
		use-toast.ts
lib/
	analyzer.ts
	github.ts
	parser.ts
	utils.ts
public/
	images/
types/
	index.ts
utils/
	calculations.ts
	constants.ts
	export.ts
	formats/
		ignore-size.json
	themes/
		colors.json
		index.ts
```

## Core modules

- **Analyzer**: `lib/analyzer.ts` orchestrates scanning, parsing, dependency graph building, pattern detection, and stats.
- **GitHub client**: `lib/github.ts` handles GitHub API calls with caching and rate‑limit headers.
- **Parser**: `lib/parser.ts` extracts functions/variables, detects security issues, imports, and call sites.
- **State**: `components/context/analysis-context.tsx` stores analysis data and UI selections.

## API routes

- `GET /api/auth/github` — OAuth callback that exchanges `code` for a token and redirects to the app.
- `POST /api/proxy` — GitHub API proxy; only allows `https://api.github.com/*`.

## Environment variables

These are optional unless you want GitHub OAuth login:

- `NEXT_PUBLIC_GITHUB_CLIENT_ID` — Required for OAuth login in the UI.
- `GITHUB_CLIENT_SECRET` — Required for the OAuth callback route.
- `GITHUB_CLIENT_ID` — Optional; server will fall back to `NEXT_PUBLIC_GITHUB_CLIENT_ID`.

See [setup.md](setup.md) for full setup and OAuth configuration steps.

## Getting started

1. Install dependencies:
	 ```bash
	 pnpm install
	 ```
2. Create `.env.local` if you want OAuth (optional).
3. Run the dev server:
	 ```bash
	 pnpm dev
	 ```
4. Open http://localhost:3000

## Usage

1. Paste a GitHub repository URL (public repo works without login).
2. Optionally provide a token for higher rate limits or private repos.
3. Explore the analysis using the visualization modes, sidebar structure, and right‑panel insights.

## Export & import

- Download JSON (full analysis) or CSV (connections) from the analysis toolbar.
- Import an existing analysis JSON to recreate the view without re‑fetching.

## Security & privacy

- Analysis runs in the browser; the server only proxies GitHub API calls.
- Tokens are stored in `sessionStorage` only (per‑tab) and are not persisted on the server.

## Scripts

- `pnpm dev` — Start the dev server.
- `pnpm build` — Production build.
- `pnpm start` — Start the production server.
- `pnpm lint` — Lint the codebase.

## Troubleshooting

- **Rate limit exceeded**: add a token or use OAuth login.
- **OAuth error**: verify `NEXT_PUBLIC_GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env.local` and confirm the callback URL.
- **Proxy errors**: ensure requests go through `/api/proxy` and that the GitHub API URL is valid.

## Contributing

1. Fork the repo.
2. Create a feature branch.
3. Commit changes with clear messages.
4. Open a pull request.

## License

MIT License 
