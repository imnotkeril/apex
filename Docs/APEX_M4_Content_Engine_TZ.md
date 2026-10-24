# APEX — Module 4: Content Engine
### Full Technical Specification | v3.0 | 2025

---

## 0. Module Overview

Content Engine is a complete content automation system. It continuously collects content from multiple sources, clusters it into topics, and allows users to synthesize high-quality posts in any format — from a Telegram post to a PDF report with images and a video script.

**Two modes of operation:**
- **Manual** — user selects sources, triggers generation, edits result, publishes
- **Auto** — system finds top topic, generates draft, publishes on schedule without user action

**Core data flow:**
```
Sources → raw_posts → AI Analysis → Topic Clusters → Draft Creation → Fact Check → Publish
                                                            ↕
                                               Knowledge Graph (pgvector)
```

---

## 1. Database Schema

### 1.1 `content_sources`
Stores all configured sources (channels, feeds, accounts).

```sql
CREATE TABLE content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Source identification
  source_type TEXT NOT NULL,         -- 'telegram', 'rss', 'twitter', 'linkedin',
                                     -- 'youtube', 'email_imap', 'web_article'
  source_id TEXT NOT NULL,           -- '@channel', URL, handle, email address
  display_name TEXT NOT NULL,        -- Human-readable name shown in UI

  -- Connection config (encrypted at app level)
  connection_config JSONB,           -- {session_string, imap_host, imap_port, etc.}

  -- Behavior settings
  is_active BOOLEAN DEFAULT TRUE,
  auto_parse BOOLEAN DEFAULT TRUE,
  parse_schedule TEXT DEFAULT '0 * * * *',  -- Cron expression
  default_language TEXT DEFAULT 'en',

  -- Filtering (optional)
  filter_keywords TEXT[],            -- Only parse posts containing these words
  exclude_keywords TEXT[],           -- Skip posts containing these words
  min_post_length INTEGER DEFAULT 0, -- Skip very short posts

  -- Stats
  last_parsed_at TIMESTAMPTZ,
  last_post_date TIMESTAMPTZ,
  total_posts_parsed INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, source_type, source_id)
);

CREATE INDEX idx_sources_org ON content_sources(org_id);
CREATE INDEX idx_sources_active ON content_sources(org_id, is_active);
```

---

### 1.2 `raw_posts`
Every parsed piece of content. Never deleted — this is the knowledge base.

```sql
CREATE TABLE raw_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES content_sources(id),

  -- Original content
  raw_text TEXT NOT NULL,
  author TEXT,
  post_date TIMESTAMPTZ NOT NULL,
  source_url TEXT,
  media_urls TEXT[],
  links TEXT[],
  language TEXT DEFAULT 'en',        -- Auto-detected

  -- AI Analysis (filled after parsing)
  summary TEXT,                      -- 1-sentence summary (Claude Haiku)
  tags TEXT[],                       -- Auto-assigned from tags_config
  embedding vector(1536),            -- pgvector embedding for semantic search

  -- Processing status
  status TEXT DEFAULT 'new',         -- 'new' → 'analyzed' → 'used'
  cluster_id UUID,                   -- FK to topic_clusters (assigned during analysis)
  used_in_draft_ids UUID[],          -- Can be used in multiple drafts

  -- Timestamps
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,

  -- Deduplication
  content_hash TEXT,                 -- MD5 of first 500 chars to detect duplicates

  CONSTRAINT unique_content_hash_per_org UNIQUE (org_id, content_hash)
);

CREATE INDEX idx_raw_posts_org ON raw_posts(org_id);
CREATE INDEX idx_raw_posts_status ON raw_posts(org_id, status);
CREATE INDEX idx_raw_posts_date ON raw_posts(org_id, post_date DESC);
CREATE INDEX idx_raw_posts_tags ON raw_posts USING GIN(tags);
CREATE INDEX idx_raw_posts_cluster ON raw_posts(cluster_id);
CREATE INDEX idx_raw_posts_embedding ON raw_posts USING ivfflat (embedding vector_cosine_ops);
```

---

### 1.3 `topic_clusters`
AI-discovered topic groups from raw_posts. Auto-created during analysis.

```sql
CREATE TABLE topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Topic info
  title TEXT NOT NULL,               -- AI-generated: "Fed Rate Decision March 2025"
  description TEXT,                  -- 2-3 sentence summary of the topic
  tags TEXT[],                       -- Inherited from constituent raw_posts

  -- Constituent posts
  post_ids UUID[],                   -- Array of raw_post IDs in this cluster
  post_count INTEGER DEFAULT 0,

  -- Scoring (for recommendations)
  source_diversity INTEGER DEFAULT 0, -- How many different sources cover this topic
  freshness_hours FLOAT,              -- Hours since most recent post
  priority TEXT DEFAULT 'medium',     -- 'high', 'medium', 'low' (AI-assigned)
  priority_reason TEXT,               -- Why this priority

  -- Status
  status TEXT DEFAULT 'active',       -- 'active', 'used', 'dismissed', 'archived'
  dismissed_at TIMESTAMPTZ,
  used_in_draft_id UUID,

  -- Embedding for semantic search
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ              -- Auto-archive after 7 days
);

CREATE INDEX idx_clusters_org ON topic_clusters(org_id);
CREATE INDEX idx_clusters_status ON topic_clusters(org_id, status);
CREATE INDEX idx_clusters_priority ON topic_clusters(org_id, priority, freshness_hours);
```

---

### 1.4 `tags_config`
User-configurable tag taxonomy. Tags drive auto-linking across all content.

```sql
CREATE TABLE tags_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Tag identity
  tag_name TEXT NOT NULL,            -- 'macro', 'crypto', 'inflation'
  display_name TEXT NOT NULL,        -- Shown in UI
  category TEXT NOT NULL,            -- 'topic', 'subtopic', 'content_type', 'custom'
  parent_tag TEXT,                   -- For subtopics

  -- Visual
  color TEXT DEFAULT '#808080',
  icon TEXT,                         -- Emoji or icon name

  -- AI instructions
  description TEXT,                  -- When to apply this tag (for AI)
  keywords TEXT[],                   -- Keywords that trigger this tag

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,   -- System tags can't be deleted
  priority INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, tag_name)
);

CREATE INDEX idx_tags_org ON tags_config(org_id);
```

---

### 1.5 `style_presets`
User-created writing styles. Each is a complete prompt with personality, rules, examples.

