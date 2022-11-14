const chalk = require('chalk')

const versioning = require('../source/versioning')
const constants = require('../source/constants')

const mongoose = require('mongoose')
//mongoose.Promise = require('bluebird')
let Schema = mongoose.Schema

// start in memory server
const { MongoMemoryServer } = require( 'mongodb-memory-server' )

// global variable to store the server
let mongoServer

// test versioning.js
const tap = require('tap')

// data
const mockOne = {
  _id: new mongoose.Types.ObjectId(),
  data: "first mock test"
}
const mockTwo = {
  _id: new mongoose.Types.ObjectId(),
  data: "second mock test"
}

const mockThree = {
  _id: new mongoose.Types.ObjectId(),
  data: "third mock test"
}
const mockFour = {
  _id: new mongoose.Types.ObjectId(),
  data: "fourth mock test"
}

// auxiliar global variables
let Mock
let initialMock

// test initialization
tap.before(async function() {

  mongoServer = await MongoMemoryServer.create()

  let mongoUri = mongoServer.getUri()

  const mongooseOpts = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    //useFindAndModify: false
  }

  await mongoose.connect(mongoUri, mongooseOpts)

  console.log(chalk.bold.green(`MongoDB successfully connected to ${mongoUri}`))

  // test schema definition
  const NAME = "test"
  let testSchema = new Schema({
    data : { type: String, required: false, unique: false },
  }, { autoIndex: false })

  testSchema.plugin(versioning, { options: NAME + "s.versioning", ensureIndex: true})

  Mock = mongoose.model(NAME, testSchema)

})

// test versioning CRUD
tap.test('create new object', async (childTest) => {
  initialMock = await new Mock(mockOne).save()
  childTest.equal(initialMock[constants.VERSION], 1)
  childTest.end()
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
  mock._deleter = "test"
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

tap.test('check default index is present in the shadow collection', async (childTest) => {
  const indexes = await Mock.VersionedModel.collection.getIndexes()

  const shadowIndex = [
     [ '_id._id', 1 ],
     [ '_validity.start', 1 ],
     [ '_validity.end', 1 ]
   ]

  if (findIndex(shadowIndex, indexes) ) {
    childTest.ok('Found expected shadow index')
  } else {
    childTest.fail('Shadow index not found')
  }

  childTest.end()
})

tap.test('insert many objects', async (childTest) => {
  const mocks = await Mock.insertMany([mockThree, mockFour])

  childTest.equal(mocks.length, 2)
  mocks.forEach(m => { childTest.equal(m[constants.VERSION], 1)})

  childTest.end()
})

tap.teardown(async function() {
  await mongoose.disconnect()
  await mongoServer.stop()
  console.log(chalk.bold.red('MongoDB disconnected'))
})

// Utility function
function findIndex(refIndex, indexes) {
  let indexFound = false
  for (const [name, index] of Object.entries(indexes)) {
    if(index.length == refIndex.length){
      for (let i = 0; i < index.length; i++) {
        if (index[i].length === refIndex[i].length) {
          if ((index[i][0] == refIndex[i][0]) && (index[i][1] == refIndex[i][1])) {
            indexFound = true
          } else {
            indexFound = false
            break
          }
        } else {
          indexFound = false
          break
        }
      }
      if (indexFound) break
    }
  }
  return indexFound
}
