# Frontend deployment

## API targets

`npm start` uses the development Angular configuration. Its `apiUrl` is `/api`, and `src/proxy.conf.js` forwards those requests to the local ASP.NET API at `http://localhost:5150` by default. Start the backend with its `Development` launch profile and a development database before using the local frontend. Set `ASPNETCORE_URLS` or `ASPNETCORE_HTTPS_PORT` when starting Angular only if the local API uses another port.

`npm run build` and the Vercel production build use Angular's production file replacement, so the deployed frontend calls `https://operia.runasp.net/api`. The production API gets its database connection from configuration retained on the server. Never point the development frontend at that hosted API for routine testing.

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`. It builds the production site with Vercel CLI and deploys exactly that prebuilt output. A failed build stops deployment. `vercel.json` disables Vercel's separate Git-triggered deployment for `main` if Git is connected later. It also routes Angular deep links to `index.html`.

## One-time setup

1. The Vercel project is `operia1/operia-frontend`. It has no Git connection; GitHub Actions deploys to it through the Vercel CLI. The output directory is set by `vercel.json` to `dist/operia/browser`.
2. The GitHub Actions repository secrets are `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The token is scoped to this Vercel project and expires on 2027-10-21; renew it before then. The deployment job names its environment `production`; a repository administrator can later add branch restrictions and move the secrets to that environment.
3. Push the workflow to `main` and inspect the GitHub Actions run and Vercel deployment. Check a deep link and an API request in the deployed app.

The production frontend calls `https://operia.runasp.net/api` from `src/environments/environment.prod.ts`. Update that value if the MonsterASP.NET API URL changes, and allow the deployed Vercel origin in the API CORS configuration.
