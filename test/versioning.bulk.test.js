const chalk = require('chalk')

const versioning = require('../source/versioning')
const constants = require('../source/constants')
const { fromJS } = require('immutable')

const mongoose = require('mongoose')
let Schema = mongoose.Schema

// start in memory server
const { MongoMemoryReplSet } = require( 'mongodb-memory-server' )

// test versioning.js
const tap = require('tap')

// global variable to store the mongo server
let mongoServer
let Mock

// test data
const mockOne = {
  _id: new mongoose.Types.ObjectId(),
  data: "first mock test",
  number: 1
}
const mockTwo = {
  _id: new mongoose.Types.ObjectId(),
  data: "second mock test",
  number: 2
}
const mockThree = {
  _id: new mongoose.Types.ObjectId(),
  data: "third mock test",
  number: 3
}
const mockFour = {
  _id: new mongoose.Types.ObjectId(),
  data: "fourth mock test",
  number: 4
}
const mockFive = {
  _id: new mongoose.Types.ObjectId(),
  data: "fifth mock test",
  number: 5
}
const mockSix = {
  _id: new mongoose.Types.ObjectId(),
  data: "sixth mock test",
  number: 6
}

const mockSeven = {
  _id: new mongoose.Types.ObjectId(),
  data: "seventh mock test",
  number: 7
}

const mockEight = {
  _id: new mongoose.Types.ObjectId(),
  data: "eighth mock test",
  number: 8
}


tap.before(async function() {

  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 3} })

  let mongoUri = mongoServer.getUri()

  const mongooseOpts = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    retryWrites: false
  }

  await mongoose.connect(mongoUri, mongooseOpts)

  console.log(chalk.bold.green(`MongoDB successfully connected to ${mongoUri}`))

  // test schema definition
  const NAME = "test"
  let testSchema = new Schema({
    data : { type: String, required: false, unique: false },
    number : { type: Number, required: false, unique: false },
  }, { autoIndex: false })
  testSchema.plugin(versioning, { options: NAME + "s.versioning", ensureIndex: true})
  Mock = mongoose.model(NAME, testSchema)

  await Mock.insertMany([mockFive, mockSix, mockSeven])

})

// test versioning CRUD
tap.test('bulk insert objects', async (childTest) => {
  let documents = [new Mock(mockOne), new Mock(mockTwo), new Mock(mockThree)]

  // store _session in document and save
  let res = await Mock.bulkSaveVersioned(documents, [], Mock)
  
  childTest.equal(res.nInserted, 3)

  let mock = await Mock.findById(mockOne._id)
  childTest.type(mock[constants.VALIDITY].start, Date)
  childTest.equal(mock[constants.VERSION], 1)

  childTest.end()
})

// test versioning CRUD
tap.test('bulk update objects', async (childTest) => {
  let updates = [ await Mock.findById(mockOne._id), await Mock.findById(mockTwo._id), await Mock.findById(mockThree._id)]
  let originals = updates.map(doc => {return fromJS(doc.toObject()).toJS()})

  // make changes
  for (let document of updates){
    document.data = "new " + document.data
  }

  // start session and save
  session = await mongoose.startSession()
  session.startTransaction()

  let res = await Mock.bulkSaveVersioned(updates, originals, Mock, {session})

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(res.nModified, 3)

  let mock = await Mock.findById(mockOne._id)
  childTest.type(mock[constants.VALIDITY].start, Date)
  childTest.equal(mock[constants.VERSION], 2)
  childTest.same(mock[constants.EDITOR], undefined)

  let versionedMock = await Mock.findVersion(mockOne._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)
  childTest.equal(versionedMock[constants.VALIDITY].end > versionedMock[constants.VALIDITY].start, true)
  childTest.equal(versionedMock[constants.EDITOR], constants.DEFAULT_EDITOR)

  childTest.end()
})

