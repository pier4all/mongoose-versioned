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
//let mongodb_uri = 'mongodb://localhost:27018/mongoose_versioned?replicaSet=rs0'

mongoose.connect(mongodb_uri, { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false})
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function() {
  console.log('Connected!')

  // create the model
  let testSchema = new Schema({
    code: { type: Number, required: true, unique: true },
    name: { type: String, required: true, unique: false }
  })
  
  // add the versioning plugin to the schema and specify 
  // the name of the shadow collection
  const name = 'test'
  testSchema.plugin(versioning, name + "s.versioning")

  // instantiate the model
  let testModel = mongoose.model(name, testSchema)
  // at this point a collection named 'tests'

  // add a new document
  // update

  // find current version
  // find previous version

  // find current version by date
  // find previous version by date

  // delete

})

```

### Using transactions
Transactions
[code snippet]
