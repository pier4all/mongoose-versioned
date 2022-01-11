const chalk = require('chalk')

const versioning = require('../source/versioning')
const constants = require('../source/constants')

const mongoose = require('mongoose')
mongoose.Promise = require('bluebird')
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

const mockNine = { 
  _id: new mongoose.Types.ObjectId(),
  data: "ninth mock test",
  number: 9 
}

const mockTen = { 
  _id: new mongoose.Types.ObjectId(),
  data: "tenth mock test",
  number: 10 
}

tap.before(async function() { 

  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 4 } })

  let mongoUri = mongoServer.getUri()

  const mongooseOpts = {
    useUnifiedTopology: true, 
    useNewUrlParser: true, 
    useFindAndModify: false,
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
  
})

// test versioning CRUD
tap.test('update object', async (childTest) => {
  const mocks = await Mock.insertMany([mockOne, mockTwo, mockThree, mockFour, mockFive, mockSix, mockSeven, mockEight, mockNine, mockTen])

  let mock = await Mock.findById(mockOne._id)
  mock.data = "modified"

  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  mock[constants.SESSION] = session
  mock = await mock.save({session})

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  let versionedMock = await Mock.findVersion(mockOne._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)
  childTest.equal(mock[constants.VERSION], 2)

  childTest.equal(mock._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})


tap.test('delete object moves it to archive', async (childTest) => {
  const mock = await Mock.findById(mockOne[constants.ID])
  mock._deletion = { "_deleter": "test" }

  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and remove
  mock[constants.SESSION] = session
  await mock.remove({session})    

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  const noMock = await Mock.findValidVersion(mockOne[constants.ID], new Date(), Mock)
  childTest.equal(noMock, null)
  
  const archivedMock = await Mock.VersionedModel.findById({ _id: mockOne[constants.ID], _version: 2 })
  childTest.equal(archivedMock[constants.DELETER], "test")

  childTest.end()
})

tap.test('update using updateOne at document level', async (childTest) => {

  let mock = await Mock.findById(mockThree._id)

  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await mock.updateOne({"$set": {data: "modified"}}, {session})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 1)
  childTest.equal(result.nModified, 1)
  childTest.equal(result.ok, 1)

  mock = await Mock.findById(mockThree._id)
  childTest.equal(mock[constants.VERSION], 2)

  let versionedMock = await Mock.findVersion(mockThree._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(mock._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.test('update using updateOne at model level', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.updateOne({"$and":[{number: {"$gte": 2}}, {number: {"$lte": 5}}]}, 
                                    {"$set": {data: "modified"}}, 
                                    {session, sort: {number: -1}, skip: 1})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 1)
  childTest.equal(result.nModified, 1)
  childTest.equal(result.ok, 1)

  let mock = await Mock.findById(mockFour._id)
  childTest.equal(mock[constants.VERSION], 2)

  let versionedMock = await Mock.findVersion(mockFour._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(mock._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.test('update using updateMany', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.updateMany({"$and":[{number: {"$gte": 5}}, {number: {"$lte": 6}}]}, 
                                     {"$set": {data: "modified"}}, {session})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 2)
  childTest.equal(result.nModified, 2)
  childTest.equal(result.ok, 1)

  // Check first mock
  let mockFiveFound = await Mock.findById(mockFive._id)
  childTest.equal(mockFiveFound [constants.VERSION], 2)

  let versionedMockFive = await Mock.findVersion(mockFive._id, 1, Mock)
  childTest.type(versionedMockFive[constants.VALIDITY].end, Date)

  childTest.equal(mockFiveFound._validity.start.getTime(), versionedMockFive._validity.end.getTime())


  // Check second mock
  let mockSixFound = await Mock.findById(mockSix._id)
  childTest.equal(mockSixFound [constants.VERSION], 2)

  let versionedMockSix = await Mock.findVersion(mockSix._id, 1, Mock)
  childTest.type(versionedMockSix[constants.VALIDITY].end, Date)

  childTest.equal(mockSixFound._validity.start.getTime(), versionedMockSix._validity.end.getTime())

  childTest.end()
})

tap.test('update using updateMany with no matching documents', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.updateMany({number: {"$gte": 100}}, {"$set": {data: "modified"}}, {session})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 0)
  childTest.equal(result.nModified, 0)
  childTest.equal(result.ok, 1)

  childTest.end()
})

tap.test('update using findOneAndUpdate', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.findOneAndUpdate({number: 7}, {"$set": {data: "modified"}}, {session, new: true})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(mockSeven._id.equals(result._id), true)
  childTest.equal(result.data, "modified")
  childTest.equal(result[constants.VERSION], 2)

  let versionedMock = await Mock.findVersion(mockSeven._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(result._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.test('update using findOneAndReplace', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.findOneAndReplace({number: 8}, {data: "modified"}, {session, new: true})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(mockEight._id.equals(result._id), true)
  childTest.equal(result.data, "modified")
  childTest.not(result.number, 8)
  childTest.equal(result[constants.VERSION], 2)

  let versionedMock = await Mock.findVersion(mockEight._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(result._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.test('update using replaceOne at model level', async (childTest) => {
  
  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await Mock.replaceOne({number: 9}, {data: "modified"}, {session})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 1)
  childTest.equal(result.nModified, 1)
  childTest.equal(result.ok, 1)

  let mock = await Mock.findById(mockNine._id)
  childTest.equal(mock[constants.VERSION], 2)
  childTest.equal(mock.data, "modified")
  childTest.not(mock.number, 9)

  let versionedMock = await Mock.findVersion(mockNine._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(mock._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.test('update using replaceOne at document level', async (childTest) => {

  let mock = await Mock.findById(mockTen._id)

  // start transaction
  session = await mongoose.startSession()
  session.startTransaction()

  // store _session in document and save
  let result = await mock.replaceOne({data: "modified 10"}, {session})  

  // commit transaction
  await session.commitTransaction()
  session.endSession()

  childTest.equal(result.n, 1)
  childTest.equal(result.nModified, 1)
  childTest.equal(result.ok, 1)

  let foundMock = await Mock.findById(mockTen._id)

  childTest.equal(foundMock[constants.VERSION], 2)
  childTest.equal(foundMock.data, "modified 10")
  childTest.not(foundMock.number, 10)

  let versionedMock = await Mock.findVersion(mockTen._id, 1, Mock)
  childTest.type(versionedMock[constants.VALIDITY].end, Date)

  childTest.equal(foundMock._validity.start.getTime(), versionedMock._validity.end.getTime())

  childTest.end()
})

tap.teardown(async function() { 
  await mongoose.disconnect()
  await mongoServer.stop()
  console.log(chalk.bold.red('MongoDB disconnected'))
})