// test versioning CRUD
tap.test('bulk update objects with different lengths fail', async (childTest) => {
  let updates = [ await Mock.findById(mockOne._id), await Mock.findById(mockTwo._id)]
  let originals = updates.map(doc => {return fromJS(doc.toObject()).toJS()})
  updates.push(await Mock.findById(mockThree._id))

  // make changes
  for (let document of updates){
    document.data = "new " + document.data
  }

  // start session and save
  session = await mongoose.startSession()
  session.startTransaction()

  let res = undefined
  try {
    // update that should fail (modifying _id to an existent one)
    res = await Mock.bulkSaveVersioned(updates, originals, Mock, {session})

    // commit transaction
    await session.commitTransaction()
    session.endSession()

  } catch (e) {
    // rollback if update fails
    if (session) session.endSession()
  }

  childTest.equal(res, undefined)

  let mock = await Mock.findById(mockOne._id)
  childTest.equal(mock[constants.VERSION], 2)

  childTest.end()
})

// test versioning CRUD
tap.test('bulk delete objects', async (childTest) => {
  let documents = [ await Mock.findById(mockOne._id), await Mock.findById(mockTwo._id), await Mock.findById(mockThree._id)]

  // start session and save
  session = await mongoose.startSession()
  session.startTransaction()

  let res = await Mock.bulkDeleteVersioned(documents, Mock, {session})

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(res.nRemoved, 3)

  let mock = await Mock.findById(mockOne._id)
  childTest.same(mock, undefined)

  let versionedMock = await Mock.findVersion(mockOne._id, 2, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)
  childTest.equal(versionedMock[constants.DELETER], constants.DEFAULT_DELETER)

  childTest.end()
})

// test versioning CRUD
tap.test('bulk delete already deleted objects', async (childTest) => {
  let documents = [ await Mock.findVersion(mockOne._id, 2, Mock), 
                    await Mock.findVersion(mockTwo._id, 2, Mock), 
                    await Mock.findVersion(mockThree._id, 2, Mock)]

  for (let document of documents){
    document._id = document._id._id
  }

  let res = undefined
  
  try {
    res = await Mock.bulkDeleteVersioned(documents, Mock)
  } catch(e) { }

  childTest.same(res, undefined)
  childTest.end()
})

// test versioning CRUD
tap.test('bulk update already deleted objects', async (childTest) => {
  let updates = [ await Mock.findVersion(mockOne._id, 2, Mock), 
    await Mock.findVersion(mockTwo._id, 2, Mock), 
    await Mock.findVersion(mockThree._id, 2, Mock)]
  
  for (let document of updates){
    document._id = document._id._id
  }

  let originals = updates.map(doc => {return fromJS(doc.toObject()).toJS()})

  for (let document of updates){
    document.data = "edited " + document.data
  }

  let res = undefined
  
  try {
    res = await Mock.bulkSaveVersioned(updates, originals, Mock)
  } catch(e) {
  }

  childTest.same(res, undefined)

  childTest.end()
})

// test versioning CRUD
tap.test('bulk update wrong version documents', async (childTest) => {
  let originals = [ await Mock.findVersion(mockOne._id, 2, Mock)]
  let previous = await Mock.findVersion(mockOne._id, 1, Mock)
  let updates = [ fromJS(previous.toObject()).toJS()]

  for (let document of updates){
    document.data = "edited " + document.data
  }

  let res = undefined
  
  try {
    res = await Mock.bulkSaveVersioned(updates, originals, Mock)
  } catch(e) {
   }

  childTest.same(res, undefined)

  childTest.end()
})

tap.test('bulk update partially fails rollsback', async (childTest) => {
  let updates = [ await Mock.findById(mockFive._id), await Mock.findById(mockSix._id)]

  let bad = new Mock(mockEight)
  updates.push(bad)
  let originals = updates.map(doc => {return fromJS(doc.toObject()).toJS()})

  for (let document of updates){
    document.data = "edited " + document.data
  }

  let res = undefined
  
  try {
    res = await Mock.bulkSaveVersioned(updates, originals, Mock)
  } catch(e) {
   }

  childTest.same(res, undefined)

  childTest.end()
})

tap.teardown(async function() {
  await mongoose.disconnect()
  await mongoServer.stop()
  console.log(chalk.bold.red('MongoDB disconnected'))
})
