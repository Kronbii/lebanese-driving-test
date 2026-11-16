/**
 * wa.me link for a phone number. Lebanese local numbers ("03 123 456", "71123456")
 * get the 961 country code; "+" / "00" prefixes are stripped.
 */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `961${digits.slice(1)}`;
  else if (digits.length <= 8) digits = `961${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