```sql
CREATE TABLE style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,                -- Internal: 'MY_CASUAL_RU'
  display_name TEXT NOT NULL,        -- UI label: 'Casual Russian Analyst'
  description TEXT,
  language TEXT NOT NULL,            -- Primary language: 'en', 'ru', 'ja', 'ko', 'zh'

  -- Core prompt (user edits this directly)
  system_prompt TEXT NOT NULL,       -- Full persona prompt
  synthesis_instructions TEXT,       -- How to combine multiple sources
  rewrite_instructions TEXT NOT NULL, -- How to apply style to neutral text

  -- Per-platform overrides (optional)
  telegram_instructions TEXT,
  linkedin_instructions TEXT,
  twitter_instructions TEXT,

  -- Parameters
  temperature FLOAT DEFAULT 0.7,     -- 0.0-1.0, controls creativity
  max_length_telegram INTEGER DEFAULT 4096,
  max_length_linkedin INTEGER DEFAULT 3000,
  max_length_twitter INTEGER DEFAULT 280,

  -- Few-shot examples (stored as JSON array)
  examples JSONB DEFAULT '[]',       -- [{topic, source_facts, output}]

  -- Forbidden/required patterns
  forbidden_phrases TEXT[],          -- ['in conclusion', 'it should be noted']
  required_elements TEXT[],          -- ['emoji', 'call_to_action']

  -- Version history
  version INTEGER DEFAULT 1,
  previous_versions JSONB DEFAULT '[]', -- [{version, system_prompt, created_at}]

  -- Meta
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, name)
);
```

---

### 1.6 `image_style_presets`
User-defined visual style for generated images.

```sql
CREATE TABLE image_style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- Visual parameters
  style_type TEXT DEFAULT 'professional',  -- 'professional', 'infographic',
                                           -- 'abstract', 'flat_illustration', 'photorealistic'
  color_palette TEXT[],            -- ['#0A0A0A', '#9B8FE4', '#FFFFFF']
  mood TEXT,                       -- 'clean', 'dramatic', 'minimalist', 'data-driven'
  composition TEXT,                -- 'centered', 'asymmetric', 'grid'

  -- Prompt instructions (user writes this)
  style_prompt TEXT NOT NULL,      -- Full prompt describing visual style
  negative_prompt TEXT DEFAULT 'no text, no logos, no watermarks, no people, no faces',

  -- Chart/data visualization settings
  chart_style TEXT DEFAULT 'minimal', -- 'minimal', 'detailed', 'branded'
  chart_colors TEXT[],             -- Colors for data charts

  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.7 `content_drafts`
All drafts — in progress and completed.

```sql
CREATE TABLE content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id),

  -- Source tracking
  source_post_ids UUID[],            -- raw_post IDs used
  cluster_id UUID REFERENCES topic_clusters(id),
  source_type TEXT DEFAULT 'manual', -- 'manual', 'cluster', 'auto', 'custom_input'

  -- Custom input (when user adds content manually)
  custom_inputs JSONB DEFAULT '[]',  -- [{type: 'text'|'url'|'youtube', content, processed_text}]

  -- Topic & metadata
  topic TEXT NOT NULL,
  tags TEXT[],
  style_preset_id UUID REFERENCES style_presets(id),
  language TEXT NOT NULL DEFAULT 'en',

  -- Generation pipeline status
  pipeline_status TEXT DEFAULT 'pending',
  -- 'pending' → 'synthesizing' → 'styling' → 'formatting' →
  -- 'translating' → 'fact_checking' → 'generating_image' → 'ready' | 'failed'
  pipeline_error TEXT,

  -- Core content
  synthesized_text TEXT,             -- Neutral synthesis (step 1)
  styled_text TEXT,                  -- After style applied (step 2)

  -- Platform versions
  telegram_version TEXT,
  linkedin_post_version TEXT,
  linkedin_article_version TEXT,
  twitter_version TEXT,
  twitter_is_thread BOOLEAN DEFAULT FALSE,
  twitter_thread_tweets JSONB,       -- [{index, text}]
  email_html_version TEXT,
  email_subject TEXT,

  -- Translations (all stored as JSONB for flexibility)
  translations JSONB DEFAULT '{}',   -- {en: text, ru: text, ja: text, ko: text, zh: text}

  -- Images
  image_analysis JSONB,              -- AI analysis: {needs_image, type, rationale}
  image_prompt TEXT,                 -- Generated prompt for Imagen
  generated_images JSONB DEFAULT '[]', -- [{url, style, prompt, generated_at}]
  selected_image_url TEXT,

  -- Charts (when data is present)
  chart_data JSONB,                  -- Extracted data for chart rendering
  chart_config JSONB,                -- Chart type, labels, colors
  chart_url TEXT,                    -- Rendered chart image URL

  -- Documents
  pdf_url TEXT,
  pptx_url TEXT,

  -- Video content
  video_idea JSONB,                  -- {hook, structure, hashtags, platform, duration}
  video_script TEXT,                 -- Full frame-by-frame script with timecodes
  video_format TEXT,                 -- 'shorts', 'short', 'medium', 'long'
  video_duration_seconds INTEGER,
  video_style TEXT,                  -- 'screencast', 'text_animation', 'talking_head'

  -- Fact check
  fact_check_status TEXT DEFAULT 'pending', -- 'pending', 'passed', 'issues_found', 'failed'
  fact_check_results JSONB,          -- [{claim, verdict, source, confidence}]
  fact_check_completed_at TIMESTAMPTZ,

  -- Knowledge graph
  related_published_ids UUID[],      -- Auto-detected related published posts
  related_raw_ids UUID[],            -- Auto-detected related raw posts

  -- Status
  status TEXT DEFAULT 'draft',       -- 'draft', 'ready', 'published', 'archived'
  created_by TEXT DEFAULT 'manual',  -- 'manual', 'auto'
  recommendation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_drafts_org ON content_drafts(org_id);
CREATE INDEX idx_drafts_status ON content_drafts(org_id, status);
CREATE INDEX idx_drafts_created ON content_drafts(org_id, created_at DESC);
```

---

### 1.8 `published_posts`
History of all publications with engagement tracking.

```sql
CREATE TABLE published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES content_drafts(id),

  -- Publication
  platform TEXT NOT NULL,            -- 'telegram', 'twitter', 'linkedin', 'wordpress'
  platform_post_id TEXT,
  post_url TEXT,
  published_text TEXT NOT NULL,
  language TEXT NOT NULL,

  -- Engagement
  likes INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,

  -- Embedding for knowledge graph
  embedding vector(1536),

  -- Tags (inherited from draft, but can differ)
  tags TEXT[],

  published_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX idx_published_org ON published_posts(org_id);
CREATE INDEX idx_published_platform ON published_posts(org_id, platform);
CREATE INDEX idx_published_date ON published_posts(org_id, published_at DESC);
CREATE INDEX idx_published_embedding ON published_posts
  USING ivfflat (embedding vector_cosine_ops);
```

---

### 1.9 `content_links`
Explicit and auto-detected connections in the knowledge graph.

```sql
CREATE TABLE content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  -- Source node
  from_type TEXT NOT NULL,           -- 'raw_post', 'published_post'
  from_id UUID NOT NULL,

  -- Target node
  to_type TEXT NOT NULL,             -- 'raw_post', 'published_post'
  to_id UUID NOT NULL,

  -- Relationship
  link_type TEXT NOT NULL,           -- 'same_topic', 'continuation', 'contradicts',
                                     -- 'supplements', 'source_of', 'auto_semantic'
  confidence FLOAT DEFAULT 1.0,      -- 1.0 = manual, 0.0-0.9 = auto-detected
  is_auto BOOLEAN DEFAULT FALSE,     -- Was this auto-detected or manually set?

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, from_type, from_id, to_type, to_id)
);

