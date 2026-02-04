# Setup Guide
Open <http://localhost:3000>
1. Create a GitHub OAuth App: <https://github.com/settings/developers>

## Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm 8+

## Install dependencies

```bash
pnpm install
```

## Environment variables

Create a `.env.local` file at the project root.

### Minimal (OAuth login optional)

```bash
# Required only if you want “Login with GitHub”
NEXT_PUBLIC_GITHUB_CLIENT_ID=
# Required for OAuth callback (if login enabled)
GITHUB_CLIENT_SECRET=
# Optional; server will use NEXT_PUBLIC_GITHUB_CLIENT_ID if unset
GITHUB_CLIENT_ID=
```

> You can still analyze public repositories without OAuth by entering a GitHub repository URL. For higher rate limits or private repos, provide a personal access token in the UI.

## Run the app

```bash
pnpm dev
```

Open http://localhost:3000

## GitHub OAuth setup (optional)

1. Create a GitHub OAuth App: https://github.com/settings/developers
2. Set **Homepage URL** to `http://localhost:3000`
3. Set **Authorization callback URL** to `http://localhost:3000/api/auth/github`
4. Copy the Client ID and Client Secret into `.env.local`.

After restarting the dev server, the **Login with GitHub** button will enable OAuth login.

## Personal access token (optional)

If you don’t use OAuth, you can paste a token in the UI.

Suggested scopes:

- Public repos only: no special scopes required
- Private repos: `repo`

## Production build

```bash
pnpm build
pnpm start
```

## Troubleshooting

- **Rate limit exceeded**: add a token or use OAuth login.
- **OAuth error**: verify `NEXT_PUBLIC_GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env.local` and confirm the callback URL.
- **Proxy errors**: ensure requests go through `/api/proxy` and that the GitHub API URL is valid.
