// Shine Solutions landing page: form handling, ad attribution, conversion events, city message-match, small UI states.
(() => {
  // ---- events: pushed to the dataLayer and sent through the Google tag (gtag.js, installed in <head>) ----
  window.dataLayer = window.dataLayer || [];
  const track = (event, params = {}) => {
    window.dataLayer.push({ event, ...params });
    if (typeof window.gtag === "function") window.gtag("event", event, params);
  };
  document.querySelectorAll('[data-track="phone_click"]').forEach((a) =>
    a.addEventListener("click", () => track("phone_click", { link_url: a.href }))
  );
  document.querySelectorAll('[data-track="offer_click"]').forEach((a) =>
    a.addEventListener("click", () => track("offer_click"))
  );

  // ---- city message-match: ?city=hurricane swaps the headline city (allowlist only) ----
  const params = new URLSearchParams(location.search);
  const cities = {
    "st-george": "St. George", "washington": "Washington", "santa-clara": "Santa Clara",
    "hurricane": "Hurricane", "la-verkin": "La Verkin", "toquerville": "Toquerville",
  };
  const cityKey = (params.get("city") || "").toLowerCase().replace(/\s+/g, "-");
  const select = document.getElementById("f-city");
  if (cities[cityKey]) {
    document.querySelectorAll("[data-city]").forEach((el) => (el.textContent = cities[cityKey]));
    const match = [...select.options].find((o) => o.text.replace(/\s/g, " ") === cities[cityKey]);
    if (match) select.value = match.value;
  }

  // ---- attribution: keep gclid / utm values across the session ----
  const form = document.getElementById("estimate-form");
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  ["gclid", "utm_source", "utm_campaign", "utm_term"].forEach((k) => {
    const fromUrl = params.get(k);
    if (fromUrl) store.set(k, fromUrl);
    const v = fromUrl || store.get(k);
    if (v && form.elements[k]) form.elements[k].value = v;
  });

  // ---- plan buttons: remember which plan they picked and pass it with the lead ----
  document.querySelectorAll("[data-plan]").forEach((a) =>
    a.addEventListener("click", () => {
      if (form.elements.plan) form.elements.plan.value = a.dataset.plan;
      track("plan_click", { plan: a.dataset.plan });
    })
  );

  // ---- two-step estimate form: step 1 = stories + city (taps), step 2 = name + phone + optional text consent ----
  const rules = {
    stories: (v) => v !== "",
    city: (v) => v !== "",
    name: (v) => v.trim().length >= 2,
    phone: (v) => v.replace(/\D/g, "").replace(/^1/, "").length === 10,
  };
  const stepFields = { 1: ["stories", "city"], 2: ["name", "phone"] };
  const val = (name) => form.elements[name].value; // RadioNodeList.value is the checked radio's value
  const radios = [...form.querySelectorAll('input[name="stories"]')];

  const setError = (name, bad) => {
    const msg = document.getElementById(`f-${name}-error`);
    msg.hidden = !bad;
    if (name === "stories") {
      document.getElementById("f-stories").toggleAttribute("data-invalid", bad);
      radios.forEach((r) => r.setAttribute("aria-invalid", bad ? "true" : "false"));
      return;
    }
    const input = form.elements[name];
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    if (bad) input.setAttribute("aria-describedby", msg.id); else input.removeAttribute("aria-describedby");
  };
  ["city", "name", "phone"].forEach((name) => {
    const el = form.elements[name];
    el.addEventListener("blur", () => { if (el.value) setError(name, !rules[name](el.value)); });
    el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true" && rules[name](el.value)) setError(name, false); });
  });
  radios.forEach((r) => r.addEventListener("change", () => setError("stories", false)));

  // flags every problem on a step, focuses the first one; true when the step is complete
  const checkStep = (n) => {
    let firstBad = null;
    stepFields[n].forEach((name) => {
      const bad = !rules[name](val(name));
      setError(name, bad);
      if (bad && !firstBad) firstBad = name === "stories" ? radios[0] : form.elements[name];
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  const panels = [...form.querySelectorAll(".form__panel")];
  const back = form.querySelector(".form__back");
  const next = form.querySelector("[data-next]");
  const stepNum = form.querySelector("[data-step-num]");
  let step = 1;
  let reachedStep2 = false; // report step 2 once per visit, even if they go back and forth
  const goTo = (n) => {
    step = n;
    form.dataset.step = String(n);
    form.classList.add("is-stepped");
    panels.forEach((p) => (p.hidden = Number(p.dataset.step) !== n));
    back.hidden = n === 1;
    stepNum.textContent = String(n);
  };
  form.dataset.step = "1";

  next.addEventListener("click", () => {
    if (!checkStep(1)) return;
    goTo(2);
    if (!reachedStep2) track("form_progress", { form: "estimate", step: 2, stories: val("stories"), city: val("city") });
    reachedStep2 = true;
    form.elements.name.focus(); // same tap, so phones open the keyboard straight away
  });
  back.addEventListener("click", () => {
    goTo(1);
    (radios.find((r) => r.checked) || radios[0]).focus();
  });

  const status = form.querySelector(".form__status");
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector(".btn__label");
  const main = form.querySelector(".form__main");
  const done = form.querySelector(".form__done");

  // error line ends in a tap-to-call link (never splits the number across lines)
  const showError = (lead) => {
    const call = document.createElement("a");
    call.href = "tel:+14354857727";
    call.textContent = "(435) 485-7727";
    call.addEventListener("click", () => track("phone_click", { link_url: call.href }));
    status.className = "form__status is-error";
    status.replaceChildren(lead, call, ".");
  };

  // Google Ads conversion: sent once per lead, only after the endpoint has accepted it (never on validation errors or failures)
  const reportAdsConversion = () => {
    const sendTo = form.dataset.adsConversion || "";
    if (typeof window.gtag !== "function") return;
    if (!/^AW-\d+\/[\w-]+$/.test(sendTo) || sendTo.endsWith("/CONVERSION_LABEL")) {
      console.warn("[Shine] Google Ads conversion not sent: set the real label in data-ads-conversion on #estimate-form.");
      return;
    }
    window.gtag("event", "conversion", { send_to: sendTo });
  };

  // the exact consent wording shown, saved with every lead as the record of what they agreed to
  const consentText = [...form.querySelectorAll(".consent__check span, .consent__fine")]
    .map((el) => el.textContent.replace(/\s+/g, " ").trim()).join(" | ");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (step === 1) { next.click(); return; } // Enter pressed on step 1 moves on instead of submitting
    if (!stepFields[1].every((name) => rules[name](val(name)))) { goTo(1); checkStep(1); return; }
    if (!checkStep(2)) return;

    // TODO before launch: set data-endpoint on the <form> to the lead destination
    // (GoHighLevel webhook, Jobber, Housecall Pro, Formspree, Zapier). Accepts a JSON POST.
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      showError("Online booking isn't connected yet. Please call ");
      console.warn("[Shine] Set data-endpoint on #estimate-form before launch.");
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    data.sms_service = form.elements.sms_service.checked ? "yes" : "no";
    data.sms_marketing = form.elements.sms_marketing.checked ? "yes" : "no";
    data.sms_consent_text = consentText;
    data.submitted_at = new Date().toISOString();
    data.page_url = location.href;

    button.disabled = true;
    button.dataset.state = "loading";
    label.textContent = "Sending";
    status.className = "form__status";
    status.textContent = "";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      track("generate_lead", { form: "estimate", city: data.city, stories: data.stories, sms_service: data.sms_service });
      reportAdsConversion();
      const first = data.name.trim().split(/\s+/)[0];
      done.querySelector(".form__done-text").textContent =
        `Thanks, ${first}. We'll be in touch shortly to set up your estimate.`;
      main.hidden = true;
      done.hidden = false;
      done.querySelector(".form__title").focus();
    } catch {
      button.dataset.state = "error";
      label.textContent = "Try again";
      showError("That didn't go through. Try again, or call ");
    } finally {
      button.disabled = false;
      if (button.dataset.state === "loading") delete button.dataset.state;
    }
  });
  form.addEventListener("input", () => {
    if (button.dataset.state === "error") { delete button.dataset.state; label.textContent = "Get my free estimate"; }
  });

  // ---- nav shadow once the page scrolls ----
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---- mobile action bar: hide it while the form itself is on screen ----
  const bar = document.getElementById("bar");
  if ("IntersectionObserver" in window && bar) {
    new IntersectionObserver(([entry]) => bar.classList.toggle("is-hidden", entry.isIntersecting), {
      threshold: 0.25,
    }).observe(form);
  }

  document.getElementById("year").textContent = new Date().getFullYear();
})();
