const chalk = require('chalk')

const versioning = require('../source/versioning')
const constants = require('../source/constants')

const mongoose = require('mongoose')
mongoose.Promise = require('bluebird')
let Schema = mongoose.Schema

// start in memory server
const { MongoMemoryServer } = require( 'mongodb-memory-server' )

const mongoServer = new MongoMemoryServer()

mongoServer.getUri().then((mongoUri) => {
  const mongooseOpts = {
    useUnifiedTopology: true, 
    useNewUrlParser: true, 
    useFindAndModify: false
  }

  mongoose.connect(mongoUri, mongooseOpts)

  mongoose.connection.on('error', (e) => {
    if (e.message.code === 'ETIMEDOUT') {
      console.log(e)
      mongoose.connect(mongoUri, mongooseOpts)
    }
    console.log(e)
  })

  mongoose.connection.once('open', () => {
    console.log(chalk.bold.green(`MongoDB successfully connected to ${mongoUri}`))
  })
})

// test schema definition
const NAME = "test"
let testSchema = new Schema({
  data : { type: String, required: false, unique: false },
}, { autoIndex: false })
testSchema.plugin(versioning, { options: NAME + "s.versioning", ensureIndex: true})
let Mock = mongoose.model(NAME, testSchema)

const mockOne = { 
  _id: new mongoose.Types.ObjectId(),
  data: "first mock test" 
}
const mockTwo = { 
  _id: new mongoose.Types.ObjectId(),
  data: "second mock test" 
}

let initialMock

// test versioning.js
const tap = require('tap')

// test versioning CRUD
tap.test('create new object', async (t) => {
  initialMock = await new Mock(mockOne).save()
  t.equal(initialMock[constants.VERSION], 1)
  t.end()
})

tap.test('update object', async (childTest) => {
  let mock = await Mock.findById(mockOne._id)
  mock.data = "modified"
  mock = await mock.save()  
  childTest.equal(mock[constants.VERSION], 2)
  childTest.end()
})

tap.test('find current version by number', async (childTest) => {
  let mock = await Mock.findVersion(mockOne._id, 2, Mock)
  childTest.equal(mock[constants.VALIDITY].end, undefined)
  childTest.end()
})

tap.test('find old version by number', async (childTest) => {
  let mock = await Mock.findVersion(mockOne._id, 1, Mock)
  childTest.type(mock[constants.VALIDITY].end, Date)
  childTest.end()
})

tap.test('find current valid version', async (childTest) => {
  var mock = await Mock.findValidVersion(mockOne._id, new Date(), Mock)
  childTest.equal(mock[constants.VERSION], 2)
  childTest.end()
})

tap.test('find old valid version', async (childTest) => {
  const archivedMock = await Mock.VersionedModel.findById({ _id: mockOne[constants.ID], _version: 1 })
  const creationDate = archivedMock[constants.VALIDITY].start
  const mock = await Mock.findValidVersion(mockOne._id, creationDate, Mock)
  childTest.equal(mock[constants.VERSION], 1)
  childTest.end()
})

tap.test('trying to update old version fails', async (childTest) => {
  try {      
    initialMock.data = "test not update old"
    await initialMock.save()
    childTest.fail('Should not get here')
  } catch (err) {
    childTest.ok(err, 'Got expected error')
  }
  childTest.end()
})

tap.test('delete object moves it to archive', async (childTest) => {
  const mock = await Mock.findById(mockOne[constants.ID])
  mock._deletion = { "_deleter": "test" }
  await mock.remove()

  const noMock = await Mock.findValidVersion(mockOne[constants.ID], new Date(), Mock)
  childTest.equal(noMock, null)
  
  const archivedMock = await Mock.VersionedModel.findById({ _id: mockOne[constants.ID], _version: 2 })
  childTest.equal(archivedMock[constants.DELETER], "test")

  childTest.end()
})

tap.test('delete object has default deleter if not provided', async (childTest) => {
  const mock = await new Mock(mockTwo).save()
  
  await mock.remove()

  const archivedMock = await Mock.VersionedModel.findById({ _id: mockTwo[constants.ID], _version: 1 })
  childTest.equal(archivedMock[constants.DELETER], constants.DEFAULT_DELETER)

  childTest.end()
})

tap.test('trying to update deleted version fails', async (childTest) => {
  try {      
    initialMock.data = "test not update deleted"
    await initialMock.save()
    childTest.fail('Should not get here')
  } catch (err) {
    childTest.ok(err, 'Got expected error')
  }
  childTest.end()
})

tap.teardown(async function() { 
  //await Mock.deleteMany()
  //await Mock.VersionedModel.deleteMany()
  mongoose.disconnect()
  mongoServer.stop()
  console.log(chalk.bold.red('MongoDB disconnected'))
})