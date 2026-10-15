/**
 * The UI dictionary (KP-D). English is the base text; Hebrew is a translation
 * of it. Every user-visible string of the product screens lives here, and the
 * `he` table is typed against `en`, so a missing (or extra) key fails the build.
 *
 * Script direction is NOT decided here: the teleprompter/karaoke/burn-in run
 * follows the script text (`resolveDir`), whatever the UI language is.
 */

import type { WaitStage } from "./waitStages"

export type UiLang = "en" | "he"

export const UI_LANGS: readonly UiLang[] = ["en", "he"]

const en = {
  // Shared chrome
  langToggleLabel: "Interface language",
  home: "Home",
  privateByDefault: "Private by default",
  privateShort: "Private",
  saveAcrossDevices: "Save across devices",
  saveShort: "Save",
  goBack: "Go back",
  backToHome: "Back to home",
  cancel: "Cancel",

  // Home / composer
  stepWrite: "Write the take",
  heroLine1: "Say it like",
  heroLine2: "you mean it.",
  tagline: "Your words. Your rhythm. Up to 5 minutes.",
  heroBody:
    "Paste your script and read it once on the teleprompter. KillerPitch learns your rhythm, then lights up every word as you say it.",
  factMinutes: "5 min",
  factMinutesLabel: "per take",
  factNoLogin: "No login",
  factNoLoginLabel: "anonymous session",
  factPrivacy: "Take privacy",
  factPrivacyLabel: "video not retained",
  scriptLabel: "Script",
  secMax: (s: number) => `${Math.round(s / 60)} min max`,
  scriptAria: "Your script",
  scriptPlaceholder: "Type or paste what you want to say…",
  overBy: (n: number) => `About ${n} second${n === 1 ? "" : "s"} over — trim it a little`,
  estimate: (n: number) => `~${n}s`,
  estimateNote: "Rough estimate · checked on your take",
  settingUp: "Setting up…",
  recordIt: "Record it",
  footerLimits: "Up to 5 minutes · no login",
  footerPrivacy: "Privacy & consent",

  // Consent form
  consentAria: "Recording and processing consent",
  consentTitle: "Before the camera turns on",
  consentIntro: "One acknowledgement, no account. You can delete your data whenever you want.",
  consentNameLabel: "Name or initials",
  consentNamePlaceholder: "Any name or initials",
  consentNameLocal: "This entry stays on this device and is never sent to KillerPitch.",
  consentAgreeBefore: "I agree to the",
  consentPrivacyLink: "Privacy Notice",
  consentAgreeAfter:
    "and consent to processing my script, video and audio for speech transcription that times the words to my rhythm. I am 18+ and have permission from everyone recorded.",
  consentNameMissing: "Enter your name or initials.",
  consentNotAgreed: "Confirm the consent statement to continue.",
  consentFailed: "Consent could not be recorded. Try again.",
  consentSubmitting: "Recording consent…",
  consentSubmit: "Agree & continue",

  // Karaoke / teleprompter chrome
  nextLine: "Next line",
  statusRecording: "Recording",
  statusTeleprompter: "Teleprompter",
  statusRehearsal: "Rehearsal",
  stopRecording: "Stop recording",
  prompterHint: "Follow the highlighted word — it moves at your pace",
  teleprompterHint: "Read at your own pace — tap or swipe to move ahead",

  // Wait screen
  waitStage: {
    uploading: "Uploading your take…",
    learning: "Learning your rhythm…",
    done: "Done",
    error: "Something went wrong",
  } as Record<WaitStage, string>,
  uploadStopped: "Upload stopped",
  rhythmNotUpdated: "Rhythm not updated",
  boothQuiet: "The booth went quiet.",
  processedPrivately: "Processed privately",
  stepRhythm: "Learn the rhythm",
  waitTitle1: "Your take is",
  waitTitle2: "in the booth.",
  waitBody: "We’re matching your words to the script to learn your rhythm. Your next take follows it.",
  whileYouWait: "While you wait",
  ad: "Ad",
  skipAd: "Skip Ad",
  skipIn: (s: number) => `Skip in ${s}s`,
  dailyLimit: (n: number) => `Daily limit reached (${n}/day). Come back tomorrow!`,
  busy: "We’re busy right now. Please try again in a moment.",

  // Results
  yourTake: "Your take",
  takeMax: "≤5 min",
  takeCaption: "Your take · processed privately",
  takeMaxClock: "05:00 max",
  nextTake: "Next take",
  resultsTitle: "Keep the words. Change the delivery.",
  rhythmKept: "This take didn’t match your script closely, so your rhythm stayed the same.",
  rhythmFailed: "We couldn’t read the rhythm of this take, so your rhythm stayed the same. You can still share it.",
  noteLocked: "Next take follows your locked rhythm.",
  noteNew: "Next take follows this take’s rhythm.",
  noteEarlier: "Next take follows your earlier rhythm, and updates it.",
  noteTeleprompter: "Next take is a teleprompter take again.",
  rhythmLocked: "Rhythm locked",
  unlock: "Unlock",
  keepThisRhythm: "Keep this rhythm",
  keepCurrentRhythm: "Keep current rhythm",
  tryAgain: "Try again",
  editText: "Edit text",
  newVideo: "New video",
  share: "Share",
  shareVideo: "Share video",
  preparing: (pct: number) => `Preparing ${pct}%`,
  shareTitle: "My KillerPitch take",

  // Video player
  play: "Play",
  pause: "Pause",
  seek: "Seek",
  mute: "Mute",
  unmute: "Unmute",

  // Saved videos (also the save-to-cloud feedback strings)
  privateLibrary: "Private library",
  myVideosTitle: "My Videos",
  myVideos: "My videos",
  savedToast: "Saved to your videos",
  savedButton: "Saved ✓",
  videosIntro:
    "Only takes you explicitly save appear here. KillerPitch never stores a rehearsal automatically.",
  closePlayer: "Close player",
  loadingVideos: "Loading your videos…",
  noTakesTitle: "No saved takes yet.",
  noTakesBody:
    "Rehearsals stay on your device. When cloud saving returns to the main flow, only the takes you choose will appear here.",
  recordFirst: "Record your first take",
  deleteTake: "Delete take",
  seconds: (s: string) => `${s}s`,

  // Account
  accountKicker: "Account · optional",
  accountTitle: "Start private. Stay connected.",
  accountBody:
    "KillerPitch works without a login. Connect Google only if you want the same private identity and projects on another device.",
  sameUserId: "Same user ID",
  sameUserIdBody: "Current work stays attached.",
  noExtraAccess: "No extra access",
  noExtraAccessBody: "No Drive or contacts permission.",
  accountFooterBefore: "Account connection is optional. Read the",
  accountFooterLink: "privacy notice",
  accountFooterAfter: "or keep using KillerPitch anonymously.",
  loadingAccount: "Loading account",
  sessionUnreadable: "Your KillerPitch session could not be read.",
  sessionUnavailable: "Session unavailable",
  refreshTryAgain: "Refresh and try again.",
  googleAccount: "Google account",
  savedIdentity: "Saved identity",
  studioTravels: "This studio travels with you.",
  connectedAs: "Connected as",
  connectedAsAfter:
    ". Sign in with the same account on another device to reopen your KillerPitch data.",
  signingOut: "Signing out…",
  signOut: "Sign out on this device",
  optionalUpgrade: "Optional upgrade",
  sameStudio: "Keep the same studio on every device.",
  upgradeBody:
    "Connect Google to turn this temporary identity into one you can return to. Your current projects and consent stay attached to the same KillerPitch identity.",
  openingGoogle: "Opening Google…",
  saveWithGoogle: "Save with Google",
  switchTitle: "Switch to an existing studio?",
  switchBody:
    "Signing in replaces this browser's temporary session. Work attached only to that temporary identity stays separate and will not move automatically.",
  opening: "Opening…",
  switchAndSignIn: "Switch and sign in",
  signInInstead: "Already connected? Sign in instead",
  upgradeFailed: "Google could not be connected. Try again.",
  signInFailed: "Google sign-in could not start. Try again.",
  signOutFailed: "This device could not be signed out. Try again.",

  // Auth completion
  securing: "Securing your studio…",
  confirming: "Confirming the identity connection.",
  studioSaved: "Your studio is saved.",
  studioSavedBody: "Use the same Google account to reopen this KillerPitch identity on another device.",
  continueToApp: "Continue to KillerPitch",
  alreadyConnected: "That account is already connected.",
  alreadyConnectedBody: "Return to Account and choose “Sign in instead” to open the existing studio.",
  returnToAccount: "Return to Account",
  googleFailed: "Google could not be connected.",
  googleFailedBody: "No KillerPitch data was changed. Return to Account and try again.",

  // Delete my data
  deletedTitle: "Your KillerPitch data was deleted.",
  deletedBody: "This browser has also been signed out of its KillerPitch session.",
  returnHome: "Return home",
  deleteTitle: "Delete my data",
  deleteBody:
    "This permanently removes this browser's scripts, projects, saved takes, metadata and KillerPitch account.",
  deleteConfirm: "This cannot be undone. Delete everything tied to this browser?",
  deleting: "Deleting…",
  deletePermanently: "Delete permanently",
  keepMyData: "Keep my data",
  deleteMyData: "Delete my KillerPitch data",
  deleteFailed: "Your data could not be deleted. Try again.",

  // Privacy page
  privacyKicker: "Privacy notice · October 15, 2026",
  privacyTitle: "Your take is yours.",
  privacyIntro:
    "KillerPitch has no public profile and no required login. A private, anonymous identity in this browser keeps your rehearsal working.",
  privacyProcessTitle: "What we process",
  privacyProcess: [
    "Your script is stored in a private project tied to this browser's anonymous identity.",
    "Your recording's audio is sent securely to a U.S.-based service provider for speech transcription, which times the words of your script to your rhythm. Nothing scores or analyses your video.",
    "KillerPitch keeps numeric timing/cost diagnostics and a versioned consent receipt. The receipt contains no typed name, script, transcript, video or audio.",
    "If you explicitly choose to save a take, that recording is stored privately for this anonymous identity until you delete it or erase all data below.",
  ] as readonly string[],
  privacyKeepTitle: "What we do not keep",
  privacyKeep:
    "In the normal rehearsal flow, KillerPitch does not write your raw take to cloud storage unless you explicitly save it. Otherwise, video and temporary audio files are discarded after the request. Third-party processing is also governed by each provider's terms and the retention settings configured for those services.",
  privacyConsentTitle: "Consent and control",
  privacyConsent:
    "Before the first recording, you provide a name or initials and explicitly agree to camera, microphone and transcription processing. That typed acknowledgement remains only on this device; the server records the anonymous consent version and timestamp. A material change to this notice requires consent again.",
  privacyAccountTitle: "Optional account connection",
  privacyAccount:
    "You can connect Google to reopen the same private KillerPitch identity on another device. KillerPitch receives basic account information such as your name and email for authentication. It never receives your Google password and does not request access to Drive, contacts or other Google services.",

  // Errors (shown in place of the English message from a lib/hook/server)
  errGeneric: "Something went wrong. Try again.",
  errCameraDenied: "Camera access denied. Please allow camera and microphone access.",
  errRecordingUnsupported: "Recording isn't supported on this browser. Please try Chrome or Safari.",
  errUploadTimeout: "Upload timed out",
  errNetwork: "Network error",
  errSupabase: "Supabase is not configured.",
  errUnsafeGoogle: "Google returned an unsafe authentication address.",
  errGoogleSaveDisabled: "Google saving is not enabled yet.",
  errSessionStart: "A private KillerPitch session could not be started. Try again.",
  errGoogleSignInDisabled: "Google sign-in is not enabled yet.",
  errGoogleUnavailable: "Google sign-in is unavailable. Try again.",
}

