export const SESSION_COOKIE_HINTS = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

export const PROTECTED_PATH_PREFIXES = ["/employee", "/settings"] as const;

export const AUTH_PATHS = ["/sign-in", "/sign-up"] as const;

export function hasSessionCookie(
  cookieHeader: string | null | undefined,
): boolean {
  if (!cookieHeader) {
    return false;
  }

  return SESSION_COOKIE_HINTS.some((name) => cookieHeader.includes(name));
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
