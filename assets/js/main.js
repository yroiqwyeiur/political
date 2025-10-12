import { translations } from "./data/translations.js";
import { eventData } from "./data/events.js";
import { I18n } from "./i18n.js";

const DEFAULT_LOCALE = document.documentElement.dataset.defaultLocale || "en";
const STORAGE_KEY = "pnp-preferred-locale";
const i18n = new I18n(translations, DEFAULT_LOCALE);

const categorySelect = document.getElementById("category");
const sortSelect = document.getElementById("sort");
const searchInput = document.getElementById("search");
const eventList = document.getElementById("event-list");
const languageSwitcher = document.getElementById("language-switcher");

let localizedEvents = [];

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
  localizedEvents = eventData.map((event) => {
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

    const sourcesMarkup = event.sources
      .map(
        (source) =>
          `<a href="${source.url}" rel="noopener noreferrer" target="_blank">${source.label}</a>`
      )
      .join(" · ");

    wrapper.innerHTML = `
      <header>
        <h3>${event.title}</h3>
      </header>
      <div class="event-meta">
        <span>${formatDate(event.datetime, locale)}</span>
        <span>${event.location}</span>
        <span>${event.categories
          .map((category) => `<span class="tag">${category}</span>`)
          .join("")}</span>
        <span class="heat-pill">${i18n.translate("events.heatLabel", locale)} ${event.heat}</span>
      </div>
      <p>${event.summary}</p>
      ${
        event.sources.length
          ? `<div class="event-sources"><strong>${i18n.translate(
              "events.sourcesPrefix",
              locale
            )}</strong> ${sourcesMarkup}</div>`
          : ""
      }
    `;

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
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();

  const initialLocale = getInitialLocale();
  bindFilters();

  if (languageSwitcher) {
    languageSwitcher.addEventListener("change", (event) => {
      if (event.target instanceof HTMLSelectElement) {
        setLocale(event.target.value);
      }
    });
  }

  setLocale(initialLocale);
});
