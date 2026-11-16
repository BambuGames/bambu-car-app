import { scrubBreadcrumb, scrubUrl, telemetryOptions } from './telemetry';

test('scrubUrl removes the token of a signed storage URL', () => {
  const signed = 'https://abc.supabase.co/storage/v1/object/sign/processed/g/v/p/out.jpg?token=eyJhbGciOi.secret#x';
  expect(scrubUrl(signed)).toBe('https://abc.supabase.co/storage/v1/object/sign/processed/g/v/p/out.jpg');
  expect(scrubUrl('/rest/v1/photos?select=*')).toBe('/rest/v1/photos');
  expect(scrubUrl('not a url ?token=1')).toBe('not a url ');
});

test('breadcrumbs of fetches lose their query strings', () => {
  const crumb = scrubBreadcrumb({ category: 'fetch', data: { url: 'https://abc.supabase.co/x?token=t', method: 'GET', status_code: 200 } });
  expect(crumb.data).toEqual({ url: 'https://abc.supabase.co/x', method: 'GET', status_code: 200 });
  const nav = scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } });
  expect(nav.data).toEqual({ from: '/a', to: '/b' });
  expect(scrubBreadcrumb({ category: 'console', message: 'hi' })).toEqual({ category: 'console', message: 'hi' });
});

test('Sentry stays off without a DSN and in development', () => {
  expect(telemetryOptions(undefined, false).enabled).toBe(false);
  expect(telemetryOptions('', false).enabled).toBe(false);
  expect(telemetryOptions('https://k@o1.ingest.de.sentry.io/1', true).enabled).toBe(false);
  const on = telemetryOptions('https://k@o1.ingest.de.sentry.io/1', false);
  expect(on).toMatchObject({ enabled: true, sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false });
  expect(on.beforeBreadcrumb).toBe(scrubBreadcrumb);
});

test('native iOS network breadcrumbs are off and query fields are dropped', () => {
  expect(telemetryOptions('https://k@o1.ingest.de.sentry.io/1', false).enableNetworkBreadcrumbs).toBe(false);
  const crumb = scrubBreadcrumb({
    category: 'http',
    data: { url: 'https://abc.supabase.co/x?token=t', 'http.query': 'token=t', 'http.fragment': 'f', method: 'GET' },
  });
  expect(crumb.data).toEqual({ url: 'https://abc.supabase.co/x', method: 'GET' });
});

test('events lose the query strings of every breadcrumb, also the native ones merged into them', () => {
  const { beforeSend } = telemetryOptions('https://k@o1.ingest.de.sentry.io/1', false);
  const event = {
    breadcrumbs: [
      { category: 'http', data: { url: 'https://abc.supabase.co/storage/v1/object/sign/p.jpg?token=t', 'http.query': 'token=t' } },
      { category: 'console', message: 'm' },
    ],
  };
  expect(beforeSend(event)).toEqual({
    breadcrumbs: [{ category: 'http', data: { url: 'https://abc.supabase.co/storage/v1/object/sign/p.jpg' } }, { category: 'console', message: 'm' }],
  });
});
