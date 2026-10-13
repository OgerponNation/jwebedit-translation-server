JWebEdit Translation Backend
============================

WHY THIS EXISTS
The Java desktop app does NOT contain your DeepL API key. Users send text to
this server, this server talks to DeepL using the private key, and only the
translated text is sent back.

LOCAL TEST
1. Install Node.js 18 or newer.
2. Open PowerShell in this folder.
3. Set your key for this terminal only:
     $env:DEEPL_API_KEY="YOUR_REAL_DEEPL_KEY"
4. For DeepL API Pro only, also run:
     $env:DEEPL_API_URL="https://api.deepl.com/v2/translate"
5. Run:
     node server.js
6. Leave that window open.
7. The editor's default config calls http://localhost:3000/translate.

PUBLIC USE
To let other people translate without a key, this backend must be deployed to
a public HTTPS URL. Put DEEPL_API_KEY in the hosting service's secret/environment
settings -- never in server.js and never in the Java app.

After deployment, copy your public URL into the project's
translation-server-url.txt, for example:
     https://your-service.example.com

The Java client automatically adds /translate.

BASIC PROTECTION INCLUDED
- 30 requests/minute per client IP by default
- 5,000 characters maximum per request by default
- target-language allowlist
- 64 KB maximum request body

These are starter protections, not production-grade billing protection. If this
is made public to many users, add persistent quotas/authentication at the server.
