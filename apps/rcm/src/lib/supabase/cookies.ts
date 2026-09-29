// "Remember me" support. When the rcm-remember cookie is "0", Supabase auth
// cookies are written WITHOUT maxAge/expires — session cookies that vanish
// when the browser closes. Default (absent/"1") keeps persistent cookies.
//
// Named separately from the portal's amg-remember on purpose. RCM is a
// different host, so its cookies are a different jar: signing in here does not
// sign you in to the wound-care portal, and signing out of one leaves the other
// alone. That separation is the point of the subdomain.

export const REMEMBER_COOKIE = "rcm-remember";

export interface CookieSetOptions {
  maxAge?: number;
  expires?: Date;
  [key: string]: unknown;
}

export function applyRemember(
  options: CookieSetOptions | undefined,
  remember: boolean,
): CookieSetOptions | undefined {
  if (remember || !options) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest;
}
