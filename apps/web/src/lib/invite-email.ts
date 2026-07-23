// Invite-email composer. mailto: drafts are plain-text only, so hyperlinks
// can't be embedded directly. Instead: copy a formatted (HTML) body — with
// the invite URL embedded in a friendly link — to the clipboard, then open
// the Outlook draft with recipient + subject and a "paste here" placeholder.

export interface InviteEmail {
  to: string;
  subject: string;
  /** HTML body with the invite URL embedded as a link. */
  html: string;
  /** Plain-text fallback (pasting into non-rich targets shows the URL). */
  text: string;
}

export async function copyFormattedAndCompose(email: InviteEmail): Promise<void> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([email.html], { type: "text/html" }),
        "text/plain": new Blob([email.text], { type: "text/plain" }),
      }),
    ]);
  } catch {
    // Rich clipboard unavailable — fall back to plain text (URL visible).
    await navigator.clipboard.writeText(email.text).catch(() => {});
  }

  const body =
    "[ Press ⌘V here — your formatted invitation is already on the clipboard ]";
  window.location.href = `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(
    email.subject,
  )}&body=${encodeURIComponent(body)}`;
}