CREATE INDEX idx_links_from ON content_links(from_type, from_id);
CREATE INDEX idx_links_to ON content_links(to_type, to_id);
```

---

### 1.10 `fact_check_results`
Detailed fact-check results per claim.

```sql
CREATE TABLE fact_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES content_drafts(id),

  claim TEXT NOT NULL,               -- The specific claim being checked
  verdict TEXT NOT NULL,             -- 'verified', 'unverified', 'disputed', 'false'
  confidence INTEGER,                -- 0-100
  source_url TEXT,
  source_title TEXT,
  explanation TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 1.11 `content_calendar`
Scheduled publications.

```sql
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES content_drafts(id),

  scheduled_at TIMESTAMPTZ NOT NULL,
  platforms TEXT[] NOT NULL,         -- ['telegram', 'linkedin']
  languages TEXT[] NOT NULL,         -- Which translations to publish

  status TEXT DEFAULT 'scheduled',   -- 'scheduled', 'published', 'failed', 'cancelled'
  published_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_org ON content_calendar(org_id, scheduled_at);
CREATE INDEX idx_calendar_status ON content_calendar(status, scheduled_at);
```

---

### 1.12 `auto_mode_config`
Auto-pilot settings for content generation.

```sql
CREATE TABLE auto_mode_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE NOT NULL REFERENCES organisations(id),

  is_enabled BOOLEAN DEFAULT FALSE,

  -- Schedule
  publish_times TEXT[] DEFAULT ARRAY['09:00', '18:00'], -- UTC times
  timezone TEXT DEFAULT 'UTC',
  max_posts_per_day INTEGER DEFAULT 2,

  -- Topic selection weights (must sum to 100)
  weight_popularity INTEGER DEFAULT 40, -- How many sources covered it
  weight_freshness INTEGER DEFAULT 40,  -- How recent
  weight_diversity INTEGER DEFAULT 20,  -- Avoid repeating recent topics

  -- Minimum requirements
  min_source_count INTEGER DEFAULT 2,   -- Don't post if only 1 source
  avoid_repeat_hours INTEGER DEFAULT 24,-- Don't repeat same topic within N hours

  -- Publishing targets
  publish_to TEXT[] DEFAULT ARRAY['telegram'],
  default_style_id UUID REFERENCES style_presets(id),
  default_image_style_id UUID REFERENCES image_style_presets(id),

  -- Auto-translate
  auto_translate_to TEXT[] DEFAULT ARRAY[]::TEXT[], -- Languages to auto-translate

  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. AI Processing Pipeline

### 2.1 Overview

Every draft goes through a sequential pipeline. Each step is a Celery task.
If any step fails, pipeline_status is set to 'failed' with the error stored.

```
raw_posts selected
       ↓
  [Step 1] SYNTHESIS        — Claude Sonnet: merge all sources into neutral text
       ↓
  [Step 2] STYLE REWRITE    — Claude Sonnet: apply user's style preset
       ↓
  [Step 3] FORMATTING       — Claude Sonnet (parallel): generate all platform versions
       ↓
  [Step 4] TRANSLATION      — Claude Haiku (parallel): translate to selected languages
       ↓
  [Step 5] FACT CHECK       — Perplexity: verify key claims
       ↓
  [Step 6] IMAGE ANALYSIS   — Claude: decide if image needed, what type
       ↓
  [Step 7] IMAGE GENERATION — Gemini Imagen 3: generate 2 variants (if needed)
       ↓
  [Step 8] GRAPH LINKS      — pgvector: find related raw_posts + published_posts
       ↓
       READY
```

Steps 3 and 4 run in parallel within their step (all platforms simultaneously, all languages simultaneously).

---

### 2.2 AI Router Mapping

| Step | Task Type | Primary Model | Fallback |
|------|-----------|--------------|----------|
| Parsing summary | `summary` | Claude Haiku | GPT-4o-mini |
| Auto-tagging | `summary` | Claude Haiku | GPT-4o-mini |
| Topic clustering | `content_synthesis` | Claude Sonnet | GPT-4o |
| Synthesis | `content_synthesis` | Claude Sonnet | GPT-4o |
| Style rewrite | `text_generation` | Claude Sonnet | GPT-4o |
| Platform formatting | `text_generation` | Claude Sonnet | GPT-4o |
| Translation | `summary` | Claude Haiku | GPT-4o-mini |
| Fact check | `company_research` | Perplexity Sonar Pro | GPT-4o + search |
| Image analysis | `text_generation` | Claude Sonnet | GPT-4o |
| Image generation | `image_generation` | Gemini Imagen 3 | DALL-E 3 |
| Recommendations | `content_synthesis` | Claude Sonnet | GPT-4o |
| YouTube transcription | external | OpenAI Whisper | — |

---

## 3. Prompts

### 3.1 Parsing: Summary Generation

**When:** Immediately after each raw_post is saved.
**Model:** Claude Haiku (fast and cheap)

```
You are a content analyst. Create a brief summary of the following post.

REQUIREMENTS:
- ONE sentence, maximum 20 words
- Capture the main point, preserve all key numbers and dates
- Write in the SAME language as the input
- Be factual, no opinions

INPUT POST:
{raw_text}

OUTPUT: Just the summary sentence, nothing else.
```

---

### 3.2 Parsing: Auto-Tagging

**When:** After summary generation.
**Model:** Claude Haiku

```
You are a content tagger. Assign relevant tags from the provided list.

AVAILABLE TAGS:
{tags_config as JSON: [{tag_name, description, keywords}]}

INPUT POST:
{raw_text}

RULES:
- Select 2-5 most relevant tags
- Use ONLY tags from the available list
- Prefer specific tags over general ones
- Always include one content_type tag (news/analysis/opinion/data)
- If no tags match well, use the closest ones

OUTPUT FORMAT: Comma-separated tag names, nothing else.
EXAMPLE OUTPUT: macro,inflation,fed,news
```

---

### 3.3 Topic Clustering

**When:** After a batch of posts is analyzed (every parse cycle).
**Model:** Claude Sonnet

```
You are a content strategist. Group the following posts by topic.

ANALYZED POSTS (last 24h):
{JSON array: [{id, source, summary, tags, post_date}]}

RECENTLY PUBLISHED (last 7 days, to avoid repetition):
{JSON array: [{topic, tags, published_at}]}

TASK:
1. Identify 3-7 distinct topics from the posts
2. For each topic:
   - Group the relevant post IDs
   - Assign a clear, specific title (not generic like "Market Update")
   - Assess priority: high (3+ sources, <6h old), medium, low
   - Write a 2-sentence description

