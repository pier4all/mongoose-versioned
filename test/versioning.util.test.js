const util = require('../source/util')
const constants = require('../source/constants')
const mongoose = require('mongoose')
let Schema = mongoose.Schema


// test util
const t = require('tap')
t.jobs = 3

t.test('clone schema should keep original fields', t => {
  let originalSchema = new Schema({
    data : { type: String, required: false, unique: false },
  })
  let clone = util.cloneSchema(originalSchema, mongoose)
  t.equal(JSON.stringify(clone.paths.data), JSON.stringify(originalSchema.paths.data))
  t.end()
})

t.test('cloned schema fields not required', t => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true },
  })
  let clone = util.cloneSchema(originalSchema, mongoose)
  t.equal(originalSchema.paths.data.isRequired, true)
  t.equal(clone.paths.data.isRequired, false)
  t.end()
})

t.test('cloned schema fields not unique', t => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true },
  })
  let clone = util.cloneSchema(originalSchema, mongoose)
  t.equal(originalSchema.paths.data._index.unique, true)
  t.equal(clone.paths.data._index.unique, false)
  t.end()
})

t.test('cloned schema field version stays unique', t => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true }
  })

  let versionField = {}
  versionField[constants.VERSION] = { type: Number, required: true, default: 0, select: true }
  originalSchema.add(versionField)

  let clone = util.cloneSchema(originalSchema, mongoose)

  t.equal(clone.paths[constants.VERSION].isRequired, true)
  t.end()
})

t.test('valid is true for version "1"', t => {
  t.equal(util.isValidVersion('1'), true)
  t.end()
})

t.test('valid is false for version "0"', t => {
   t.equal(util.isValidVersion('0'), false)
   t.end()
})

t.test('valid is false for version "x"', t => {
   t.equal(util.isValidVersion('x'), false)
   t.end()
})

t.test('valid is false for version " "', t => {
  t.equal(util.isValidVersion(' '), false)
  t.end()
})

t.test('valid is false for int version', t => {
  t.equal(util.isValidVersion(5), false)
  t.end()
})

t.test('writable is false for field version', t => {
  t.equal(util.isWritable(constants.VERSION), false)
  t.end()
})

t.test('writable is false for field name', t => {
  t.equal(util.isWritable("name"), true)
  t.end()
})
