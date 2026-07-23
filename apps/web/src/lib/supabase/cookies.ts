// "Remember me" support. When the amg-remember cookie is "0", Supabase auth
// cookies are written WITHOUT maxAge/expires — session cookies that vanish
// when the browser closes. Default (absent/"1") keeps persistent cookies.

export const REMEMBER_COOKIE = "amg-remember";

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
