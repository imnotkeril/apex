# APEX User Guide

A page-by-page walkthrough of the APEX dashboard. Sign in at `/login` with **Continue with
Google** (or the `DEV_AUTH` bypass in local dev), and you land on the Dashboard. The left
sidebar (collapsible via the button at the bottom) groups pages into **Main**, **Content**,
and **Settings**; your avatar at the bottom of the sidebar opens **Profile**.

A fresh install has no data, so pages start empty and show what to do next (add a source,
parse, create a draft). Nothing on a page is sample data.

## Dashboard

The landing page (`/`). Gives a one-screen overview of the whole pipeline:

- **Metric strip**: new posts (24h), active clusters, drafts ready, published this week,
  total views this week — each with a vs.-previous-period delta.
- **AI Recommendations**: the top 3 topic clusters (by a freshness/diversity/post-count
  score), each with **Create Draft**, **View Sources**, and **Dismiss**.
- **Sources Health**, **Content Pipeline** (drafts currently in the generation pipeline,
  with a step-dot progress indicator), and **Recent Activity** — three panels side by side.
- **Auto Mode** panel: on/off state, next scheduled publish times, top auto-mode
  candidates, and target platforms; links to the Auto Mode page.
- **Quick Actions**: Create New Draft, Parse All Sources, Refresh Clusters, Open Knowledge
  Graph, Open Calendar.

Tip: dismissing a cluster here removes it from recommendations everywhere (it's the same
`POST /clusters/{id}/dismiss` action as on the Topic Clusters page).

## Raw Posts

`/content/raw-posts` — every piece of content collected from your sources, before or after
AI analysis.

- **Toolbar**: Parse Now / Parse All Sources (triggers source parsing), **Add URL / Video /
  Text** (manual input — resolves a web article or YouTube video to text, or accepts plain
  text directly), and an auto-parse schedule indicator.
- **Filters** (left rail): search, source, status (new/analyzed/used/failed), tags,
  date range, language, minimum post length, content-type tag.
- **Table**: date, source (with platform icon), AI summary + text preview, tags, status,
  "used in" (which cluster/drafts reference it), language, and row actions (view full text,
  create a draft from this post).
- **Bulk actions** (select rows first): Create Draft from Selected, Re-analyze, Edit Tags,
  Mark as Used.
- Failed posts show an inline error note with a **Retry** link that re-triggers parsing for
  that post's source.

## Topic Clusters

`/content/clusters` — AI-grouped topics discovered across your raw posts.

- **Toolbar**: Refresh Clusters (queues re-clustering), Export (CSV), sort by
  priority/freshness/post count, Grid/List view toggle.
- **Filters**: search title/description, status (active/used/dismissed/archived),
  priority (high/medium/low), tags, date range, min source count.
- Each **cluster card** shows priority badge, title, description, tags, source/post/
  freshness counts, top-source avatars, and three actions: **Create Draft**, **View
  Posts** (jumps to Raw Posts filtered by this cluster), **Dismiss**.
- Clicking a card opens a **details panel** (inline on wide screens, a slide-over drawer
  otherwise) with the full stat breakdown, top sources, and the same actions.
- Select multiple cards (checkbox) to **Dismiss Selected** in bulk.

## Drafts

`/content/drafts` — every draft, across every pipeline stage.

- **Status tabs**: All, Draft, In Progress, Ready, Scheduled, Published, Archived.
- **Filters**: search, status, style preset, language, date range, created-by mode
  (Manual/Auto).
- **Table** columns: topic + preview, tags, style preset, output formats (platform icons),
  status (with a progress bar while generating), fact-check status (with a **View Issues**
  link when issues are found), last-updated, and row actions (view, edit, delete).
- **Create New Draft** opens the draft creation screen (below).

### Create / Edit Draft

`/content/drafts/new` (also used for editing, via `?id=`). Reached from Drafts, from a
cluster's **Create Draft**, or from selected Raw Posts.

- **Left panel**: the source posts this draft is based on (from raw posts or a cluster).
- **Draft Settings**: topic, style preset, language, output formats (Telegram, LinkedIn
  Post/Article, Twitter, Email, PDF, PPTX, Image — toggle chips), translation targets
  (en/ru/ja/ko/zh). **Generate** kicks off the pipeline.
- Once generation starts, a **Generation** panel appears with a step tracker (research →
  synthesis → styling → formatting → translation → fact-check → image) and the current
  styled text. When the draft reaches **ready**, **Publish Now** and **Schedule** buttons
  appear.

## Calendar

`/content/calendar` — scheduled and published content across platforms.

