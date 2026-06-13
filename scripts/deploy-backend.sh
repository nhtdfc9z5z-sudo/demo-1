#!/usr/bin/env bash
#
# Deploy the CapitalRent backend to YOUR OWN Supabase project.
#
# This applies all database migrations (tables, RLS, storage buckets) and
# deploys the Edge Functions to a Supabase project you control, so you are no
# longer depending on the original Lovable-managed backend.
#
# Prerequisites:
#   - Node.js installed (this script uses `npx supabase`, no global install)
#   - A Supabase account + a project (default ref below is your empty project)
#   - Your project's Database password (Supabase will prompt for it on `link`)
#
# Usage:
#   LOVABLE_API_KEY=xxxx ./scripts/deploy-backend.sh [PROJECT_REF]
#
set -euo pipefail

PROJECT_REF="${1:-eaccuilktorsbysgppad}"
SUPABASE="npx --yes supabase@latest"

echo "==> Target Supabase project: $PROJECT_REF"

echo "==> 1/5 Logging in to Supabase (a browser window / token prompt will open)…"
$SUPABASE login

echo "==> 2/5 Linking this repo to the project…"
$SUPABASE link --project-ref "$PROJECT_REF"

echo "==> 3/5 Applying database migrations (tables, RLS, storage buckets)…"
$SUPABASE db push

echo "==> 4/5 Deploying Edge Functions…"
$SUPABASE functions deploy

echo "==> 5/5 Setting Edge Function secrets…"
if [ -n "${LOVABLE_API_KEY:-}" ]; then
  $SUPABASE secrets set "LOVABLE_API_KEY=$LOVABLE_API_KEY"
  echo "    LOVABLE_API_KEY set."
else
  cat <<'EOF'
    WARNING: LOVABLE_API_KEY was not provided.
    The AI functions (analyze-*, generate-*, chat-contrato, ocr-documento)
    will return errors until you set it:

        npx supabase secrets set LOVABLE_API_KEY=your_key

    You can obtain this key from your Lovable project settings, or refactor
    the functions to call OpenAI/Anthropic directly instead.
EOF
fi

cat <<EOF

==> Backend deploy finished for project: $PROJECT_REF

Next steps (manual, in the Supabase dashboard for $PROJECT_REF):
  1. Settings -> API: copy the Project URL and the 'anon'/publishable key.
  2. Authentication -> URL Configuration:
       Site URL:      https://demo-1-nhtdfc9z5z-sudos-projects.vercel.app
       Redirect URLs: https://demo-1-nhtdfc9z5z-sudos-projects.vercel.app/**
                      http://localhost:8080/**
  3. In Vercel (project demo-1 -> Settings -> Environment Variables) update:
       VITE_SUPABASE_URL=<new project URL>
       VITE_SUPABASE_PROJECT_ID=$PROJECT_REF
       VITE_SUPABASE_PUBLISHABLE_KEY=<new anon key>
     then redeploy.
EOF
