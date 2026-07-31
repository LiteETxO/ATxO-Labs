#!/usr/bin/env bash
# deploy.sh — Sync ~/selam-landing.html + ~/selam-onboarding.html + ~/assets/
# into this directory and push to the Vercel `selam-landing` project that
# serves heyselam.app.
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
mkdir -p "$HERE/assets"
rsync -a --delete ~/assets/ "$HERE/assets/"

# vercel.json: cleanUrls + / → /selam-landing rewrite (matches what's been
# served from heyselam.app for months). Refreshed every run so it can't drift.
cat > "$HERE/vercel.json" <<'EOF'
{
  "cleanUrls": true,
  "rewrites": [
    { "source": "/", "destination": "/selam-landing" },
    { "source": "/security", "destination": "/selam-security" }
  ]
}
EOF

# robots.txt + sitemap.xml — generated every run like vercel.json so the
# SEO surface can't drift from what's deployed.
cat > "$HERE/robots.txt" <<'ROBOTS'
User-agent: *
Allow: /
Sitemap: https://heyselam.app/sitemap.xml
ROBOTS

cat > "$HERE/sitemap.xml" <<SITEMAP
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://heyselam.app/</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>1.0</priority></url>
  <url><loc>https://heyselam.app/security</loc><lastmod>$(date +%Y-%m-%d)</lastmod><priority>0.6</priority></url>
</urlset>
SITEMAP

echo "Files synced. Deploying..."
vercel deploy --prod --yes

echo ""
echo "✓ Live at https://heyselam.app/"
echo "  Verify with: curl -s https://heyselam.app/ | grep '<title>'"
