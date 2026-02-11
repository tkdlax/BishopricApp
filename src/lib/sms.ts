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

export function buildWhatsAppUrl(phone: string, body: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(body);
  return `https://wa.me/${cleaned}${body ? `?text=${encoded}` : ''}`;
}

export function openWhatsApp(phone: string, body: string): void {
  const url = buildWhatsAppUrl(phone, body);
  window.open(url, '_blank');
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
