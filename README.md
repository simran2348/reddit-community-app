# Community Leaderboard (Devvit)

A splash-only Reddit app that shows a subreddit's **top image posts** in a coverflow carousel, plus an optional **photo competition** with voting. It runs entirely inside the post in the feed: no expanded mode, and it never takes over Reddit's scrolling.

## Features

- **Top posts:** the 10 most upvoted image posts of the week, month or year, ranked by Reddit upvotes and cached for 10 minutes.
- **Coverflow carousel:**
  - The active image sits in the center, with dimmed neighbours on each side.
  - With 4 or more images it loops: image 10 sits to the left of image 1, and both directions wrap around. With 1–3 images it stops at the ends: the left arrow is disabled on the first image and the right arrow on the last
  - Navigate with the arrows, a swipe, a tap on a side image, or the keyboard arrow keys.
  - Each image has its own `3 / 10` tag in its top-right corner that moves with it and fades in when it reaches the front.
- **Post details on the image:** the avatar, title, upvotes and comments sit on a smooth dark fade at the bottom of the front photo.
- **Text posts (optional):** when mods turn on *Include text posts in Top posts*, text posts are ranked too and shown as dark cards with the start of their text (or the title if there's no body). The slideshow skips them, and the competition stays image-only.
- **Slideshow:** the round orange play button at the top right of the Top posts carousel opens a black overlay over the whole post. It starts from the current image, cross-fades through the images (fitted, never cropped) with the author's avatar at the bottom left at the slideshow interval set in Settings (3 or 5 s), and loops. Swipe, the arrows or the arrow keys move, Space pauses, Esc or ✕ closes. It requests real fullscreen only where the browser allows it; inside Reddit it covers the post. Code: `components/Slideshow.tsx`.
- **Loading, empty and error states** share one blurred panel. While loading it shows an orange line-art camera (SVG + CSS: the outline draws itself in, the lens rings spin, and the open rings close into full circles at the end of each cycle) on the dark card (same size as the empty-state card). The loader stays at least 5 seconds, longer if the data is slower (`useMinimumDuration`). It also stays up until the images have downloaded, so cards never show their own loading placeholders (`preloadImages.ts`): all 10 on Top posts; on the competition, all entries up to 20, otherwise the cards shown first (later ones load a couple ahead as you swipe). A 30-second safety cap stops a stuck image from keeping the loader up forever. Then the images replace it, or a small dark card appears in the middle with the icon and title (error states add a message and "Try again").
- **Dark only:** the whole app uses one dark theme (`src/client/styles/global.css`), whatever the Reddit or device theme.
- **Bottom navigation bar** (edge to edge, near-black):
  - 🏆 *Podium + current period* ("This week"): the top posts carousel.
  - *Trophy*: the photo competition. While a competition is running, an orange pulse ripples behind the icon whenever you're on another screen. When it's turned off, the screen shows "No competition right now".
  - *Cog*: settings.
- **Settings screen:**
  - Opens in place like the other tabs (no slide), edge to edge above the nav, with a dark see-through backdrop over the background photo.
  - **Community header:** the source subreddit's banner (edge to edge), icon, name and member count, with a **Join** button. Join subscribes the viewer to the subreddit the app is installed in (`subscribeToCurrentSubreddit`, needs `SUBSCRIBE_TO_SUBREDDIT` in `devvit.json` permissions). Reddit doesn't tell apps whether a user is already a member, so "Joined" reflects joins made through this button (stored in Redis). Icon and banner are requested at full size (Reddit's resize query is dropped on `styles.redditmedia.com`) so they stay sharp. Info is cached for 30 minutes and only fetched when Settings is first opened.
  - **Inline options:** *Top posts* (Week / Month / Year) and *Slideshow* (3s / 5s), each on one row.
  - **Send feedback to the mods** (bottom): opens a modmail compose to the community.
  - Choices are saved per viewer in browser storage.
- **Bottom nav shadow:** a soft shadow above the nav separates it from the screen content.
- **Photo competition:**
  - Moderators can turn it on in the app settings.
  - Image posts with a set flair become entries; leave the flair empty to include all image posts.
  - One vote per user per photo, and you can't vote for your own. These rules are enforced on the server.
  - Entries are ordered by competition votes (most first; ties newest first). The top 3 by votes get a medal (`public/p1.png`–`p3.png`) on the photo's top-left corner; entries with equal votes share a place, and entries with no votes get none. Medals update right after a vote; the order refreshes on the next load.
- **Avatars:** 40px circles showing the author's snoovatar, or a slightly zoomed `public/snoo.png` when they don't have one.
- **Post title:** the app creates its post on install, or from the moderator menu, titled `Welcome to r/<subreddit>`.

## Configuration

| Where | Setting | Purpose |
|---|---|---|
| `src/server/core/source.ts` | `getSourceSubreddit()` | Subreddit the posts come from: the one the app is installed in (needed for triggers) |
| Dev portal → app settings | Include text posts in Top posts | Also ranks text posts in Top posts (not the competition). Off by default |
| Dev portal → app settings | Enable photo competition | Turns the competition on, and shows the orange pulse on the trophy |
| Dev portal → app settings | Photo competition post flair | Flair that marks entries (empty = all image posts). Matching ignores emoji, punctuation, case and decorative fonts, so `Photography Contest` matches `📸 \| 𝗣𝗵𝗼𝘁𝗼𝗴𝗿𝗮𝗽𝗵𝘆 𝗖𝗼𝗻𝘁𝗲𝘀𝘁` |
| `devvit.json` → `dev.subreddit` | — | Subreddit used by `npm run dev` |

## Icons

All UI icons come from [lucide-react](https://lucide.dev) (tree-shaken, so only the icons imported are bundled): Podium, Trophy and Settings in the nav, chevrons, Play (slideshow button), Play/Pause/X in the slideshow, ArrowBigUp and MessageSquare on posts, Users, Plus/Check, MessageSquareText in the Settings community card, and Quote on text-post cards. The camera loader is a custom SVG, and the medals are PNGs in `public/`.

## Project structure

```
src/
  server/                 Devvit backend (Hono)
    routes/api.ts         /api/config, /api/rankings, /api/community(/join), /api/competition(/votes|/vote)
    routes/menu.ts        Moderator menu: create the post
    routes/triggers.ts    On install: create the post; post submit/flair/delete: update the competition index
    routes/scheduler.ts   Every 15 min: competition catch-up scan for missed triggers
    core/rankings.ts      Top image (and optionally text) posts + author avatars (Redis-cached)
    core/community.ts     Community banner/icon/members (cached) and Join
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
- **Viewer preferences** (period, slideshow interval) live in `localStorage` and fail safely if storage is unavailable.

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
