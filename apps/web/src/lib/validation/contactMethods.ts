/**
 * Deliberately lenient phone validation: accepts Israeli local formats
 * (050-1234567, 02-5551234) and international formats (+972501234567,
 * +1 415 555 0132) alike. The goal is to catch obvious typos (letters,
 * far too short/long) without rejecting a legitimate number just because
 * it does not match one specific country's convention.
 */
const PHONE_PATTERN = /^\+?[0-9][0-9\-\s()]{5,19}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'יש להזין מספר טלפון.';
  }
  if (!PHONE_PATTERN.test(trimmed)) {
    return 'מספר הטלפון אינו תקין - יש להזין ספרות בלבד (עם אפשרות ל-+, רווחים ומקפים).';
  }
  return null;
}

export function validateEmailAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'יש להזין כתובת דוא"ל.';
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'כתובת הדוא"ל אינה תקינה.';
  }
  return null;
}

/** Whether every active phone draft has a valid number - used to block form submission without needing to lift per-row error state up to the parent form. */
export function arePhoneDraftsValid(phones: Array<{ number: string; status: 'active' | 'inactive' }>): boolean {
  return phones.filter((phone) => phone.status === 'active').every((phone) => validatePhoneNumber(phone.number) === null);
}

export function areEmailDraftsValid(emails: Array<{ address: string; status: 'active' | 'inactive' }>): boolean {
  return emails.filter((email) => email.status === 'active').every((email) => validateEmailAddress(email.address) === null);
}
