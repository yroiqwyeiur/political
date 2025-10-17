import { translations } from "./data/translations.js";
import { I18n } from "./i18n.js";
import { initAnalytics, trackEvent, trackPageView } from "./analytics.js";

const DEFAULT_LOCALE = document.documentElement.dataset.defaultLocale || "en";
const STORAGE_KEY = "pnp-preferred-locale";
const i18n = new I18n(translations, DEFAULT_LOCALE);

let rawEventData = [];
const categorySelect = document.getElementById("category");
const sortSelect = document.getElementById("sort");
const searchInput = document.getElementById("search");
const eventList = document.getElementById("event-list");
const languageSwitcher = document.getElementById("language-switcher");

let localizedEvents = [];
let moduleSections = [];
let moduleTriggers = [];
let navModuleTriggers = [];
let activeModule = null;

function safeGetStoredLocale() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch (err) {
    console.warn("Unable to read stored locale", err);
    return null;
  }
}

function safeStoreLocale(locale) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale);
  } catch (err) {
    console.warn("Unable to persist locale", err);
  }
}

function getInitialLocale() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("lang");
  if (fromQuery && translations[fromQuery]) {
    return fromQuery;
  }

  const stored = safeGetStoredLocale();
  if (stored && translations[stored]) {
    return stored;
  }

  return DEFAULT_LOCALE;
}

function updateLocalizedEvents(locale) {
  localizedEvents = rawEventData.map((event) => {
    const localeData = event.locales[locale] ?? event.locales[DEFAULT_LOCALE];
    return {
      id: event.id,
      datetime: event.datetime,
      heat: event.heat,
      title: localeData.title,
      location: localeData.location,
      categories: [...localeData.categories],
      summary: localeData.summary,
      sources: localeData.sources.map((source) => ({ ...source }))
    };
  });
}

