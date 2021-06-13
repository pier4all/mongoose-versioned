# Versioning Module MongoDB
Module for versioning in MongoDB, inspired by Vermongo (https://www.npmjs.com/package/mongoose-vermongo and https://github.com/thiloplanz/v7files/wiki/Vermongo).

It includes support for transactions to avoid inconsistency when performing an update or deletion since this operations involve the main and the shadow collection (see instructions below). 

This module allows to keep the change history of every document and the deleted documents. The idea is to have a "main collection" storing the current document versions and a different collection called "shadow collection" to keep all the past versions and deleted docuemnts. 

(pending) 
description of creation process
description of updating process
description of deletion process
query methods on versions by number and date

## Instructions
This package is also available as npm module at: (pending)

For development and test, please follow the instrucitons below.
### Installation
Install all the dependencies as listed in the file `package.json`.
```
npm install
```

### Basic usage
This package requires mongoose and it is added as a plugin to each individual model that will be versioned. Get familiar with mongoose before using this package (https://mongoosejs.com/docs/index.html).

```javascript
// import versioning and mongoose related dependencies
const versioning = require('./source/versioning')
const mongoose = require('mongoose')
mongoose.Promise = require('bluebird')
let Schema = mongoose.Schema

// connect to the database following mongoose instructions, for example:
let mongodb_uri = 'mongodb://localhost/test'

const versionItems = async(mongodb_uri) => {
  try {
      await mongoose.connect(mongodb_uri, { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false })
      console.log("Database.connect: DB connected ")
  } catch (err) {
      console.error(`Database.connect: MongoDB connection error. Please make sure MongoDB is running:` + err.message)
      throw new Error(err)
  }

  const db = mongoose.connection

  // create the model
  let itemSchema = new Schema({
    code: { type: Number, required: true, unique: true },
    name: { type: String, required: true, unique: false }
  })
  
  // add the versioning plugin to the schema and specify 
  // the name of the shadow collection
  const name = 'item'
  itemSchema.plugin(versioning, {collection: name + "s.versioning", mongoose})

  // instantiate the model
  let Item = mongoose.model(name, itemSchema)
  // at this point a collection named 'tests'

  // add a new document
  const newItem = {
    code: 1,
    name: "first item"
  }

  let savedItem = await new Item(newItem).save()
  console.log(`saved item with id: ${savedItem._id}, version: ${savedItem._version}`)

  let id = savedItem._id

  // update
  savedItem.name = "modified item"
  let updatedItem = await savedItem.save()
  console.log(`updated item with name: ${updatedItem.name}, version: ${updatedItem._version}`)
    
  // find current version
  let foundCurrent = await Item.findVersion(id, 2, Item)
  console.log(`found current version ${foundCurrent._version}, name = ${foundCurrent.name}`)

  // find old version
  let foundOld = await Item.findVersion(id, 1, Item)
  console.log(`found current version ${foundOld._version}, name = ${foundOld.name}`)

  await db.close()
}

versionItems(mongodb_uri)

```

### Using transactions
Transactions

Transactions can be used to ensure the database remains in a consistent state even if the operation fails. Update and delete operations involve changes in both main and shadow collections and therefore need to be wrapped in a transaction to ensure serialization. 

The transaction should be stated before calling the update/delete operation and in addition the session should be stored in a reserved "_session" inside the document and passed as an option to save/delete method.

```javascript
const versioning = require('./source/versioning')
const mongoose = require('mongoose')
mongoose.Promise = require('bluebird')

[...]

try {
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store session in the document
  document[c.SESSION] = session

  // save sending the session as option
  await document.save({session})

  // commit transaction
  await session.commitTransaction()
  session.endSession()

} catch(error) {
  if (session) session.endSession()
  const message = `Error updating document ${id} in the collection ${collection}.`
  processError(res, error, message)
}

```