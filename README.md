# Community Leaderboard (Devvit)

A splash-only Reddit app that shows a subreddit's **top image posts** in a coverflow carousel, plus an optional **photo competition** with voting. It runs entirely inside the post in the feed: no expanded mode, and it never takes over Reddit's scrolling.

## Features

- **Top posts:** the 10 most upvoted image posts of the week, month or year, ranked by Reddit upvotes and cached for 10 minutes.
- **Coverflow carousel:**
  - The active image sits in the center, with dimmed neighbours on each side.
  - With 4 or more images it loops: image 10 sits to the left of image 1, and both directions wrap around. With 1–3 images it stops at the ends: the left arrow is disabled on the first image and the right arrow on the last (auto-play rewinds to the first).
  - Navigate with the arrows, a swipe, a tap on a side image, or the keyboard arrow keys.
  - Ranks 1–3 show a medal (`public/p1.png`–`p3.png`) on the image's top-left corner, sized to the card.
  - Each image has its own `3 / 10` tag in its top-right corner that moves with it and fades in when it reaches the front.
- **Post details on the image:** the avatar, title, upvotes and comments sit on a smooth dark fade at the bottom of the front photo.
- **Auto-play:** optional, every 3 or 5 seconds. It pauses on hover, while settings are open, or when the app is in the background.
- **Bottom navigation bar** (edge to edge, solid background):
  - 🏆 *Podium + current period* ("This week"): the top posts carousel.
  - *Trophy*: the photo competition. While a competition is running, an orange pulse ripples behind the icon whenever you're on another screen. When it's turned off, the screen shows "No competition right now".
  - *Cog*: settings.
- **Settings screen:**
  - Holds the week/month/year toggle and the auto-play options.
  - Slides in from the right above the nav bar while the main screen slides out, over the same background.
  - Choices are saved per viewer in browser storage.
- **Photo competition:**
  - Moderators can turn it on in the app settings.
  - Image posts with a set flair become entries; leave the flair empty to include all image posts.
  - One vote per user per photo, and you can't vote for your own. These rules are enforced on the server.
- **Avatars:** 40px circles showing the author's snoovatar, or a slightly zoomed `public/snoo.png` when they don't have one.
- **Post title:** the app creates its post on install, or from the moderator menu, titled `Welcome to r/<subreddit>`.

## Configuration

| Where | Setting | Purpose |
|---|---|---|
| `src/server/core/source.ts` | `getSourceSubreddit()` | Subreddit the posts come from: the one the app is installed in (needed for triggers) |
| Dev portal → app settings | Enable photo competition | Turns the competition on, and shows the orange pulse on the trophy |
| Dev portal → app settings | Photo competition post flair | Flair that marks entries (empty = all image posts). Matching ignores emoji, punctuation, case and decorative fonts, so `Photography Contest` matches `📸 \| 𝗣𝗵𝗼𝘁𝗼𝗴𝗿𝗮𝗽𝗵𝘆 𝗖𝗼𝗻𝘁𝗲𝘀𝘁` |
| `devvit.json` → `dev.subreddit` | — | Subreddit used by `npm run dev` |

## Project structure

```
src/
  server/                 Devvit backend (Hono)
    routes/api.ts         /api/config, /api/rankings, /api/competition(/votes|/vote)
    routes/menu.ts        Moderator menu: create the post
    routes/triggers.ts    On install: create the post; post submit/flair/delete: update the competition index
    routes/scheduler.ts   Every 15 min: competition catch-up scan for missed triggers
    core/rankings.ts      Top image posts + author avatars (Redis-cached)
    core/competition.ts   Entries, vote counts, server-side vote validation
    core/settings.ts      Reads subreddit settings
    core/source.ts        Source subreddit (the install subreddit)
    core/media.ts         Picks an image URL from a post
    core/cache.ts         Small Redis read-through cache
  client/                 Splash UI (React)
    App.tsx               Bottom nav, screens, settings screen, preferences
    screens/              TopImagesScreen, CompetitionScreen
    components/           Carousel, cards, settings panel, states
    hooks/                Carousel/swipe logic, dismiss, visibility
    services/             Typed fetch wrappers for /api
    preferences.ts        Per-viewer settings (browser storage)
    periods.ts            Week/month/year labels
    styles/               global.css (tokens, background), components.css
  shared/api.ts           Types shared by client and server
public/                   background.jpg, snoo.png, p1–p3.png (medals)
```

## Data and storage

- **Rankings** are read from Reddit's top-posts listing and cached in Redis for 10 minutes. Empty results are not cached.
- **Competition entries** live in a Redis sorted set of post IDs (newest first), kept current by triggers:
  - `onPostSubmit` and `onPostFlairUpdate` re-check the post and add it if it has the competition flair, or remove it if it doesn't.
  - `onPostDelete` removes it.
  - The first load for a flair runs a one-time backfill over the ~1,000 newest posts to pick up earlier entries.
  - A catch-up job (`scheduler.tasks` in `devvit.json`, every 15 minutes) re-checks the 100 newest posts in case a trigger failed. It adds missing entries and removes indexed posts whose flair no longer matches. Posts already indexed are left as they are, and votes are never touched. It does nothing while the competition is off.
  - When shown, each entry is re-checked for an image and moderation state, so a removed, author-deleted (author `[deleted]`) or NSFW post drops out even if a trigger was missed, and a re-approved one comes back. Top posts skip author-deleted posts the same way.
  - The list is cached for 5 minutes and cleared by any trigger. Vote counts are always live.
  - `[competition]` lines in `npx devvit logs` show the backfill, each indexed post, catch-up results, and fetch counts.
- **Votes** are stored in Redis, keyed by Reddit post ID. Duplicate votes are blocked with an atomic `HSETNX` per user and post.
- **Viewer preferences** (period, auto-play) live in `localStorage` and fail safely if storage is unavailable.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Playtest live on the dev subreddit |
| `npm run build` | Build client and server |
| `npm run test:types` | Type check |
| `npm run lint` | Lint |
| `npm run test:unit` | Unit tests |
| `npm run deploy` | Type check, lint, then upload a new version |
| `npm run launch` | Deploy and publish for review |
| `npm run login` | Log the CLI into Reddit |

Requires Node 24+. CI (`.github/workflows/ci.yaml`) runs type check, lint, unit tests and build on every push to `main`.

## Known leftovers

`src/client/game.tsx`, `game.html` and `hooks/useCounter.ts` are leftovers from the starter template, and `useCounter.ts` breaks the type check in CI. Remove them with:

```sh
git rm src/client/game.tsx src/client/game.html src/client/hooks/useCounter.ts
```

These are also unused and safe to remove: `index.css`, `components/InfoPopover.tsx`, `components/AppHeader.tsx`, `components/TimeFilter.tsx`, `components/MainNavigation.tsx`, `components/SettingsButton.tsx`, and `server/routes/forms.ts`. If you remove `forms.ts`, also remove its import and route in `server/index.ts`.