OUTPUT FORMAT (JSON array):
[
  {
    "title": "Fed Holds Rates at 5.25%, Markets React",
    "description": "The Federal Reserve...",
    "post_ids": ["uuid1", "uuid2", "uuid3"],
    "tags": ["macro", "fed", "rates"],
    "priority": "high",
    "priority_reason": "4 sources, posted 2 hours ago",
    "source_diversity": 4,
    "freshness_hours": 2.3
  }
]

Sort by priority descending, then freshness ascending.
```

---

### 3.4 Content Synthesis

**When:** Step 1 of draft generation pipeline.
**Model:** Claude Sonnet

```
You are an expert content synthesizer. You will receive multiple posts about the SAME topic from different sources.

SOURCE POSTS:
{for each post: "--- Post from {source} ({date}):\n{raw_text}\n---"}

TASK:
1. Extract ALL unique facts: numbers, dates, percentages, names, quotes
2. Identify different perspectives or conflicting information
3. Synthesize ONE comprehensive text that:
   - Combines ALL unique information (do NOT summarize or reduce)
   - Preserves every factual data point
   - Shows different viewpoints if they exist
   - Has logical flow: context → main event → implications

CRITICAL RULES:
- SYNTHESIZE, do not summarize. Combine, do not compress.
- Keep ALL numbers, dates, and facts from all sources
- If sources contradict → mention both views explicitly
- Write in {language}
- Do NOT apply any style yet — this is a neutral factual synthesis

OUTPUT: Just the synthesized text, nothing else.
```

---

### 3.5 Style Rewrite

**When:** Step 2 of pipeline, after synthesis.
**Model:** Claude Sonnet

```
SYSTEM:
{style_preset.system_prompt}

USER:
Rewrite the following synthesized content in the specified style.

STYLE INSTRUCTIONS:
{style_preset.rewrite_instructions}

FORBIDDEN PHRASES: {style_preset.forbidden_phrases}

INPUT TEXT (neutral synthesis):
{synthesized_text}

CRITICAL RULES:
- Preserve ALL facts, numbers, and dates from the input
- Keep ALL information — do not remove any facts
- Apply the style ONLY to tone, structure, and word choice
- Platform: {platform} | Target length: {max_length} characters

OUTPUT: Just the rewritten text in the specified style.
```

---

### 3.6 Platform Formatting — Telegram

```
You are a Telegram channel content formatter.

INPUT TEXT:
{styled_text}

