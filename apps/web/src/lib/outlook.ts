/**
 * Compose-email link that opens the DESKTOP mail app (Outlook, when it's the
 * system default mail handler) with recipient/subject/body pre-filled.
 * mailto: is the only scheme macOS reliably routes to the desktop app; the
 * Outlook-web deeplink was rejected because it opened the browser.
 */
export function outlookComposeUrl({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
