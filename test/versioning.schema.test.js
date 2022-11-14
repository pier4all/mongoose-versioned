const versioning = require('../source/versioning')
const constants = require('../source/constants')

const mongoose = require('mongoose')
let Schema = mongoose.Schema

// test versioning.js
const tap = require('tap')

// test versioning schema
tap.test(`schema cannot have field ${constants.EDITOR}`, t => {
  try {    
    const NAME = "bad"  
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.EDITOR] = { type: String, required: true, default: constants.DEFAULT_EDITOR }
    badSchema.add(reservedField)
    
    badSchema.plugin(versioning)
    mongoose.model(NAME, badSchema)
    t.fail('Should not get here')

  } catch (err) {
    t.ok(err, 'Got expected error')
  }
  t.end()
})

tap.test(`schema cannot have field ${constants.DELETER}`, t => {
  try {    
    const NAME = "bad"  
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.DELETER] = { type: String }
    badSchema.add(reservedField)
    
    badSchema.plugin(versioning, NAME + "s.versioning")
    mongoose.model(NAME, badSchema)
    t.fail('Should not get here')

  } catch (err) {
    t.ok(err, 'Got expected error')
  }
  t.end()
})

tap.test(`schema cannot have field ${constants.VERSION}`, t => {
  try {    
    const NAME = "bad"  
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.VERSION] = { type: Number, required: true, default: 0, select: true }
    badSchema.add(reservedField)
    
    badSchema.plugin(versioning, {collection: NAME + "s.versioning", ensureIndex: false})
    mongoose.model(NAME, badSchema)
    t.fail('Should not get here')

  } catch (err) {
    t.ok(err, 'Got expected error')
  }
  t.end()
})

tap.test(`schema cannot have field ${constants.VALIDITY}`, t => {
  try {    
    const NAME = "bad"  
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.VALIDITY] = { type: Date, required: false }
    badSchema.add(reservedField)
    
    badSchema.plugin(versioning, {collection: NAME + "s.versioning", ensureIndex: false})
    mongoose.model(NAME, badSchema)
    t.fail('Should not get here')

  } catch (err) {
    t.ok(err, 'Got expected error')
  }
  t.end()
})

tap.test(`schema cannot have field ${constants.SESSION}`, t => {
  try {    
    const NAME = "bad"  
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.SESSION] = { type: Date, required: false }
    badSchema.add(reservedField)
    
    badSchema.plugin(versioning, {collection: NAME + "s.versioning", ensureIndex: false})
    mongoose.model(NAME, badSchema)
    t.fail('Should not get here')

  } catch (err) {
    t.ok(err, 'Got expected error')
  }
  t.end()
})


tap.test(`default shadow collection is versions`, t => {
  const NAME = "default_document"  
  let newSchema = new Schema({ })

  let reservedField = {date: { type: Date, required: false }}
  newSchema.add(reservedField)
  
  newSchema.plugin(versioning, {ensureIndex: false})
  mongoose.model(NAME, newSchema)

  t.equal(newSchema.statics.VersionedModel.collection.collectionName, 'versions')

  t.end()
})

tap.test(`shadow collection is set to provided string`, t => {
  const NAME = "document"  
  let newSchema = new Schema({ })

  let field = {date: { type: Date, required: false }}
  newSchema.add(field)
  
  newSchema.plugin(versioning, {collection: NAME + "s.versioning", ensureIndex: false})
  mongoose.model(NAME, newSchema)

  t.equal(newSchema.statics.VersionedModel.collection.collectionName, NAME + "s.versioning")

  t.end()
})

tap.test(`shadow collection is set to provided object property`, t => {
  const NAME = "object_document"  
  let newSchema = new Schema({ })

  let field = {date: { type: Date, required: false }}
  newSchema.add(field)
  
  newSchema.plugin(versioning, {collection: NAME + "s.versioning", ensureIndex: false})
  mongoose.model(NAME, newSchema)

  t.equal(newSchema.statics.VersionedModel.collection.collectionName, NAME + "s.versioning")

  t.end()
})