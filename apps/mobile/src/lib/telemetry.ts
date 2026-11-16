// Sentry for the app (spec 11.1, EU data region). Off without a DSN and in development. Nothing personal is
// sent, and no screenshots: photos show number plates. Signed storage links carry their key in the query
// string, so every URL in a breadcrumb loses its query before it leaves the phone. iOS's own network
// breadcrumbs (expo-image, file downloads) never pass beforeBreadcrumb and are merged into each event, so
// they are switched off and every event's breadcrumbs are scrubbed once more in beforeSend.
type Crumb = { category?: string; message?: string; data?: Record<string, unknown> };

export function scrubUrl(url: string): string {
  return url.split('#')[0].split('?')[0];
}

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T {
  if (!crumb.data) return crumb;
  const data = { ...crumb.data };
  for (const key of ['url', 'from', 'to']) {
    if (typeof data[key] === 'string') data[key] = scrubUrl(data[key]);
  }
  delete data['http.query'];
  delete data['http.fragment'];
  return { ...crumb, data };
}

export function scrubEvent<T extends { breadcrumbs?: Crumb[] }>(event: T): T {
  return event.breadcrumbs ? { ...event, breadcrumbs: event.breadcrumbs.map(scrubBreadcrumb) } : event;
}

export function telemetryOptions(dsn: string | undefined, isDev: boolean) {
  return {
    dsn: dsn || undefined,
    enabled: !!dsn && !isDev,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableNetworkBreadcrumbs: false,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  };
}
