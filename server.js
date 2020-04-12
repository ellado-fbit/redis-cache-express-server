const express = require('express')
const redis = require('redis')
const mongoUtils = require('./utils/mongo_utils')
const config = require('./config.js')

const client = redis.createClient()

mongoUtils.openMongoCollection(config.mongodb_uri, config.db_name, config.col_name, config.poolSize)
  .then(col => {
    console.log('Connected to MongoDB!')
    createApp(col.collection)
  })
  .catch(error => {
    console.log('ERROR:', error.message)
    process.exit()
  })

const createApp = (collection) => {
  const app = express()

  const getUserFromMongo = (req, res) => {
    const { username } = req.params

    mongoUtils.queryMongoCollection({ username: username }, collection)
      .then(user => {
        console.log(`Searching user '${username}' in Mongo...`)

        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        // Set user data to Redis
        console.log(`Setting '${username}' data to Redis cache...`)
        client.setex(username, 20, JSON.stringify(user))  // data expires from Redis in 20 seconds!

        res.status(200).json({ extratedFrom: 'MongoDB', user: user })
      })
      .catch(error => {
        res.status(500).json({ error: error.message })
      })
  }

  const getUserFromRedisCache = (req, res, next) => {
    const { username } = req.params

    client.get(username, (err, user) => {
      if (user) {
        console.log(`Extracted user '${username}' from Redis cache.`)
        res.status(200).json({ extractedFrom: 'Redis cache', user: JSON.parse(user) })
      } else {
        next()  // user not found in chache, then it moves on to the next middleware getUserFromMongo
      }
    })
  }

  app.use('/user/:username', getUserFromRedisCache, getUserFromMongo)

  const PORT = 3000
  app.listen(PORT, () => { console.log('Server running on port', PORT) })
}