REQUIREMENTS:
- Maximum {max_length} characters (hard limit)
- Use 1-2 emoji per post, placed naturally (not just at start)
- Break into short paragraphs (2-4 lines each)
- Preserve all facts and numbers
- No hashtags (Telegram channels don't need them)

OUTPUT: Formatted text ready for Telegram, nothing else.
```

---

### 3.7 Platform Formatting — LinkedIn Post

```
You are a LinkedIn content formatter.

INPUT TEXT:
{styled_text}

REQUIREMENTS:
- Maximum 3000 characters
- First 2 lines are critical — visible without "See more" click
- Professional tone, paragraph structure
- Add 3-5 relevant hashtags at the end
- Preserve all facts and numbers

STRUCTURE:
Hook (2 lines) → Main content → Conclusion → Hashtags

OUTPUT: Formatted text ready for LinkedIn, nothing else.
```

---

### 3.8 Platform Formatting — Twitter/X

```
You are a Twitter/X content formatter.

INPUT TEXT:
{styled_text}

REQUIREMENTS:
- If fits in 280 chars → single tweet
- If 281-2800 chars → create thread (max 10 tweets)
- Each tweet must be a complete standalone thought
- Thread tweet 1: hook + main point
- Thread tweets 2-N: supporting facts and context
- Last tweet: conclusion or CTA
- Use 1-2 relevant emoji
- Keep all key facts and numbers

OUTPUT FORMAT:
Single tweet:
{text}

Thread:
TWEET 1:
{text}

TWEET 2:
{text}
[etc]
```

---

### 3.9 Translation

**When:** Step 4 of pipeline, after formatting.
**Model:** Claude Haiku (fast, cheap, good quality)
**Supports:** en, ru, ja, ko, zh

```
You are a professional translator specializing in financial and business content.

TRANSLATE FROM: {source_language}
TRANSLATE TO: {target_language}

INPUT TEXT:
{text}

REQUIREMENTS:
- Preserve ALL financial terms with precise equivalents
- Maintain the tone, style, and personality of the original
- Keep all numbers, dates, percentages, and proper names
- Use natural {target_language} — not literal translation
- Preserve formatting: line breaks, emoji placement
- For Japanese/Korean/Chinese: use appropriate formality level

OUTPUT: Just the translation, nothing else.
```

---

### 3.10 Fact Check

**When:** Step 5 of pipeline.
**Model:** Perplexity Sonar Pro (has real-time web access)

```
You are a fact-checking expert. Verify the key factual claims in the following content.

CONTENT TO CHECK:
{styled_text}

TASK:
1. Identify 3-7 specific factual claims that can be verified (numbers, dates, events, quotes)
2. For each claim, search for verification
3. Assign a verdict

OUTPUT FORMAT (JSON):
{
  "overall_verdict": "passed|issues_found|failed",
  "claims": [
    {
      "claim": "The Fed held rates at 5.25-5.5% in March 2025",
      "verdict": "verified|unverified|disputed|false",
      "confidence": 95,
      "source_url": "https://...",
      "source_title": "Federal Reserve Press Release",
      "explanation": "Confirmed by official Fed statement"
    }
  ],
  "summary": "2 claims verified, 1 unverified (no recent data found)"
}
```

---

### 3.11 Image Analysis

**When:** Step 6 of pipeline.
**Model:** Claude Sonnet

```
You are a visual content strategist. Analyze the following text and decide what image or visual would best accompany it.

CONTENT:
{styled_text}

USER'S IMAGE STYLE PRESET:
{image_style_preset as JSON}

TASK:
1. Determine if an image would add value (not all posts need one)
2. If yes, determine the type:
   - "illustration" — abstract/thematic image (no data)
   - "infographic" — diagram with concepts or icons
   - "data_chart" — actual chart/graph (only if specific numeric data is present)
3. If "data_chart": extract the data points

OUTPUT FORMAT (JSON):
{
  "needs_image": true,
  "image_type": "illustration|infographic|data_chart",
  "rationale": "Post contains comparison of 3 rate scenarios — bar chart would add clarity",
  "image_prompt": "Detailed prompt for Gemini Imagen in English, incorporating user's style preset...",
  "chart_data": {    // Only if image_type = "data_chart"
    "chart_type": "bar|line|pie",
    "title": "Fed Funds Rate 2023-2025",
    "labels": ["Jan 23", "Jun 23", "Dec 23", "Mar 24", "Mar 25"],
    "datasets": [{"label": "Rate %", "data": [4.5, 5.25, 5.5, 5.5, 5.25]}],
    "colors": ["#9B8FE4"]
  }
}
```

---

### 3.12 Recommendations Generation

**When:** Every 6 hours or on demand.
**Model:** Claude Sonnet

```
You are a content strategy AI. Analyze recent topic clusters and recommend what to publish.

ACTIVE TOPIC CLUSTERS:
{JSON: [{id, title, description, tags, post_count, source_diversity, freshness_hours, priority}]}

PUBLISHED HISTORY (last 7 days):
{JSON: [{topic, tags, published_at}]}

WEIGHTING CRITERIA:
- Popularity weight: {weight_popularity}% (how many sources cover it)
- Freshness weight: {weight_freshness}% (how recent)
- Diversity weight: {weight_diversity}% (avoid repeating recent topics)

TASK:
Rank the clusters by recommendation priority. Return top 5.

OUTPUT FORMAT (JSON array):
[
  {
    "cluster_id": "uuid",
    "rank": 1,
    "recommendation_score": 87,
    "recommendation_reason": "4 sources within 3 hours, topic not covered in 5 days",
    "suggested_angle": "Focus on market implications of the decision"
  }
]
```

---

## 4. Source Parsers — Technical Implementation

### 4.1 Telegram (Telethon)

```python
# Uses Telethon as a USER CLIENT (not bot)
# Reads public and subscribed channels

from telethon import TelegramClient

async def parse_telegram_channel(source: ContentSource, session_string: str):
    client = TelegramClient(StringSession(session_string), API_ID, API_HASH)
    async with client:
        channel = await client.get_entity(source.source_id)
        messages = await client.get_messages(
            channel,
            limit=50,
            offset_date=source.last_parsed_at,
            reverse=True
        )
        for msg in messages:
            if msg.text and len(msg.text) > source.min_post_length:
                yield {
                    "raw_text": msg.text,
                    "post_date": msg.date,
                    "source_url": f"https://t.me/{source.source_id}/{msg.id}",
                    "media_urls": [await get_media_url(msg)] if msg.media else [],
                }
```

**Setup requirement:** User must authenticate Telethon once (phone number + code). Session string stored encrypted in `content_sources.connection_config`.

---

### 4.2 RSS

```python
import feedparser

async def parse_rss_feed(source: ContentSource):
    feed = feedparser.parse(source.source_id)  # source_id = feed URL
    cutoff = source.last_parsed_at or datetime.now() - timedelta(days=7)

    for entry in feed.entries:
        entry_date = datetime(*entry.published_parsed[:6], tzinfo=UTC)
        if entry_date <= cutoff:
            continue
        full_text = entry.get('summary', '') or entry.get('description', '')
        yield {
            "raw_text": f"{entry.title}\n\n{full_text}",
            "post_date": entry_date,
            "source_url": entry.link,
            "author": entry.get('author', ''),
        }
```

---

### 4.3 YouTube

```python
import yt_dlp
import whisper

async def parse_youtube_video(url: str):
    # Step 1: Try to get subtitles
    ydl_opts = {
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en', 'ru'],
        'skip_download': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if info.get('subtitles') or info.get('automatic_captions'):
            # Extract subtitle text
            transcript = extract_subtitle_text(info)
        else:
            # Step 2: Download audio and transcribe via Whisper
            # NOTE: This is slow (1-5 min for long videos) — runs as Celery task
            transcript = await transcribe_with_whisper(url)

    return {
        "raw_text": transcript,
        "post_date": parse_date(info.get('upload_date')),
        "source_url": url,
        "author": info.get('channel', ''),
    }
```

---

### 4.4 Email IMAP

```python
import imaplib
import email

async def parse_email_inbox(source: ContentSource):
    config = source.connection_config  # {host, port, username, password, folder}

    with imaplib.IMAP4_SSL(config['host'], config['port']) as mail:
        mail.login(config['username'], config['password'])
        mail.select(config.get('folder', 'INBOX'))

        # Search unread emails from specified senders
        if config.get('from_filter'):
            _, data = mail.search(None, f'FROM "{config["from_filter"]}" UNSEEN')
        else:
            _, data = mail.search(None, 'UNSEEN')

        for num in data[0].split():
            _, msg_data = mail.fetch(num, '(RFC822)')
            msg = email.message_from_bytes(msg_data[0][1])
            body = extract_email_body(msg)
            yield {
                "raw_text": body,
                "post_date": email.utils.parsedate_to_datetime(msg['Date']),
                "author": msg['From'],
            }
```

---

### 4.5 Web Article

```python
import httpx
from crawl4ai import AsyncWebCrawler

async def parse_web_article(url: str):
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)
        return {
            "raw_text": result.markdown,  # Clean markdown text
            "post_date": datetime.now(UTC),
            "source_url": url,
        }
```

**Fallback:** If crawl4ai fails, use Perplexity to fetch and summarize the article.

---

## 5. Knowledge Graph — Implementation

### 5.1 Auto-linking via pgvector

After every raw_post is analyzed and every published_post is created, embeddings are generated and links are automatically created based on cosine similarity.

```python
async def generate_embedding(text: str) -> list[float]:
    """Generate 1536-dim embedding via OpenAI text-embedding-3-small"""
    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000],  # Truncate if needed
    )
    return response.data[0].embedding


async def find_similar_posts(
    embedding: list[float],
    post_type: str,          # 'raw_post' or 'published_post'
    org_id: str,
    limit: int = 10,
    threshold: float = 0.75, # Minimum similarity score
) -> list[dict]:
    """Find semantically similar posts using pgvector"""

    if post_type == 'raw_post':
        query = """
            SELECT id, summary, tags,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM raw_posts
            WHERE org_id = $2
              AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY similarity DESC
            LIMIT $4
        """
    else:
        query = """
            SELECT id, published_text, tags,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM published_posts
            WHERE org_id = $2
              AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY similarity DESC
            LIMIT $4
        """

    return await db.fetch(query, embedding, org_id, threshold, limit)


async def auto_link_post(post_id: str, post_type: str, org_id: str, db):
    """Create automatic semantic links for a new post"""

    # Get embedding of the new post
    if post_type == 'raw_post':
        post = await db.fetchrow("SELECT embedding, tags FROM raw_posts WHERE id=$1", post_id)
    else:
        post = await db.fetchrow("SELECT embedding, tags FROM published_posts WHERE id=$1", post_id)

    embedding = post['embedding']

    # Find similar raw_posts
    similar_raw = await find_similar_posts(embedding, 'raw_post', org_id, limit=5)
    # Find similar published_posts
    similar_published = await find_similar_posts(embedding, 'published_post', org_id, limit=5)

    # Create links
    for similar in similar_raw:
        if similar['id'] != post_id:
            await db.execute("""
                INSERT INTO content_links
                  (org_id, from_type, from_id, to_type, to_id, link_type, confidence, is_auto)
                VALUES ($1, $2, $3, $4, $5, 'auto_semantic', $6, true)
                ON CONFLICT DO NOTHING
            """, org_id, post_type, post_id, 'raw_post', similar['id'], similar['similarity'])

    for similar in similar_published:
        await db.execute("""
            INSERT INTO content_links
              (org_id, from_type, from_id, to_type, to_id, link_type, confidence, is_auto)
            VALUES ($1, $2, $3, $4, $5, 'auto_semantic', $6, true)
            ON CONFLICT DO NOTHING
        """, org_id, post_type, post_id, 'published_post', similar['id'], similar['similarity'])
