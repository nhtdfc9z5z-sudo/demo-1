# Deployment status & runbook — CapitalRent (Teal Property Hub)

## Current state (as of import)

| Layer | Status | Details |
|---|---|---|
| Repo | ✅ on GitHub | `github.com/nhtdfc9z5z-sudo/demo-1` (branch `main`) |
| Frontend | ✅ live & public | https://demo-1-nhtdfc9z5z-sudos-projects.vercel.app (Vercel, project `demo-1`) |
| Build | ✅ fixed | PWA service-worker minification disabled to avoid a `terser` worker deadlock on Node 22 (see `vite.config.ts`) |
| Backend | ⚠️ not owned by you | App points to Lovable-managed Supabase `uoheygncxbftbfqfqwcu` (alive, but you have no dashboard access) |

The frontend can already read/write to the original backend with the public
anon key, **but you cannot administer that backend** (no dashboard access, can't
set Auth redirect URLs, can't manage data or secrets). For a real production
setup you should own the backend.

## Frontend environment variables (Vercel)

These are public client values (safe to expose). Set for Production + Preview + Development:

```
VITE_SUPABASE_URL=https://uoheygncxbftbfqfqwcu.supabase.co
VITE_SUPABASE_PROJECT_ID=uoheygncxbftbfqfqwcu
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY=<maps browser key>
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID=<maps tracking id>
```

(After migrating the backend — below — repoint the first three to your own project.)

## Backend: the decision

The app's Edge Functions only need ONE external secret: `LOVABLE_API_KEY`
(Lovable's AI gateway, used by all `analyze-*` / `generate-*` / `chat-contrato`
/ `ocr-documento` functions). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### Option A — Manage the existing backend via Lovable (least work)
If you still have the Lovable project, configure the Site URL / redirect URLs
and any custom domain from inside Lovable, and keep using
`uoheygncxbftbfqfqwcu`. Keeps all existing data and the working AI key.

### Option B — Own the backend in your Supabase project (recommended) ✅
Move everything to the empty project you created (`eaccuilktorsbysgppad`).

What gets created automatically by the migrations:
- All tables + Row Level Security policies (115 migrations)
- Storage buckets: `facturas`, `incidencia-archivos`, `property-photos`,
  `contratos`, `contrato-plantillas`, `incidencia-documentos`,
  `inquilino-documentos`, `documentos`

Run:

```bash
# from the repo root; LOVABLE_API_KEY is optional but needed for AI features
LOVABLE_API_KEY=your_key ./scripts/deploy-backend.sh eaccuilktorsbysgppad
```

Then finish the wiring (the script prints these too):
1. Supabase dashboard → Settings → API: copy the **Project URL** + **anon key**.
2. Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://demo-1-nhtdfc9z5z-sudos-projects.vercel.app`
   - Redirect URLs: `https://demo-1-nhtdfc9z5z-sudos-projects.vercel.app/**` and `http://localhost:8080/**`
3. Vercel → project `demo-1` → Settings → Environment Variables: update
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   to the new project, then **Redeploy**.

> Note: the new project starts empty. Any data in the original backend is not
> copied. If you need that data, export it first (requires access to the
> original project).

## Follow-ups / hardening
- Restrict the Google Maps browser key by HTTP referrer (your Vercel domain) in Google Cloud Console.
- Consider code-splitting: the main JS chunk is ~3.3 MB (~916 KB gzip).
- `npm audit` reports vulnerabilities typical of Lovable exports; review before heavy production use.
