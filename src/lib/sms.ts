/**
 * Build sms: URL. Must be opened from direct user gesture (button tap) on iOS.
 */
export function buildSmsUrl(phone: string, body: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(body);
  return `sms:${cleaned}?body=${encoded}`;
}

export function openSms(phone: string, body: string): void {
  const url = buildSmsUrl(phone, body);
  window.location.href = url;
}

/** Normalize phone to digits; if 10 digits assume US and prepend 1 for wa.me. */
export function normalizePhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `1${cleaned}`;
  return cleaned;
}

const MAX_WHATSAPP_URL_BODY = 1500;

export function buildWhatsAppUrl(phone: string, body: string): string {
  const cleaned = normalizePhoneForWhatsApp(phone);
  const truncated = body.length > MAX_WHATSAPP_URL_BODY ? body.slice(0, MAX_WHATSAPP_URL_BODY) + '…' : body;
  const encoded = encodeURIComponent(truncated);
  return `https://wa.me/${cleaned}${encoded ? `?text=${encoded}` : ''}`;
}

export function openWhatsApp(phone: string, body: string): void {
  const url = buildWhatsAppUrl(phone, body);
  window.open(url, '_blank');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