```

---

### 5.2 Graph Query for UI

```python
async def get_knowledge_graph(
    org_id: str,
    filters: dict,    # {types: ['raw', 'published'], tags: ['macro'], date_from, date_to}
    center_id: str | None = None,  # Focus on a specific node
    depth: int = 2,
) -> dict:
    """
    Returns graph data for D3.js/vis.js visualization.
    Format: {nodes: [...], edges: [...]}
    """

    nodes = []
    edges = []

    # Fetch nodes based on filters
    if 'raw' in filters.get('types', ['raw', 'published']):
        raw_query = """
            SELECT id, 'raw_post' as type, summary as label,
                   tags, post_date as date, source_id
            FROM raw_posts
            WHERE org_id = $1
              AND ($2::text[] IS NULL OR tags && $2)
              AND ($3::timestamptz IS NULL OR post_date >= $3)
            LIMIT 200
        """
        raw_nodes = await db.fetch(raw_query, org_id, filters.get('tags'), filters.get('date_from'))
        nodes.extend([{**n, 'color': '#4A9EF5'} for n in raw_nodes])  # Blue for raw

    if 'published' in filters.get('types', ['raw', 'published']):
        pub_query = """
            SELECT id, 'published_post' as type,
                   LEFT(published_text, 80) as label,
                   tags, published_at as date, platform
            FROM published_posts
            WHERE org_id = $1
              AND ($2::text[] IS NULL OR tags && $2)
            LIMIT 200
        """
        pub_nodes = await db.fetch(pub_query, org_id, filters.get('tags'))
        nodes.extend([{**n, 'color': '#9B8FE4'} for n in pub_nodes])  # Purple for published

    # Fetch edges between visible nodes
    node_ids = [n['id'] for n in nodes]
    edges_query = """
        SELECT from_id, to_id, link_type, confidence, is_auto
        FROM content_links
        WHERE org_id = $1
          AND from_id = ANY($2)
          AND to_id = ANY($2)
    """
    edges = await db.fetch(edges_query, org_id, node_ids)

    return {"nodes": nodes, "edges": edges}
```

---

## 6. API Endpoints

### 6.1 Sources

```
GET    /api/v1/content/sources
POST   /api/v1/content/sources
PUT    /api/v1/content/sources/{id}
DELETE /api/v1/content/sources/{id}
POST   /api/v1/content/sources/{id}/parse        → trigger manual parse
POST   /api/v1/content/sources/parse-all         → parse all active sources
GET    /api/v1/content/sources/{id}/status       → last parse status, error count
POST   /api/v1/content/sources/add-url           → parse a single web article/YouTube URL
```

### 6.2 Raw Posts

```
GET    /api/v1/content/raw-posts                 → list with filters
         ?status=new&tags=macro,crypto&date_from=2025-01-01&source_id=uuid&limit=50
GET    /api/v1/content/raw-posts/{id}
PATCH  /api/v1/content/raw-posts/{id}            → edit tags, summary
DELETE /api/v1/content/raw-posts/{id}
GET    /api/v1/content/raw-posts/{id}/related    → semantically similar posts
```

### 6.3 Topic Clusters

```
GET    /api/v1/content/clusters                  → active clusters sorted by priority
GET    /api/v1/content/clusters/{id}             → cluster with all posts
POST   /api/v1/content/clusters/{id}/dismiss     → mark as not relevant
POST   /api/v1/content/clusters/refresh          → re-run clustering
POST   /api/v1/content/clusters/search           → {query: text} → search by topic manually
         Body: {query: "Fed rates impact", tags: ["macro"]}
```

### 6.4 Drafts

```
GET    /api/v1/content/drafts                    → list with filters
POST   /api/v1/content/drafts                    → create draft
         Body: {source_post_ids, cluster_id, style_preset_id, languages, output_formats}
GET    /api/v1/content/drafts/{id}               → full draft with all versions
GET    /api/v1/content/drafts/{id}/status        → pipeline_status for polling
PATCH  /api/v1/content/drafts/{id}               → edit text, tags, topic
POST   /api/v1/content/drafts/{id}/regenerate    → regenerate specific versions
         Body: {steps: ['formatting', 'translation'], languages: ['ja']}
POST   /api/v1/content/drafts/{id}/publish       → publish now or schedule
         Body: {platforms, languages, scheduled_at (optional)}
DELETE /api/v1/content/drafts/{id}
GET    /api/v1/content/drafts/{id}/related       → related raw + published posts
```

### 6.5 Custom Input

```
POST   /api/v1/content/custom-input/url          → fetch and parse a URL
         Body: {url: "https://..."}
         Response: {processed_text, title, detected_language}
POST   /api/v1/content/custom-input/youtube      → transcribe YouTube video (async)
         Body: {url: "https://youtube.com/watch?v=..."}
         Response: {job_id} → poll via /jobs/{job_id}
POST   /api/v1/content/custom-input/text         → validate and save raw text
```

### 6.6 Published Posts

```
GET    /api/v1/content/published                 → list with filters
GET    /api/v1/content/published/{id}
POST   /api/v1/content/published/{id}/sync       → sync engagement stats from platform
```

### 6.7 Calendar

```
GET    /api/v1/content/calendar                  → scheduled posts by date range
         ?date_from=2025-01-01&date_to=2025-01-31
PUT    /api/v1/content/calendar/{id}/reschedule  → change scheduled time
DELETE /api/v1/content/calendar/{id}             → cancel scheduled post
```

### 6.8 Knowledge Graph

```
GET    /api/v1/content/graph                     → graph data for visualization
         ?types=raw,published&tags=macro&date_from=2025-01-01
GET    /api/v1/content/graph/{id}                → graph centered on specific node
POST   /api/v1/content/graph/links               → create manual link
         Body: {from_type, from_id, to_type, to_id, link_type}
DELETE /api/v1/content/graph/links/{id}          → remove a link
PATCH  /api/v1/content/raw-posts/{id}/tags       → update tags (graph auto-updates)
PATCH  /api/v1/content/published/{id}/tags       → update tags
```

### 6.9 Styles & Presets

```
GET    /api/v1/content/style-presets
POST   /api/v1/content/style-presets
PUT    /api/v1/content/style-presets/{id}
DELETE /api/v1/content/style-presets/{id}
POST   /api/v1/content/style-presets/{id}/duplicate
GET    /api/v1/content/style-presets/{id}/versions  → prompt version history
POST   /api/v1/content/style-presets/{id}/restore   → restore previous version

