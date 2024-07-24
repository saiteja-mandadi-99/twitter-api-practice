const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const databasePath = path.join(__dirname, 'twitterClone.db')
let database = null

const initializeDBAndServer = async () => {
  try {
    database = await open({filename: databasePath, driver: sqlite3.Database})
    app.listen(3000, () =>
      console.log('Server running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

module.exports = app
