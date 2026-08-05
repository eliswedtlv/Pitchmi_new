'use strict'

// Bump this whenever the processing disclosure changes materially. Consent is
// recorded as a metadata-only event whose action contains the version; no name,
// initials, script, transcript or media is written to the event log.
const CONSENT_VERSION = '2026-08-05'
const CONSENT_ACTION = `consent_${CONSENT_VERSION.replaceAll('-', '_')}`

module.exports = { CONSENT_VERSION, CONSENT_ACTION }