- **Views**: Month, Week, List; navigate with the prev/next arrows or **Today**.
- **Filters**: platform, language, status (scheduled/publishing/published/failed/
  cancelled).
- Each day cell shows color-coded event chips (platform tint, status-colored left border);
  clicking one opens the **details panel** with full preview, platforms/languages, related
  draft link, and actions: **Edit Schedule** / **Reschedule** (opens a date-time picker
  modal) and **Cancel Scheduled Post**.
- **Schedule Content** button jumps to Drafts filtered to `ready`, since scheduling starts
  from an existing ready draft's Publish flow.
- A legend at the bottom of the calendar explains the platform icons and status colors.

## Knowledge Graph

`/content/graph` — visual map of how raw and published content relate.

- **Toolbar**: view filter (All / Raw Posts / Published Posts), tag filter, date range,
  source filter, node search.
- **Canvas**: force-style layout with zoom in/out/fit controls; nodes are raw posts (sky
  blue) or published posts (lavender), sized larger for the most-connected node; edges are
  color/style-coded by relation type (Same Topic, Continuation, Contradicts, Supplements,
  Source Of, Auto Semantic).
- **Stats row**: node/edge counts (raw vs. published, manual vs. auto-generated edges),
  graph density, cluster count, last-updated with a manual refresh button.
- Clicking a node opens **Node Details**: tags, summary, engagement metrics (for published
  posts), the list of connected nodes with relation type and confidence score, and actions
  to **Create Draft from This** or **View Full Content**.
- Manual links between two pieces of content can be added via the API
  (`POST /content/graph/links`); the graph also carries automatically generated semantic
  links.

## Published Posts

`/content/published` — performance tracking for everything that went live.

- **Toolbar**: Sync Engagement (refreshes like/repost/view/comment counts), Export (CSV),
  page-size selector.
- **Filters**: search, platform, date range, tags, language, engagement range, sort
  (newest / engagement).
- **Table**: post preview, tags, platform, published-at, engagement (likes, views,
  reposts, comments), language, and row actions (view details, sync engagement for that
  row).
- Clicking a row opens **Post Details**: full engagement breakdown, content preview, tags,
  a link back to the source draft, sync action, and "view on platform" (external link).

## Sources

`/content/sources` — where content comes from and how healthy each source is.

- **Type tabs**: All, Telegram, Twitter/X, RSS, YouTube, Other.
- **Stats bar**: total, active, with errors, disabled, 7-day success rate, last-parsed.
- **Add Source** opens a modal (type, handle/URL, display name, language); type and
  handle are fixed once created — edit only changes display name/language.
- **Table**: source name + handle, type, status, last parsed/last post, 7-day success rate
  (with a mini progress bar), error count, and row actions (**Run parser now**, **Edit**,
  **Enable/Disable**).
- Clicking a row opens **Source Details**: description, language, 7-day stats (posts
  parsed, success rate, errors, duplicates, filtered out), recent parse activity log, and
  the same run/edit/enable-disable actions.

## Styles & Presets

`/content/styles` — reusable AI style presets (tone, format, and rewrite rules applied
during draft generation).

- **Stats**: total, active, archived, default preset count.
- **Create New Preset**: display name, language, system prompt, and rewrite instructions
  (system prompt is required for new presets; editing an existing preset only touches name/
  language via the UI — deeper edits go through the API).
- **Table**: preset name + internal name, description + tags, default star (click to set
  as default), language, times used in drafts, status, last updated, and row actions
  (view, edit, duplicate).
- **Preset Details** panel: full settings breakdown (tone, writing style, length,
  complexity, format) and custom instructions, plus Edit / Duplicate / Delete.

## Tags

`/content/tags` — the tag taxonomy used across raw posts, drafts, and published content.

- **Subtabs**: All, Topic, Content, Platform, Status tags.
- **Stats**: total, active, archived, unused, 30-day usage sparkline.
- **Create Tag**: display name, category, optional description.
- **Table**: tag, type badge, category, 30-day usage count, trend sparkline, first/last
  used, languages, status, and row actions (view, edit, delete — system tags can't be
  deleted).
- **Tag Details** panel: description, 30-day stats (posts, mentions, reach, trend), a usage
  chart, languages, related tags, and Edit/Delete.

## Image Styles

`/content/image-styles` — visual presets for AI-generated draft illustrations.

- **Subtabs**: All, Charts & Data, Diagrams, Photos, Illustrations, Custom.
- **Stats**: total, active, draft, archived, consistency score, images generated (30d).
- **New Style**: display name, category, mood, and a style prompt (required for new
  styles).
