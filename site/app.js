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
  const filters = { q: "", topic: null, goal: null, type: null, channel: null, unread: false, tested: false };
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
  const tested = (s) => s["Evidence type"] === "A/B test";
  const sectionHead = (title, href, label, sub) => `<div class="section-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${href ? `<a class="link" href="${href}">${label} →</a>` : ""}</div>`;

  // media
  const ICON = {
    video: '<svg viewBox="0 0 16 16"><path d="M4 2.8v10.4c0 .6.6.9 1.1.6l8.2-5.2c.5-.3.5-.9 0-1.2L5.1 2.2C4.6 1.9 4 2.2 4 2.8z"/></svg>',
    podcast: '<svg viewBox="0 0 16 16"><path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0v-4A2.5 2.5 0 0 0 8 1zm-4.5 6a.75.75 0 0 1 .75.75 3.75 3.75 0 0 0 7.5 0 .75.75 0 0 1 1.5 0 5.25 5.25 0 0 1-4.5 5.2V14.5h2a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5h2v-1.55a5.25 5.25 0 0 1-4.5-5.2A.75.75 0 0 1 3.5 7z"/></svg>',
    article: '<svg viewBox="0 0 16 16"><path d="M3.5 1h6.3L13 4.2v9.3c0 .8-.7 1.5-1.5 1.5h-8C2.7 15 2 14.3 2 13.5v-11C2 1.7 2.7 1 3.5 1zM5 8h6v1.3H5zm0 2.6h6v1.3H5zM5 5.4h3v1.3H5z"/></svg>',
    "case-study": '<svg viewBox="0 0 16 16"><path d="M2 13h12v1.5H2zM3 8h2.2v4H3zm3.9-3h2.2v7H6.9zm3.9-3H13v10h-2.2z"/></svg>',
    talk: '<svg viewBox="0 0 16 16"><path d="M1.5 2h13v1.5H14V10c0 .6-.4 1-1 1H8.8l2 3.2-1.3.8L8 12.6 6.5 15l-1.3-.8 2-3.2H3c-.6 0-1-.4-1-1V3.5h-.5z"/></svg>',
    paper: '<svg viewBox="0 0 16 16"><path d="M3.5 1h9c.8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5h-9C2.7 15 2 14.3 2 13.5v-11C2 1.7 2.7 1 3.5 1zM5 4v1.3h6V4zm0 2.6v1.3h6V6.6zm0 2.6v1.3h4V9.2z"/></svg>',
  };
  const PAPERS = /nature\.com|jamanetwork|stanford\.edu|udel\.edu|pnas\.org|rug\.nl/;
  const kindOf = (s) => (PAPERS.test(s.Link) ? "paper" : String(s.Type || "article").toLowerCase().replace(/\s+/g, "-"));
  const kindLabel = (k) => ({ "case-study": "Case study", paper: "Research" }[k] || cap(k));
  const kindPill = (s) => { const k = kindOf(s); return `<span class="kind k-${k}">${ICON[k] || ICON.article}${kindLabel(k)}</span>`; };
  const vidOf = (s) => ((s.Video || s.Link).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1] || null;
  const canEmbed = location.protocol.startsWith("http");
  const fmtDur = (sec) => { if (!sec) return ""; const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + "m" : ""}`.trim() : `${m} min`; };
  const fmtT = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = String(t % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  const approx = (s) => (s.Times === "approximate" ? "≈" : "");
  const frag = (a) => encodeURIComponent(a).replace(/-/g, "%2D").replace(/,/g, "%2C");
  function jumpUrl(s, t, anchor) {
    const vid = vidOf(s);
    if (t != null && vid) return `https://www.youtube.com/watch?v=${vid}&t=${Math.round(t)}s`;
    if (t != null && /developer\.apple\.com\/videos/.test(s.Link)) return `${s.Link.replace(/\/?$/, "/")}?time=${Math.round(t)}`;
    if (anchor) return `${s.Link.split("#")[0]}#:~:text=${frag(anchor)}`;
    return null;
  }
  const CHANNELS = [
    [/lennysnewsletter\.com|^Lenny's Podcast/, "Lenny's Podcast", "#f76b15"],
    [/^Dive Club/, "Dive Club", "#2c7be5"],
    [/^Sneak Peek/, "Sneak Peek", "#12a594"],
    [/subclub\.com|^Sub Club/, "Sub Club", "#e93d82"],
    [/revenuecat\.com/, "RevenueCat", "#f2545b"],
    [/developer\.apple\.com/, "Apple WWDC", "#1d1d1f"],
    [/blog\.duolingo\.com/, "Duolingo Blog", "#58a700"],
    [/superwall\.com/, "Superwall", "#6e56cf"],
    [PAPERS, "Research papers", "#6f6e77"],
  ];
  const channelOf = (s) => { for (const [re, name, color] of CHANNELS) if (re.test(s.Link) || re.test(s.Creator || "")) return { name, color }; return { name: host(s.Link).replace(/^blog\./, ""), color: "#8b8d98" }; };
  sources.forEach((s) => { s._ch = channelOf(s).name; });
  const channels = [...new Set(sources.map((s) => s._ch))]
    .map((name) => ({ name, color: (CHANNELS.find((c) => c[1] === name) || [])[2] || "#8b8d98", items: sources.filter((s) => s._ch === name) }))
    .sort((a, b) => b.items.length - a.items.length);
  const kpCount = (s) => (s["Key points"] || []).length || splitTakeaways(s.Takeaways).length;

  function banner(s, { play = false, tag = "div", href = "" } = {}) {
    const k = kindOf(s), dur = fmtDur(s.Duration), ch = channelOf(s);
    const inner = `${kindPill(s)}${dur ? `<span class="dur">${dur}</span>` : ""}${s.Image ? "" : `<span class="chan">${esc(ch.name)}</span>`}${play || vidOf(s) ? `<span class="play">${ICON.video}</span>` : ""}`;
    const attrs = href ? ` href="${esc(href)}"` : "";
    if (s.Image) return `<${tag} class="banner"${attrs} style="--k:var(--${k === "case-study" ? "case" : k})"><img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('fallback');this.remove()"/>${inner}</${tag}>`;
    return `<${tag} class="banner fallback"${attrs} style="--k:var(--${k === "case-study" ? "case" : k})"><span class="fb-title">${esc(s._ch)}</span>${inner}</${tag}>`;
  }
  const thumb = (s, cls = "thumb") => s.Image ? `<span class="${cls}"><img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>` : `<span class="${cls} fallback" style="--k:var(--${kindOf(s) === "case-study" ? "case" : kindOf(s)})"></span>`;
  const citeThumb = (s) => s.Image ? `<img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<i style="--k:var(--${kindOf(s) === "case-study" ? "case" : kindOf(s)})"></i>`;

  const evidenceBadge = (s) => tested(s)
    ? `<span class="ev ev-test" title="Backed by an A/B test or measured result">Tested</span>`
    : `<span class="ev" title="Experience or opinion, no measured result">Experience</span>`;

  function card(s) {
    const r = s.Results && tested(s) ? firstSentence(s.Results) : null;
    return `
      <a class="card ${learned.has(s.id) ? "is-learned" : ""}" href="#/s/${s.id}">
        ${banner(s)}
        <div class="card-body">
          <h3>${esc(s.Title)}</h3>
          <p class="did">${esc(s["Bottom line"] || s["What they did"])}</p>
          ${r ? `<p class="result"><span>${esc(r)}</span></p>` : ""}
          <div class="card-foot">${evidenceBadge(s)}<span class="kp">${kpCount(s)} key points${(s.Chapters || []).length ? ` · ${s.Chapters.length} chapters` : ""}</span></div>
        </div>
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
    ai: ["claude", "cursor", "prototype", "prototyping"], claude: ["ai", "prototype"], cursor: ["ai", "prototype"], prototype: ["prototyping", "prototypes"], prototyping: ["prototype"],
    crit: ["crits", "critique", "feedback"], crits: ["crit", "critique"], critique: ["crit", "crits"], handoff: ["engineers", "handoff"], delight: ["delight", "playful", "motion"],
    learners: ["users", "learner"], users: ["learner"], freeze: ["freezes", "streak"], freezes: ["freeze", "streak"],
  };
  const words = (q) => q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const expand = (ws) => [...new Set(ws.flatMap((w) => [w, ...(SYN[w] || []), w.replace(/s$/, "")]))];
  const kpText = (s) => (s["Key points"] || []).map((k) => k.title + " " + k.detail).join(" ");

  function ask(q) {
    const terms = expand(words(q));
    if (!terms.length) return null;
    const scored = sources.map((s) => {
      const strong = [s.Title, (s.Topics || []).join(" "), s["Bottom line"]].join(" ").toLowerCase();
      const body = [s["What they did"], s.Results, s.Takeaways, s["Ideas for OnCourse"], kpText(s)].join(" ").toLowerCase();
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
    "How do designers prototype with Claude Code?",
    "How should we run design crits?",
    "How do we add delight without clutter?",
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
                <p class="step-title">${screen ? `<span class="screen">${esc(screen)}</span>` : ""}${esc(text)}</p>
                <p class="step-why"><strong>${esc((s.Apps || [])[0] || s._ch)}:</strong> ${esc(s["Bottom line"])}</p>
                ${s.Results && tested(s) ? `<p class="step-result">${esc(firstSentence(s.Results))}</p>` : ""}
                <a class="link small" href="#/s/${s.id}">Read the notes →</a>
              </div>
            </li>`;
          }).join("")}
        </ol>
        <div class="where">
          <p class="eyebrow">Where the answers come from</p>
          <div class="where-list">${res.hits.slice(0, 6).map(({ s }) => `<a class="mini" href="#/s/${s.id}">${thumb(s)}<span>${esc(s.Title)}</span></a>`).join("")}</div>
          ${res.lesson ? `<a class="btn" href="#/course/${res.lesson.id}">Read the lesson: ${esc(res.lesson.title)} →</a>` : ""}
        </div>
      </div>`;
  }

  function renderHome() {
    const testedCount = sources.filter(tested).length;
    const hours = Math.round(sources.reduce((n, s) => n + (s.Duration || 0), 0) / 3600);
    const byNew = [...sources].sort((a, b) => String(b.Added).localeCompare(String(a.Added)));
    const recent = []; const seenCh = new Set();
    for (const s of byNew) if (recent.length < 6 && !seenCh.has(s._ch) && s.Added === byNew[0].Added) { recent.push(s); seenCh.add(s._ch); }
    for (const s of byNew) if (recent.length < 6 && !recent.includes(s)) recent.push(s);
    app.innerHTML = `
      <section class="hero">
        <h1>We watch the design talks<br/>so you <em>don't have to</em></h1>
        <p class="lede">What Duolingo, Headspace, Linear, Swiggy and others changed, and what happened. Every video, podcast and article is boiled down to key points you can learn in minutes, with links straight to the moment it's said.</p>
        <div class="stats">
          <div><strong>${sources.length}</strong> sources</div>
          <div><strong>${hours}h</strong> of video and podcasts</div>
          <div><strong>${testedCount}</strong> with tested results</div>
          <div><strong>${lessons.length}</strong> lessons</div>
        </div>
      </section>

      <section class="ask">
        <form id="askf" class="ask-box" role="search">
          <input id="askq" type="search" placeholder="Ask anything: onboarding, streaks, paywalls, crits, AI prototyping…" value="${esc(lastQuestion)}" aria-label="Ask the library" autocomplete="off" />
          <button class="btn primary" type="submit">Ask</button>
        </form>
        <div class="suggest">${SUGGESTED.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <div id="answer" aria-live="polite"></div>
      </section>

      <section>
        ${sectionHead("Latest", "#/sources", `All ${sources.length} sources`, "Newly added videos, podcasts and articles")}
        <div class="grid">${recent.map(card).join("")}</div>
      </section>

      <section>
        ${sectionHead("The course", "#/course", "All lessons", "Everything the sources say on one topic, in ten minutes")}
        <div class="lesson-grid">${lessons.map((l, i) => lessonCard(l, i)).join("")}</div>
      </section>

      <section>
        ${sectionHead("Channels", null, null, "Where the sources come from")}
        <div class="channels">${channels.filter((c) => c.items.length >= 2).map((c) => `
          <a class="channel" href="#/sources" data-channel="${esc(c.name)}"><span class="avatar" style="--k:${c.color}">${esc(c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</span><div><h3>${esc(c.name)}</h3><p>${c.items.length} sources</p></div></a>`).join("")}</div>
      </section>
    `;
    const f = document.getElementById("askf"), q = document.getElementById("askq");
    f.onsubmit = (e) => { e.preventDefault(); lastQuestion = q.value; renderAnswer(q.value); };
    app.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { q.value = b.dataset.q; lastQuestion = q.value; renderAnswer(q.value); });
    app.querySelectorAll("[data-channel]").forEach((a) => a.onclick = () => { Object.assign(filters, { q: "", topic: null, goal: null, type: null, unread: false, tested: false, channel: a.dataset.channel }); });
    if (lastQuestion) renderAnswer(lastQuestion);
  }

  // ---------- Course ----------
  const lessonSources = (l) => [...new Set(l.ideas.flatMap((i) => i.sourceIds))];
  function lessonCard(l, i) {
    const ids = lessonSources(l);
    const done = ids.filter((id) => learned.has(id)).length;
    const faces = ids.map((id) => byId[id]).filter((s) => s.Image).slice(0, 5);
    return `<a class="lesson" href="#/course/${l.id}">
      <span class="lesson-num">${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(l.title)}</h3>
      <p class="muted">${esc(l.summary)}</p>
      <span class="small muted">${l.ideas.length} ideas · ${ids.length} sources${done ? ` · ${done} learned` : ""}</span>
      <span class="faces">${faces.map((s) => `<img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`).join("")}</span>
    </a>`;
  }

  function renderCourse() {
    app.innerHTML = `
      <section class="intro">
        <h1>The course</h1>
        <p>Each lesson brings together what every source says about one topic, so you can learn it in ten minutes. It ends with what to try at OnCourse.</p>
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
      <article class="lesson-page">
        <p class="eyebrow">Lesson ${i + 1} of ${lessons.length}</p>
        <h1>${esc(l.title)}</h1>
        <p class="lede">${esc(l.summary)}</p>
        <ol class="idea-list">
          ${l.ideas.map((idea, k) => `
            <li>
              <h3><span class="num">${k + 1}</span>${esc(idea.heading)}</h3>
              <p>${esc(idea.body)}</p>
              <div class="cites">${idea.sourceIds.map((sid) => { const s = byId[sid]; return `<a class="cite" href="#/s/${sid}">${citeThumb(s)}<b>${esc((s.Apps || [])[0] || s._ch)} · ${esc(s.Title)}</b></a>`; }).join("")}</div>
            </li>`).join("")}
        </ol>
        <section class="try">
          <h3>Try at OnCourse</h3>
          <ul>${l.try.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <p class="muted small">To prototype one, run <code>/product-design &lt;idea&gt;</code>.</p>
        </section>
      </article>
      <section class="related">
        ${sectionHead(`Sources in this lesson`, null, null, `${srcs.length} videos, podcasts and articles`)}
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
    if (filters.channel && s._ch !== filters.channel) return false;
    if (filters.unread && learned.has(s.id)) return false;
    if (filters.tested && !tested(s)) return false;
    if (filters.q) {
      const hay = [s.Title, s.Creator, s._ch, s["Bottom line"], s["What they did"], s.Results, s.Takeaways, kpText(s), s["Ideas for OnCourse"], (s.Topics || []).join(" "), (s.Apps || []).join(" "), (s.Tools || []).join(" ")].join(" ").toLowerCase();
      return filters.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  };
  const chipRow = (label, key, values, field) => `
    <div class="filter-row" role="group" aria-label="${label}">
      <span class="filter-label">${label}</span>
      ${values.map((v) => `<button type="button" class="chip ${filters[key] === v ? "on" : ""}" data-f="${key}" data-v="${esc(v)}" aria-pressed="${filters[key] === v}">${esc(v)} <span class="n">${field === "_ch" ? sources.filter((s) => s._ch === v).length : count(field, v)}</span></button>`).join("")}
    </div>`;

  function renderSources() {
    const list = sources.filter(matches);
    const learnedCount = sources.filter((s) => learned.has(s.id)).length;
    const active = filters.q || Object.entries(filters).some(([k, v]) => v && k !== "q");
    app.innerHTML = `
      <section class="intro">
        <h1>Sources</h1>
        <p>Every video, podcast, talk and article, read by the agent from the source itself. You've learned ${learnedCount} of ${sources.length}.</p>
        <div class="progress" aria-hidden="true"><span style="width:${sources.length ? (learnedCount / sources.length) * 100 : 0}%"></span></div>
      </section>
      <section class="filters">
        <input id="q" class="search" type="search" placeholder="Search: streak, paywall, Duolingo, Claude Code…" value="${esc(filters.q)}" aria-label="Search sources" />
        ${chipRow("Channel", "channel", channels.filter((c) => c.items.length >= 2).map((c) => c.name), "_ch")}
        ${chipRow("Type", "type", uniq("Type"), "Type")}
        ${chipRow("Topic", "topic", uniq("Topics"), "Topics")}
        ${chipRow("Goal", "goal", uniq("Goal"), "Goal")}
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
    const clear = () => { Object.assign(filters, { q: "", topic: null, goal: null, type: null, channel: null, unread: false, tested: false }); renderSources(); };
    document.getElementById("clear")?.addEventListener("click", clear);
    document.getElementById("clear2")?.addEventListener("click", clear);
  }

  // ---------- App icons ----------
  const ICON_BASE = location.pathname.includes("/site/") ? "../icons/" : "icons/";
  const hasIcon = new Set(window.LIBRARY.icons || []);
  function appMark(name, cls = "") {
    const ch = esc(name[0].toUpperCase());
    if (!hasIcon.has(slug(name))) return `<span class="app-mark ${cls}">${ch}</span>`;
    return `<img class="app-mark img ${cls}" src="${ICON_BASE}${slug(name)}.png" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'app-mark ${cls}',textContent:this.dataset.l}))" data-l="${ch}">`;
  }

  // ---------- Source page ----------
  function timeLink(s, t, anchor, label) {
    const url = jumpUrl(s, t, anchor);
    const text = label || (t != null ? approx(s) + fmtT(t) : "Read");
    if (!url) return t != null ? `<span class="jump" title="Time in the episode">${esc(text)}</span>` : "";
    const embed = t != null && vidOf(s) && canEmbed;
    return `<a class="jump" href="${esc(url)}" target="_blank" rel="noopener" ${embed ? `data-t="${Math.round(t)}"` : ""}>${t != null ? ICON.video : "↗"} ${esc(text)}</a>`;
  }
  function chapterRow(s, c, i) {
    const url = jumpUrl(s, c.t, c.anchor);
    const embed = c.t != null && vidOf(s) && canEmbed;
    const t = c.t != null ? approx(s) + fmtT(c.t) : String(i + 1).padStart(2, "0");
    const body = `<span class="t">${esc(t)}</span><span><span class="ct">${esc(c.title || c.anchor)}</span>${c.summary ? `<span class="cs">${esc(c.summary)}</span>` : ""}</span>`;
    return url ? `<li><a class="ch" href="${esc(url)}" target="_blank" rel="noopener" ${embed ? `data-t="${Math.round(c.t)}"` : ""}>${body}</a></li>` : `<li><div class="ch static">${body}</div></li>`;
  }

  function chapterStrip(s, chapters) {
    const timed = chapters.filter((c) => c.t != null);
    if (timed.length < 2) return "";
    const embed = vidOf(s) && canEmbed;
    const chips = timed.map((c) => {
      const url = jumpUrl(s, c.t);
      const inner = `<span class="t">${esc(approx(s) + fmtT(c.t))}</span><span class="ct">${esc(c.title || c.anchor)}</span>`;
      return url ? `<a class="chip-ch" href="${esc(url)}" target="_blank" rel="noopener" ${embed ? `data-t="${Math.round(c.t)}"` : ""} title="${esc(c.summary || c.title)}">${inner}</a>` : `<span class="chip-ch static">${inner}</span>`;
    }).join("");
    return `<nav class="ch-strip" aria-label="Chapters"><div class="ch-strip-head"><span>Jump to a chapter · ${timed.length}</span><span class="ch-arrows"><button type="button" class="ch-arrow" data-dir="-1" aria-label="Previous chapters">‹</button><button type="button" class="ch-arrow" data-dir="1" aria-label="More chapters">›</button></span></div><div class="ch-scroll">${chips}</div></nav>`;
  }

  function renderSource(id) {
    const s = byId[id];
    if (!s) return notFound("That source isn't in the library.");
    const isLearned = learned.has(s.id);
    const inLessons = lessons.filter((l) => lessonSources(l).includes(s.id));
    const related = sources.filter((x) => x.id !== s.id && (x.Topics || []).some((t) => (s.Topics || []).includes(t))).sort((a, b) => (b.Topics || []).filter((t) => (s.Topics || []).includes(t)).length - (a.Topics || []).filter((t) => (s.Topics || []).includes(t)).length).slice(0, 3);
    const kps = (s["Key points"] || []).length ? s["Key points"] : splitTakeaways(s.Takeaways).map((t) => ({ title: t }));
    const chapters = s.Chapters || [];
    const start = s["Start here"];
    const vid = vidOf(s);
    const isMedia = vid || /Video|Podcast|Talk/.test(s.Type);
    const startT = start && start.t != null ? start.t : 0;
    const playUrl = vid ? `https://www.youtube.com/watch?v=${vid}${startT ? `&t=${Math.round(startT)}s` : ""}` : s.Link;
    app.innerHTML = `
      <a class="back" href="#/sources">← All sources</a>
      <header class="src-hero">
        <div class="player-col">
          <div class="player" id="player">
            ${vid && canEmbed ? banner(s, { play: true, tag: "div" }) : banner(s, { play: !!isMedia, tag: "a", href: playUrl })}
          </div>
          ${chapterStrip(s, chapters)}
        </div>
        <div class="src-head">
          <div class="kinds">${kindPill(s)}${evidenceBadge(s)}<span class="creator">${esc(s.Creator)}</span></div>
          <h1>${esc(s.Title)}</h1>
          <p class="bl">${esc(s["Bottom line"])}</p>
          <div class="actions">
            ${start && (start.t != null || start.anchor) ? `<a class="btn accent" href="${esc(jumpUrl(s, start.t, start.anchor) || s.Link)}" target="_blank" rel="noopener" ${start.t != null && vid && canEmbed ? `data-t="${Math.round(start.t)}"` : ""}>${ICON.video.replace("<svg", '<svg width="12" height="12" fill="currentColor"')} ${start.t != null ? `Start at ${approx(s)}${fmtT(start.t)}` : "Jump to the best part"}</a>` : ""}
            <a class="btn" href="${esc(s.Link)}" target="_blank" rel="noopener">${vid ? "Open on YouTube" : "Open the source"} ↗</a>
            <button type="button" class="btn" id="learn" aria-pressed="${isLearned}">${isLearned ? "✓ Learned" : "Mark as learned"}</button>
          </div>
          <div class="facts">
            ${s.Duration ? `<span>${fmtDur(s.Duration)}</span>` : ""}
            <span>${kps.length} key points</span>
            ${chapters.length ? `<span>${chapters.length} chapters</span>` : ""}
            ${s.Times === "approximate" ? `<span title="Worked out from the transcript, may be off by up to a minute">≈ times are estimates</span>` : ""}
          </div>
        </div>
      </header>

      <div class="src-body">
        <div class="src-main">
          <section>
            <h2>Key points <small>${isMedia && kps.some((k) => k.t != null) ? "Tap a time to jump there" : ""}</small></h2>
            <ol class="kps">${kps.map((k, i) => `
              <li class="kp-item">
                <span class="num">${i + 1}</span>
                <div>
                  <h3>${esc(k.title)}</h3>
                  ${k.detail ? `<p>${esc(k.detail)}</p>` : ""}
                  ${k.t != null && jumpUrl(s, k.t) ? `<div>${timeLink(s, k.t)}</div>` : ""}
                </div>
              </li>`).join("")}</ol>
          </section>

          <section class="callout ${s.Results && tested(s) ? "" : "none"}"><h3>${tested(s) ? "What happened" : "What they say happened"}</h3><p>${s.Results ? esc(s.Results) : "The source gives no numbers. Treat it as an idea, not a proven result."}</p>${s.Results && !tested(s) ? `<p class="note">Not from a measured test.</p>` : ""}</section>

          <section><h2>What they did</h2><p class="prose">${esc(s["What they did"])}</p></section>

          <section><h2>Ideas for OnCourse</h2><ul class="ideas">${splitIdeas(s["Ideas for OnCourse"]).map((i) => { const [screen, text] = ideaParts(i); return `<li>${screen ? `<span class="screen">${esc(screen)}</span>` : ""}<span>${esc(text)}</span></li>`; }).join("")}</ul></section>

          <section><h2>My notes</h2><textarea id="notes" rows="4" placeholder="What did you learn? What would you try?">${esc(notes[s.id] || "")}</textarea><p class="muted small">Saved in this browser.</p></section>
        </div>

        <aside class="side">
          ${start && start.why ? `<div class="panel start-here"><h3>If you have 5 minutes</h3><p>${esc(start.why)}</p>${start.t != null || start.anchor ? timeLink(s, start.t, start.anchor, start.t != null ? `Watch from ${approx(s)}${fmtT(start.t)}` : "Read this part") : ""}</div>` : ""}
          ${chapters.length ? `<div class="panel"><h3>${isMedia ? "Chapters" : "Sections"} <span>${chapters.length}</span></h3><ol class="chapters ${chapters.some((c) => c.t != null) ? "" : "nums"}">${chapters.map((c, i) => chapterRow(s, c, i)).join("")}</ol></div>` : ""}
          <div class="panel"><dl>
            ${(s.Apps || []).length ? `<div><dt>Apps</dt><dd class="tags">${s.Apps.map((a) => `<a class="tag app" href="#/apps/${slug(a)}">${appMark(a, "xs")}${esc(a)}</a>`).join("")}</dd></div>` : ""}
            ${(s.Tools || []).length ? `<div><dt>Tools they used</dt><dd class="tags">${s.Tools.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</dd></div>` : ""}
            <div><dt>Topics</dt><dd class="tags">${(s.Topics || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</dd></div>
            ${inLessons.length ? `<div><dt>In the course</dt><dd class="tags">${inLessons.map((l) => `<a class="tag app" href="#/course/${l.id}">${esc(l.title)}</a>`).join("")}</dd></div>` : ""}
            ${s["Used in"] ? `<div><dt>Used in</dt><dd>${esc(s["Used in"])}</dd></div>` : ""}
            <div><dt>Added</dt><dd class="small">${esc(s.Added || "")} · ${esc(s._ch)}</dd></div>
          </dl></div>
        </aside>
      </div>
      ${related.length ? `<section class="related">${sectionHead("Related")}<div class="grid">${related.map(card).join("")}</div></section>` : ""}
    `;

    const player = document.getElementById("player");
    const play = (t) => {
      app.querySelectorAll(".chip-ch").forEach((c) => c.classList.toggle("on", +c.dataset.t === Math.round(t || 0)));
      player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?start=${Math.round(t || 0)}&autoplay=1&rel=0&modestbranding=1" title="${esc(s.Title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      player.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    const strip = app.querySelector(".ch-scroll");
    if (strip) {
      const arrows = app.querySelectorAll(".ch-arrow");
      const sync = () => { arrows[0].disabled = strip.scrollLeft < 4; arrows[1].disabled = strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 4; strip.classList.toggle("end", arrows[1].disabled); };
      arrows.forEach((b) => b.onclick = () => strip.scrollBy({ left: +b.dataset.dir * strip.clientWidth * 0.8, behavior: "smooth" }));
      strip.addEventListener("scroll", sync, { passive: true }); sync();
    }
    if (vid && canEmbed) {
      player.querySelector(".banner").onclick = () => play(startT);
      app.querySelectorAll("[data-t]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); play(+a.dataset.t); }));
    }
    document.getElementById("learn").onclick = () => {
      learned.has(s.id) ? learned.delete(s.id) : learned.add(s.id);
      store.set("learned", [...learned]); renderSource(id);
    };
    const ta = document.getElementById("notes");
    ta.oninput = () => { notes[s.id] = ta.value; store.set("notes", notes); };
    scrollTo(0, 0);
  }

  // ---------- Apps ----------
  const apps = [...new Set(sources.flatMap((s) => s.Apps || []))]
    .map((name) => ({ name, id: slug(name), items: sources.filter((s) => (s.Apps || []).includes(name)) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  function renderApps() {
    app.innerHTML = `
      <section class="intro"><h1>Apps</h1><p>What each app changed, and what happened, across every source.</p></section>
      <div class="app-grid">${apps.map((a) => {
        const results = a.items.filter((s) => s.Results && tested(s)).length;
        return `<a class="app-card" href="#/apps/${a.id}">${appMark(a.name, "big")}<div><h3>${esc(a.name)}</h3><p class="muted small">${a.items.length} source${a.items.length > 1 ? "s" : ""}${results ? ` · ${results} tested` : ""}</p></div></a>`;
      }).join("")}</div>`;
  }
  function renderApp(id) {
    const a = apps.find((x) => x.id === id);
    if (!a) return notFound("That app isn't in the library.");
    app.innerHTML = `
      <a class="back" href="#/apps">← All apps</a>
      <section class="intro"><div class="app-title">${appMark(a.name, "big")}<h1>${esc(a.name)}</h1></div>
      <p>Everything the library says ${esc(a.name)} tried, with what happened.</p></section>
      <div class="grid" style="margin-bottom:64px">${a.items.map(card).join("")}</div>`;
    scrollTo(0, 0);
  }

  // ---------- Experiments ----------
  function renderExperiments() {
    const byWeek = [...experiments].sort((a, b) => String(b.Week).localeCompare(String(a.Week)));
    app.innerHTML = `
      <section class="intro"><h1>Weekly experiments</h1><p>One or two ideas a week, picked from the sources and OnCourse's own data.</p></section>
      ${byWeek.length ? `<section class="exp-list">${byWeek.map((e) => `
        <article class="exp">
          <div class="meta"><span class="status">${esc(e.Status || "Proposed")}</span><span class="muted">Week of ${esc(e.Week || "")} · ${esc(e.Area || "")} · ${esc(e.Goal || "")}</span>${e.Effort ? `<span class="muted">Effort ${esc(e.Effort)}</span>` : ""}</div>
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
      <p>The library is the <code>design-library</code> skill in Claude Code, Cursor and Codex, so any agent can read it, add to it and use it while designing.</p></section>
      <div class="prompt-list">${prompts.map(([t, p], i) => `
        <div class="prompt"><div><h3>${esc(t)}</h3><p><code>${esc(p)}</code></p></div><button type="button" class="btn" data-copy="${i}">Copy</button></div>`).join("")}</div>
      <section class="try"><h3>Where it lives</h3><ul>
        <li><code>~/Documents/design-library/data/sources.json</code>: the sources (the agent edits this)</li>
        <li><code>~/Documents/design-library/data/lessons.json</code>: the course</li>
        <li><a class="link" href="https://github.com/sainath-oncourse/design-library" target="_blank" rel="noopener">github.com/sainath-oncourse/design-library</a>: every push updates this site</li>
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
  document.getElementById("foot").innerHTML = `Updated ${built} · Notes written by an agent from each source; the videos, podcasts and articles belong to their creators.`;
  addEventListener("hashchange", route);
  route();
})();
