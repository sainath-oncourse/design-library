---
name: design-library
description: Sainath's design library for OnCourse. Videos, talks, articles and case studies about what other apps tried and what happened, each read by an agent from the source and turned into ideas for OnCourse screens. Use when adding a design video or article link, when designing or discussing an OnCourse screen and you want evidence of what other apps did (streaks, onboarding, paywall, trial, renewal, notifications), or when asked for this week's design experiments.
---

# Design library

Sainath can't watch every video or read every article, so the agent does: it reads each source, keeps what the app actually changed and what happened, and turns it into ideas for OnCourse. The library is also a website for Sainath's own learning.

| Where | What |
|---|---|
| `data/sources.json` | One object per source. **The source of truth.** |
| `data/lessons.json` | The course: one lesson per topic, each idea citing sources by exact Title |
| `data/experiments.json` | The weekly experiments |
| `site/`, `index.html`, `design-library.html` | The website, live at https://sainath-oncourse.github.io/design-library/ (GitHub Pages from `main`; every push updates it). `design-library.html` is one self-contained file to open or share; `site/` holds its parts |
| `build.mjs` | Run `node build.mjs` after any data change; it regenerates `site/data.js` and catches duplicate links |

Timeless principles (Laws of UX, design books, Apple HIG, Material) are **not** kept here. They live in the `product-design` skill's `principles.md`. Don't add a source that only restates a principle.

## A source

```json
{
  "Title": "How Duolingo's streak builds habit",
  "Creator": "Osman Mansur, Duolingo Blog",
  "Type": "Video | Article | Talk | Case study | Podcast | Thread",
  "Link": "https://… (unique)",
  "Topics": ["Onboarding", "Paywall", "Home", "Practice", "Lessons", "Progress & streaks", "Notifications", "Renewal", "Gamification", "Copy", "Visual design", "Navigation", "Accessibility", "Research methods", "Design process", "Motion", "AI tools"],
  "Goal": ["Activation", "Retention", "Conversion", "Renewal", "Usability", "Craft", "Speed"],
  "What they did": "The concrete change, in 1–3 sentences.",
  "Results": "Numbers with their context, quoted from the source. null if the source has none.",
  "Takeaways": "3–5 short points separated by '; '",
  "Ideas for OnCourse": "Screen: change. Screen: change. (1–3, each starting with the OnCourse screen: Home, Today's plan, Practice, Lessons, Flashcards, Streaks, Onboarding, Paywall, Renewal, Notifications, or "Design process:" for how the team works)",
  "Apps": ["Products studied, e.g. Duolingo (not design tools)"],
  "Tools": ["Design/AI tools shown, e.g. Figma, Claude Code, Cursor (optional)"],
  "Evidence type": "A/B test | Experience",
  "Bottom line": "One sentence: what to take away.",
  "Key points": [{ "title": "Short claim, ≤10 words", "detail": "2–4 sentences explaining what, how and why, with specifics and quotes", "t": 1234 }],
  "Chapters": [{ "t": 0, "title": "Intro", "summary": "One sentence" }],
  "Start here": { "t": 1234, "why": "The best part to watch if Sainath has 5 minutes" },
  "Image": "Banner image: https://i.ytimg.com/vi/<id>/hqdefault.jpg for YouTube, else the page's og:image",
  "Video": "YouTube URL when Link is a podcast/newsletter page that also has a video (optional)",
  "Duration": 3600,
  "Times": "exact | approximate (times estimated from transcript position)",
  "Status": "Read | To read | Tried",
  "Used in": "Experiment names, if any",
  "Added": "YYYY-MM-DD"
}
```

## Add a source

Channels already mined: Lenny's Podcast (transcripts: github.com/ChatPRD/lennys-podcast-transcripts), Dive Club (Ridd), Sneak Peek (@sneakpeekdesign). For YouTube captions, `youtube-transcript-api` (Python) works when yt-dlp hangs.


1. **Read the source itself, never from memory.** Fetch the article. For a video or podcast, get the transcript (the page, a transcript site, or a published transcript); if Caddie is connected, `create_video_note` then `get_note` reads YouTube transcripts. If it can't be read, add it with `"Status": "To read"` and say so.
2. Fill every field. Key points (4–6) must be explained, not one-liners, each with `t` = seconds where it's said (null for articles). Chapters: use the creator's YouTube chapters when the description has them; otherwise 6–12 at real topic shifts. For articles, chapters come from the real headings with `"t": null, "anchor": "<heading text exactly as on the page>"` (the site links them with #:~:text=). `Takeaways` = the key point titles joined by "; ". Quote numbers exactly with their context; never round up or invent them. Keep "Ideas for OnCourse" to a real screen and a real change.
3. Check `Link` isn't already in `data/sources.json`, append the object.
4. **Update the course.** Add the source to the matching lesson in `data/lessons.json`: cite it in an existing idea (`sources` uses the exact Title), add a new idea if it teaches something new, or start a new lesson when 3+ sources share a topic no lesson covers. Only state what the sources say. Run `node build.mjs` (it fails if a lesson cites a missing source).
5. Commit and push (`git add -A && git commit -m "add: <title>" && git push`).
6. Reply with three lines: what they did, what happened, and the one idea most worth trying.

## Use it while designing

When `/product-design` or a discussion needs evidence, search `data/sources.json` by Topics and Goal for the screen at hand (and Caddie's `growth_library` if connected). Bring 2–4 sources: what they did, the result, how it would look in OnCourse, with the link.

## Weekly experiments (1–2 a week)

1. Read `data/experiments.json`: what was picked, running, won or lost. Don't repeat a lost idea without a new reason.
2. Find the biggest leaks in PostHog (onboarding completion, paywall view and trial start, D1/D7/D30 retention, plan completion, streak breaks, renewal). Quote numbers with their date range.
3. For the 1–2 leaks affecting the most learners, find what other apps did in the sources. Prefer sources with real Results.
4. Check the idea isn't already in the app (search the oncourse-app code).
5. Append to `data/experiments.json`: `{ "Experiment", "Week" (Monday, YYYY-MM-DD), "Goal", "Area", "Hypothesis": "If we <change> on <screen>, then <metric> moves from <baseline> to <target>, because <what app X did and what happened>", "Based on", "Data", "Metric", "Target", "Effort": "S|M|L", "Score": (impact 1–10 × confidence 1–10) / effort (S=1, M=2, L=3), "Status": "Proposed", "Owner", "Result" }`. Add the experiment name to each source's "Used in". Build, commit, push.
6. No dark patterns, no fake numbers, and respect store rules (paywall transparency, permission and review prompts).
7. Tell Sainath the 1–2 experiments, the data and source behind each, and how to start one: `/product-design <experiment>`.
