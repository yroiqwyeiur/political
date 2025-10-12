let activeProvider = null;
let analyticsId = null;

function ensureGa4DataLayer() {
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
}

export function initAnalytics() {
  const root = document.documentElement;
  const provider = root.dataset.analyticsProvider;

  if (provider !== "ga4") {
    return;
  }

  const gaId = root.dataset.gaId;
  if (!gaId) {
    console.warn("Analytics disabled: data-ga-id attribute is empty.");
    return;
  }

  ensureGa4DataLayer();

  if (analyticsId === gaId) {
    return; // already initialised with this ID
  }

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  script.async = true;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", gaId, { send_page_view: false });

  activeProvider = "ga4";
  analyticsId = gaId;
}

export function trackPageView(params = {}) {
  if (activeProvider === "ga4" && window.gtag) {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
      ...params
    });
  }
}

export function trackEvent(name, params = {}) {
  if (activeProvider === "ga4" && window.gtag) {
    window.gtag("event", name, params);
  }
}
