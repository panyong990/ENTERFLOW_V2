// Only an opaque client-scoped retry key goes in the URL. No form values,
// document bytes, credentials, or Demo/browser-storage records are persisted.
const parameter = 'inquirySubmission';
export function recoveryKey(url: string) {
  const value = new URL(url).searchParams.get(parameter);
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : null;
}
export function recoveryUrl(url: string, key: string | null) {
  const next = new URL(url);
  if (key) next.searchParams.set(parameter, key);
  else next.searchParams.delete(parameter);
  return next.href;
}
export function retainRecoveryKey(key: string | null) {
  window.history.replaceState(window.history.state, '', recoveryUrl(window.location.href, key));
}
