// Constants shared between mobile and (future) web.

export const APP_NAME = "Agile"; // TODO: replace with final brand name before App Store / Play Store submission
export const BUNDLE_ID_IOS = "com.agile.woundcare";
export const PACKAGE_NAME_ANDROID = "com.agile.woundcare";

export const PHOTO_BUCKET = "wound-photos";
export const SIGNED_URL_EXPIRY_SECONDS = 60;

export const CONFIDENCE_THRESHOLDS = {
    green: 0.8,
    yellow: 0.5,
    red: 0,
} as const;

export const SYNC_RETENTION_DAYS = 30;
export const SYNC_MIN_VISITS_PER_ACTIVE_WOUND = 5;

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const BIOMETRIC_REPROMPT_AFTER_BACKGROUND_MS = 5 * 60 * 1000;