function activateModule(moduleName, options = {}) {
  if (!moduleName || !moduleSections.length) return;
  const normalized = moduleName.trim();
  if (!normalized || normalized === activeModule) {
    if (options.scroll && normalized === activeModule) {
      const currentSections = moduleSections.filter(
        (section) => section.dataset.module === normalized
      );
      currentSections[0]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const matchedSections = moduleSections.filter(
    (section) => section.dataset.module === normalized
  );

  if (!matchedSections.length) return;

  moduleSections.forEach((section) => {
    const isMatch = section.dataset.module === normalized;
    section.classList.toggle("is-active", isMatch);
    if (isMatch) {
      section.removeAttribute("aria-hidden");
    } else {
      section.setAttribute("aria-hidden", "true");
    }
  });

  navModuleTriggers.forEach((trigger) => {
    const isMatch = trigger.dataset.moduleTarget === normalized;
    trigger.classList.toggle("is-active", isMatch);
    trigger.setAttribute("aria-selected", isMatch ? "true" : "false");
  });

  activeModule = normalized;

  if (options.updateHash !== false) {
    const params = new URLSearchParams(window.location.search);
    const query = params.toString();
    const hash = `#${normalized}`;
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;
    window.history.replaceState({}, "", newUrl);
  }

  const scrollTarget = matchedSections[0];
  if (options.scroll !== false && scrollTarget) {
    scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function initModuleTabs() {
  moduleTriggers = Array.from(document.querySelectorAll("[data-module-target]"));
  moduleSections = Array.from(document.querySelectorAll(".module-section"));
  navModuleTriggers = moduleTriggers.filter((trigger) => trigger.closest(".navigation"));

  if (!moduleTriggers.length || !moduleSections.length) {
    return;
  }

  document.body.classList.add("modules-ready");

  moduleSections.forEach((section) => {
    section.classList.remove("is-active");
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-hidden", "true");
  });

  navModuleTriggers.forEach((trigger) => {
    trigger.setAttribute("role", "tab");
    trigger.setAttribute("aria-selected", "false");
    const moduleName = trigger.dataset.moduleTarget;
    const controlled = moduleSections.find((section) => section.dataset.module === moduleName);
    if (controlled?.id) {
      trigger.setAttribute("aria-controls", controlled.id);
    }
  });

  moduleTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (!(trigger instanceof HTMLAnchorElement)) return;
      const targetModule = trigger.dataset.moduleTarget;
      if (!targetModule) return;
      event.preventDefault();
      activateModule(targetModule, { scroll: true });
    });
  });

  const fromHash = window.location.hash?.replace(/^#/, "") ?? "";
  const initialTrigger =
    moduleTriggers.find((trigger) => trigger.dataset.moduleTarget === fromHash) ??
    navModuleTriggers[0] ??
    moduleTriggers[0];
  const initialModule = initialTrigger?.dataset.moduleTarget;
  if (initialModule) {
    activateModule(initialModule, { scroll: false, updateHash: !!fromHash });
  }
}

function initNavigation() {
  const navToggle = document.querySelector(".nav-toggle");
  const navigation = document.querySelector(".navigation");
  if (!navToggle || !navigation) return;

  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    navigation.classList.toggle("open", !expanded);
  });

  navigation.addEventListener("click", (evt) => {
    if (evt.target instanceof HTMLAnchorElement) {
      navigation.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function formatDate(dateString, locale) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function deriveCategories(locale) {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const all = new Set();
  localizedEvents.forEach((event) => event.categories.forEach((category) => all.add(category)));
  return Array.from(all).sort((a, b) => collator.compare(a, b));
}

function populateCategoryOptions(locale = i18n.getLocale()) {
  if (!categorySelect) return;
  const categories = deriveCategories(locale);
  const previousValue = categorySelect.value;

  Array.from(categorySelect.querySelectorAll("option")).forEach((option) => {
    if (option.value !== "all") {
      option.remove();
    }
  });

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  if (previousValue !== "all" && categories.includes(previousValue)) {
    categorySelect.value = previousValue;
  } else {
    categorySelect.value = "all";
  }
}

function filterEvents(locale = i18n.getLocale()) {
  const search = searchInput?.value.trim().toLowerCase() ?? "";
  const category = categorySelect?.value ?? "all";
  const sort = sortSelect?.value ?? "time";

  let filtered = localizedEvents.filter((event) => {
    const haystacks = [event.title, event.summary, ...event.categories];
    const matchesSearch = !search || haystacks.some((text) => text.toLowerCase().includes(search));
    const matchesCategory = category === "all" || event.categories.includes(category);
    return matchesSearch && matchesCategory;
  });

  filtered.sort((a, b) => {
    if (sort === "heat" && b.heat !== a.heat) {
      return b.heat - a.heat;
    }
    return new Date(b.datetime) - new Date(a.datetime);
  });

  renderEvents(filtered, locale);
}

function renderEvents(data, locale) {
  if (!eventList) return;
  eventList.innerHTML = "";

  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "event-card";
    empty.innerHTML = `<p>${i18n.translate("events.empty", locale)}</p>`;
    eventList.appendChild(empty);
    return;
  }

  data.forEach((event) => {
    const wrapper = document.createElement("article");
    wrapper.className = "event-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = event.title;
    header.appendChild(title);
    wrapper.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "event-meta";

    const datetime = document.createElement("span");
    datetime.textContent = formatDate(event.datetime, locale);
    meta.appendChild(datetime);

    const location = document.createElement("span");
    location.textContent = event.location;
    meta.appendChild(location);

    const categoriesWrapper = document.createElement("span");
    event.categories.forEach((category) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = category;
      categoriesWrapper.appendChild(tag);
    });
    meta.appendChild(categoriesWrapper);

    const heat = document.createElement("span");
    heat.className = "heat-pill";
    heat.textContent = `${i18n.translate("events.heatLabel", locale)} ${event.heat}`;
    meta.appendChild(heat);

    wrapper.appendChild(meta);

    const summary = document.createElement("p");
    summary.textContent = event.summary;
    wrapper.appendChild(summary);

    if (event.sources.length) {
      const sourcesContainer = document.createElement("div");
      sourcesContainer.className = "event-sources";

      const prefix = document.createElement("strong");
      prefix.textContent = i18n.translate("events.sourcesPrefix", locale);
      sourcesContainer.appendChild(prefix);

      event.sources.forEach((source, index) => {
        if (index > 0) {
          sourcesContainer.appendChild(document.createTextNode(" · "));
        } else {
          sourcesContainer.appendChild(document.createTextNode(" "));
        }

        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.label;
        sourcesContainer.appendChild(link);
      });

      wrapper.appendChild(sourcesContainer);
    }

    eventList.appendChild(wrapper);
  });
}

function bindFilters() {
  const getLocale = () => i18n.getLocale();
  searchInput?.addEventListener("input", () => filterEvents(getLocale()));
  categorySelect?.addEventListener("change", () => filterEvents(getLocale()));
  sortSelect?.addEventListener("change", () => filterEvents(getLocale()));
}

function setLocale(locale) {
  const resolved = i18n.setLocale(locale);
  document.documentElement.lang = resolved;
  document.documentElement.dataset.currentLocale = resolved;

  if (languageSwitcher && languageSwitcher.value !== resolved) {
    languageSwitcher.value = resolved;
  }

  i18n.applyDocument(document);
  updateLocalizedEvents(resolved);
  populateCategoryOptions(resolved);
  filterEvents(resolved);

  const params = new URLSearchParams(window.location.search);
  params.set("lang", resolved);
  const query = params.toString();
  const hash = window.location.hash ?? "";
  const newUrl = `${window.location.pathname}?${query}${hash}`;
  window.history.replaceState({}, "", newUrl);
  safeStoreLocale(resolved);
  trackPageView();
  return resolved;
}

document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  initAnalytics();

  bindFilters();
  initModuleTabs();

  const cacheBuster =
    document.documentElement.dataset.eventVersion ?? String(Date.now());

  try {
    const module = await import(`./data/events.js?v=${cacheBuster}`);
    rawEventData = Array.isArray(module.eventData) ? module.eventData : [];
  } catch (err) {
    console.error("Failed to load event data", err);
    rawEventData = [];
  }

  if (languageSwitcher) {
    languageSwitcher.addEventListener("change", (event) => {
      if (event.target instanceof HTMLSelectElement) {
        const updatedLocale = setLocale(event.target.value);
        trackEvent("change_locale", { value: updatedLocale });
      }
    });
  }

  const initialLocale = getInitialLocale();
  setLocale(initialLocale);
});
