"""Prompt templates aligned with APEX M4 Content Engine TZ §3."""

SUMMARY_SYSTEM = "You are a content analyst. Follow instructions exactly."


def summary_user_prompt(raw_text: str) -> str:
    return f"""Create a brief summary of the following post.

REQUIREMENTS:
- ONE sentence, maximum 20 words
- Capture the main point, preserve all key numbers and dates
- Write in the SAME language as the input
- Be factual, no opinions

INPUT POST:
{raw_text}

OUTPUT: Just the summary sentence, nothing else."""


def tagging_user_prompt(raw_text: str, tags_json: str) -> str:
    return f"""You are a content tagger. Assign relevant tags from the provided list.

AVAILABLE TAGS:
{tags_json}

INPUT POST:
{raw_text}

RULES:
- Select 2-5 most relevant tags
- Use ONLY tags from the available list
- Prefer specific tags over general ones
- Always include one content_type tag (news/analysis/opinion/data)
- If no tags match well, use the closest ones

OUTPUT FORMAT: Comma-separated tag names, nothing else.
EXAMPLE OUTPUT: macro,inflation,fed,news"""


def cluster_user_prompt(posts_json: str, published_json: str) -> str:
    return f"""You are a content strategist. Group the following posts by topic.

ANALYZED POSTS (last 24h):
{posts_json}

RECENTLY PUBLISHED (last 7 days, to avoid repetition):
{published_json}

TASK:
1. Identify 3-7 distinct topics from the posts
2. For each topic:
   - Group the relevant post IDs
   - Assign a clear, specific title (not generic like "Market Update")
   - Assess priority: high (3+ sources, <6h old), medium, low
   - Write a 2-sentence description

OUTPUT FORMAT: a single JSON array (no markdown fences), each item:
{{
  "title": "...",
  "description": "...",
  "post_ids": ["uuid", ...],
  "tags": ["tag1", ...],
  "priority": "high|medium|low",
  "priority_reason": "...",
  "source_diversity": 0,
  "freshness_hours": 0.0
}}

Sort by priority descending, then freshness ascending."""


def synthesis_user_prompt(source_blocks: str, language: str) -> str:
    return f"""You are an expert content synthesizer. You will receive multiple posts about the SAME topic from different sources.

SOURCE POSTS:
{source_blocks}

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

OUTPUT: Just the synthesized text, nothing else."""


def synthesis_and_style_user(
    source_blocks: str,
    research_block: str,
    language: str,
    rewrite_instructions: str,
    forbidden: str,
    max_length: int,
) -> str:
    """Single-pass synthesis + styling (one Sonnet call instead of two)."""
    research_section = (
        f"""
FRESH WEB RESEARCH (found just now — weave in anything genuinely useful, cite numbers/dates):
{research_block}
"""
        if research_block
        else ""
    )
    return f"""You are an expert content writer. You will receive multiple raw posts about the SAME topic
from different sources, plus optional fresh web research.

SOURCE POSTS:
{source_blocks}
{research_section}
TASK (do all in one pass):
1. Extract ALL unique facts from the sources: numbers, dates, percentages, names, quotes.
2. If web research adds new relevant facts or newer developments — integrate them.
3. If sources contradict — mention both views explicitly.
4. Write ONE final post that combines everything, with logical flow: context → main event → implications.
5. Apply this style to tone, structure and word choice:
{rewrite_instructions}

FORBIDDEN PHRASES: {forbidden}

CRITICAL RULES:
- Keep ALL numbers, dates and facts. Synthesize, do not compress.
- Write in {language}. Target length: about {max_length} characters.

OUTPUT: just the final styled text, nothing else."""


def research_query_user(topic: str, tags: str, summaries: str) -> str:
    return f"""Find the latest news, data points and notable developments from the past 7 days about this topic.

TOPIC: {topic}
TAGS: {tags}
WHAT WE ALREADY KNOW (do not repeat, look for NEW information):
{summaries[:3000]}

Return a compact bullet list (max 8 bullets) of NEW facts with numbers/dates and source names.
If nothing new or relevant is found, return exactly: NOTHING_NEW"""


