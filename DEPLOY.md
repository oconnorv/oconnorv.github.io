# Moving oconnorv.com to GitHub Pages

The goal: the website moves to GitHub Pages (free), the domain and its DNS stay at DreamHost, and
Google Workspace email keeps working. The website switch only touches the `@` and `www` records;
the mail records (MX and TXT) must stay exactly as they are.

## 0. Before you start

- Take a screenshot of the DNS records page for oconnorv.com in the DreamHost panel.
- Note your DreamHost renewal date.

## 1. Check the preview

In the GitHub repo, open **Settings → Pages**. The source should be "Deploy from a branch",
branch `main`, folder `/ (root)`. The site is then live at https://oconnorv.github.io/.

## 2. Verify the domain with GitHub

This stops anyone else from claiming oconnorv.com on GitHub.

1. Click your profile picture → **Settings → Pages** (your account settings, not the repo's).
2. **Add a domain** → `oconnorv.com`. GitHub shows a TXT record.
3. In DreamHost, add that TXT record (name `_github-pages-challenge-oconnorv`, value from GitHub).
4. Back in GitHub, click **Verify**. Leave the TXT record in place afterwards.

## 3. Point the domain at GitHub (DreamHost panel)

1. Set the domain's website to **DNS Only**. This removes DreamHost's own website records.
2. **Straight away**, check the MX records and the Google TXT records (SPF `v=spf1 ...`,
   `google._domainkey`, `_dmarc`, `google-site-verification`) are still listed. Re-add anything
   missing from your screenshot.
3. Add these records. Don't add any wildcard (`*`) records.

| Type | Name | Value |
|---|---|---|
| A | `@` (blank) | `185.199.108.153` |
| A | `@` (blank) | `185.199.109.153` |
| A | `@` (blank) | `185.199.110.153` |
| A | `@` (blank) | `185.199.111.153` |
| AAAA | `@` (blank) | `2606:50c0:8000::153` |
| AAAA | `@` (blank) | `2606:50c0:8001::153` |
| AAAA | `@` (blank) | `2606:50c0:8002::153` |
| AAAA | `@` (blank) | `2606:50c0:8003::153` |
| CNAME | `www` | `oconnorv.github.io` |

## 4. Turn on the custom domain

In the repo's **Settings → Pages**, set the custom domain to `oconnorv.com` and save. (GitHub adds a
`CNAME` file to the repo.) Once the DNS check shows a green tick, tick **Enforce HTTPS**. DNS and
the HTTPS certificate can take from a few minutes to about 24 hours.

## 5. Check everything

- https://oconnorv.com loads the game, and https://www.oconnorv.com redirects to it.
- Send an email to your oconnorv.com address from another account, and send one out from it.

## 6. Cancel DreamHost hosting (keep the domain)

- Cancel the **hosting** plan only, and keep the domain registration. DreamHost keeps registrations
  active and manageable after hosting closes.
- Before cancelling, check the refund terms and ask DreamHost to confirm DNS stays editable on a
  registration-only account. If it doesn't, move DNS to Cloudflare's free DNS first, recreating
  every record (especially the mail ones) before switching nameservers.
