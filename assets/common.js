/* Shared helpers for the quiz and teacher pages: API client, question rendering, text size. */
window.MB = (function () {
  const ITEMS = window.MB_ITEMS || [];
  const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  const TOPIC = { 1: ["Number & algebra", "#1F4E79"], 2: ["Functions", "#5B4B8A"], 3: ["Geometry & trig", "#0F6B63"],
                  4: ["Stats & probability", "#8A5A1B"], 5: ["Calculus", "#8C2F39"] };
  const PAPER = { 0: "Quick check", 1: "Paper 1", 2: "Paper 2", 3: "Paper 3" };

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stripTags = s => String(s || "").replace(/<[^>]+>/g, "");

  /* ---------- storage that never throws ---------- */
  const store = {
    get(k, area) { try { return (area || localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, area) { try { (area || localStorage).setItem(k, v); } catch (e) {} },
    del(k, area) { try { (area || localStorage).removeItem(k); } catch (e) {} },
    json(k, area) { try { return JSON.parse((area || localStorage).getItem(k) || "null"); } catch (e) { return null; } }
  };

  /* ---------- API ---------- */
  const okUrl = u => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(u);
  function apiUrl() {
    const fromConfig = (window.MB_API_URL || "").trim();
    if (fromConfig && okUrl(fromConfig)) return fromConfig;
    const fromLink = new URLSearchParams(location.search).get("api");
    if (fromLink && okUrl(fromLink)) return fromLink;
    const saved = store.get("mb-api");
    if (saved && okUrl(saved)) return saved;
    return "";
  }
  const configured = () => !!((window.MB_API_URL || "").trim() && okUrl(window.MB_API_URL.trim()));

  const MESSAGES = {
    no_api: "This site isn't connected to a quiz backend yet.",
    network: "Couldn't reach the quiz server. Check your connection and try again.",
    bad_response: "The quiz server sent an unexpected reply.",
    bad_key: "That teacher key wasn't accepted.",
    no_quiz: "This quiz doesn't exist. Check the link with your teacher.",
    closed: "This quiz is closed. Ask your teacher to reopen it.",
    no_name: "Enter your name.",
    bad_pin: "Your PIN must be 4 to 8 digits.",
    pin_mismatch: "That PIN doesn't match the one used for this name. Check your name's spelling and your PIN.",
    no_resubmit: "Your teacher has already started marking this, and resubmission is turned off.",
    quiz_full: "This quiz has reached its limit of submissions.",
    answers_too_long: "Your answers are too long to send. Shorten your working a little.",
    no_items: "Choose at least one question.",
    too_many_items: "A quiz can hold at most 40 questions.",
    no_sub: "That submission no longer exists.",
    stale_answers: "The student changed their answers while you were marking. Reload their submission before saving.",
    server_error: "The quiz server hit an error. Try again in a moment.",
    unknown_action: "The quiz server is out of date. Redeploy backend/Code.gs."
  };
  const message = e => MESSAGES[e && e.code] || (e && e.message) || "Something went wrong.";

  async function api(action, body, url) {
    url = url || apiUrl();
    if (!url) throw { code: "no_api" };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
      // text/plain keeps this a "simple" request, which Apps Script web apps accept without a CORS preflight.
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                               body: JSON.stringify(Object.assign({ action }, body || {})), signal: ctrl.signal });
    } catch (e) { throw { code: "network" }; }
    finally { clearTimeout(timer); }
    let data;
    try { data = await res.json(); } catch (e) { throw { code: "bad_response" }; }
    if (!data || !data.ok) throw { code: (data && data.error) || "server_error" };
    return data;
  }

  /* ---------- rendering ---------- */
  const codeCls = c => /^AHL/.test(c) ? "code ahl" : "code";
  function badge(it) {
    if (it.paper === 0) return `<span class="badge">Quick check</span>`;
    const gdc = it.paper === 2 || it.paper === 3;
    return `<span class="badge ${gdc ? "gdc" : "nogdc"}">${gdc ? "GDC required" : "No calculator"}</span>`;
  }
  function headerHTML(it, num) {
    return `<header>
      ${num != null ? `<span class="qnum">Q${num}</span>` : ""}
      <span class="iid">${it.id}</span>
      <span class="ititle">${it.title}</span>
      ${it.codes.map(c => `<span class="${codeCls(c)}">${c}</span>`).join("")}
      ${badge(it)}
      <span class="imax">[Maximum mark: ${it.max}]</span>
    </header>`;
  }
  function msHTML(it) {
    return it.ms.map(m => {
      const total = (it.parts.find(p => p.l === m.l) || {}).m;
      const line = L => `<div class="msline"><span>${L.t}</span><span class="msc">${L.c}</span></div>`;
      const note = m.note ? `<div class="msnote"><b>Note:</b> ${m.note}</div>` : "";
      const alt = m.alt ? `<div class="msalt"><div class="altt">${m.alt.title}</div>${m.alt.lines.map(line).join("")}</div>` : "";
      const tot = (it.parts.length > 1 && total != null) ? `<div class="mstot">[${total} mark${total === 1 ? "" : "s"}]</div>` : "";
      return `<div class="mspart"><div class="mspl">${m.l}</div><div>${m.lines.map(line).join("")}${note}${alt}${tot}</div></div>`;
    }).join("") + `<div class="msgrand">Total [${it.max} marks]</div>`;
  }
  const quizMax = ids => ids.reduce((s, id) => s + ((BY_ID[id] || {}).max || 0), 0);

  /* ---------- small UI helpers ---------- */
  function toast(text, kind) {
    let el = document.getElementById("mb-toast");
    if (!el) { el = document.createElement("div"); el.id = "mb-toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text;
    el.dataset.kind = kind || "";
    el.classList.add("on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("on"), 4200);
  }
  function when(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                   : d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function duration(sec) {
    sec = Math.round(sec || 0);
    if (!sec) return "";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m} min${s ? " " + s + " s" : ""}` : `${s} s`;
  }

  /* Maths symbol palette: inserts into the last focused textarea. */
  const SYMBOLS = ["√", "π", "²", "³", "ⁿ", "½", "≤", "≥", "≠", "≈", "±", "×", "÷", "∞", "θ", "α", "β", "λ", "μ", "σ", "∫", "Σ", "→", "⇒", "∈", "ℝ", "ℤ", "ℕ", "ℂ", "i", "e", "ln", "log"];
  let lastField = null;
  document.addEventListener("focusin", e => { if (e.target.matches && e.target.matches("textarea.answer, textarea.comment")) lastField = e.target; });
  function symbolBar(el) {
    el.innerHTML = SYMBOLS.map(s => `<button type="button" class="sym" data-s="${esc(s)}" title="Insert ${esc(s)}">${esc(s)}</button>`).join("");
    el.addEventListener("mousedown", e => { if (e.target.closest(".sym")) e.preventDefault(); });
    el.addEventListener("click", e => {
      const b = e.target.closest(".sym"); if (!b) return;
      const f = lastField && document.body.contains(lastField) ? lastField : document.querySelector("textarea.answer");
      if (!f || f.readOnly || f.disabled) return;
      const s = b.dataset.s, a = f.selectionStart, z = f.selectionEnd;
      f.setRangeText(s, a, z, "end");
      f.focus();
      f.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  /* Text size control (shares the bank's remembered setting). */
  function zoom() {
    const g = document.querySelector(".zoom .zg"); if (!g) return;
    const set = v => { document.documentElement.style.setProperty("--scale", v);
      g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.scale === String(v) ? "true" : "false")); };
    let saved = store.get("aahl-scale") || "1";
    if (!["1", "1.22", "1.5"].includes(saved)) saved = "1";
    set(saved);
    g.querySelectorAll("button").forEach(b => b.onclick = () => { set(b.dataset.scale); store.set("aahl-scale", b.dataset.scale); });
  }

  return { ITEMS, BY_ID, TOPIC, PAPER, esc, stripTags, store, api, apiUrl, okUrl, configured, message,
           headerHTML, msHTML, quizMax, toast, when, duration, symbolBar, zoom };
})();