GET    /api/v1/content/image-style-presets
POST   /api/v1/content/image-style-presets
PUT    /api/v1/content/image-style-presets/{id}
DELETE /api/v1/content/image-style-presets/{id}
```

### 6.10 Tags

```
GET    /api/v1/content/tags
POST   /api/v1/content/tags
PUT    /api/v1/content/tags/{id}
DELETE /api/v1/content/tags/{id}          → only non-system tags
```

### 6.11 Auto Mode & Settings

```
GET    /api/v1/content/auto-mode
PUT    /api/v1/content/auto-mode
POST   /api/v1/content/auto-mode/enable
POST   /api/v1/content/auto-mode/disable
GET    /api/v1/content/auto-mode/preview  → what would auto mode publish next
```

### 6.12 Recommendations

```
GET    /api/v1/content/recommendations            → current recommendations
POST   /api/v1/content/recommendations/refresh   → force regenerate
```

---

## 7. Celery Tasks

```python
# All background tasks

# ─── PARSING ──────────────────────────────────────────────────────────────────

@celery_app.task
def parse_source(source_id: str):
    """Parse a single source. Called by scheduler or manual trigger."""

@celery_app.task
def parse_all_sources(org_id: str):
    """Parse all active sources for an org. Spawns parse_source tasks."""

@celery_app.task
def analyze_raw_post(post_id: str):
    """Generate summary + tags + embedding for a raw_post."""

@celery_app.task
def cluster_topics(org_id: str):
    """Re-run topic clustering for an org after new posts arrive."""

@celery_app.task
def transcribe_youtube(url: str, org_id: str, job_id: str):
    """Download audio + run Whisper. Long-running task (1-10 min)."""

# ─── DRAFT GENERATION ─────────────────────────────────────────────────────────

@celery_app.task
def run_draft_pipeline(draft_id: str):
    """
    Master task: runs all pipeline steps in sequence.
    Updates draft.pipeline_status after each step.
    """

@celery_app.task
def step_synthesis(draft_id: str): ...

@celery_app.task
def step_style_rewrite(draft_id: str): ...

@celery_app.task
def step_platform_formatting(draft_id: str): ...
# Spawns parallel subtasks for each platform

@celery_app.task
def step_translation(draft_id: str, target_language: str): ...
# Spawned in parallel for each target language

@celery_app.task
def step_fact_check(draft_id: str): ...

@celery_app.task
def step_image_analysis(draft_id: str): ...

@celery_app.task
def step_image_generation(draft_id: str): ...

@celery_app.task
def step_graph_links(draft_id: str):
    """Find related posts and create content_links records."""

# ─── PUBLISHING ───────────────────────────────────────────────────────────────

@celery_app.task
def publish_draft(draft_id: str, platforms: list, languages: list): ...

@celery_app.task
def sync_engagement_stats(published_post_id: str): ...

# ─── SCHEDULED (Celery Beat) ──────────────────────────────────────────────────

# Every hour: parse all active sources
celery_app.conf.beat_schedule['content.parse_all'] = {
    'task': 'parse_all_sources',
    'schedule': crontab(minute=0),    # Every hour at :00
}

# Every 6 hours: regenerate recommendations
celery_app.conf.beat_schedule['content.recommendations'] = {
    'task': 'generate_recommendations',
    'schedule': crontab(minute=0, hour='*/6'),
}

# Twice daily: publish auto-mode posts
# Times from auto_mode_config per org
celery_app.conf.beat_schedule['content.auto_publish'] = {
    'task': 'run_auto_mode',
    'schedule': crontab(minute=0),    # Checks every hour, publishes per org schedule
}

