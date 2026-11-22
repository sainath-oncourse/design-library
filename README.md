# Design library

What other apps tried, and what happened: videos, talks, articles and case studies, read by an agent and turned into ideas for OnCourse.

- **Browse:** https://sainath-oncourse.github.io/design-library/ (or double-click `design-library.html` offline).
- **Add a source:** give the agent a link ("add this to the design library: <link>"). It follows [SKILL.md](SKILL.md).
- **Weekly experiments:** ask the agent for "this week's design experiments".

Data lives in `data/sources.json` and `data/experiments.json`. After editing, run `node build.mjs`.

**Screens:** app screens and animations captured on Android live in the private screen library (`~/Documents/screen-library`). To update the Screens section, run `node sync-screens.mjs` (it copies `screens/` and writes `data/screens.json`), then `node build.mjs`.
