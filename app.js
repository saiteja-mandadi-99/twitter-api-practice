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

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) return res.status(401).send('Invalid JWT Token')

  jwt.verify(token, 'secretKey', (err, user) => {
    if (err) {
      return res.status(401).send('Invalid JWT Token')
    } else {
      req.user = user
      next()
    }
  })
}

const convertTweetObjToResponseObj = dbObject => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.dateTime,
  }
}

const convertNameToResponseObj = dbObject => {
  return {
    name: dbObject.name,
  }
}

const convertTweetToResponseObj = dbObject => {
  return {
    tweet: dbObject.tweet,
  }
}

// API 1: Register
app.post('/register/', async (req, res) => {
  const {username, password, name, gender} = req.body
  try {
    const query = `SELECT * FROM user WHERE username = ?`
    const dbUser = await database.get(query, [username])

    if (dbUser) {
      res.status(400).send('User already exists')
    } else if (password.length < 6) {
      res.status(400).send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const createNewUser = `INSERT INTO user (username, password, name, gender) VALUES (?, ?, ?, ?)`
      await database.run(createNewUser, [
        username,
        hashedPassword,
        name,
        gender,
      ])
      res.status(200).send('User created successfully')
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
    res.status(500).send('Internal Server Error')
  }
})

// API 2: Login
app.post('/login/', async (req, res) => {
  const {username, password} = req.body
  try {
    const query = `SELECT * FROM user WHERE username = ?`
    const dbUser = await database.get(query, [username])

    if (!dbUser) {
      res.status(400).send('Invalid user')
    } else if (!(await bcrypt.compare(password, dbUser.password))) {
      res.status(400).send('Invalid password')
    } else {
      const payload = {username: dbUser.username}
      const JWTToken = jwt.sign(payload, 'secretKey', {expiresIn: '1h'})
      res.status(200).send({JWTToken})
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
    res.status(500).send('Internal Server Error')
  }
})

// API 3: Returns the latest tweets of people whom the user follows. Return 4 tweets at a time
app.get('/user/tweets/feed/', authenticateToken, async (req, res) => {
  const {username} = req.user
  try {
    // Retrieve the user_id of the authenticated user
    const userQuery = `SELECT user_id FROM user WHERE username = ?`
    const user = await database.get(userQuery, [username])
    const userId = user.user_id

    // Fetch the latest 4 tweets from people the user follows
    const query = `
      SELECT u.username, t.tweet, t.date_time AS dateTime
      FROM tweet t
      JOIN user u ON t.user_id = u.user_id
      JOIN follower f ON t.user_id = f.following_user_id
      WHERE f.follower_user_id = ${userId}
      ORDER BY t.date_time DESC
      LIMIT 4
    `
    const tweets = await database.all(query)

    // Send the response
    res.status(200).send(tweets.map(convertTweetObjToResponseObj))
  } catch (e) {
    console.log(`Error: ${e.message}`)
    res.status(500).send('Internal Server Error')
  }
})

//API4:all names of people whom the user follows
app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username} = request.user
  try {
    const getUser = `select user_id from user where username = '${username}'`
    const user = await database.get(getUser)
    const userId = user.user_id
    const getQuery = `select name from follower join user on follower.following_user_id = user.user_id where follower.follower_user_id = ${userId}`
    const ans = await database.all(getQuery)
    response.send(ans.map(eachName => convertNameToResponseObj(eachName)))
  } catch (err) {
    console.log(`Internal Error : ${err.message}`)
    response.status(500).send(`Internal Error:${err.message}`)
  }
})

//API 5 :  all names of people who follows the user
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username} = request.user
  try {
    const getUser = `select user_id from user where username = '${username}'`
    const user = await database.get(getUser)
    const userId = user.user_id
    const getQuery = `select name from follower join user on follower.follower_user_id = user.user_id where follower.following_user_id = ${userId}`
    const ans = await database.all(getQuery)
    response.send(ans.map(eachName => convertNameToResponseObj(eachName)))
  } catch (err) {
    console.log(`Internal Error : ${err.message}`)
    response.status(500).send(`Internal Error:${err.message}`)
  }
})
//API6 : /tweets/:tweetId/

//API9:  list of all tweets of the user
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request.user
  try {
    const getUser = `select user_id from user where username = '${username}'`
    const user = await database.get(getUser)
    const userId = user.user_id
    const getQuery = `select tweet from tweet join user on tweet.user_id = user.user_id where user.user_id =  ${userId}`
    const ans = await database.all(getQuery)
    response.send(ans.map(eachTweet => convertTweetToResponseObj(eachTweet)))
  } catch (err) {
    console.log(`Internal Error : ${err.message}`)
    response.status(500).send(`Internal Error:${err.message}`)
  }
})

//API10: Create a tweet in the tweet table
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body
  const {username} = request.user
  try {
    const getUser = `select user_id from user where username = '${username}'`
    const user = await database.get(getUser)
    const userId = user.user_id
    const insertQuery = `insert into tweet(tweet, user_id, date_time) values('${tweet}', ${userId}, datetime('now')) `
    await database.run(insertQuery)
    response.send('Created a Tweet')
  } catch (err) {
    console.log(`Internal Error : ${err.message}`)
    response.status(500).send(`Internal Error:${err.message}`)
  }
})
module.exports = app
