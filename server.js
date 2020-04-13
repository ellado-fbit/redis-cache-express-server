const express = require('express')
const redis = require('redis')
const mongoUtils = require('./utils/mongo_utils')
const config = require('./config.js')

// By default, Redis has 16 databases fixed by configuration. Each database is identified by an index in the range [0-15].
// Useful redis-cli commands:
//   'info keyspace' to list the databases for which some keys are defined.
//   'select <index>' to change the current database.
//   'config get databases' to know the number of databases.

const REDIS_DB_INDEX = 0  // allowed values: [0-15]

const client = redis.createClient({ db: REDIS_DB_INDEX })

const { mongodb_uri, db_name, col_name, poolSize} = config

mongoUtils.openMongoCollection(mongodb_uri, db_name, col_name, poolSize)
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

    mongoUtils.queryMongoCollection({ username }, collection)
      .then(user => {
        console.log(`Searching user '${username}' in Mongo...`)

        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        // Set user data to Redis
        console.log(`Setting '${username}' data to Redis cache...`)
        client.setex(username, 60, JSON.stringify(user))  // data expires from Redis in 60 seconds!

        res.status(200).json({ extratedFrom: 'MongoDB', user })
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
        res.status(200).json({ extractedFrom: `Redis cache (db index: ${REDIS_DB_INDEX})`, user: JSON.parse(user) })
      } else {
        next()  // user not found in chache, then it moves on to the next middleware getUserFromMongo
      }
    })
  }

  app.use('/user/:username', getUserFromRedisCache, getUserFromMongo)

  const PORT = 3000
  app.listen(PORT, () => { console.log('Server running on port', PORT) })
}
