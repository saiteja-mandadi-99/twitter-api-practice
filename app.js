const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

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

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  try {
    const api1 = `select * from user where username = '${username}'`
    const dbUser = await database.get(api1)
    if (dbUser !== undefined) {
      response.status(400)
      response.send('User already exists')
    } else if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      let hashedPassword = await bcrypt.hash(password, 10)
      const createNewUser = `INSERT INTO USER (username, password, name, gender) values('${username}','${hashedPassword}','${name}','${gender}')`
      await database.run(createNewUser)
      response.status(200)
      response.send('User created successfully')
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  try {
    const api2 = `select * from user where username = '${username}'`
    const dbUser = await database.get(api2)
    if (dbUser === undefined) {
      response.status(400)
      response.send('Invalid user')
    } else if (!(await bcrypt.compare(password, dbUser.password))) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {username: dbUser.username}
      const jwttoken = jwt.sign(payload, 'secretKey', {expiresIn: '1h'}) // Adjust secret and options as needed
      response.status(200).send({jwttoken}) // Include status code 200
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }
})

module.exports = app
