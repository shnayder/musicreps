// Build-time app configuration injected via esbuild --define values.

declare const __APP_CONTACT_EMAIL__: string;
declare const __APP_SUPPORT_URL__: string;
declare const __APP_TERMS_URL__: string;
declare const __APP_PRIVACY_URL__: string;

/** Only allow http/https URLs; reject javascript:, data:, etc. */
function safeUrl(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? raw : '';
  } catch {
    return '';
  }
}

export type AppConfig = {
  contactEmail: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
};

export const APP_CONFIG: AppConfig = {
  contactEmail: __APP_CONTACT_EMAIL__,
  supportUrl: safeUrl(__APP_SUPPORT_URL__),
  termsUrl: safeUrl(__APP_TERMS_URL__),
  privacyUrl: safeUrl(__APP_PRIVACY_URL__),
};