export type UiStrings = typeof en

const he: UiStrings = {
  langToggleLabel: "שפת הממשק",
  home: "בית",
  privateByDefault: "פרטי כברירת מחדל",
  privateShort: "פרטי",
  saveAcrossDevices: "שמירה בין מכשירים",
  saveShort: "שמירה",
  goBack: "חזרה",
  backToHome: "חזרה לדף הבית",
  cancel: "ביטול",

  stepWrite: "כתבו את הטייק",
  heroLine1: "תגידו את זה",
  heroLine2: "כמו שאתם מתכוונים.",
  tagline: "המילים שלכם. הקצב שלכם. עד 5 דקות.",
  heroBody:
    "הדביקו את הטקסט וקראו אותו פעם אחת בטלפרומפטר. KillerPitch לומדת את הקצב שלכם, ואז מאירה כל מילה ברגע שאתם אומרים אותה.",
  factMinutes: "5 דק׳",
  factMinutesLabel: "לכל טייק",
  factNoLogin: "בלי התחברות",
  factNoLoginLabel: "סשן אנונימי",
  factPrivacy: "פרטיות הטייק",
  factPrivacyLabel: "הסרטון לא נשמר",
  scriptLabel: "טקסט",
  secMax: (s) => `עד ${Math.round(s / 60)} דק׳`,
  scriptAria: "הטקסט שלכם",
  scriptPlaceholder: "הקלידו או הדביקו את מה שאתם רוצים להגיד…",
  overBy: (n) => (n === 1 ? "שנייה אחת יותר מדי — קצרו קצת" : `${n} שניות יותר מדי — קצרו קצת`),
  estimate: (n) => `~${n} שנ׳`,
  estimateNote: "הערכה גסה · נבדק בטייק",
  settingUp: "מכינים…",
  recordIt: "להקלטה",
  footerLimits: "עד 5 דקות · בלי התחברות",
  footerPrivacy: "פרטיות והסכמה",

  consentAria: "הסכמה להקלטה ולעיבוד",
  consentTitle: "לפני שהמצלמה נדלקת",
  consentIntro: "אישור אחד, בלי חשבון. אפשר למחוק את המידע שלכם בכל רגע.",
  consentNameLabel: "שם או ראשי תיבות",
  consentNamePlaceholder: "כל שם או ראשי תיבות",
  consentNameLocal: "מה שתכתבו כאן נשאר במכשיר הזה ולא נשלח ל-KillerPitch.",
  consentAgreeBefore: "אני מסכים/ה ל",
  consentPrivacyLink: "הודעת הפרטיות",
  consentAgreeAfter:
    "ונותן/ת הסכמה לעיבוד הטקסט, הווידאו והאודיו שלי לתמלול דיבור שמתזמן את המילים לקצב שלי. אני בן/בת 18 ומעלה ויש לי רשות מכל מי שמופיע בהקלטה.",
  consentNameMissing: "כתבו שם או ראשי תיבות.",
  consentNotAgreed: "אשרו את הצהרת ההסכמה כדי להמשיך.",
  consentFailed: "לא הצלחנו לרשום את ההסכמה. נסו שוב.",
  consentSubmitting: "רושמים הסכמה…",
  consentSubmit: "מסכים/ה וממשיכים",

  nextLine: "השורה הבאה",
  statusRecording: "מקליטים",
  statusTeleprompter: "טלפרומפטר",
  statusRehearsal: "חזרה",
  stopRecording: "עצירת ההקלטה",
  prompterHint: "עקבו אחרי המילה המודגשת — היא נעה בקצב שלכם",
  teleprompterHint: "קראו בקצב שלכם — הקישו או החליקו כדי להתקדם",

  waitStage: {
    uploading: "מעלים את הטייק…",
    learning: "לומדים את הקצב שלכם…",
    done: "סיום",
    error: "משהו השתבש",
  },
  uploadStopped: "ההעלאה נעצרה",
  rhythmNotUpdated: "הקצב לא עודכן",
  boothQuiet: "האולפן השתתק.",
  processedPrivately: "מעובד באופן פרטי",
  stepRhythm: "לומדים את הקצב",
  waitTitle1: "הטייק שלכם",
  waitTitle2: "באולפן.",
  waitBody: "אנחנו מתאימים את המילים שלכם לטקסט כדי ללמוד את הקצב. הטייק הבא ילך לפיו.",
  whileYouWait: "בזמן שמחכים",
  ad: "פרסומת",
  skipAd: "דילוג",
  skipIn: (s) => `דילוג בעוד ${s} שנ׳`,
  dailyLimit: (n) => `הגעתם למגבלה היומית (${n} ביום). נתראה מחר!`,
  busy: "יש עומס כרגע. נסו שוב עוד רגע.",

  yourTake: "הטייק שלכם",
  takeMax: "עד 5 דק׳",
  takeCaption: "הטייק שלכם · מעובד באופן פרטי",
  takeMaxClock: "עד 05:00",
  nextTake: "הטייק הבא",
  resultsTitle: "אותן מילים. הגשה אחרת.",
  rhythmKept: "הטייק הזה לא היה מספיק קרוב לטקסט, אז הקצב שלכם נשאר כמו שהיה.",
  rhythmFailed: "לא הצלחנו לקרוא את הקצב של הטייק הזה, אז הקצב שלכם נשאר כמו שהיה. אפשר עדיין לשתף אותו.",
  noteLocked: "הטייק הבא ילך לפי הקצב הנעול שלכם.",
  noteNew: "הטייק הבא ילך לפי הקצב של הטייק הזה.",
  noteEarlier: "הטייק הבא ילך לפי הקצב הקודם שלכם, ויעדכן אותו.",
  noteTeleprompter: "הטייק הבא יהיה שוב טייק טלפרומפטר.",
  rhythmLocked: "הקצב נעול",
  unlock: "שחרור",
  keepThisRhythm: "לשמור את הקצב הזה",
  keepCurrentRhythm: "לשמור את הקצב הנוכחי",
  tryAgain: "עוד טייק",
  editText: "עריכת טקסט",
  newVideo: "סרטון חדש",
  share: "שיתוף",
  shareVideo: "שיתוף הסרטון",
  preparing: (pct) => `מכינים ${pct}%`,
  shareTitle: "הטייק שלי ב-KillerPitch",

  play: "הפעלה",
  pause: "השהיה",
  seek: "דילוג בסרטון",
  mute: "השתקה",
  unmute: "ביטול השתקה",

  privateLibrary: "ספרייה פרטית",
  myVideosTitle: "הסרטונים שלי",
  myVideos: "הסרטונים שלי",
  savedToast: "נשמר לסרטונים שלכם",
  savedButton: "נשמר ✓",
  videosIntro: "כאן מופיעים רק טייקים ששמרתם במפורש. KillerPitch אף פעם לא שומרת חזרה באופן אוטומטי.",
  closePlayer: "סגירת הנגן",
  loadingVideos: "טוענים את הסרטונים שלכם…",
  noTakesTitle: "עדיין אין טייקים שמורים.",
  noTakesBody:
    "החזרות נשארות במכשיר שלכם. כששמירה בענן תחזור, רק הטייקים שתבחרו יופיעו כאן.",
  recordFirst: "הקליטו את הטייק הראשון",
  deleteTake: "מחיקת הטייק",
  seconds: (s) => `${s} שנ׳`,

  accountKicker: "חשבון · לא חובה",
  accountTitle: "מתחילים פרטי. נשארים מחוברים.",
  accountBody:
    "KillerPitch עובדת בלי התחברות. חברו את Google רק אם אתם רוצים את אותה זהות פרטית ואת אותם פרויקטים גם במכשיר אחר.",
  sameUserId: "אותו מזהה משתמש",
  sameUserIdBody: "העבודה הנוכחית נשארת מחוברת.",
  noExtraAccess: "בלי הרשאות נוספות",
  noExtraAccessBody: "בלי גישה ל-Drive או לאנשי קשר.",
  accountFooterBefore: "חיבור חשבון הוא לא חובה. קראו את",
  accountFooterLink: "הודעת הפרטיות",
  accountFooterAfter: "או המשיכו להשתמש ב-KillerPitch באופן אנונימי.",
  loadingAccount: "טוענים את החשבון",
  sessionUnreadable: "לא הצלחנו לקרוא את הסשן שלכם ב-KillerPitch.",
  sessionUnavailable: "הסשן לא זמין",
  refreshTryAgain: "רעננו את הדף ונסו שוב.",
  googleAccount: "חשבון Google",
  savedIdentity: "זהות שמורה",
  studioTravels: "האולפן הזה הולך איתכם.",
  connectedAs: "מחוברים בתור",
  connectedAsAfter: ". התחברו עם אותו חשבון במכשיר אחר כדי לפתוח שוב את המידע שלכם ב-KillerPitch.",
  signingOut: "מתנתקים…",
  signOut: "התנתקות במכשיר הזה",
  optionalUpgrade: "שדרוג לא חובה",
  sameStudio: "אותו אולפן בכל מכשיר.",
  upgradeBody:
    "חברו את Google כדי להפוך את הזהות הזמנית הזו לזהות שאפשר לחזור אליה. הפרויקטים וההסכמה הנוכחיים נשארים מחוברים לאותה זהות ב-KillerPitch.",
  openingGoogle: "פותחים את Google…",
  saveWithGoogle: "שמירה עם Google",
  switchTitle: "לעבור לאולפן קיים?",
  switchBody:
    "התחברות מחליפה את הסשן הזמני של הדפדפן הזה. עבודה שמחוברת רק לזהות הזמנית נשארת נפרדת ולא תעבור אוטומטית.",
  opening: "פותחים…",
  switchAndSignIn: "לעבור ולהתחבר",
  signInInstead: "כבר מחוברים? התחברו במקום זה",
  upgradeFailed: "לא הצלחנו לחבר את Google. נסו שוב.",
  signInFailed: "לא הצלחנו להתחיל התחברות עם Google. נסו שוב.",
  signOutFailed: "לא הצלחנו לנתק את המכשיר הזה. נסו שוב.",

  securing: "מאבטחים את האולפן שלכם…",
  confirming: "מאשרים את חיבור הזהות.",
  studioSaved: "האולפן שלכם נשמר.",
  studioSavedBody: "השתמשו באותו חשבון Google כדי לפתוח את הזהות הזו ב-KillerPitch במכשיר אחר.",
  continueToApp: "המשך ל-KillerPitch",
  alreadyConnected: "החשבון הזה כבר מחובר.",
  alreadyConnectedBody: "חזרו לחשבון ובחרו ״התחברו במקום זה״ כדי לפתוח את האולפן הקיים.",
  returnToAccount: "חזרה לחשבון",
  googleFailed: "לא הצלחנו לחבר את Google.",
  googleFailedBody: "שום מידע ב-KillerPitch לא השתנה. חזרו לחשבון ונסו שוב.",

  deletedTitle: "המידע שלכם ב-KillerPitch נמחק.",
  deletedBody: "הדפדפן הזה גם נותק מהסשן שלו ב-KillerPitch.",
  returnHome: "חזרה לדף הבית",
  deleteTitle: "מחיקת המידע שלי",
  deleteBody:
    "הפעולה מוחקת לצמיתות את הטקסטים, הפרויקטים, הטייקים השמורים, המטא־דאטה וחשבון ה-KillerPitch של הדפדפן הזה.",
  deleteConfirm: "אי אפשר לבטל את זה. למחוק את כל מה שקשור לדפדפן הזה?",
  deleting: "מוחקים…",
  deletePermanently: "מחיקה לצמיתות",
  keepMyData: "לשמור את המידע",
  deleteMyData: "מחיקת המידע שלי ב-KillerPitch",
  deleteFailed: "לא הצלחנו למחוק את המידע. נסו שוב.",

  privacyKicker: "הודעת פרטיות · 15 באוקטובר 2026",
  privacyTitle: "הטייק שלכם שייך לכם.",
  privacyIntro:
    "ל-KillerPitch אין פרופיל ציבורי ואין חובת התחברות. זהות פרטית ואנונימית בדפדפן הזה היא מה שמאפשר לחזרה שלכם לעבוד.",
  privacyProcessTitle: "מה אנחנו מעבדים",
  privacyProcess: [
    "הטקסט שלכם נשמר בפרויקט פרטי שקשור לזהות האנונימית של הדפדפן הזה.",
    "האודיו של ההקלטה נשלח בצורה מאובטחת לספק שירות בארה״ב לצורך תמלול דיבור, שמתזמן את המילים של הטקסט לקצב שלכם. שום דבר לא מדרג או מנתח את הווידאו שלכם.",
    "KillerPitch שומרת נתוני אבחון מספריים של תזמון ועלויות ואישור הסכמה עם מספר גרסה. האישור לא כולל את השם שהקלדתם, טקסט, תמלול, וידאו או אודיו.",
    "אם תבחרו במפורש לשמור טייק, ההקלטה הזו נשמרת באופן פרטי עבור הזהות האנונימית הזו, עד שתמחקו אותה או את כל המידע למטה.",
  ],
  privacyKeepTitle: "מה אנחנו לא שומרים",
  privacyKeep:
    "בתהליך החזרה הרגיל, KillerPitch לא כותבת את הטייק הגולמי שלכם לאחסון בענן, אלא אם שמרתם אותו במפורש. אחרת, קובצי הווידאו והאודיו הזמניים נמחקים בסוף הבקשה. העיבוד אצל צדדים שלישיים כפוף גם לתנאים של כל ספק ולהגדרות שמירת המידע שהוגדרו לשירותים האלה.",
  privacyConsentTitle: "הסכמה ושליטה",
  privacyConsent:
    "לפני ההקלטה הראשונה אתם כותבים שם או ראשי תיבות ומסכימים במפורש להפעלת מצלמה ומיקרופון ולעיבוד התמלול. האישור שהקלדתם נשאר רק במכשיר הזה; השרת רושם את גרסת ההסכמה האנונימית ואת מועד ההסכמה. שינוי מהותי בהודעה הזו יחייב הסכמה מחדש.",
  privacyAccountTitle: "חיבור חשבון (לא חובה)",
  privacyAccount:
    "אפשר לחבר את Google כדי לפתוח את אותה זהות פרטית ב-KillerPitch במכשיר אחר. KillerPitch מקבלת פרטי חשבון בסיסיים כמו שם וכתובת אימייל לצורך אימות. היא אף פעם לא מקבלת את הסיסמה שלכם ל-Google ולא מבקשת גישה ל-Drive, לאנשי קשר או לשירותי Google אחרים.",

  errGeneric: "משהו השתבש. נסו שוב.",
  errCameraDenied: "אין גישה למצלמה. אפשרו גישה למצלמה ולמיקרופון.",
  errRecordingUnsupported: "הדפדפן הזה לא תומך בהקלטה. נסו Chrome או Safari.",
  errUploadTimeout: "ההעלאה לקחה יותר מדי זמן",
  errNetwork: "שגיאת רשת",
  errSupabase: "השירות לא מוגדר.",
  errUnsafeGoogle: "Google החזירה כתובת אימות לא בטוחה.",
  errGoogleSaveDisabled: "שמירה עם Google עוד לא זמינה.",
  errSessionStart: "לא הצלחנו לפתוח סשן פרטי ב-KillerPitch. נסו שוב.",
  errGoogleSignInDisabled: "התחברות עם Google עוד לא זמינה.",
  errGoogleUnavailable: "התחברות עם Google לא זמינה כרגע. נסו שוב.",
}

