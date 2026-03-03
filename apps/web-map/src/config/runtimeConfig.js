const defaults = {
  javaApiBaseUrl: 'http://localhost:8080',
  mlApiBaseUrl: 'http://localhost:8001',
  csharpApiBaseUrl: 'http://localhost:5001',
};

const runtimeOverride = window.__COMMUNITY_ALERTS_CONFIG__ || {};

export const runtimeConfig = {
  ...defaults,
  ...runtimeOverride,
};