# Daily: archive expired clusters
celery_app.conf.beat_schedule['content.archive_clusters'] = {
    'task': 'archive_old_clusters',
    'schedule': crontab(hour=3, minute=0),
}
```

---

## 8. Frontend Screens

### 8.1 Dashboard

**URL:** `/dashboard`

Four sections:

**Stats row:** New Posts (last 24h) | Active Clusters | Drafts Ready | Published This Week

**AI Recommendations:** List of topic clusters sorted by priority.
Each card shows: topic title, priority badge (High/Medium/Low), number of sources, hours since last post, tags, preview of 2-3 source summaries.
Actions: [Create Draft] [View Sources] [Dismiss]

**Recent Activity:** Timeline of last 10 events (parses, draft generations, publications).

**Auto Mode Status:** If enabled — next publish time, what it plans to publish.

---

### 8.2 Raw Posts

**URL:** `/content/raw-posts`

Full-width table with left filter panel.

**Filters:** Source (multi-select), Status (New/Analyzed/Used), Tags (multi-select), Date range, Language, Search text.

**Table columns:** Date | Source | Summary | Tags | Status | Used In | Actions

**Row actions:** [View Full Text] [Edit Tags] [Add to Draft]

**Bulk actions** (when rows selected): [Create Draft from Selected] [Re-analyze]

**Top bar:** [Parse Now] [Parse All] Auto-parse toggle + schedule display.

---

### 8.3 Topic Clusters

**URL:** `/content/clusters`

Card grid sorted by priority.

Each cluster card:
- Title + priority badge
- Description (2 sentences)
- Tags row
- Source count + freshness ("4 sources, 2 hours ago")
- Collapsed list of source post summaries
- [Create Draft] [View All Posts] [Dismiss] buttons

Top: [Search by Topic] input — allows manual topic search via Perplexity.

---

### 8.4 Create Draft

**URL:** `/content/drafts/new`

**Left panel (40%):** Source posts selected for this draft.
Each post shows: source, date, summary, tags. [Remove] button per post. [+ Add More Posts] opens source picker modal.

**Right panel (60%):** Draft editor.

Settings section:
- Topic (text input, auto-suggested from tags)
- Style preset selector
- Language (primary)
- Tags editor (add/remove)
- Output formats (checkboxes): Telegram / LinkedIn Post / LinkedIn Article / Twitter / Email / PDF / PPTX / Image / Video Idea / Video Script
- Translation targets (multi-select): EN / RU / JA / KO / ZH

[Generate] button — triggers pipeline. Shows progress indicator per step:
```
Synthesis ✓ → Styling ✓ → Formatting... → Translation ⏳ → Fact Check ⏳ → Image ⏳
```

**Results section** (after generation):
Tabs per output format. Each tab shows the text with character count and [Copy] [Edit] [Regenerate this version] buttons.

Image tab: Shows 2 generated variants side by side. [Select] button on each.

Fact check tab: List of claims with verdict badges (✅ Verified / ⚠️ Unverified / ❌ False).

Related content panel (right side): Shows related raw posts (blue) and related published posts (purple) found via semantic search. Click to preview.

Bottom: [Save Draft] [Publish Now] [Schedule]

---

### 8.5 Drafts List

**URL:** `/content/drafts`

Filter tabs: All | Draft | Ready | Published | Archived

Card grid. Each card:
- Topic + status badge
- Preview text (2 lines)
- Tags + style preset name
- Created at + created_by (Manual/Auto)
- Available versions icons (TG/LI/TW/PDF/etc)
- Fact check status badge
- [Edit] [Publish] [Delete]

---

### 8.6 Content Calendar

**URL:** `/content/calendar`

Month/week view (toggleable). Each scheduled item shown as a pill on the date.
Pill shows: platform icon + topic preview.
Hover: full preview tooltip.
Click: opens draft detail panel on the right.
No drag-and-drop in v1 — reschedule via detail panel.

---

### 8.7 Knowledge Graph

**URL:** `/content/graph`

Full-screen interactive graph using D3.js or vis.js.

**Top controls:**
- Filter: [Raw Posts] [Published] [Both] toggles
- Filter by Tags: multi-select
- Filter by Date range
- Filter by Source

**Graph:**
- Blue nodes = raw_posts
- Purple nodes = published posts
- Node size = number of connections
- Edge color by link type (auto-semantic = thin gray, same_topic = medium, continuation = thick purple)
- Hover node: preview tooltip (summary + tags + date)
- Click node: right panel opens with full content + all connections listed
- From right panel: [Create Draft from This] [Edit Tags] [Add Manual Link]

---

### 8.8 Style Presets

**URL:** `/content/styles`

List of style cards + [+ Create New Style] button.

Each card: name, language, description, temperature badge, [Edit] [Duplicate] [Set Default] [Delete].

**Edit style page:**
Full form with:
- Name, language, description
- System prompt (large textarea)
- Synthesis instructions (textarea)
- Rewrite instructions (textarea)
- Per-platform overrides (expandable sections)
- Forbidden phrases (tag input)
- Required elements (tag input)
- Temperature slider (0.0 – 1.0)
- Max length per platform (number inputs)
- Few-shot examples (add/remove/edit examples with topic → output pairs)
- Version history (list of previous saves with restore button)
- [Save] [Test with Sample Post]

**Test panel:** Input a sample raw text → runs synthesis + style rewrite → shows output live.

---

### 8.9 Settings

**URL:** `/content/settings`

Tabs: [Sources] [Auto Mode] [Tags] [Image Styles] [Publishing]

**Sources tab:** Table of configured sources. [+ Add Source] opens modal by source type with connection instructions.

**Auto Mode tab:** Enable toggle, publish times, weights sliders, min source count, avoid-repeat hours, default style/image style selectors, auto-translate targets.

**Tags tab:** Tag list with category grouping. [+ Add Tag] [Edit] [Delete]. System tags show lock icon (non-deletable).

**Image Styles tab:** List of image style presets. Each has name, style_type, color palette preview, [Edit] [Set Default].

**Publishing tab:** Platform connections (Telegram bot token + channel, Twitter OAuth, LinkedIn OAuth, WordPress URL + credentials).

---

## 9. Error Handling

| Scenario | Handling |
|----------|---------|
| Parse returns 0 posts | Log silently, update last_parsed_at, no user error |
| Duplicate post detected | Skip silently via content_hash constraint |
| AI step fails (timeout/rate limit) | Retry 3x with exponential backoff, then mark pipeline_status='failed', store error |
| All AI models fail | Mark failed, notify user in UI, allow manual retry |
| Fact check finds false claims | Mark draft with fact_check_status='issues_found', show warning before publish |
| Image generation fails | Skip image, mark image as unavailable, continue to ready status |
| Whisper transcription takes >10min | Keep job in queue, notify via UI status badge |
| Publishing to platform fails | Log error, keep draft as 'ready', show retry button |
| Twitter text too long even for 10-tweet thread | Cap at 10 tweets, last tweet: "Read full analysis: [link]" |
| User edits published draft | Show warning: "Already published — changes won't affect live post", offer Re-publish |

---

## 10. How This Module Connects to Foundation

```python
# Every service in M4 follows this pattern:
from app.core.ai_router import ai_router, TaskType    # ← AI from foundation
from app.core.database import get_db                  # ← DB from foundation
from app.core.celery_app import celery_app            # ← Queue from foundation
from app.core.auth import get_current_user            # ← Auth from foundation
from app.core.exceptions import ResourceNotFoundException # ← Errors from foundation

# M4 adds to alembic/env.py:
from app.modules.content import models  # noqa

# M4 adds to api/router.py:
from app.modules.content import router as content_router
api_router.include_router(content_router.router, prefix="/content")

# M4 adds to celery_app.py beat_schedule:
# parse_all, recommendations, auto_publish, archive_clusters
```

---

## 11. Development Phases for M4

### Phase 1 — Core Loop (3 weeks)
- [ ] DB migrations: all tables
- [ ] Telegram + RSS parsers
- [ ] AI analysis: summary + tagging
- [ ] Topic clustering
- [ ] Draft creation pipeline (synthesis + styling + TG/LinkedIn/Twitter formatting)
- [ ] Fact check step
- [ ] Basic publish: Telegram only
- [ ] Frontend: Dashboard + Raw Posts + Create Draft + Drafts List

### Phase 2 — Full Sources + Translations (2 weeks)
- [ ] YouTube transcription (Whisper)
- [ ] Email IMAP parser
- [ ] Web article parser
- [ ] Twitter/X via Grok
- [ ] LinkedIn via Perplexity
- [ ] All 5 languages translation
- [ ] Publishing: Twitter + LinkedIn

### Phase 3 — Images + Documents (2 weeks)
- [ ] Image analysis + Gemini Imagen 3 generation
- [ ] Chart/data visualization (when data present)
- [ ] PDF report generation
- [ ] PPTX generation
- [ ] Image style presets UI

### Phase 4 — Knowledge Graph + Advanced (2 weeks)
- [ ] pgvector embeddings for all posts
- [ ] Auto-linking pipeline
- [ ] Knowledge graph UI (D3.js)
- [ ] Manual link management
- [ ] Content Calendar view
- [ ] Style preset version history
- [ ] Auto Mode full implementation

---

## 12. Implementation Checklist

- [ ] All DB tables created via Alembic migration
- [ ] `GET /api/v1/content/sources` returns sources list
- [ ] Manual parse trigger works end-to-end
- [ ] Raw posts appear in UI after parse
- [ ] AI summary + tags populated for each post
- [ ] Topic clusters generated after parse
- [ ] Draft creation triggers pipeline
- [ ] Pipeline progress visible in UI (polling /drafts/{id}/status)
- [ ] Telegram version generated correctly
- [ ] Fact check runs and results shown
- [ ] Publish to Telegram works
- [ ] Knowledge graph shows nodes and edges
- [ ] Tag edit updates graph links automatically
- [ ] Style preset CRUD works
- [ ] Style test panel generates live preview
- [ ] Auto mode creates and publishes without user action
