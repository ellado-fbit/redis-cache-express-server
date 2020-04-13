const MongoClient = require('mongodb').MongoClient

const openMongoCollection = (mongodb_uri, db_name, col_name, poolSize) => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(mongodb_uri, { useNewUrlParser: true, useUnifiedTopology: true, poolSize }, (err, client) => {
      if (!err) {
        const db = client.db(db_name)
        db.collection(col_name, (err, collection) => {
          if (!err) {
            resolve({
              mongodb_uri,
              db_name,
              col_name,
              collection
            })
          } else {
            reject(err)
          }
        })
      } else {
        reject(err)
      }
    })
  })
}

const queryMongoCollection = (query, mongo_col) => {
  return new Promise((resolve, reject) => {
    mongo_col.findOne(query, (err, item) => {
      if (!err) {
        resolve(item)
      } else {
        reject(err)
      }
    })
  })
}

module.exports = {
  openMongoCollection,
  queryMongoCollection
}
