export async function dashboardFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401) window.dispatchEvent(new Event('ksfh-session-expired'));
  if (response.status === 403) window.dispatchEvent(new Event('ksfh-permissions-changed'));
  return response;
}
