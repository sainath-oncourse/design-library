(() => {
  const { sources, experiments, built } = window.LIBRARY;
  const app = document.getElementById("app");

  // ---------- personal state (this browser only) ----------
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem("dl:" + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem("dl:" + k, JSON.stringify(v)),
  };
  let learned = new Set(store.get("learned", []));
  const notes = store.get("notes", {});
  const filters = { q: "", topic: null, goal: null, type: null, unread: false, results: false };

  // ---------- theme ----------
  const root = document.documentElement;
  const applyTheme = (t) => { if (t) root.dataset.theme = t; else delete root.dataset.theme; };
  const qs = new URLSearchParams(location.search).get("theme");
  applyTheme(qs || store.get("theme", null));
  document.getElementById("theme").onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    store.set("theme", next); applyTheme(next);
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const splitTakeaways = (t) => (t || "").split(/;\s+/).filter(Boolean).map(cap);
  // "Paywall: do X. Onboarding: do Y." -> one bullet per screen
  const splitIdeas = (t) => (t || "").split(/(?<=[.!?'])\s+(?=[A-Z][\w/' -]{2,40}:\s)/).filter(Boolean);
  const ideaParts = (i) => { const m = i.match(/^([A-Z][\w/' -]{2,40}):\s+(.*)$/s); return m ? [m[1], m[2]] : [null, i]; };
  const uniq = (key) => [...new Set(sources.flatMap((s) => [].concat(s[key] || [])))].sort();
  const count = (key, v) => sources.filter((s) => [].concat(s[key] || []).includes(v)).length;

  const matches = (s) => {
    if (filters.topic && !(s.Topics || []).includes(filters.topic)) return false;
    if (filters.goal && !(s.Goal || []).includes(filters.goal)) return false;
    if (filters.type && s.Type !== filters.type) return false;
    if (filters.unread && learned.has(s.id)) return false;
    if (filters.results && !s.Results) return false;
    if (filters.q) {
      const hay = [s.Title, s.Creator, s["What they did"], s.Results, s.Takeaways, s["Ideas for OnCourse"], (s.Topics || []).join(" ")].join(" ").toLowerCase();
      return filters.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  };

  const chipRow = (label, key, values, field) => `
    <div class="filter-row" role="group" aria-label="${label}">
      <span class="filter-label">${label}</span>
      ${values.map((v) => `<button type="button" class="chip ${filters[key] === v ? "on" : ""}" data-f="${key}" data-v="${esc(v)}" aria-pressed="${filters[key] === v}">${esc(v)} <span class="n">${count(field, v)}</span></button>`).join("")}
    </div>`;

  // ---------- list ----------
  function renderList() {
    const list = sources.filter(matches);
    const learnedCount = sources.filter((s) => learned.has(s.id)).length;
    app.innerHTML = `
      <section class="intro">
        <h1>What other apps tried, and what happened</h1>
        <p class="muted">${sources.length} videos, talks and case studies, read for you, each with ideas for OnCourse. You've learned ${learnedCount} of ${sources.length}.</p>
        <div class="progress" aria-hidden="true"><span style="width:${sources.length ? (learnedCount / sources.length) * 100 : 0}%"></span></div>
      </section>

      <section class="filters">
        <input id="q" class="search" type="search" placeholder="Search: streak, paywall, trial reminder…" value="${esc(filters.q)}" aria-label="Search sources" />
        ${chipRow("Topic", "topic", uniq("Topics"), "Topics")}
        ${chipRow("Goal", "goal", uniq("Goal"), "Goal")}
        ${chipRow("Type", "type", uniq("Type"), "Type")}
        <div class="filter-row">
          <span class="filter-label">Show</span>
          <button type="button" class="chip ${filters.results ? "on" : ""}" data-toggle="results" aria-pressed="${filters.results}">With numbers</button>
          <button type="button" class="chip ${filters.unread ? "on" : ""}" data-toggle="unread" aria-pressed="${filters.unread}">Not learned yet</button>
          ${Object.entries(filters).some(([k, v]) => v && k !== "q") || filters.q ? `<button type="button" class="link" id="clear">Clear all</button>` : ""}
        </div>
      </section>

      <p class="muted small">${list.length === sources.length ? "" : `${list.length} of ${sources.length} sources`}</p>
      ${list.length ? `<section class="grid">${list.map(card).join("")}</section>` :
        `<div class="empty"><p><strong>Nothing matches.</strong></p><p class="muted">Try fewer filters, or a different word.</p><button type="button" class="btn" id="clear2">Clear filters</button></div>`}
      <footer class="foot muted small">Updated ${built}. Ask the agent to add a link, or edit <code>data/sources.json</code> and run <code>node build.mjs</code>.</footer>
    `;

    const q = document.getElementById("q");
    q.oninput = () => { filters.q = q.value; const pos = q.selectionStart; renderList(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); };
    app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { const k = b.dataset.f; filters[k] = filters[k] === b.dataset.v ? null : b.dataset.v; renderList(); });
    app.querySelectorAll("[data-toggle]").forEach((b) => b.onclick = () => { filters[b.dataset.toggle] = !filters[b.dataset.toggle]; renderList(); });
    const clear = () => { Object.assign(filters, { q: "", topic: null, goal: null, type: null, unread: false, results: false }); renderList(); };
    document.getElementById("clear")?.addEventListener("click", clear);
    document.getElementById("clear2")?.addEventListener("click", clear);
  }

  function card(s) {
    const firstResult = s.Results ? s.Results.split(/(?<=\.)\s/)[0] : null;
    return `
      <a class="card ${learned.has(s.id) ? "is-learned" : ""}" href="#/s/${s.id}">
        <div class="meta"><span class="type t-${esc((s.Type || "").toLowerCase().replace(/\s/g, "-"))}">${esc(s.Type)}</span><span class="muted">${esc(host(s.Link))}</span>${learned.has(s.id) ? `<span class="tick" title="Learned">✓ Learned</span>` : ""}</div>
        <h2>${esc(s.Title)}</h2>
        <p class="did">${esc(s["What they did"])}</p>
        ${firstResult ? `<p class="result"><span>${esc(firstResult)}</span></p>` : `<p class="result none">No numbers in the source</p>`}
        <div class="tags">${(s.Topics || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </a>`;
  }

  // ---------- detail ----------
  function renderDetail(id) {
    const s = sources.find((x) => x.id === id);
    if (!s) { app.innerHTML = `<div class="empty"><p><strong>That source isn't in the library.</strong></p><a class="btn" href="#/">Back to all sources</a></div>`; return; }
    const isLearned = learned.has(s.id);
    const related = sources.filter((x) => x.id !== s.id && (x.Topics || []).some((t) => (s.Topics || []).includes(t))).slice(0, 3);
    app.innerHTML = `
      <a class="back" href="#/">← All sources</a>
      <article class="detail">
        <div class="meta"><span class="type t-${esc((s.Type || "").toLowerCase().replace(/\s/g, "-"))}">${esc(s.Type)}</span><span class="muted">${esc(s.Creator)}</span></div>
        <h1>${esc(s.Title)}</h1>
        <div class="tags">${(s.Topics || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${(s.Goal || []).map((g) => `<span class="tag goal">${esc(g)}</span>`).join("")}</div>

        <div class="actions">
          <a class="btn primary" href="${esc(s.Link)}" target="_blank" rel="noopener">Open the source ↗</a>
          <button type="button" class="btn" id="learn" aria-pressed="${isLearned}">${isLearned ? "✓ Learned" : "Mark as learned"}</button>
        </div>

        <section><h3>What they did</h3><p>${esc(s["What they did"])}</p></section>
        <section class="callout ${s.Results ? "" : "none"}"><h3>What happened</h3><p>${s.Results ? esc(s.Results) : "The source gives no numbers. Treat it as an idea, not a proven result."}</p></section>
        <section><h3>Takeaways</h3><ul>${splitTakeaways(s.Takeaways).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>
        <section><h3>Ideas for OnCourse</h3><ul class="ideas">${splitIdeas(s["Ideas for OnCourse"]).map((i) => { const [screen, text] = ideaParts(i); return `<li>${screen ? `<span class="screen">${esc(screen)}</span>` : ""}<span>${esc(cap(text))}</span></li>`; }).join("")}</ul></section>
        ${s["Used in"] ? `<section><h3>Used in</h3><p>${esc(s["Used in"])}</p></section>` : ""}

        <section><h3>My notes</h3><textarea id="notes" rows="4" placeholder="What did you learn? What would you try?">${esc(notes[s.id] || "")}</textarea><p class="muted small" id="saved">Saved in this browser.</p></section>
        <p class="muted small">Added ${esc(s.Added || "")} · Read by the agent from the source itself.</p>
      </article>
      ${related.length ? `<section class="related"><h3>Related</h3><div class="grid">${related.map(card).join("")}</div></section>` : ""}
    `;
    document.getElementById("learn").onclick = () => {
      learned.has(s.id) ? learned.delete(s.id) : learned.add(s.id);
      store.set("learned", [...learned]); renderDetail(id);
    };
    const ta = document.getElementById("notes");
    ta.oninput = () => { notes[s.id] = ta.value; store.set("notes", notes); };
    scrollTo(0, 0);
  }

  // ---------- experiments ----------
  function renderExperiments() {
    const byWeek = [...experiments].sort((a, b) => String(b.Week).localeCompare(String(a.Week)));
    app.innerHTML = `
      <section class="intro">
        <h1>Weekly experiments</h1>
        <p class="muted">One or two ideas a week, picked from the sources and OnCourse's own data.</p>
      </section>
      ${byWeek.length ? `<section class="exp-list">${byWeek.map((e) => `
        <article class="exp">
          <div class="meta"><span class="status s-${esc(String(e.Status || "").toLowerCase())}">${esc(e.Status || "Proposed")}</span><span class="muted">Week of ${esc(e.Week || "")} · ${esc(e.Area || "")} · ${esc(e.Goal || "")}</span>${e.Effort ? `<span class="muted">Effort ${esc(e.Effort)}</span>` : ""}</div>
          <h2>${esc(e.Experiment)}</h2>
          <p>${esc(e.Hypothesis)}</p>
          ${e.Data ? `<p class="small"><strong>Data:</strong> ${esc(e.Data)}</p>` : ""}
          ${e["Based on"] ? `<p class="small"><strong>Based on:</strong> ${esc(e["Based on"])}</p>` : ""}
          ${e.Result ? `<p class="callout"><strong>Result:</strong> ${esc(e.Result)}</p>` : ""}
        </article>`).join("")}</section>` :
      `<div class="empty"><p><strong>No experiments yet.</strong></p><p class="muted">Ask the agent for "this week's design experiments". It finds the biggest leak in PostHog, matches it to what other apps did, and proposes one or two to try.</p><a class="btn" href="#/">Browse sources</a></div>`}
    `;
  }

  // ---------- router ----------
  function route() {
    const h = location.hash || "#/";
    const tab = h.startsWith("#/experiments") ? "experiments" : "sources";
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    if (h.startsWith("#/s/")) renderDetail(decodeURIComponent(h.slice(4)));
    else if (tab === "experiments") renderExperiments();
    else renderList();
  }
  addEventListener("hashchange", route);
  route();
})();
