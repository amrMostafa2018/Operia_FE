# Frontend deployment

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`. It builds the production site with Vercel CLI and deploys exactly that prebuilt output. A failed build stops deployment. `vercel.json` disables Vercel's separate Git-triggered deployment for `main` if Git is connected later. It also routes Angular deep links to `index.html`.

## One-time setup

1. The Vercel project is `operia1/operia-frontend`. It has no Git connection; GitHub Actions deploys to it through the Vercel CLI. The output directory is set by `vercel.json` to `dist/operia/browser`.
2. The GitHub Actions repository secrets are `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The token is scoped to this Vercel project and expires on 2027-10-21; renew it before then. The deployment job names its environment `production`; a repository administrator can later add branch restrictions and move the secrets to that environment.
3. Push the workflow to `main` and inspect the GitHub Actions run and Vercel deployment. Check a deep link and an API request in the deployed app.

The production frontend calls `https://operia.runasp.net/api` from `src/environments/environment.prod.ts`. Update that value if the MonsterASP.NET API URL changes, and allow the deployed Vercel origin in the API CORS configuration.
