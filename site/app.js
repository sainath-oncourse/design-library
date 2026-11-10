(() => {
  const { sources, experiments, lessons, built } = window.LIBRARY;
  const app = document.getElementById("app");
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));

  // ---------- personal state (this browser only) ----------
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem("dl:" + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem("dl:" + k, JSON.stringify(v)),
  };
  const learned = new Set(store.get("learned", []));
  const notes = store.get("notes", {});
  const filters = { q: "", topic: null, goal: null, type: null, unread: false, tested: false };
  let lastQuestion = new URLSearchParams(location.search).get("q") || "";

  // ---------- theme ----------
  const root = document.documentElement;
  const applyTheme = (t) => { if (t) root.dataset.theme = t; else delete root.dataset.theme; };
  applyTheme(new URLSearchParams(location.search).get("theme") || store.get("theme", null));
  document.getElementById("theme").onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    store.set("theme", next); applyTheme(next);
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const splitTakeaways = (t) => (t || "").split(/;\s+/).filter(Boolean).map(cap);
  const splitIdeas = (t) => (t || "").split(/(?<=[.!?'])\s+(?=[A-Z][\w/' -]{2,40}:\s)/).filter(Boolean);
  const ideaParts = (i) => { const m = i.match(/^([A-Z][\w/' -]{2,40}):\s+(.*)$/s); return m ? [m[1], cap(m[2])] : [null, cap(i)]; };
  const firstSentence = (t) => (t || "").split(/(?<=\.)\s/)[0];
  const typeClass = (t) => "t-" + String(t || "").toLowerCase().replace(/\s/g, "-");
  const tested = (s) => s["Evidence type"] === "A/B test";
  const apps = [...new Set(sources.flatMap((s) => s.Apps || []))]
    .map((name) => ({ name, id: slug(name), items: sources.filter((s) => (s.Apps || []).includes(name)) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  const ideaCount = sources.reduce((n, s) => n + splitIdeas(s["Ideas for OnCourse"]).length, 0);
  const sectionHead = (title, href, label) => `<div class="section-head"><h2>${title}</h2>${href ? `<a class="link" href="${href}">${label} →</a>` : ""}</div>`;

  const evidenceBadge = (s) => tested(s)
    ? `<span class="ev ev-test" title="Backed by an A/B test or measured result">Tested</span>`
    : `<span class="ev" title="Experience or opinion, no measured result">Experience</span>`;

  function card(s) {
    const r = s.Results ? firstSentence(s.Results) : null;
    return `
      <a class="card ${learned.has(s.id) ? "is-learned" : ""}" href="#/s/${s.id}">
        <div class="meta"><span class="type ${typeClass(s.Type)}">${esc(s.Type)}</span>${evidenceBadge(s)}<span class="muted">${esc(host(s.Link))}</span>${learned.has(s.id) ? `<span class="tick">✓ Learned</span>` : ""}</div>
        <h3>${esc(s.Title)}</h3>
        <p class="did">${esc(s["Bottom line"] || s["What they did"])}</p>
        ${r && tested(s) ? `<p class="result"><span>${esc(r)}</span></p>` : `<p class="result none"><span>${r ? esc(r) : "No numbers in the source"}</span></p>`}
        <div class="tags">${(s.Apps || []).map((a) => `<span class="tag app">${esc(a)}</span>`).join("")}${(s.Topics || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </a>`;
  }

  // ---------- Ask (searches the library in this browser) ----------
  const STOP = new Set("a an the and or of to in on for with how do does did i we our my should can what when why which is are be it this that from at by into vs more most best get make".split(" "));
  const SYN = {
    push: ["notifications", "reminder"], notification: ["notifications", "reminder"], notifications: ["reminder"], remind: ["reminder", "notifications"], reminders: ["reminder", "notifications"],
    cancel: ["renewal", "churn", "cancellation"], cancellations: ["renewal", "churn"], churn: ["renewal", "cancel"], renew: ["renewal"], renewal: ["churn", "cancel"],
    trial: ["paywall", "trial"], price: ["paywall", "pricing", "plan"], pricing: ["paywall", "plan"], subscribe: ["paywall", "conversion"], conversion: ["paywall"], buy: ["paywall", "conversion"],
    new: ["onboarding", "activation", "first"], week: ["activation", "first"], first: ["onboarding", "activation"], signup: ["sign-up", "onboarding"], activation: ["onboarding", "first"], onboard: ["onboarding"],
    streak: ["streak", "streaks", "freeze"], streaks: ["streak", "freeze"], habit: ["streak", "retention", "daily"], retention: ["streak", "retain"], daily: ["streak", "habit"], study: ["lesson", "session"],
    learners: ["users", "learner"], users: ["learner"], freeze: ["freezes", "streak"], freezes: ["freeze", "streak"],
  };
  const words = (q) => q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const expand = (ws) => [...new Set(ws.flatMap((w) => [w, ...(SYN[w] || []), w.replace(/s$/, "")]))];

  function ask(q) {
    const terms = expand(words(q));
    if (!terms.length) return null;
    const scored = sources.map((s) => {
      const strong = [s.Title, (s.Topics || []).join(" "), s["Bottom line"]].join(" ").toLowerCase();
      const body = [s["What they did"], s.Results, s.Takeaways, s["Ideas for OnCourse"]].join(" ").toLowerCase();
      let score = 0;
      for (const t of terms) { if (strong.includes(t)) score += 3; if (body.includes(t)) score += 1; }
      if (score && tested(s)) score += 1.5;
      return { s, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const lessonScores = lessons.map((l) => {
      const hay = [l.title, l.summary, l.topics.join(" "), ...l.ideas.map((i) => i.heading + " " + i.body)].join(" ").toLowerCase();
      return { l, score: terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score);
    return { hits: scored.slice(0, 6), lesson: lessonScores[0]?.score ? lessonScores[0].l : null };
  }

  const SUGGESTED = [
    "How do I get new learners to study in their first week?",
    "Should the paywall come before or after onboarding?",
    "How should streak freezes work?",
    "When should we ask to send reminders?",
    "How do I reduce cancellations at renewal?",
    "What makes a free trial feel safe to start?",
    "How should tabs and navigation work?",
    "How do we make screens accessible?",
  ];

  function renderAnswer(q) {
    const box = document.getElementById("answer");
    if (!q.trim()) { box.innerHTML = ""; return; }
    const res = ask(q);
    if (!res || !res.hits.length) {
      box.innerHTML = `<div class="answer"><p><strong>The library has nothing on that yet.</strong></p><p class="muted">Try different words, or ask your agent to find and add a source about it.</p></div>`;
      return;
    }
    const top = res.hits.slice(0, 3);
    box.innerHTML = `
      <div class="answer">
        <p class="eyebrow">What to do first</p>
        <ol class="steps">
          ${top.map(({ s }, i) => {
            const [screen, text] = ideaParts(splitIdeas(s["Ideas for OnCourse"])[0] || "");
            return `<li>
              <span class="num">${i + 1}</span>
              <div>
                <p class="step-title">${screen ? `<span class="screen">${esc(screen)}</span> ` : ""}${esc(text)}</p>
                <p class="step-why"><strong>${esc((s.Apps || [])[0] || s.Creator)}:</strong> ${esc(s["Bottom line"])}</p>
                ${s.Results && tested(s) ? `<p class="step-result">${esc(firstSentence(s.Results))}</p>` : ""}
                <a class="link small" href="#/s/${s.id}">Read the notes →</a>
              </div>
            </li>`;
          }).join("")}
        </ol>
        <div class="where">
          <p class="eyebrow">Where the answers come from</p>
          <div class="where-list">${res.hits.slice(0, 5).map(({ s }) => `<a href="#/s/${s.id}"><span class="muted small">${esc(s.Type)} · ${esc(host(s.Link))}</span><span>${esc(s.Title)}</span></a>`).join("")}</div>
          ${res.lesson ? `<a class="btn" href="#/course/${res.lesson.id}">Read the lesson: ${esc(res.lesson.title)} →</a>` : ""}
        </div>
        <p class="muted small">Searches this library on your Mac and shows what it says. For a written answer, ask your agent (it reads the same library).</p>
      </div>`;
  }

  function renderHome() {
    const testedCount = sources.filter(tested).length;
    const recent = [...sources].sort((a, b) => String(b.Added).localeCompare(String(a.Added))).slice(0, 6);
    app.innerHTML = `
      <section class="hero">
        <h1>We read the design talks<br/>so you don't have to</h1>
        <p class="lede">What apps like Duolingo, Headspace and Calm changed in onboarding, practice, streaks, reminders, paywalls and renewal, and how teams like Apple and Linear design screens. Every point links to its source, with ideas for OnCourse.</p>
        <div class="stats">
          <div><strong>${sources.length}</strong><span>videos, talks and case studies</span></div>
          <div><strong>${testedCount}</strong><span>with tested results</span></div>
          <div><strong>${ideaCount}</strong><span>ideas for OnCourse</span></div>
          <div><strong>${apps.length}</strong><span>apps</span></div>
        </div>
      </section>

      <section class="ask">
        <form id="askf" class="ask-box" role="search">
          <input id="askq" type="search" placeholder="Ask about onboarding, streaks, reminders, paywalls, renewal…" value="${esc(lastQuestion)}" aria-label="Ask the library" autocomplete="off" />
          <button class="btn primary" type="submit">Ask</button>
        </form>
        <div class="suggest">${SUGGESTED.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <div id="answer" aria-live="polite"></div>
      </section>

      <section>
        ${sectionHead("The course", "#/course", "All lessons")}
        <div class="lesson-grid">${lessons.map((l, i) => lessonCard(l, i)).join("")}</div>
      </section>

      <section>
        ${sectionHead("Latest sources", "#/sources", `All ${sources.length}`)}
        <div class="grid">${recent.map(card).join("")}</div>
      </section>

      <section>
        ${sectionHead("Apps", "#/apps", "All apps")}
        <div class="app-row">${apps.map((a) => `<a class="app-pill" href="#/apps/${a.id}"><span class="app-mark">${esc(a.name[0])}</span>${esc(a.name)} <span class="muted">${a.items.length}</span></a>`).join("")}</div>
      </section>
    `;
    const f = document.getElementById("askf"), q = document.getElementById("askq");
    f.onsubmit = (e) => { e.preventDefault(); lastQuestion = q.value; renderAnswer(q.value); };
    app.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { q.value = b.dataset.q; lastQuestion = q.value; renderAnswer(q.value); });
    if (lastQuestion) renderAnswer(lastQuestion);
  }

  // ---------- Course ----------
  const lessonSources = (l) => [...new Set(l.ideas.flatMap((i) => i.sourceIds))];
  function lessonCard(l, i) {
    const n = lessonSources(l).length;
    const done = lessonSources(l).filter((id) => learned.has(id)).length;
    return `<a class="lesson" href="#/course/${l.id}">
      <span class="lesson-num">${i + 1}</span>
      <h3>${esc(l.title)}</h3>
      <p class="muted">${esc(l.summary)}</p>
      <span class="small muted">${l.ideas.length} ideas · ${n} sources${done ? ` · ${done} learned` : ""}</span>
    </a>`;
  }

  function renderCourse() {
    app.innerHTML = `
      <section class="intro">
        <h1>The course</h1>
        <p class="muted">Each lesson brings together what every source says about one topic, so you can learn it in ten minutes. It ends with what to try at OnCourse.</p>
      </section>
      <div class="lesson-list">${lessons.map((l, i) => lessonCard(l, i)).join("")}</div>`;
  }

  function renderLesson(id) {
    const i = lessons.findIndex((l) => l.id === id);
    const l = lessons[i];
    if (!l) return notFound("That lesson isn't in the course.");
    const prev = lessons[i - 1], next = lessons[i + 1];
    const srcs = lessonSources(l).map((x) => byId[x]);
    app.innerHTML = `
      <a class="back" href="#/course">← The course</a>
      <article class="detail lesson-page">
        <p class="eyebrow">Lesson ${i + 1} of ${lessons.length}</p>
        <h1>${esc(l.title)}</h1>
        <p class="lede">${esc(l.summary)}</p>

        <ol class="idea-list">
          ${l.ideas.map((idea, k) => `
            <li>
              <h3><span class="num">${k + 1}</span>${esc(idea.heading)}</h3>
              <p>${esc(idea.body)}</p>
              <div class="cites">${idea.sourceIds.map((sid) => `<a class="cite" href="#/s/${sid}">${esc((byId[sid].Apps || [])[0] || "")} · ${esc(byId[sid].Type)} ↗</a>`).join("")}</div>
            </li>`).join("")}
        </ol>

        <section class="try">
          <h3>Try at OnCourse</h3>
          <ul>${l.try.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <p class="muted small">To prototype one, run <code>/product-design &lt;idea&gt;</code>.</p>
        </section>
      </article>

      <section class="related">
        ${sectionHead(`Sources in this lesson (${srcs.length})`)}
        <div class="grid">${srcs.map(card).join("")}</div>
      </section>

      <nav class="pager">
        ${prev ? `<a href="#/course/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a href="#/course/${next.id}">${esc(next.title)} →</a>` : ""}
      </nav>`;
    scrollTo(0, 0);
  }

  // ---------- Sources ----------
  const uniq = (key) => [...new Set(sources.flatMap((s) => [].concat(s[key] || [])))].sort();
  const count = (key, v) => sources.filter((s) => [].concat(s[key] || []).includes(v)).length;
  const matches = (s) => {
    if (filters.topic && !(s.Topics || []).includes(filters.topic)) return false;
    if (filters.goal && !(s.Goal || []).includes(filters.goal)) return false;
    if (filters.type && s.Type !== filters.type) return false;
    if (filters.unread && learned.has(s.id)) return false;
    if (filters.tested && !tested(s)) return false;
    if (filters.q) {
      const hay = [s.Title, s.Creator, s["Bottom line"], s["What they did"], s.Results, s.Takeaways, s["Ideas for OnCourse"], (s.Topics || []).join(" "), (s.Apps || []).join(" ")].join(" ").toLowerCase();
      return filters.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  };
  const chipRow = (label, key, values, field) => `
    <div class="filter-row" role="group" aria-label="${label}">
      <span class="filter-label">${label}</span>
      ${values.map((v) => `<button type="button" class="chip ${filters[key] === v ? "on" : ""}" data-f="${key}" data-v="${esc(v)}" aria-pressed="${filters[key] === v}">${esc(v)} <span class="n">${count(field, v)}</span></button>`).join("")}
    </div>`;

  function renderSources() {
    const list = sources.filter(matches);
    const learnedCount = sources.filter((s) => learned.has(s.id)).length;
    const active = filters.q || Object.entries(filters).some(([k, v]) => v && k !== "q");
    app.innerHTML = `
      <section class="intro">
        <h1>Sources</h1>
        <p class="muted">Every video, talk, article and case study, read by the agent from the source itself. You've learned ${learnedCount} of ${sources.length}.</p>
        <div class="progress" aria-hidden="true"><span style="width:${sources.length ? (learnedCount / sources.length) * 100 : 0}%"></span></div>
      </section>
      <section class="filters">
        <input id="q" class="search" type="search" placeholder="Search: streak, paywall, Duolingo…" value="${esc(filters.q)}" aria-label="Search sources" />
        ${chipRow("Topic", "topic", uniq("Topics"), "Topics")}
        ${chipRow("Goal", "goal", uniq("Goal"), "Goal")}
        ${chipRow("Type", "type", uniq("Type"), "Type")}
        <div class="filter-row">
          <span class="filter-label">Show</span>
          <button type="button" class="chip ${filters.tested ? "on" : ""}" data-toggle="tested" aria-pressed="${filters.tested}">Tested only</button>
          <button type="button" class="chip ${filters.unread ? "on" : ""}" data-toggle="unread" aria-pressed="${filters.unread}">Not learned yet</button>
          ${active ? `<button type="button" class="link" id="clear">Clear all</button>` : ""}
        </div>
      </section>
      ${active ? `<p class="muted small">${list.length} of ${sources.length} sources</p>` : ""}
      ${list.length ? `<section class="grid">${list.map(card).join("")}</section>` :
        `<div class="empty"><p><strong>Nothing matches.</strong></p><p class="muted">Try fewer filters, or a different word.</p><button type="button" class="btn" id="clear2">Clear filters</button></div>`}
    `;
    const q = document.getElementById("q");
    q.oninput = () => { filters.q = q.value; const pos = q.selectionStart; renderSources(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); };
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const k = b.dataset.f; filters[k] = filters[k] === b.dataset.v ? null : b.dataset.v; renderSources(); });
    app.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => { filters[b.dataset.toggle] = !filters[b.dataset.toggle]; renderSources(); });
    const clear = () => { Object.assign(filters, { q: "", topic: null, goal: null, type: null, unread: false, tested: false }); renderSources(); };
    document.getElementById("clear")?.addEventListener("click", clear);
    document.getElementById("clear2")?.addEventListener("click", clear);
  }

  // ---------- Source notes ----------
  function renderSource(id) {
    const s = byId[id];
    if (!s) return notFound("That source isn't in the library.");
    const isLearned = learned.has(s.id);
    const inLessons = lessons.filter((l) => lessonSources(l).includes(s.id));
    const related = sources.filter((x) => x.id !== s.id && (x.Topics || []).some((t) => (s.Topics || []).includes(t))).slice(0, 3);
    app.innerHTML = `
      <a class="back" href="#/sources">← All sources</a>
      <article class="detail">
        <div class="meta"><span class="type ${typeClass(s.Type)}">${esc(s.Type)}</span>${evidenceBadge(s)}<span class="muted">${esc(s.Creator)}</span></div>
        <h1>${esc(s.Title)}</h1>
        <div class="tags">${(s.Apps || []).map((a) => `<a class="tag app" href="#/apps/${slug(a)}">${esc(a)}</a>`).join("")}${(s.Topics || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>

        <section class="bottom-line"><h3>The bottom line</h3><p>${esc(s["Bottom line"])}</p></section>

        <div class="actions">
          <a class="btn primary" href="${esc(s.Link)}" target="_blank" rel="noopener">Open the source ↗</a>
          <button type="button" class="btn" id="learn" aria-pressed="${isLearned}">${isLearned ? "✓ Learned" : "Mark as learned"}</button>
        </div>

        <section><h3>Key takeaways</h3><ul>${splitTakeaways(s.Takeaways).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>
        <section><h3>What they did</h3><p>${esc(s["What they did"])}</p></section>
        <section class="callout ${s.Results ? "" : "none"}"><h3>What happened</h3><p>${s.Results ? esc(s.Results) : "The source gives no numbers. Treat it as an idea, not a proven result."}</p></section>
        <section><h3>Ideas for OnCourse</h3><ul class="ideas">${splitIdeas(s["Ideas for OnCourse"]).map((i) => { const [screen, text] = ideaParts(i); return `<li>${screen ? `<span class="screen">${esc(screen)}</span>` : ""}<span>${esc(text)}</span></li>`; }).join("")}</ul></section>
        ${inLessons.length ? `<section><h3>In the course</h3><div class="cites">${inLessons.map((l) => `<a class="cite" href="#/course/${l.id}">${esc(l.title)} →</a>`).join("")}</div></section>` : ""}
        ${s["Used in"] ? `<section><h3>Used in</h3><p>${esc(s["Used in"])}</p></section>` : ""}

        <section><h3>My notes</h3><textarea id="notes" rows="4" placeholder="What did you learn? What would you try?">${esc(notes[s.id] || "")}</textarea><p class="muted small">Saved in this browser.</p></section>
        <p class="muted small">Added ${esc(s.Added || "")} · Notes written by the agent from the source itself; the source belongs to its creator.</p>
      </article>
      ${related.length ? `<section class="related">${sectionHead("Related")}<div class="grid">${related.map(card).join("")}</div></section>` : ""}
    `;
    document.getElementById("learn").onclick = () => {
      learned.has(s.id) ? learned.delete(s.id) : learned.add(s.id);
      store.set("learned", [...learned]); renderSource(id);
    };
    const ta = document.getElementById("notes");
    ta.oninput = () => { notes[s.id] = ta.value; store.set("notes", notes); };
    scrollTo(0, 0);
  }

  // ---------- Apps ----------
  function renderApps() {
    app.innerHTML = `
      <section class="intro"><h1>Apps</h1><p class="muted">What each app changed, and what happened, across every source.</p></section>
      <div class="app-grid">${apps.map((a) => {
        const results = a.items.filter((s) => s.Results).length;
        return `<a class="app-card" href="#/apps/${a.id}"><span class="app-mark big">${esc(a.name[0])}</span><div><h3>${esc(a.name)}</h3><p class="muted small">${a.items.length} source${a.items.length > 1 ? "s" : ""} · ${results} with results</p></div></a>`;
      }).join("")}</div>`;
  }

  function renderApp(id) {
    const a = apps.find((x) => x.id === id);
    if (!a) return notFound("That app isn't in the library.");
    app.innerHTML = `
      <a class="back" href="#/apps">← All apps</a>
      <section class="intro"><div class="app-title"><span class="app-mark big">${esc(a.name[0])}</span><h1>${esc(a.name)}</h1></div>
      <p class="muted">Everything the library says ${esc(a.name)} tried, with what happened.</p></section>
      <div class="timeline">${a.items.map((s) => `
        <article class="tl-item">
          <div class="meta"><span class="type ${typeClass(s.Type)}">${esc(s.Type)}</span>${evidenceBadge(s)}<span class="muted">${esc(s.Creator)}</span></div>
          <h3><a href="#/s/${s.id}">${esc(s.Title)}</a></h3>
          <p>${esc(s["What they did"])}</p>
          ${s.Results ? `<p class="result"><span>${esc(s.Results)}</span></p>` : ""}
        </article>`).join("")}</div>`;
    scrollTo(0, 0);
  }

  // ---------- Experiments ----------
  function renderExperiments() {
    const byWeek = [...experiments].sort((a, b) => String(b.Week).localeCompare(String(a.Week)));
    app.innerHTML = `
      <section class="intro"><h1>Weekly experiments</h1><p class="muted">One or two ideas a week, picked from the sources and OnCourse's own data.</p></section>
      ${byWeek.length ? `<section class="exp-list">${byWeek.map((e) => `
        <article class="exp">
          <div class="meta"><span class="status s-${esc(String(e.Status || "").toLowerCase())}">${esc(e.Status || "Proposed")}</span><span class="muted">Week of ${esc(e.Week || "")} · ${esc(e.Area || "")} · ${esc(e.Goal || "")}</span>${e.Effort ? `<span class="muted">Effort ${esc(e.Effort)}</span>` : ""}</div>
          <h3>${esc(e.Experiment)}</h3>
          <p>${esc(e.Hypothesis)}</p>
          ${e.Data ? `<p class="small"><strong>Data:</strong> ${esc(e.Data)}</p>` : ""}
          ${e["Based on"] ? `<p class="small"><strong>Based on:</strong> ${esc(e["Based on"])}</p>` : ""}
          ${e.Result ? `<p class="callout"><strong>Result:</strong> ${esc(e.Result)}</p>` : ""}
        </article>`).join("")}</section>` :
      `<div class="empty"><p><strong>No experiments yet.</strong></p><p class="muted">Ask your agent for "this week's design experiments". It finds the biggest leak in PostHog, matches it to what other apps did, and proposes one or two to try.</p><a class="btn" href="#/course">Browse the course</a></div>`}`;
  }

  // ---------- Use with your agent ----------
  function renderAgent() {
    const prompts = [
      ["Add a source", "Add this to the design library: <link>"],
      ["Ideas for a screen", "Use the design library: what did other apps do about <problem, e.g. new learners not studying in week 1>? Give me the 3 changes most likely to work for OnCourse, each with what the app did, the result and the link."],
      ["This week's experiments", "Give me this week's design experiments from the design library and PostHog."],
      ["Design with it", "/product-design <idea> (it checks the design library during the evidence step)"],
    ];
    app.innerHTML = `
      <section class="intro"><h1>Use it with your agent</h1>
      <p class="muted">The library is installed as the <code>design-library</code> skill in Claude Code, Cursor and Codex on this Mac, so any agent there can read it, add to it and use it while designing.</p></section>
      <div class="prompt-list">${prompts.map(([t, p], i) => `
        <div class="prompt"><div><h3>${esc(t)}</h3><p><code>${esc(p)}</code></p></div><button type="button" class="btn" data-copy="${i}">Copy</button></div>`).join("")}</div>
      <section class="try"><h3>Where it lives</h3><ul>
        <li><code>~/Documents/design-library/data/sources.json</code>: the sources (the agent edits this)</li>
        <li><code>~/Documents/design-library/data/lessons.json</code>: the course</li>
        <li><code>~/Documents/design-library/design-library.html</code>: this site, one file</li>
      </ul></section>`;
    app.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
      try { await navigator.clipboard.writeText(prompts[+b.dataset.copy][1]); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { b.textContent = "Select and copy"; }
    });
  }

  function notFound(msg) {
    app.innerHTML = `<div class="empty"><p><strong>${esc(msg)}</strong></p><a class="btn" href="#/">Back home</a></div>`;
  }

  // ---------- router ----------
  function route() {
    const h = location.hash || "#/";
    const tab = h.startsWith("#/course") ? "course" : h.startsWith("#/s") ? "sources" : h.startsWith("#/apps") ? "apps" : h.startsWith("#/experiments") ? "experiments" : h.startsWith("#/agent") ? "agent" : "ask";
    document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const [, , a, b] = h.split("/");
    if (h.startsWith("#/course/") && b === undefined && a) renderLesson(decodeURIComponent(a));
    else if (h.startsWith("#/course")) renderCourse();
    else if (h.startsWith("#/s/")) renderSource(decodeURIComponent(a));
    else if (h.startsWith("#/sources")) renderSources();
    else if (h.startsWith("#/apps/")) renderApp(decodeURIComponent(a));
    else if (h.startsWith("#/apps")) renderApps();
    else if (h.startsWith("#/experiments")) renderExperiments();
    else if (h.startsWith("#/agent")) renderAgent();
    else renderHome();
    if (!h.startsWith("#/s/") && !h.startsWith("#/course/") && !h.startsWith("#/apps/")) scrollTo(0, 0);
  }
  document.getElementById("foot").innerHTML = `Updated ${built} · Notes written by the agent from each source; the sources belong to their creators.`;
  addEventListener("hashchange", route);
  route();
})();
