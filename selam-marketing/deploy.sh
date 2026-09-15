#!/usr/bin/env bash
# deploy.sh — Sync ~/selam-landing.html + ~/selam-onboarding.html + ~/assets/
# into this directory and push to the Vercel `selam-landing` project that
# serves heyselam.ai (heyselam.app 301s to it).
#
# Run any time you've edited the landing or onboarding HTML at ~/.
# No build step — these are static files.

set -euo pipefail

HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$HERE"

echo "Syncing source files from ~/..."
cp ~/selam-landing.html    "$HERE/selam-landing.html"
cp ~/selam-onboarding.html "$HERE/selam-onboarding.html"
cp ~/selam-security.html   "$HERE/selam-security.html"
cp ~/selam-vs-chatgpt.html "$HERE/selam-vs-chatgpt.html"
cp ~/selam-local-ai.html   "$HERE/selam-local-ai.html"
cp ~/selam-vs-openworker.html   "$HERE/selam-vs-openworker.html"
cp ~/selam-phone-assistant.html "$HERE/selam-phone-assistant.html"
cp ~/selam-meeting-notes.html   "$HERE/selam-meeting-notes.html"
cp ~/selam-ops.html             "$HERE/selam-ops.html"
mkdir -p "$HERE/assets"
rsync -a --delete ~/assets/ "$HERE/assets/"

# vercel.json: cleanUrls + / → /selam-landing rewrite (matches what's been
# served from heyselam.app for months). Refreshed every run so it can't drift.
cat > "$HERE/vercel.json" <<'EOF'
{
  "cleanUrls": true,
  "redirects": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "heyselam.app" }],
      "destination": "https://heyselam.ai/",
      "permanent": true
    },
    {
      "source": "/",
      "has": [{ "type": "host", "value": "www.heyselam.ai" }],
      "destination": "https://heyselam.ai/",
      "permanent": true
    },
    {
      "source": "/:path+",
      "has": [{ "type": "host", "value": "heyselam.app" }],
      "destination": "https://heyselam.ai/:path+",
      "permanent": true
    },
    {
      "source": "/:path+",
      "has": [{ "type": "host", "value": "www.heyselam.ai" }],
      "destination": "https://heyselam.ai/:path+",
      "permanent": true
    }
  ],
  "rewrites": [
    { "source": "/", "destination": "/selam-landing" },
    { "source": "/security", "destination": "/selam-security" },
    { "source": "/vs/chatgpt-desktop", "destination": "/selam-vs-chatgpt" },
    { "source": "/local-ai-assistant", "destination": "/selam-local-ai" },
    { "source": "/vs/openworker", "destination": "/selam-vs-openworker" },
    { "source": "/ai-phone-assistant", "destination": "/selam-phone-assistant" },
    { "source": "/ai-meeting-notes", "destination": "/selam-meeting-notes" },
    { "source": "/ops", "destination": "/selam-ops" }
  ]
}
EOF

# robots.txt + sitemap.xml — generated every run like vercel.json so the
# SEO surface can't drift from what's deployed.
cat > "$HERE/robots.txt" <<'ROBOTS'
User-agent: *
Allow: /
Disallow: /ops
Disallow: /selam-ops
Disallow: /api/
Sitemap: https://heyselam.ai/sitemap.xml
ROBOTS

cat > "$HERE/sitemap.xml" <<SITEMAP
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://heyselam.ai/</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>1.0</priority></url>
  <url><loc>https://heyselam.ai/security</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.6</priority></url>
  <url><loc>https://heyselam.ai/vs/chatgpt-desktop</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.7</priority></url>
  <url><loc>https://heyselam.ai/local-ai-assistant</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.7</priority></url>
  <url><loc>https://heyselam.ai/vs/openworker</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.7</priority></url>
  <url><loc>https://heyselam.ai/ai-phone-assistant</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.7</priority></url>
  <url><loc>https://heyselam.ai/ai-meeting-notes</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.7</priority></url>
</urlset>
SITEMAP

echo "Files synced. Deploying..."
vercel deploy --prod --yes

echo ""
echo "✓ Live at https://heyselam.ai/"
echo "  Verify with: curl -s https://heyselam.ai/ | grep '<title>'"
