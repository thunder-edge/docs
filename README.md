# Thunder Docs

Thunder documentation built with Astro + Starlight.

## About the Content

This documentation is generated with AI support and reviewed by humans.

Contributions are very welcome, including AI-assisted contributions.
If you use AI during the process, please perform a technical review before opening a PR.

## Local Development

```bash
npm ci
npm run dev
```

## CI/CD for GitHub Pages

This repository is configured to publish automatically to GitHub Pages.

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: `push` on the `main` branch (and manual execution via `workflow_dispatch`)
- Build: `npm ci` + `npm run build`
- Deploy: `dist/` artifact with `actions/deploy-pages`

## Enable in the GitHub Repository

1. Open `Settings` -> `Pages`.
2. Under `Build and deployment`, select `Source: GitHub Actions`.
3. Ensure the main branch is `main`.
4. Push this configuration to trigger the first deploy.

## Expected URL

- User/organization repository (`<owner>.github.io`): publishes at `/`
- Project repository (e.g. `thunder-docs`): publishes at `/<repo>`

`astro.config.mjs` is already configured to detect this scenario automatically in CI.
