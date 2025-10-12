export class I18n {
  constructor(translations, defaultLocale) {
    this.translations = translations;
    this.defaultLocale = defaultLocale;
    this.currentLocale = this.#resolveLocale(defaultLocale);
  }

  setLocale(locale) {
    this.currentLocale = this.#resolveLocale(locale);
    return this.currentLocale;
  }

  getLocale() {
    return this.currentLocale;
  }

  translate(key, locale = this.currentLocale) {
    const map = this.translations[locale] || this.translations[this.defaultLocale] || {};
    return map[key] ?? key;
  }

  applyDocument(root = document) {
    const locale = this.currentLocale;
    const map = this.translations[locale] || {};

    if (map["meta.title"]) {
      root.title = map["meta.title"];
    }

    const metaDescription = root.querySelector('meta[name="description"]');
    if (metaDescription && map["meta.description"]) {
      metaDescription.setAttribute("content", map["meta.description"]);
    }

    root.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (!key) return;
      const value = map[key];
      if (value == null) return;

      const attr = element.dataset.i18nAttr;
      if (attr) {
        element.setAttribute(attr, value);
      } else {
        element.textContent = value;
      }
    });
  }

  #resolveLocale(locale) {
    if (locale && this.translations[locale]) {
      return locale;
    }
    return this.defaultLocale;
  }
}