export const DICTIONARIES: Record<UiLang, UiStrings> = { en, he }

export function strings(lang: UiLang): UiStrings {
  return DICTIONARIES[lang] ?? en
}

/** Coerce any language code (e.g. the server's Scribe code) to a UI language. */
export function toUiLang(lang?: string | null): UiLang {
  return lang?.toLowerCase().startsWith("he") ? "he" : "en"
}

/** Wait-stage label for a language code; English for anything but Hebrew. */
export function waitStageLabel(stage: WaitStage, lang?: string | null): string {
  return strings(toUiLang(lang)).waitStage[stage]
}

// English messages thrown by libs/hooks, mapped to their dictionary key.
const KNOWN_ERRORS: Partial<Record<string, keyof UiStrings>> = {}
for (const key of Object.keys(en) as (keyof UiStrings)[]) {
  const value = en[key]
  if (typeof value === "string" && (key.startsWith("err") || key === "consentNameMissing")) {
    KNOWN_ERRORS[value] = key
  }
}

/**
 * The user-facing text for an error, in the UI language. Prefers the server's
 * own localized `{ en, he }` message, then a known message from the dictionary.
 * An unknown English message is kept in English, but shown as a generic line in
 * Hebrew rather than mixing an English sentence into the Hebrew UI.
 */
export function errorText(error: unknown, lang: UiLang, fallback?: string): string {
  const t = strings(lang)
  const e = error as { message?: unknown; body?: { message?: unknown } } | string | null | undefined
  const message = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : ""
  const localized = typeof e === "object" && e ? e.body?.message : undefined
  if (localized && typeof localized === "object") {
    const pick = (localized as Partial<Record<UiLang, unknown>>)[lang]
    if (typeof pick === "string") return pick
  }
  const key = message ? KNOWN_ERRORS[message] : undefined
  if (key) return t[key] as string
  if (lang === "en" && message) return message
  return fallback ?? t.errGeneric
}
