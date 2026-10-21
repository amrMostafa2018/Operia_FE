# Frontend deployment

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`. It builds the production site with Vercel CLI and deploys exactly that prebuilt output. A failed build stops deployment. `vercel.json` disables Vercel's separate Git-triggered deployment for `main` so each push creates one production deployment while other branches can still receive previews. It also routes Angular deep links to `index.html`.

## One-time setup

1. Confirm the existing Vercel project is connected to `amrMostafa2018/Operia_FE`, with `main` as its production branch and the repository root as its project root.
2. In Vercel, confirm the project uses Angular's `npm run build` command. The output directory is set by `vercel.json` to `dist/operia/browser`.
3. Create a Vercel access token. Run `vercel link` against this repository on a trusted machine to obtain `orgId` and `projectId` from `.vercel/project.json`. The `.vercel` directory is ignored by Git.
4. In the GitHub repository, create a `production` environment restricted to `main`. Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as environment secrets. Use the existing Vercel project IDs so the workflow deploys the current site and domain.
5. Push the workflow to `main` and inspect the GitHub Actions run and Vercel deployment. Check a deep link and an API request in the deployed app.

The production frontend calls `https://operia.runasp.net/api` from `src/environments/environment.prod.ts`. Update that value if the MonsterASP.NET API URL changes, and allow the deployed Vercel origin in the API CORS configuration.