def recommendations_user(clusters_json: str) -> str:
    return f"""You are a content strategist. Below are current topic clusters from our content feed
(with post counts, freshness and tags).

CLUSTERS (JSON):
{clusters_json}

TASK: rank which topics are worth posting about RIGHT NOW. Consider: momentum (many fresh posts
from diverse sources), timeliness, and audience appeal.

OUTPUT: a single JSON array (no markdown fences), each element:
{{"cluster_id": "...", "priority": "high|medium|low", "reason": "one punchy sentence why this topic is hot (or not) right now"}}
Include EVERY cluster id from the input exactly once."""


def style_rewrite_user_prompt(
    synthesized_text: str,
    rewrite_instructions: str,
    forbidden: str,
    platform: str,
    max_length: int,
) -> str:
    return f"""Rewrite the following synthesized content in the specified style.

STYLE INSTRUCTIONS:
{rewrite_instructions}

FORBIDDEN PHRASES: {forbidden}

INPUT TEXT (neutral synthesis):
{synthesized_text}

CRITICAL RULES:
- Preserve ALL facts, numbers, and dates from the input
- Keep ALL information — do not remove any facts
- Apply the style ONLY to tone, structure, and word choice
- Platform: {platform} | Target length: {max_length} characters

OUTPUT: Just the rewritten text in the specified style."""


def format_telegram_user(styled_text: str, max_length: int) -> str:
    return f"""You are a Telegram channel content formatter.

INPUT TEXT:
{styled_text}

REQUIREMENTS:
- Maximum {max_length} characters (hard limit)
- Use 1-2 emoji per post, placed naturally (not just at start)
- Break into short paragraphs (2-4 lines each)
- Preserve all facts and numbers
- No hashtags (Telegram channels don't need them)

OUTPUT: Formatted text ready for Telegram, nothing else."""


def format_linkedin_user(styled_text: str) -> str:
    return f"""You are a LinkedIn content formatter.

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

OUTPUT: Formatted text ready for LinkedIn, nothing else."""


def format_twitter_user(styled_text: str) -> str:
    return f"""You are a Twitter/X content formatter.

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
If single tweet, output only the tweet text.
If thread, output:
TWEET 1:
...
TWEET 2:
...
"""


_LANG_NAMES = {"en": "English", "ru": "Russian", "ja": "Japanese", "ko": "Korean", "zh": "Chinese (Simplified)"}


def translation_user(text: str, target_lang: str) -> str:
    lang_name = _LANG_NAMES.get(target_lang, target_lang)
    return f"""Translate the following social media post into {lang_name}.

RULES:
- Preserve meaning, tone, formatting, emoji and hashtags.
- Keep proper nouns, tickers and technical terms accurate.
- Output ONLY the translated text, no explanations.

TEXT:
{text}"""


def image_prompt_user(styled_text: str, style_hint: str) -> str:
    return f"""Create a single concise image-generation prompt (max 80 words) for an illustration
accompanying this social media post. No text/words inside the image. Style: {style_hint or "clean, modern, editorial"}.

POST:
{styled_text[:2000]}

Output ONLY the image prompt."""


def fact_check_user(styled_text: str) -> str:
    return f"""You are a fact-checking expert. Verify the key factual claims in the following content.

CONTENT TO CHECK:
{styled_text}

TASK:
1. Identify 3-7 specific factual claims that can be verified (numbers, dates, events, quotes)
2. For each claim, search for verification
3. Assign a verdict

OUTPUT FORMAT: a single JSON object (no markdown fences):
{{
  "overall_verdict": "passed|issues_found|failed",
  "claims": [
    {{
      "claim": "...",
      "verdict": "verified|unverified|disputed|false",
      "confidence": 95,
      "source_url": "https://...",
      "source_title": "...",
      "explanation": "..."
    }}
  ],
  "summary": "short summary"
}}"""