- **List/Grid toggle**; each style shows a preview thumbnail, category chip, and status.
- **Table** (list view): style, category, description, preview, used-in count, languages,
  status, updated, and row actions (view, edit, delete).
- **Style Details** panel: full settings (color scheme, background, typography, grid,
  corner radius, shadow, aspect ratios), a larger preview, usage stats, and Edit/Delete.

## Auto Mode

`/content/auto-mode` — unattended content generation and publishing.

- **Tabs**: Overview, Rules, Activity, Settings.
- **Overview** shows the on/off toggle, 30-day counts (drafts generated, published, success
  rate) and the latest runs. **Rules** shows the single live rule built from your Settings
  (schedule, topics, mode, channels). **Activity** lists every run: a draft that was started
  (with its current state: in progress, awaiting review, published, failed) or a slot that was
  skipped and why (daily cap reached, no eligible cluster). Empty until the first scheduled
  slot is reached.
- **Settings tab** (fully live, persists to the backend):
  - **Mode**: Full auto (generate + publish automatically after a clean fact-check) vs.
    Draft only (stop at a ready draft for manual review).
  - **Days of Week** auto mode is allowed to run (none selected = every day).
  - **Publish Times** (comma-separated, org timezone).
  - **Max Posts Per Day** (hard cap across all platforms).
  - **Allowed Topics** (comma-separated tags; empty = any topic).
  - **Publish To** (target platforms — needs the matching integration key configured).
  - **Save Settings** persists via `PUT /content/auto-mode`.
- The right-hand **Auto Mode Details** panel summarizes status, the active guardrails
  (taken from your settings) and 30-day stats.

## Settings

`/content/settings` — workspace-wide configuration, 8 tabs:

1. **General** — workspace name/URL, default language, timezone, date/time format,
   content defaults (default post status, duplicate detection, autosave, media
   optimization, link checking), and system settings (data retention, export format, API
   access, system updates).
2. **AI & Generation** — image generation toggle + provider (DALL-E 3 / Nano Banana),
   default content language, fact-check gate (block publishing on fact-check issues), a
   live **AI Spend** panel (today/30-day totals, by model), and a reference table of which
   AI model handles which pipeline task and its approximate cost.
3. **Content** — (reserved; not yet configurable from the UI).
4. **Integrations** — paste API keys directly into the app, grouped as AI Providers
   (Anthropic, OpenAI, Perplexity, Grok, Google AI), Publishing (Telegram bot token/chat
   id, Twitter/LinkedIn tokens, SMTP host/port/user/password/From and the email recipient list), and Source Parsing (Telegram API id/hash for channel
   parsing). Keys are encrypted at rest and masked once saved; an org-level key overrides
   the server's environment default, and removing it falls back to the env value.
5. **Team & Access** — the org roster: avatar initials, name, email, role (admin/editor/
   viewer), active status, created date. Admins can change a member's role or deactivate/
   reactivate them; you cannot demote or deactivate your own account.
6. **Billing** — plan info (labeled honestly as "Pro · self-hosted", no seat billing), the
   same live AI Spend view as the AI tab, and an editable **Daily AI Budget (USD)** — the
   value that gates generation once daily spend is reached.
7. **Notifications** — org-level Telegram delivery toggles (Draft Ready, Published,
   Pipeline Failed, Budget Alert at 80%) and a **Send Test** button that sends a real
   message via the configured Telegram bot.
8. **Advanced** — **Export All Content** (downloads a JSON file with sources, drafts,
   published posts, and tags), read-only workspace info (org id, slug, created date, and
   the current settings JSON), and a direct link to `/llms.txt`.

The right-hand **Account & Plan** panel (visible on wide screens) shows workspace identity,
a shortcut to Team management, plan/AI-credit info, security summary, and system info.

## Profile

Reached via the avatar in the bottom of the sidebar (`/profile`). Tabs:

- **Overview** — 30-day activity metrics, recently worked-on items, and a preferences
  summary card.
- **Preferences** — default language, content tone, writing style, and default length for
  new drafts; persists to your user profile and feeds the Overview cards.
- **Security** — read-only: auth method (Google OAuth), and an explicit note that APEX
  never stores a password.
- **API & Integrations** — a shortcut card linking to Settings → Integrations (key
  management is workspace-level, not per-user).
- **Activity** — real counts (drafts, published, topics) and your 5 most recent drafts.
- **Notifications** — your personal delivery-preference toggles (draft ready, published,
  pipeline failed, budget alert); actual Telegram delivery is still controlled by the
  org-level toggles in Settings → Notifications.

The left profile card, achievements, and the Account & Plan panel on this page show
illustrative account/plan info alongside the live tabs above.
