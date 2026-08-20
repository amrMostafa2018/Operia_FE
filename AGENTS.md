# OPERIA frontend guidance

Apply this file on every frontend change in `Operia_FE` without being asked. Do not treat it as optional review notes.

## Source of truth

- The current user request has highest priority.
- `_File_2_Super_Admin_Functional_Specification_V1_Final.docx` defines business behavior, validation, access, integrations, and audit expectations.
- `OPERIA Admin Portal Functional Specification.pptx` defines the desktop visual reference. Inspect the screenshot for the relevant screen before changing UI.
- Existing backend and frontend conventions constrain implementation, but do not replace a documented requirement.

Read `requirements/OPERIA_REQUIREMENTS_INDEX.md`, `requirements/OPERIA_ARCHITECTURE_CONVENTIONS.md`, and `requirements/OPERIA_DEVELOPER_GUIDE.md` before planning or implementing a feature. Record a source conflict or implementation decision in the requirements index instead of silently changing the requirement.

## Cross-cutting rules

- Enforce permissions on the API; frontend permission checks are UX only.
- Fetch `GET /api/auth/capabilities` after login, token refresh, and session restoration; store the result in `AuthStore`. Do not derive permissions from JWT claims and do not maintain a frontend role-to-permission matrix.
- Use `permissionGuard` with `data.permissions` on routes and `PermissionService` in components for navigation and control visibility only. Add permission constants only in `core/models/permissions.model.ts` (`Policies.*`) and keep names aligned with backend policy names.
- Build standalone components with `ChangeDetectionStrategy.OnPush`. Prefer `inject()` for dependency injection. Use the `app-` selector prefix and one component per file. Keep components thin: HTTP and domain logic belong in services, not templates or components.
- Organize features under `src/app/features/<feature>/` with colocated `*.component.ts/html/scss`, `*.service.ts`, and `models/`. Keep shell layout in `layout/`, reusable UI in `shared/`, and cross-cutting auth, guards, interceptors, and store code in `core/`. Do not put feature screens in `shared/` or create catch-all barrel services or models that accumulate unrelated types.
- Use `AuthStore` (NgRx Signal Store) for session and permission state. Use component-local `signal()` and `computed()` for UI state. Use small focused services only for multi-step flows that span components. Do not introduce classic NgRx Store, Redux, or Zustand without an explicit architectural decision.
- Use Angular `HttpClient` only; never introduce Axios or raw `fetch` in application code. Keep HTTP calls in feature or `core` services, never in components. Use `environment.apiUrl` and do not hardcode API hosts. Let requests pass through `languageInterceptor`, `jwtInterceptor`, and `errorInterceptor`. Map API field errors with `core/utils/api-error.util.ts`.
- Lazy-load routes via `loadComponent` or `loadChildren`. Protect authenticated areas with `authGuard` and capability-gated routes with `permissionGuard` plus `data.permissions`. Register routes in `app.routes.ts` or `layout/main.routes.ts`. When adding a main-shell route, update sidebar or navigation so permission-filtered navigation stays consistent. Do not hardcode login redirects in feature components; use guards and interceptors.
- Prefer Reactive Forms for create and edit flows. Keep local validators for shape and required rules; surface API business conflicts through `api-error.util.ts`.
- **Inline validation with a message (required on every form change):** every validator error a control can produce must show a bilingual message next to that field (`small.field-error` or `small.error-msg`). Invalid styling without text is not allowed. Cover every Angular error key the control uses (`required`, `email`, `minlength`, `maxlength`, `pattern`, `mismatch`, phone validators, custom keys, and `server`). Map each key to a specific `ERRORS.*` or feature i18n string; do not return `null` for a known error key. Show `control.errors['server']` in the same inline slot after `applyServerFieldErrors`.
- **Backend validations (required on every form or mutation that calls the API):** before shipping, read the matching Application `Commands/<Operation>/<Operation>Validator.cs`, handler `ValidationException` / `ConflictException` field codes, and `ApiErrorCodes`. For each field and code the API can return: map the API field name to the form control (extend `api-error.util.ts` aliases when names differ); apply with `extractApiFieldErrors`, `translateApiFieldErrors`, and `applyServerFieldErrors`; add matching `ERRORS.<Code>` keys in both `ar.json` and `en.json` (same names as `ApiErrorCodes` / SharedKernel `api-errors.*.json`). Non-field conflicts still get a bilingual toast. Do not swallow 400/409/422. Global 401/403 stay on interceptors.
- Add Arabic and English user-facing strings together in `src/assets/i18n/ar.json` and `en.json` in the same change. Use `TranslatePipe` in templates and `TranslateService.instant()` in services and toast messages. Default language is Arabic; control RTL through `LanguageService` and do not hardcode `dir` or `lang` in components. Add matching bilingual `ERRORS.*` entries when the UI surfaces new API error codes.
- Use PrimeNG with the existing theme and PrimeIcons. Match the relevant PowerPoint layout within the existing application shell, including RTL behavior. Reuse shared SCSS partials and respect existing CSS variables and theme; do not invent a parallel design system.
- Let interceptors own global 401 handling (session clear and redirect to login) and 403 handling (redirect to `/unauthorized`). Map validation and field errors to forms and bilingual toasts in features; do not swallow errors silently.

## Form and API validation checklist

Run this before handing off any create/edit/auth form or mutation UI:

- Does every form control with validators have an inline message for every error key it can produce, including `server`?
- Are those messages bilingual (`ERRORS.*` or feature keys in both `ar.json` and `en.json`), not hardcoded English or Arabic?
- Did you read the backend operation validator and handler errors for this request, not only the Angular validators?
- Are API field names mapped onto form controls, and are all `ApiErrorCodes` this UI can receive present under `ERRORS`?
- Do 400/409/422 responses update the matching fields or a toast instead of failing silently?

## Handoff

- Never use native browser dialogs (`alert`, `confirm`, or `prompt`) for application workflows. Use an in-app modal or toast that matches the existing UI instead.
- Format and lint changed files before handoff. Run `npm run build` before handing off frontend changes. Do not leave `console.log` statements in committed code. Use `@core/*`, `@app/*`, and `@env/*` path aliases instead of long relative imports.

## What not to do

- Do not authorize behavior from frontend checks, JWT permission claims, or hardcoded role matrices.
- Do not call `HttpClient` from components.
- Do not use native browser dialogs for application workflows.
- Do not introduce new UI libraries without an explicit request.
- Do not hardcode user-facing English or Arabic strings in templates.
- Do not leave a control invalid without an inline message, or return `null` from a field-error helper for a validator the control uses.
- Do not ship a mutation form without mapping the matching backend validator and handler field/conflict codes.
