# Harami Manus — Automated Anime Clips Page

Free stack: local video bank → GitHub Pages hosting → GitHub Actions → Instagram + Facebook
auto-posting. No paid APIs, no hosting bill.

## How it works

1. `scripts/sync-videos.js` reads video+caption pairs from a local folder (currently
   `~/Desktop/Kahaniwaala 2/memes/reels`), copies new videos into `videos/` (renamed to just
   their ID, dropping the source-account prefix), and adds an entry to `data/videos.json`
   with the caption and auto-generated hashtags (anime/One Piece tags based on caption
   content).
2. GitHub Pages serves everything in `videos/` at a public URL, which both platforms'
   posting APIs need.
3. `.github/workflows/post-instagram.yml` and `post-facebook.yml` each run on their own
   schedule (every hour, 10am-10pm IST, offset 30 min from each other to avoid a git-push
   race) and post the next not-yet-posted video to that platform via `scripts/post-social.js`.
   At 13 posts/day per platform, the current 65-video bank lasts ~5 days before running dry —
   keep the bank topped up (see "Adding new videos" below).
4. The same video can be posted to both Instagram and Facebook — they track posted-status
   independently (`igPostedAt` / `fbPostedAt` per video).

## Adding new videos

Whenever you add more videos to the local folder, run:

```bash
npm run sync
```

Then commit and push the new videos + updated `data/videos.json`:

```bash
git add videos/ data/videos.json
git commit -m "Add new videos"
git push
```

This step needs to be run locally (or asked of Claude in a new session) — GitHub Actions
can't see your local filesystem, so new content has to be synced up manually each time you
add to the bank.

## One-time setup

### 1. Push this repo and enable GitHub Pages

```bash
git remote add origin https://github.com/ashish200695/harami-manus.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source → Deploy from a
branch**, select `main` / `/ (root)`.

### 2. Connect Instagram (same Meta app as CelebCity)

Reusing the **CelebCity Automation** Meta app:

1. developers.facebook.com → CelebCity Automation → **Use cases** → **Customize** next to
   "Manage messaging & content on Instagram" → **API setup with Instagram login**
2. Under **Roles → Instagram Testers**, add this new Instagram account as a tester, and
   accept the invite from the Instagram app (Settings → Website permissions → Tester invites)
3. Back in the API setup page, under "2. Generate access tokens", click **Add account**,
   log in with the new Instagram account, then **Generate token**
4. Copy the **Instagram User ID** and the **access token**

### 3. Connect Facebook Page

1. Create a Facebook Page for this project if you don't have one yet
2. In the same Meta app, add the **Facebook Login** / Pages API product if not already there
3. Get a **Page Access Token** (via Graph API Explorer: select the app, select the Page,
   request `pages_manage_posts` and `pages_read_engagement` permissions, generate token) and
   your **Page ID** (found in Page Settings → About, or via `/me/accounts` API call)

### 4. Add GitHub secrets

In the repo: **Settings → Secrets and variables → Actions**:
- `IG_USER_ID`, `IG_ACCESS_TOKEN` — from step 2
- `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN` — from step 3
- Repository **variable** `SITE_BASE_URL` = `https://ashish200695.github.io/harami-manus`
  (or a custom domain if you add one later)

Once those exist, both workflows post automatically — no further action needed.

**Token expiry**: like CelebCity, these tokens expire periodically (~60 days for Instagram)
unless you set up long-lived System User tokens. Posting will silently stop until refreshed.

## Content

All video content is used under license (per explicit confirmation) — see `data/videos.json`
for the full tracked list with original captions and per-platform posting status.
