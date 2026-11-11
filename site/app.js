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
  const EMPTY = { q: "", topic: null, goal: null, type: null, channel: null, unread: false, tested: false };
  const filters = { ...EMPTY };
  let sortBy = "new";
  let lastQuestion = new URLSearchParams(location.search).get("q") || "";

  // ---------- theme ----------
  const root = document.documentElement;
  const applyTheme = (t) => { if (t) root.dataset.theme = t; else delete root.dataset.theme; };
  applyTheme(new URLSearchParams(location.search).get("theme") || store.get("theme", null));
  const toggleTheme = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    store.set("theme", next); applyTheme(next);
  };
  document.getElementById("theme").onclick = toggleTheme;
  document.getElementById("theme2").onclick = toggleTheme;

  // images fade in when loaded
  document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);
  document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);

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
  const research = (s) => s["Evidence type"] === "Research";
  const initials = (n) => n.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const secHead = (title, sub, right = "") => `<div class="sec-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${right}</div>`;
  const shelfTools = (id, href, label) => `<div class="sec-tools">${href ? `<a class="link" href="${href}">${label}</a>` : ""}<button type="button" class="round" data-shelf="${id}" data-dir="-1" aria-label="Back">‹</button><button type="button" class="round" data-shelf="${id}" data-dir="1" aria-label="More">›</button></div>`;
  const shelf = (id, html) => `<div class="shelf" id="${id}">${html}</div>`;

  const SVG = {
    home: '<svg viewBox="0 0 20 20"><path d="M10 2.5 2.5 8.4V17c0 .3.2.5.5.5h4.5v-5h5v5H17c.3 0 .5-.2.5-.5V8.4z"/></svg>',
    course: '<svg viewBox="0 0 20 20"><path d="M10 3 1 7.5l9 4.5 7.5-3.75V13H19V7.5zM4.5 10.8v3.2c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-3.2L10 13.5z"/></svg>',
    library: '<svg viewBox="0 0 20 20"><path d="M3 3h3v14H3zm4.5 0h3v14h-3zm4.6.6 2.9-.8 3.6 13.5-2.9.8z"/></svg>',
    channels: '<svg viewBox="0 0 20 20"><path d="M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z"/></svg>',
    apps: '<svg viewBox="0 0 20 20"><path d="M5 2h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm2.5 4.5v7h1.6v-2.6h1.5c1.6 0 2.7-1 2.7-2.2S12.2 6.5 10.6 6.5zm1.6 1.3h1.3c.7 0 1.2.4 1.2.9s-.5 1-1.2 1H9.1z"/></svg>',
    flask: '<svg viewBox="0 0 20 20"><path d="M7 2h6v1.5h-1v4.2l4.8 7.6c.7 1.1-.1 2.7-1.4 2.7H4.6c-1.3 0-2.1-1.6-1.4-2.7L8 7.7V3.5H7zm2.5 1.5v4.6L7.2 11.8h5.6l-2.3-3.7V3.5z"/></svg>',
    search: '<svg viewBox="0 0 20 20"><path d="M8.5 3a5.5 5.5 0 1 0 3.3 9.9l3.6 3.6 1.1-1.1-3.6-3.6A5.5 5.5 0 0 0 8.5 3zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>',
    spark: '<svg viewBox="0 0 20 20"><path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6z"/></svg>',
  };

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
  const kVar = (s) => `var(--${kindOf(s) === "case-study" ? "case" : kindOf(s)})`;
  const vidOf = (s) => ((s.Video || s.Link).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1] || null;
  const isMedia = (s) => !!vidOf(s) || /Video|Podcast|Talk/.test(s.Type);
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

  // ---------- channels ----------
  const CHANNELS = [
    [/^Lenny's Newsletter|lennysnewsletter\.com\/p\//, "Lenny's Newsletter", "#ff6719", "Lenny Rachitsky's newsletter on product, growth and careers.", "https://www.lennysnewsletter.com"],
    [/^Lenny's Podcast|youtube.*lenny/i, "Lenny's Podcast", "#f76b15", "Long interviews with product leaders, designers and growth people.", "https://www.youtube.com/@LennysPodcast"],
    [/^Dive Club/, "Dive Club", "#2c7be5", "Ridd's interviews with designers about how they work.", "https://www.youtube.com/@dive-club"],
    [/^Sneak Peek/, "Sneak Peek", "#12a594", "Designers walk through real product work, screen by screen.", "https://www.youtube.com/@sneakpeekpod"],
    [/subclub\.com|^Sub Club/, "Sub Club", "#e93d82", "RevenueCat's podcast on subscription app growth.", "https://subclub.com"],
    [/revenuecat\.com/, "RevenueCat", "#f2545b", "Subscription app data, paywalls and pricing.", "https://www.revenuecat.com/blog"],
    [/developer\.apple\.com/, "Apple WWDC", "#1d1d1f", "Apple's design and developer talks.", "https://developer.apple.com/videos/"],
    [/duolingo\.com/, "Duolingo", "#58a700", "Duolingo's own write-ups on design, research and experiments.", "https://blog.duolingo.com"],
    [/superwall\.com/, "Superwall", "#6e56cf", "Paywall experiments and teardowns.", "https://superwall.com/blog"],
    [PAPERS, "Research papers", "#6f6e77", "Peer-reviewed studies on learning and behaviour.", ""],
    [/growth\.design/, "Growth.Design", "#ff5a36", "Comic-style case studies of product psychology.", "https://growth.design/case-studies"],
    [/^Built for Mars|builtformars\.com/, "Built for Mars", "#c2410c", "Peter Ramsey's UX teardowns and experiments.", "https://builtformars.com"],
    [/nngroup\.com/, "Nielsen Norman Group", "#d6001c", "Usability research and guidelines.", "https://www.nngroup.com/articles/"],
    [/emilkowal\.ski|^Emil Kowalski/, "Emil Kowalski", "#111111", "Animation and interface craft.", "https://emilkowal.ski"],
    [/rauno\.me/, "Rauno Freiberg", "#444444", "Interaction design details and essays.", "https://rauno.me"],
    [/linear\.app/, "Linear", "#5e6ad2", "How Linear designs and builds.", "https://linear.app/now"],
    [/phiture\.com/, "Phiture", "#00a3a1", "Mobile growth, retention and lifecycle.", "https://phiture.com/blog/"],
    [/andrewchen\.com/, "Andrew Chen", "#2563eb", "Essays on growth and network effects.", "https://andrewchen.com"],
    [/reforge\.com/, "Reforge", "#7c3aed", "Growth and product frameworks.", "https://www.reforge.com/blog"],
    [/khanacademy\.org/, "Khan Academy", "#14bf96", "Learning design from Khan Academy.", "https://blog.khanacademy.org"],
    [/quizlet\.com/, "Quizlet", "#4255ff", "Study tools and learning science.", "https://quizlet.com/blog"],
    [/irrationallabs\.com/, "Irrational Labs", "#ff4d4d", "Behavioural science applied to products.", "https://irrationallabs.com/blog/"],
    [/firstround\.com/, "First Round Review", "#1a1a1a", "Long-form playbooks from startup operators.", "https://review.firstround.com"],
    [/figma\.com/, "Figma", "#a259ff", "Figma's blog on design process and craft.", "https://www.figma.com/blog/"],
    [/design\.google|material\.io/, "Google Design", "#4285f4", "Google's design articles and guidance.", "https://design.google"],
    [/adapty\.io/, "Adapty", "#6720ff", "Paywall and subscription data.", "https://adapty.io/blog/"],
    [/retention\.blog/, "Retention.blog", "#0f766e", "Deep dives on retention and engagement.", "https://www.retention.blog"],
    [/brilliant\.org/, "Brilliant", "#111111", "Interactive learning design.", "https://brilliant.org"],
    [/spotify\.design/, "Spotify Design", "#1db954", "Spotify's design team on craft and research.", "https://spotify.design"],
    [/intercom\.com/, "Intercom", "#1f8ded", "Product and onboarding writing from Intercom.", "https://www.intercom.com/blog/"],
    [/vercel\.com/, "Vercel", "#000000", "Web craft and performance.", "https://vercel.com/blog"],
    [/airship\.com/, "Airship", "#0b61a4", "Push notification benchmarks and practice.", "https://www.airship.com/resources/"],
    [/nirandfar\.com/, "Nir Eyal", "#e85d04", "Habit-forming products.", "https://www.nirandfar.com"],
    [/learningscientists\.org/, "The Learning Scientists", "#2a9d8f", "Evidence-based study strategies.", "https://www.learningscientists.org"],
  ];
  const channelOf = (s) => { for (const [re, name] of CHANNELS) if (re.test(s.Link) || re.test(s.Creator || "")) return name; return host(s.Link).replace(/^blog\./, ""); };
  sources.forEach((s) => { s._ch = channelOf(s); });
  const byNew = [...sources].sort((a, b) => String(b.Added).localeCompare(String(a.Added)));
  const channels = [...new Set(sources.map((s) => s._ch))]
    .map((name) => { const c = CHANNELS.find((x) => x[1] === name) || []; return { name, id: slug(name), color: c[2] || "#8b8d98", desc: c[3] || "", home: c[4] || "", items: byNew.filter((s) => s._ch === name) }; })
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  const chByName = Object.fromEntries(channels.map((c) => [c.name, c]));
  const kpCount = (s) => (s["Key points"] || []).length || splitTakeaways(s.Takeaways).length;

  // ---------- icons ----------
  const ICON_BASE = location.pathname.includes("/site/") ? "../icons/" : "icons/";
  const hasIcon = new Set(window.LIBRARY.icons || []);
  const hasCh = new Set(window.LIBRARY.chIcons || []);
  const swap = (cls, txt, style = "") => `this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls}',textContent:'${txt}'${style ? `,style:'${style}'` : ""}}))`;
  function appMark(name, cls = "") {
    const ch = esc(name[0].toUpperCase());
    if (!hasIcon.has(slug(name))) return `<span class="app-mark ${cls}">${ch}</span>`;
    return `<img class="app-mark ${cls}" src="${ICON_BASE}${slug(name)}.png" alt="" loading="lazy" onerror="${swap(`app-mark ${cls}`, ch)}">`;
  }
  function channelMark(name, cls = "") {
    const c = chByName[name] || { color: "#8b8d98" };
    const ini = esc(initials(name));
    if (!hasCh.has(slug(name))) return `<span class="cmark ${cls}" style="--c:${c.color}">${ini}</span>`;
    return `<img class="cmark ${cls}" src="${ICON_BASE}channels/${slug(name)}.png" alt="" loading="lazy" onerror="${swap(`cmark ${cls}`, ini, `--c:${c.color}`)}">`;
  }

  // ---------- thumbs + cards ----------
  function thumb(s, { play = false, cls = "" } = {}) {
    const dur = fmtDur(s.Duration);
    const extra = `${kindPill(s)}${dur ? `<span class="dur">${dur}</span>` : ""}${play ? `<span class="play">${ICON.video}</span>` : ""}`;
    if (s.Image) return `<span class="thumb ${cls}" style="--k:${kVar(s)}"><img class="f" src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('fallback');this.parentNode.insertAdjacentHTML('afterbegin','<span class=fb>${esc(s._ch).replace(/'/g, "")}</span>');this.remove()"/>${extra}</span>`;
    return `<span class="thumb fallback ${cls}" style="--k:${kVar(s)}"><span class="fb">${esc(s._ch)}</span>${extra}</span>`;
  }
  const plainThumb = (s) => s.Image ? `<span class="thumb"><img class="f" src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>` : `<span class="thumb fallback" style="--k:${kVar(s)}"></span>`;
  const citeThumb = (s) => s.Image ? `<img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>` : `<i style="--k:${kVar(s)}"></i>`;
  const evidenceBadge = (s) => tested(s)
    ? `<span class="ev ev-test" title="Backed by an A/B test or measured result">Tested</span>`
    : research(s)
    ? `<span class="ev ev-research" title="Backed by a usability study or real usage data, not an A/B test">Research</span>`
    : `<span class="ev" title="Experience or opinion, no measured result">Experience</span>`;

  function card(s) {
    const r = s.Results && tested(s) ? firstSentence(s.Results) : null;
    const chs = (s.Chapters || []).length;
    return `<a class="card ${learned.has(s.id) ? "is-learned" : ""}" href="#/s/${s.id}">
      ${thumb(s, { play: isMedia(s) })}
      <div class="card-b">
        <div class="card-ch">${channelMark(s._ch)}<span>${esc(s._ch)}</span>${evidenceBadge(s)}</div>
        <h3>${esc(s.Title)}</h3>
        ${r ? `<p class="res">${esc(r)}</p>` : `<p class="bl">${esc(s["Bottom line"] || s["What they did"])}</p>`}
        <p class="meta">${plural(kpCount(s), "key point")}${chs ? ` · ${plural(chs, isMedia(s) ? "chapter" : "section")}` : ""}</p>
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
    "How do we add delight without clutter?",
  ];
  function renderAnswer(q) {
    const box = document.getElementById("answer");
    if (!box) return;
    if (!q.trim()) { box.innerHTML = ""; return; }
    const res = ask(q);
    if (!res || !res.hits.length) {
      box.innerHTML = `<div class="answer"><p><strong>The library has nothing on that yet.</strong></p><p class="muted">Try different words, or ask your agent to find and add a source about it.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="answer">
      <p class="eyebrow">What to do first</p>
      <ol class="steps">${res.hits.slice(0, 3).map(({ s }, i) => {
        const [screen, text] = ideaParts(splitIdeas(s["Ideas for OnCourse"])[0] || "");
        return `<li><span class="num">${i + 1}</span><div>
          <p class="step-title">${screen ? `<span class="screen">${esc(screen)}</span>` : ""}${esc(text)}</p>
          <p class="step-why"><strong>${esc((s.Apps || [])[0] || s._ch)}:</strong> ${esc(s["Bottom line"])}</p>
          ${s.Results && tested(s) ? `<p class="step-res">${esc(firstSentence(s.Results))}</p>` : ""}
          <a class="link small" href="#/s/${s.id}">Read the notes →</a></div></li>`;
      }).join("")}</ol>
      <p class="eyebrow">Where the answers come from</p>
      <div class="minis">${res.hits.map(({ s }) => `<a class="mini" href="#/s/${s.id}">${plainThumb(s)}<span>${esc(s.Title)}</span></a>`).join("")}</div>
      ${res.lesson ? `<a class="btn" href="#/course/${res.lesson.id}">Read the lesson: ${esc(res.lesson.title)} →</a>` : ""}
    </div>`;
  }

  // ---------- course helpers ----------
  const lessonSources = (l) => [...new Set(l.ideas.flatMap((i) => i.sourceIds))].filter((id) => byId[id]);
  const lessonDone = (l) => { const ids = lessonSources(l); return ids.length ? ids.filter((id) => learned.has(id)).length / ids.length : 0; };
  const faces = (l, n = 4) => `<span class="faces">${lessonSources(l).map((id) => byId[id]).filter((s) => s.Image).slice(0, n).map((s) => `<img src="${esc(s.Image)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`).join("")}</span>`;
  const lessonTile = (l, i) => `<a class="ltile" href="#/course/${l.id}">
      <span class="n">Lesson ${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(l.title)}</h3>
      <p>${esc(l.summary)}</p>
      <div class="foot"><span>${l.ideas.length} ideas · ${lessonSources(l).length} sources</span>${faces(l, 3)}</div>
    </a>`;

  // ---------- Home ----------
  function renderHome() {
    const testedCount = sources.filter(tested).length;
    const hours = Math.round(sources.reduce((n, s) => n + (s.Duration || 0), 0) / 3600);
    const recent = []; const seenCh = new Set();
    for (const s of byNew) if (recent.length < 10 && !seenCh.has(s._ch)) { recent.push(s); seenCh.add(s._ch); }
    for (const s of byNew) if (recent.length < 12 && !recent.includes(s)) recent.push(s);
    const nextLesson = lessons.find((l) => lessonDone(l) < 1) || lessons[0];
    const nextIdx = lessons.indexOf(nextLesson);
    const started = learned.size > 0;
    const topicCounts = {};
    sources.forEach((s) => (s.Topics || []).forEach((t) => (topicCounts[t] = (topicCounts[t] || 0) + 1)));
    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t);
    const videos = byNew.filter((s) => vidOf(s)).slice(0, 12);

    app.innerHTML = `<div class="enter">
      <section class="home-hero">
        <h1>What other apps tried, <span>and what happened.</span></h1>
        <p class="sub">Talks, podcasts and articles from Duolingo, Headspace, Linear and more, boiled down to key points with links to the exact moment.</p>
        <form id="askf" class="ask-box" role="search">
          ${SVG.spark}
          <input id="askq" type="search" placeholder="What do you want to learn today?" value="${esc(lastQuestion)}" aria-label="Ask the library" autocomplete="off" />
          <button class="btn primary" type="submit">Ask</button>
        </form>
        <div class="suggest">${SUGGESTED.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <div id="answer" aria-live="polite"></div>
        <div class="stats">
          <div><strong>${sources.length}</strong><span>sources</span></div>
          <div><strong>${channels.length}</strong><span>channels</span></div>
          <div><strong>${hours}h</strong><span>of video and audio</span></div>
          <div><strong>${testedCount}</strong><span>with tested results</span></div>
        </div>
      </section>

      <section class="sec">
        <a class="continue" href="#/course/${nextLesson.id}">
          <div>
            <span class="eyebrow">${started ? "Continue the course" : "Start the course"} · Lesson ${nextIdx + 1} of ${lessons.length}</span>
            <h3>${esc(nextLesson.title)}</h3>
            <p>${esc(nextLesson.summary)}</p>
            <div class="bar"><span style="width:${Math.round(lessonDone(nextLesson) * 100)}%"></span></div>
          </div>
          ${faces(nextLesson, 4)}
        </a>
      </section>

      <section class="sec">
        ${secHead("New in the library", "The latest from each channel", shelfTools("sh-new", "#/sources", "See all"))}
        ${shelf("sh-new", recent.map(card).join(""))}
      </section>

      <section class="sec">
        ${secHead("Channels", "Newsletters, podcasts and blogs we read", `<a class="link" href="#/channels">All ${channels.length}</a>`)}
        <div class="ch-grid">${channels.slice(0, 12).map(channelTile).join("")}</div>
      </section>

      <section class="sec">
        ${secHead("The course", "Everything the sources say on one topic, in ten minutes", shelfTools("sh-course", "#/course", "All lessons"))}
        ${shelf("sh-course", lessons.map(lessonTile).join(""))}
      </section>

      ${videos.length ? `<section class="sec">
        ${secHead("Watch", "Talks and interviews with chapters you can jump to", shelfTools("sh-vid"))}
        ${shelf("sh-vid", videos.map(card).join(""))}
      </section>` : ""}

      ${topTopics.map((t, i) => `<section class="sec">
        ${secHead(esc(cap(t)), plural(topicCounts[t], "source"), shelfTools("sh-t" + i, "#/sources", "See all").replace('href="#/sources"', `href="#/sources" data-topic="${esc(t)}"`))}
        ${shelf("sh-t" + i, byNew.filter((s) => (s.Topics || []).includes(t)).slice(0, 12).map(card).join(""))}
      </section>`).join("")}
    </div>`;
    const f = document.getElementById("askf"), q = document.getElementById("askq");
    f.onsubmit = (e) => { e.preventDefault(); lastQuestion = q.value; renderAnswer(q.value); };
    app.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { q.value = b.dataset.q; lastQuestion = q.value; renderAnswer(q.value); });
    app.querySelectorAll("[data-topic]").forEach((a) => a.onclick = () => Object.assign(filters, EMPTY, { topic: a.dataset.topic }));
    wireShelves();
    if (lastQuestion) renderAnswer(lastQuestion);
  }

  function wireShelves() {
    app.querySelectorAll(".shelf").forEach((el) => {
      const btns = app.querySelectorAll(`[data-shelf="${el.id}"]`);
      if (!btns.length) return;
      const sync = () => { btns[0].disabled = el.scrollLeft < 4; btns[1].disabled = el.scrollLeft + el.clientWidth > el.scrollWidth - 4; };
      btns.forEach((b) => b.onclick = () => el.scrollBy({ left: +b.dataset.dir * el.clientWidth * 0.85, behavior: "smooth" }));
      el.addEventListener("scroll", sync, { passive: true }); sync();
    });
  }

  // ---------- Channels ----------
  const channelTile = (c) => `<a class="ctile" href="#/channels/${c.id}">${channelMark(c.name, "md")}<div><h3>${esc(c.name)}</h3><p>${plural(c.items.length, "source")}</p></div></a>`;
  function renderChannels() {
    app.innerHTML = `<div class="enter">
      <header class="page-head"><h1>Channels</h1><p>The newsletters, podcasts, blogs and research the library reads from. ${channels.length} so far.</p></header>
      <div class="grid">${channels.map((c) => `<a class="cbig" href="#/channels/${c.id}">
        <div class="top">${channelMark(c.name, "lg")}<div><h3>${esc(c.name)}</h3><p class="muted small">${plural(c.items.length, "source")}</p></div></div>
        ${c.desc ? `<p class="desc">${esc(c.desc)}</p>` : ""}
        <div class="strip">${c.items.slice(0, 3).map(plainThumb).join("")}</div>
      </a>`).join("")}</div>
    </div>`;
  }
  function renderChannel(id) {
    const c = channels.find((x) => x.id === id);
    if (!c) return notFound("That channel isn't in the library.");
    const t = c.items.filter(tested).length;
    app.innerHTML = `<div class="enter">
      <a class="back" href="#/channels">← All channels</a>
      <header class="hero-id">${channelMark(c.name, "xl")}<div>
        <h1>${esc(c.name)}</h1>
        ${c.desc ? `<p>${esc(c.desc)}</p>` : ""}
        <div class="facts"><span>${plural(c.items.length, "source")}</span>${t ? `<span>${t} tested</span>` : ""}${c.home ? `<a class="link" href="${esc(c.home)}" target="_blank" rel="noopener">${esc(host(c.home))} ↗</a>` : ""}</div>
      </div></header>
      <div class="grid">${c.items.map(card).join("")}</div>
    </div>`;
  }

  // ---------- Library ----------
  const uniq = (key) => [...new Set(sources.flatMap((s) => [].concat(s[key] || [])))].sort();
  const matches = (s, skip) => {
    if (skip !== "topic" && filters.topic && !(s.Topics || []).includes(filters.topic)) return false;
    if (skip !== "goal" && filters.goal && !(s.Goal || []).includes(filters.goal)) return false;
    if (skip !== "type" && filters.type && s.Type !== filters.type) return false;
    if (skip !== "channel" && filters.channel && s._ch !== filters.channel) return false;
    if (filters.unread && learned.has(s.id)) return false;
    if (filters.tested && !tested(s)) return false;
    if (filters.q) {
      const hay = [s.Title, s.Creator, s._ch, s["Bottom line"], s["What they did"], s.Results, s.Takeaways, kpText(s), s["Ideas for OnCourse"], (s.Topics || []).join(" "), (s.Apps || []).join(" "), (s.Tools || []).join(" ")].join(" ").toLowerCase();
      return filters.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  };
  let showAllCh = false;
  function facet(title, key, values, field, { mark, limit } = {}) {
    const pool = sources.filter((s) => matches(s, key));
    const n = (v) => pool.filter((s) => (field === "_ch" ? s._ch === v : [].concat(s[field] || []).includes(v))).length;
    let rows = values.map((v) => [v, n(v)]).filter(([v, c]) => c || filters[key] === v);
    const more = limit && rows.length > limit && !showAllCh;
    if (more) rows = rows.slice(0, limit);
    return `<div class="facet"><h4>${title}</h4><div class="facet-list">
      ${rows.map(([v, c]) => `<button type="button" class="fopt ${filters[key] === v ? "on" : ""}" data-f="${key}" data-v="${esc(v)}" aria-pressed="${filters[key] === v}">${mark ? mark(v) : ""}<span>${esc(v)}</span><span class="n">${c}</span></button>`).join("")}
      ${limit && values.length > limit ? `<button type="button" class="fopt more" id="morech">${showAllCh ? "Show fewer" : `Show all ${values.length}`}</button>` : ""}
    </div></div>`;
  }
  const typeDot = (t) => `<span class="dot" style="--k:var(--${t === "Case study" ? "case" : t.toLowerCase().replace(/\s+/g, "-")})"></span>`;

  function renderSources(keepFocus) {
    const list = sources.filter((s) => matches(s));
    if (sortBy === "new") list.sort((a, b) => String(b.Added).localeCompare(String(a.Added)));
    else if (sortBy === "tested") list.sort((a, b) => (tested(b) - tested(a)) || (research(b) - research(a)));
    else if (sortBy === "short") list.sort((a, b) => (a.Duration || 600) - (b.Duration || 600));
    const learnedCount = sources.filter((s) => learned.has(s.id)).length;
    const chips = [
      ...["channel", "type", "topic", "goal"].filter((k) => filters[k]).map((k) => [k, filters[k]]),
      ...(filters.tested ? [["tested", "Tested only"]] : []), ...(filters.unread ? [["unread", "Not learned"]] : []),
    ];
    const open = app.querySelector(".facets.open");
    app.innerHTML = `<div class="${keepFocus ? "" : "enter"}">
      <header class="page-head"><h1>Library</h1><p>Every video, podcast, talk and article, read by the agent from the source. You've learned ${learnedCount} of ${sources.length}.</p></header>
      <div class="lib">
        <aside class="facets ${open ? "open" : ""}" id="facets">
          <div class="facet"><h4>Show</h4><div class="facet-list">
            <button type="button" class="fopt ${filters.tested ? "on" : ""}" data-toggle="tested" aria-pressed="${filters.tested}"><span>Tested results only</span><span class="n">${sources.filter((s) => tested(s) && matches(s)).length}</span></button>
            <button type="button" class="fopt ${filters.unread ? "on" : ""}" data-toggle="unread" aria-pressed="${filters.unread}"><span>Not learned yet</span></button>
          </div></div>
          ${facet("Type", "type", uniq("Type"), "Type", { mark: typeDot })}
          ${facet("Channel", "channel", channels.map((c) => c.name), "_ch", { mark: (v) => channelMark(v), limit: 10 })}
          ${facet("Topic", "topic", uniq("Topics"), "Topics")}
          ${facet("Goal", "goal", uniq("Goal"), "Goal")}
        </aside>
        <div>
          <form class="lib-search" role="search" onsubmit="return false">${SVG.search}<input id="q" type="search" placeholder="Search: streak, paywall, Duolingo, Claude Code…" value="${esc(filters.q)}" aria-label="Search the library" autocomplete="off" /></form>
          <div class="lib-bar">
            <div class="active">
              <button type="button" class="btn filters-btn" id="fbtn">Filters${chips.length ? ` · ${chips.length}` : ""}</button>
              <span class="count">${list.length === sources.length ? `${list.length} sources` : `${list.length} of ${sources.length}`}</span>
              ${chips.map(([k, v]) => `<button type="button" class="pill-x" data-x="${k}">${esc(v)} ✕</button>`).join("")}
              ${chips.length || filters.q ? `<button type="button" class="link" id="clear">Clear all</button>` : ""}
            </div>
            <select class="sort" id="sort" aria-label="Sort">
              <option value="new" ${sortBy === "new" ? "selected" : ""}>Newest</option>
              <option value="tested" ${sortBy === "tested" ? "selected" : ""}>Tested first</option>
              <option value="short" ${sortBy === "short" ? "selected" : ""}>Shortest first</option>
            </select>
          </div>
          ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` :
            `<div class="empty"><p><strong>Nothing matches.</strong></p><p class="muted">Try fewer filters, or a different word.</p><button type="button" class="btn" id="clear2">Clear filters</button></div>`}
        </div>
      </div></div>`;
    const q = document.getElementById("q");
    let tm;
    q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { filters.q = q.value; const pos = q.selectionStart; renderSources(true); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); }, 120); };
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const k = b.dataset.f; filters[k] = filters[k] === b.dataset.v ? null : b.dataset.v; renderSources(true); });
    app.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => { filters[b.dataset.toggle] = !filters[b.dataset.toggle]; renderSources(true); });
    app.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { const k = b.dataset.x; filters[k] = typeof filters[k] === "boolean" ? false : null; renderSources(true); });
    const clear = () => { Object.assign(filters, EMPTY); renderSources(true); };
    document.getElementById("clear")?.addEventListener("click", clear);
    document.getElementById("clear2")?.addEventListener("click", clear);
    document.getElementById("morech")?.addEventListener("click", () => { showAllCh = !showAllCh; renderSources(true); });
    document.getElementById("sort").onchange = (e) => { sortBy = e.target.value; renderSources(true); };
    document.getElementById("fbtn").onclick = () => document.getElementById("facets").classList.toggle("open");
  }

  // ---------- Source page ----------
  function chapterRow(s, c, i, best) {
    const url = jumpUrl(s, c.t, c.anchor);
    const embed = c.t != null && vidOf(s) && canEmbed;
    const t = c.t != null ? approx(s) + fmtT(c.t) : best ? "Start" : String(i + 1).padStart(2, "0");
    const body = `<span class="t">${esc(t)}</span><span><span class="ct">${esc(c.title || c.anchor)}</span>${c.summary ? `<span class="cs">${esc(c.summary)}</span>` : ""}</span>`;
    const cls = `chrow${best ? " best" : ""}`;
    return url ? `<li><a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener" ${embed ? `data-t="${Math.round(c.t)}"` : ""}>${body}</a></li>` : `<li><div class="${cls} static">${body}</div></li>`;
  }

  function renderSource(id) {
    const s = byId[id];
    if (!s) return notFound("That source isn't in the library.");
    const isLearned = learned.has(s.id);
    const inLessons = lessons.filter((l) => lessonSources(l).includes(s.id));
    const shared = (x) => (x.Topics || []).filter((t) => (s.Topics || []).includes(t)).length;
    const related = sources.filter((x) => x.id !== s.id && shared(x)).sort((a, b) => shared(b) - shared(a) || (b._ch === s._ch) - (a._ch === s._ch)).slice(0, 6);
    const moreCh = (chByName[s._ch]?.items || []).filter((x) => x.id !== s.id).slice(0, 8);
    const kps = (s["Key points"] || []).length ? s["Key points"] : splitTakeaways(s.Takeaways).map((t) => ({ title: t }));
    const chapters = s.Chapters || [];
    const start = s["Start here"];
    const vid = vidOf(s);
    const media = isMedia(s);
    const startT = start && start.t != null ? start.t : 0;
    const playUrl = vid ? `https://www.youtube.com/watch?v=${vid}${startT ? `&t=${Math.round(startT)}s` : ""}` : s.Link;
    const bestRow = start && (start.t != null || start.anchor)
      ? chapterRow(s, { t: start.t, anchor: start.anchor, title: "If you have 5 minutes", summary: start.why }, 0, true) : "";
    const hasPanel = chapters.length || bestRow;
    const playerInner = vid && canEmbed
      ? `<div class="thumb" id="poster" role="button" tabindex="0" aria-label="Play">${s.Image ? `<img class="f" src="${esc(s.Image)}" alt="" referrerpolicy="no-referrer"/>` : ""}${kindPill(s)}<span class="play">${ICON.video}</span></div>`
      : `<a class="thumb ${s.Image ? "" : "fallback"}" href="${esc(playUrl)}" target="_blank" rel="noopener" style="--k:${kVar(s)}">${s.Image ? `<img class="f" src="${esc(s.Image)}" alt="" referrerpolicy="no-referrer"/>` : `<span class="fb">${esc(s._ch)}</span>`}${kindPill(s)}${media ? `<span class="play">${ICON.video}</span>` : ""}<span class="open">${media ? "Play on " + esc(host(s.Link)) : "Read on " + esc(host(s.Link))} ↗</span></a>`;
    const startLabel = start && start.t != null ? `Play the best part · ${approx(s)}${fmtT(start.t)}` : "Read the best part";

    app.innerHTML = `<div class="enter">
      <a class="back" href="#/channels/${slug(s._ch)}">← ${esc(s._ch)}</a>
      <div class="stage ${hasPanel ? "" : "solo"}">
        <div class="player" id="player">${playerInner}</div>
        ${hasPanel ? `<aside class="chpanel" aria-label="${media ? "Chapters" : "Sections"}"><div class="chpanel-in">
          <div class="chpanel-head"><h2>${media ? "Chapters" : "Sections"}</h2><span>${chapters.length ? chapters.length : ""}${chapters.some((c) => c.t != null) && vid && canEmbed ? " · plays here" : ""}</span></div>
          <ol class="chlist">${bestRow}${chapters.map((c, i) => chapterRow(s, c, i)).join("")}</ol>
          ${s.Times === "approximate" ? `<p class="chpanel-note">≈ Times are worked out from the transcript and may be off by up to a minute.</p>` : ""}
        </div></aside>` : ""}
      </div>

      <header class="src-title">
        <div class="src-meta"><a href="#/channels/${slug(s._ch)}">${channelMark(s._ch, "md")}${esc(s._ch)}</a>${s.Creator && s.Creator !== s._ch ? `<span>· ${esc(s.Creator.replace(s._ch, "").replace(/^\s*\((.*)\)\s*$/, "$1").trim() || s.Creator)}</span>` : ""}${kindPill(s)}${evidenceBadge(s)}</div>
        <h1>${esc(s.Title)}</h1>
        <p class="lede">${esc(s["Bottom line"])}</p>
        <div class="actions">
          ${start && (start.t != null || start.anchor) ? `<a class="btn accent" href="${esc(jumpUrl(s, start.t, start.anchor) || s.Link)}" target="_blank" rel="noopener" ${start.t != null && vid && canEmbed ? `data-t="${Math.round(start.t)}"` : ""}>${ICON.video} ${startLabel}</a>` : ""}
          <a class="btn" href="${esc(s.Link)}" target="_blank" rel="noopener">${vid ? "Open on YouTube" : "Open the source"} ↗</a>
          <button type="button" class="btn" id="learn" aria-pressed="${isLearned}">${isLearned ? "✓ Learned" : "Mark as learned"}</button>
          <span class="facts">${s.Duration ? `<span>${fmtDur(s.Duration)}</span>` : ""}<span>${plural(kps.length, "key point")}</span>${s.Added ? `<span>Added ${esc(s.Added)}</span>` : ""}</span>
        </div>
      </header>

      <div class="src-cols">
        <div class="src-main">
          <section>
            <h2>Key points <small>${media && kps.some((k) => k.t != null) ? "Tap a time to play from there" : ""}</small></h2>
            <ol class="kps">${kps.map((k, i) => `<li class="kp"><span class="num">${i + 1}</span><div>
              <h3>${esc(k.title)}</h3>
              ${k.detail ? `<p>${esc(k.detail)}</p>` : ""}
              ${k.t != null && jumpUrl(s, k.t) ? `<a class="jump" href="${esc(jumpUrl(s, k.t))}" target="_blank" rel="noopener" ${vid && canEmbed ? `data-t="${Math.round(k.t)}"` : ""}>${ICON.video} ${approx(s)}${fmtT(k.t)}</a>` : k.anchor && jumpUrl(s, null, k.anchor) ? `<a class="jump" href="${esc(jumpUrl(s, null, k.anchor))}" target="_blank" rel="noopener">Read this part ↗</a>` : ""}
            </div></li>`).join("")}</ol>
          </section>
          <section class="callout ${tested(s) && s.Results ? "" : research(s) && s.Results ? "research" : "none"}">
            <h3>${tested(s) ? "What happened" : research(s) ? "What the research found" : "What they say happened"}</h3>
            <p>${s.Results ? esc(s.Results) : "The source gives no numbers. Treat it as an idea, not a proven result."}</p>
            ${s.Results && research(s) ? `<p class="note">From a study or real usage data, not an A/B test.</p>` : s.Results && !tested(s) ? `<p class="note">Not from a measured test.</p>` : ""}
          </section>
          <section><h2>What they did</h2><p class="prose">${esc(s["What they did"])}</p></section>
          <section><h2>Ideas for OnCourse</h2><ul class="ideas">${splitIdeas(s["Ideas for OnCourse"]).map((i) => { const [screen, text] = ideaParts(i); return `<li>${screen ? `<span class="screen">${esc(screen)}</span>` : ""}${esc(text)}</li>`; }).join("")}</ul></section>
          <section><h2>My notes</h2><textarea id="notes" placeholder="What did you learn? What would you try?">${esc(notes[s.id] || "")}</textarea><p class="muted small" style="margin-top:6px">Saved in this browser.</p></section>
        </div>
        <aside class="side">
          ${(s.Apps || []).length ? `<div><h4>Apps</h4><div class="tags">${s.Apps.map((a) => `<a class="tag" href="#/apps/${slug(a)}">${appMark(a, "xs")}${esc(a)}</a>`).join("")}</div></div>` : ""}
          ${(s.Tools || []).length ? `<div><h4>Tools they used</h4><div class="tags">${s.Tools.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>` : ""}
          ${(s.Topics || []).length ? `<div><h4>Topics</h4><div class="tags">${s.Topics.map((t) => `<a class="tag" href="#/sources" data-topic="${esc(t)}">${esc(t)}</a>`).join("")}</div></div>` : ""}
          ${inLessons.length ? `<div><h4>In the course</h4><div class="tags">${inLessons.map((l) => `<a class="tag" href="#/course/${l.id}">${esc(l.title)}</a>`).join("")}</div></div>` : ""}
          ${s["Used in"] ? `<div><h4>Used in</h4><p class="small">${esc(s["Used in"])}</p></div>` : ""}
          ${related.length ? `<div><h4>Related</h4><div class="rel">${related.slice(0, 4).map((x) => `<a href="#/s/${x.id}">${plainThumb(x)}<span><b>${esc(x.Title)}</b><small>${esc(x._ch)}</small></span></a>`).join("")}</div></div>` : ""}
        </aside>
      </div>

      ${moreCh.length ? `<section class="sec">${secHead(`More from ${esc(s._ch)}`, "", shelfTools("sh-ch", `#/channels/${slug(s._ch)}`, "See all"))}${shelf("sh-ch", moreCh.map(card).join(""))}</section>` : ""}
    </div>`;

    const player = document.getElementById("player");
    const rows = [...app.querySelectorAll(".chlist [data-t]")];
    const play = (t) => {
      rows.forEach((r) => r.classList.toggle("on", +r.dataset.t === Math.round(t || 0) && !r.classList.contains("best")));
      player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?start=${Math.round(t || 0)}&autoplay=1&rel=0&modestbranding=1" title="${esc(s.Title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      const r = player.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) player.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    if (vid && canEmbed) {
      const poster = document.getElementById("poster");
      poster.onclick = () => play(startT);
      poster.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(startT); } };
      app.querySelectorAll("[data-t]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); play(+a.dataset.t); }));
    }
    app.querySelectorAll("[data-topic]").forEach((a) => a.onclick = () => Object.assign(filters, EMPTY, { topic: a.dataset.topic }));
    document.getElementById("learn").onclick = (e) => {
      const b = e.currentTarget;
      learned.has(s.id) ? learned.delete(s.id) : learned.add(s.id);
      store.set("learned", [...learned]);
      b.setAttribute("aria-pressed", learned.has(s.id)); b.textContent = learned.has(s.id) ? "✓ Learned" : "Mark as learned";
    };
    const ta = document.getElementById("notes");
    ta.oninput = () => { notes[s.id] = ta.value; store.set("notes", notes); };
    wireShelves();
  }

  // ---------- Course ----------
  function renderCourse() {
    const done = lessons.filter((l) => lessonDone(l) >= 1).length;
    app.innerHTML = `<div class="enter">
      <header class="page-head"><h1>The course</h1><p>Each lesson brings together what every source says about one topic, so you can learn it in ten minutes, and ends with what to try at OnCourse. ${done ? `${done} of ${lessons.length} done.` : ""}</p></header>
      <div class="course-list">${lessons.map((l, i) => { const p = Math.round(lessonDone(l) * 100); return `<a class="lrow" href="#/course/${l.id}">
        <span class="big">${String(i + 1).padStart(2, "0")}</span>
        <div><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p>
          <p class="meta">${l.ideas.length} ideas · ${lessonSources(l).length} sources${(l.examples || []).length ? ` · ${l.examples.length} app examples` : ""}${p ? ` · ${p}% learned` : ""}</p>
          ${p ? `<div class="bar"><span style="width:${p}%"></span></div>` : ""}</div>
        ${faces(l, 4)}
      </a>`; }).join("")}</div>
    </div>`;
  }

  function renderLesson(id) {
    const i = lessons.findIndex((l) => l.id === id);
    const l = lessons[i];
    if (!l) return notFound("That lesson isn't in the course.");
    const prev = lessons[i - 1], next = lessons[i + 1];
    const srcs = lessonSources(l).map((x) => byId[x]);
    app.innerHTML = `<div class="enter">
      <div class="lesson">
        <nav class="toc" aria-label="In this lesson">
          <a class="back" href="#/course">← The course</a>
          <h4>In this lesson</h4>
          ${l.ideas.map((idea, k) => `<a href="#idea-${k}" data-idea="${k}">${k + 1}. ${esc(idea.heading)}</a>`).join("")}
          ${(l.examples || []).length ? `<a href="#idea-ex" data-idea="ex">See it in real apps</a>` : ""}
          <a href="#idea-try" data-idea="try">Try at OnCourse</a>
        </nav>
        <article>
          <p class="eyebrow">Lesson ${i + 1} of ${lessons.length}</p>
          <h1>${esc(l.title)}</h1>
          <p class="lede">${esc(l.summary)}</p>
          ${l.ideas.map((idea, k) => `<section class="idea" id="idea-${k}">
            <h2><span class="num">${k + 1}</span>${esc(idea.heading)}</h2>
            <p>${esc(idea.body)}</p>
            <div class="cites">${idea.sourceIds.filter((sid) => byId[sid]).map((sid) => { const s = byId[sid]; return `<a class="cite" href="#/s/${sid}">${citeThumb(s)}<b>${esc((s.Apps || [])[0] || s._ch)} · ${esc(s.Title)}</b></a>`; }).join("")}</div>
          </section>`).join("")}
          ${(l.examples || []).length ? `<section class="examples" id="idea-ex"><h2>See it in real apps</h2>
            <div class="ex-grid">${l.examples.map((e) => `<a class="ex" href="${esc(e.url)}" target="_blank" rel="noopener">${appMark(e.app, "big")}<div><b>${esc(e.app)}</b><p>${esc(e.note)}</p><span class="go">Open on Mobbin ↗</span></div></a>`).join("")}</div>
          </section>` : ""}
          <section class="try" id="idea-try"><h2>Try at OnCourse</h2>
            <ul>${(l.try || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
            <p class="muted small">To prototype one, run <code>/product-design &lt;idea&gt;</code>.</p>
          </section>
          <nav class="pager">
            ${prev ? `<a href="#/course/${prev.id}"><small>← Previous</small><b>${esc(prev.title)}</b></a>` : "<span></span>"}
            ${next ? `<a href="#/course/${next.id}"><small>Next →</small><b>${esc(next.title)}</b></a>` : ""}
          </nav>
        </article>
      </div>
      <section class="sec">${secHead("Sources in this lesson", plural(srcs.length, "source"), shelfTools("sh-ls"))}${shelf("sh-ls", srcs.map(card).join(""))}</section>
    </div>`;
    // in-page links without touching the hash route
    app.querySelectorAll(".toc [data-idea]").forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById("idea-" + a.dataset.idea)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    const tocLinks = [...app.querySelectorAll(".toc [data-idea]")];
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) tocLinks.forEach((a) => a.classList.toggle("on", "idea-" + a.dataset.idea === en.target.id)); }), { rootMargin: "-20% 0px -70% 0px" });
    app.querySelectorAll(".idea, #idea-ex, #idea-try").forEach((el) => io.observe(el));
    wireShelves();
  }

  // ---------- Apps ----------
  const apps = [...new Set(sources.flatMap((s) => s.Apps || []))]
    .map((name) => ({ name, id: slug(name), items: sources.filter((s) => (s.Apps || []).includes(name)) }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  let appSort = "count";
  function renderApps() {
    const list = appSort === "az" ? [...apps].sort((a, b) => a.name.localeCompare(b.name)) : apps;
    app.innerHTML = `<div class="enter">
      <header class="page-head"><h1>Apps</h1><p>What each of ${apps.length} apps changed, and what happened, across every source.</p></header>
      <div class="seg" role="group" aria-label="Sort apps"><button type="button" data-as="count" class="${appSort === "count" ? "on" : ""}">Most covered</button><button type="button" data-as="az" class="${appSort === "az" ? "on" : ""}">A to Z</button></div>
      <div class="app-grid">${list.map((a) => {
        const results = a.items.filter((s) => s.Results && tested(s)).length;
        return `<a class="app-card" href="#/apps/${a.id}">${appMark(a.name, "big")}<div><h3>${esc(a.name)}</h3><p>${plural(a.items.length, "source")}${results ? ` · ${results} tested` : ""}</p></div></a>`;
      }).join("")}</div>
    </div>`;
    app.querySelectorAll("[data-as]").forEach((b) => b.onclick = () => { appSort = b.dataset.as; renderApps(); });
  }
  function renderApp(id) {
    const a = apps.find((x) => x.id === id);
    if (!a) return notFound("That app isn't in the library.");
    const t = a.items.filter(tested).length;
    app.innerHTML = `<div class="enter">
      <a class="back" href="#/apps">← All apps</a>
      <header class="hero-id">${appMark(a.name, "xl")}<div><h1>${esc(a.name)}</h1><p>Everything the library says ${esc(a.name)} tried, with what happened.</p>
        <div class="facts"><span>${plural(a.items.length, "source")}</span>${t ? `<span>${t} tested</span>` : ""}</div></div></header>
      <div class="grid">${a.items.map(card).join("")}</div>
    </div>`;
  }

  // ---------- Experiments ----------
  function renderExperiments() {
    const byWeek = [...experiments].sort((a, b) => String(b.Week).localeCompare(String(a.Week)));
    app.innerHTML = `<div class="enter">
      <header class="page-head"><h1>Weekly experiments</h1><p>One or two ideas a week, picked from the sources and OnCourse's own data.</p></header>
      ${byWeek.length ? `<div class="stack">${byWeek.map((e) => `<article class="box">
        <p class="eyebrow">${esc(e.Status || "Proposed")} · Week of ${esc(e.Week || "")} · ${esc(e.Area || "")}${e.Goal ? ` · ${esc(e.Goal)}` : ""}${e.Effort ? ` · Effort ${esc(e.Effort)}` : ""}</p>
        <h3 style="margin-top:8px">${esc(e.Experiment)}</h3>
        <p>${esc(e.Hypothesis)}</p>
        ${e.Data ? `<p class="small"><strong>Data:</strong> ${esc(e.Data)}</p>` : ""}
        ${e["Based on"] ? `<p class="small"><strong>Based on:</strong> ${esc(e["Based on"])}</p>` : ""}
        ${e.Result ? `<div class="callout" style="margin-top:12px"><h3>Result</h3><p>${esc(e.Result)}</p></div>` : ""}
      </article>`).join("")}</div>` :
      `<div class="box" style="max-width:640px"><h3>No experiments yet</h3><p>Ask your agent for "this week's design experiments". It finds the biggest leak in PostHog, matches it to what other apps did, and proposes one or two to try.</p><p style="margin-top:14px"><a class="btn" href="#/course">Browse the course</a></p></div>`}
    </div>`;
  }

  // ---------- Use with your agent ----------
  function renderAgent() {
    const prompts = [
      ["Add a source", "Add this to the design library: <link>"],
      ["Ideas for a screen", "Use the design library: what did other apps do about <problem, e.g. new learners not studying in week 1>? Give me the 3 changes most likely to work for OnCourse, each with what the app did, the result and the link."],
      ["This week's experiments", "Give me this week's design experiments from the design library and PostHog."],
      ["Design with it", "/product-design <idea> (it checks the design library during the evidence step)"],
    ];
    app.innerHTML = `<div class="enter">
      <header class="page-head"><h1>Use it with your agent</h1><p>The library is the <code>design-library</code> skill in Claude Code, Cursor and Codex, so any agent can read it, add to it and use it while designing.</p></header>
      <div class="stack">${prompts.map(([t, p], i) => `<div class="box prompt"><div><h3>${esc(t)}</h3><code>${esc(p)}</code></div><button type="button" class="btn" data-copy="${i}">Copy</button></div>`).join("")}</div>
      <section class="try" style="max-width:860px"><h2>Where it lives</h2><ul>
        <li><code>~/Documents/design-library/data/sources.json</code>: the sources (the agent edits this)</li>
        <li><code>~/Documents/design-library/data/lessons.json</code>: the course</li>
        <li><a class="link" href="https://github.com/sainath-oncourse/design-library" target="_blank" rel="noopener">github.com/sainath-oncourse/design-library</a>: every push updates this site</li>
      </ul></section>
    </div>`;
    app.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
      try { await navigator.clipboard.writeText(prompts[+b.dataset.copy][1]); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { b.textContent = "Select and copy"; }
    });
  }

  function notFound(msg) {
    app.innerHTML = `<div class="empty"><p><strong>${esc(msg)}</strong></p><a class="btn" href="#/">Back home</a></div>`;
  }

  // ---------- shell: nav ----------
  const NAV = [
    ["home", "Home", "#/", SVG.home],
    ["course", "Course", "#/course", SVG.course, lessons.length],
    ["sources", "Library", "#/sources", SVG.library, sources.length],
    ["channels", "Channels", "#/channels", SVG.channels, channels.length],
    ["apps", "Apps", "#/apps", SVG.apps, apps.length],
    ["experiments", "Experiments", "#/experiments", SVG.flask],
  ];
  document.getElementById("sidenav").innerHTML = NAV.map(([k, label, href, icon, n]) => `<a class="side-link" data-tab="${k}" href="${href}">${icon}<span>${label}</span>${n ? `<span class="n">${n}</span>` : ""}</a>`).join("");
  document.getElementById("tabbar").innerHTML = NAV.slice(0, 5).map(([k, label, href, icon]) => `<a data-tab="${k}" href="${href}">${icon}<span>${label}</span></a>`).join("");
  document.getElementById("sidechannels").innerHTML = channels.map((c) => `<a class="side-link" data-ch="${c.id}" href="#/channels/${c.id}">${channelMark(c.name)}<span>${esc(c.name)}</span><span class="n">${c.items.length}</span></a>`).join("");
  const gq = document.getElementById("gq");
  document.getElementById("gsearch").onsubmit = (e) => { e.preventDefault(); Object.assign(filters, EMPTY, { q: gq.value.trim() }); gq.value = ""; gq.blur(); if (location.hash === "#/sources") go(); else location.hash = "#/sources"; };
  addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); (document.getElementById("q") || gq).focus(); } });

  // ---------- router ----------
  function render() {
    const h = location.hash || "#/";
    const tab = h.startsWith("#/course") ? "course" : h.startsWith("#/s") ? "sources" : h.startsWith("#/channels") ? "channels" : h.startsWith("#/apps") ? "apps" : h.startsWith("#/experiments") ? "experiments" : h.startsWith("#/agent") ? "agent" : "home";
    document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const [, , a] = h.split("/");
    document.querySelectorAll("[data-ch]").forEach((x) => x.classList.toggle("active", h.startsWith("#/channels/") && x.dataset.ch === a));
    const id = a && decodeURIComponent(a);
    if (h.startsWith("#/course/") && id) renderLesson(id);
    else if (h.startsWith("#/course")) renderCourse();
    else if (h.startsWith("#/s/")) renderSource(id);
    else if (h.startsWith("#/sources")) renderSources();
    else if (h.startsWith("#/channels/") && id) renderChannel(id);
    else if (h.startsWith("#/channels")) renderChannels();
    else if (h.startsWith("#/apps/") && id) renderApp(id);
    else if (h.startsWith("#/apps")) renderApps();
    else if (h.startsWith("#/experiments")) renderExperiments();
    else if (h.startsWith("#/agent")) renderAgent();
    else renderHome();
    const t = { course: "Course", sources: "Library", channels: "Channels", apps: "Apps", experiments: "Experiments", agent: "Use with your agent" }[tab];
    const h1 = app.querySelector("h1")?.textContent;
    document.title = h1 && tab !== "home" ? `${h1} · Design library` : t ? `${t} · Design library` : "Design library";
    scrollTo({ top: 0, behavior: "instant" });
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function go() {
    if (document.startViewTransition && !reduce) {
      app.classList.add("vt");
      document.startViewTransition(() => { render(); app.querySelector(".enter")?.classList.remove("enter"); });
    } else render();
  }
  document.getElementById("foot").innerHTML = `Updated ${built} · Notes written by an agent from each source; the videos, podcasts and articles belong to their creators.`;
  addEventListener("hashchange", go);
  render();
})();
