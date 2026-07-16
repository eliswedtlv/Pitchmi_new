# PitchMi v2 — Milestone 2 Product Spec (feed, leaderboards, identity)

Status: **product spec only** — convert to a `/goal` spec (`docs/cc-goal-pitchmi-v2.md`) after v1 ships and its real code can be inspected. Do not build from this document.

Depends on: v1 core loop (`docs/cc-goal-pitchmi-v1.md`, T-1150) deployed and stable.

## 1. Goals

Turn PitchMi from a private practice tool into a public stage: users can publish their best takes to a web feed with scores, compete on leaderboards, and carry their identity/history across devices.

## 2. Features

### 2.1 Google sign-in (Supabase OAuth)
- Anonymous stays the default — nothing about the v1 flow changes for signed-out users.
- "Sign in with Google" offered at: My videos (cross-device sync pitch), first Publish attempt, and settings.
- On sign-in, **link the anonymous identity**: Supabase `linkIdentity` / merge — all existing projects and saved takes move to the Google-backed user. Test the merge path hard; losing a user's history is the worst failure of this milestone.
- Basic scopes only (openid/email/profile) — no Google verification review required. Prereq (Eli, manual): Google Cloud OAuth consent screen with homepage + privacy-policy URLs, client ID/secret into Supabase.

### 2.2 Publish flow
- "Publish" action on a cloud-saved take. Requires sign-in.
- First publish asks for a **public nickname** (unique, 3–20 chars, profanity-filtered); stored in a `profiles` table keyed by user id.
- Publish = row in `published_videos` referencing the saved take + a denormalized score snapshot + use_case + language. Video becomes publicly playable (public bucket copy or long-lived signed URL strategy — decide at build time against real v1 storage code).
- Unpublish (owner) and admin unpublish (moderation) both required. Explicit consent copy at publish time: score + video become public.

### 2.3 Public feed
- Public web page (no auth to view), SSR for shareability/SEO: `/feed`, item pages `/v/[id]` with OG tags (thumbnail, score).
- Sort: Newest / Top (score) / per use-case filter / per language filter.
- Cards: video player, nickname, overall score, dimensions on expand, use-case chip, published date.
- Infinite scroll with cursor pagination.

### 2.4 Leaderboards
- `/leaderboard`: daily / weekly / all-time, filterable by use-case and language.
- Rank by overall score; tie-break: accuracy, then timing, then earliest publish.
- One entry per user per board (their best published take in the window).
- Materialized view or scheduled refresh — decide at build time; must stay cheap at low traffic.

### 2.5 Moderation (minimum viable)
- Report button on feed items (reason enum) → `reports` table.
- Admin UI (v1 admin) gains a Moderation tab: reported items queue, play, unpublish, ban-from-publishing flag on the profile.
- Auto-hide when reports from ≥ 3 distinct users pending review.
- This is the one place admin CAN see content (published = already public).

### 2.6 Ad network swap (parallel, independent)
- Replace the `<AdSlot/>` demo stub with the chosen network (decision pending — Eli evaluates options; the v1 stub contract `GET /api/ad` was designed for this).

## 3. Data model additions (sketch)

```
profiles: user_id pk → nickname unique, banned_from_publish bool, created_at
published_videos: id, take_id, user_id, use_case, language, scores jsonb,
                  overall int, published_at, hidden bool
reports: id, published_video_id, reporter_user_id, reason, ts
```

RLS: profiles/published_videos publicly readable (published + not hidden); writes owner-only; reports insert-any-authed, read admin-only.

## 4. Non-scope (v2)

- Comments, likes, follows, or any social graph.
- Payments / premium tiers.
- Native apps.
- Notification emails.

## 5. Open questions (answer before converting to /goal spec)

1. Public video hosting: copy to public bucket vs CDN vs signed-URL rotation — cost/abuse trade-off.
2. Nickname profanity filter: library vs LLM check (multilingual!).
3. Leaderboard windows in which timezone (suggest UTC, display local).
4. Does publishing require a minimum score (quality floor for the feed)?
5. Feed thumbnails: generate server-side (ffmpeg frame grab) at publish time?
6. Anti-gaming: same video republished repeatedly; rate-limit publishes (suggest 3/day).
