const DISALLOWED_AUTH_CALLBACK_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /\.lovable\.app$/i,
  /^localhost$/i,
  /^127(?:\.\d{1,3}){3}$/i,
  /^\[::1\]$/i,
];

export function isDisallowedAuthCallbackHost(hostname: string) {
  return DISALLOWED_AUTH_CALLBACK_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function getConfiguredPublicAppUrl() {
  const rawUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();

  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (isDisallowedAuthCallbackHost(url.hostname)) {
      return null;
    }

    url.pathname = '';
    url.search = '';
    url.hash = '';

    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getConfiguredSetPasswordUrl() {
  const publicAppUrl = getConfiguredPublicAppUrl();

  if (!publicAppUrl) {
    return null;
  }

  return new URL('/set-password', `${publicAppUrl}/`).toString();
}