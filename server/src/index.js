'use strict'

const createApp = require('./app')
const config = require('./config')

// Fail fast on the secrets that gate the admin panel (T-10010). An empty
// ADMIN_COOKIE_SECRET used to fall back to a constant published in this repo,
// which made the admin cookie forgeable by anyone; an empty ADMIN_PASSWORD
// would leave the login comparing against ''. Booting broken is worse than not
// booting. Tests build the app directly and set their own values.
if (process.env.NODE_ENV !== 'test') {
  const missing = ['ADMIN_COOKIE_SECRET', 'ADMIN_PASSWORD'].filter(k => !config[k])
  if (missing.length) {
    throw new Error(`Refusing to start: ${missing.join(' and ')} must be set (see server/.env.example).`)
  }
  // Not fatal — local dev boots without it — but CORS is closed when it is
  // empty, so an unset value on Railway means the client cannot call the API.
  if (!config.CLIENT_ORIGIN) {
    console.warn('WARNING: CLIENT_ORIGIN is empty — cross-origin browser requests are refused.')
  }
}

const app = createApp()
app.listen(config.PORT, () => {
  console.log(`PitchMi API listening on :${config.PORT}`)
})
