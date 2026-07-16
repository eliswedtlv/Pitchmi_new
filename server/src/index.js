'use strict'

const createApp = require('./app')
const config = require('./config')

const app = createApp()
app.listen(config.PORT, () => {
  console.log(`PitchMi API listening on :${config.PORT}`)
})
