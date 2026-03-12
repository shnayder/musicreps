// Build-time app configuration injected via esbuild --define values.

declare const __APP_CONTACT_EMAIL__: string;
declare const __APP_SUPPORT_URL__: string;
declare const __APP_TERMS_URL__: string;
declare const __APP_PRIVACY_URL__: string;

export type AppConfig = {
  contactEmail: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
};

export const APP_CONFIG: AppConfig = {
  contactEmail: __APP_CONTACT_EMAIL__,
  supportUrl: __APP_SUPPORT_URL__,
  termsUrl: __APP_TERMS_URL__,
  privacyUrl: __APP_PRIVACY_URL__,
};

