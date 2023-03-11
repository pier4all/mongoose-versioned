import versioning from '../source/versioning'
import constants from '../source/constants'

import mongoose, { Schema } from 'mongoose'

// test versioning.js
import tap from 'tap'

// test versioning schema
tap.test(`schema cannot have field ${constants.EDITOR}`, t => {
  try {
    const NAME = 'bad'
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.EDITOR] = { type: String, required: true, default: constants.DEFAULT_EDITOR }
    badSchema.add(reservedField)

    badSchema.plugin(versioning)
    mongoose.model(NAME, badSchema)
    tap.fail('Should not get here')

  } catch (err) {
    tap.ok(err, 'Got expected error')
  }
  tap.end()
})

tap.test(`schema cannot have field ${constants.DELETER}`, t => {
  try {
    const NAME = 'bad'
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.DELETER] = { type: String }
    badSchema.add(reservedField)

    badSchema.plugin(versioning, NAME + 's.versioning' as any)
    mongoose.model(NAME, badSchema)
    tap.fail('Should not get here')

  } catch (err) {
    tap.ok(err, 'Got expected error')
  }
  tap.end()
})

tap.test(`schema cannot have field ${constants.VERSION}`, t => {
  try {
    const NAME = 'bad'
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.VERSION] = { type: Number, required: true, default: 0, select: true }
    badSchema.add(reservedField)

    badSchema.plugin(versioning, {collection: NAME + 's.versioning', ensureIndex: false})
    mongoose.model(NAME, badSchema)
    tap.fail('Should not get here')

  } catch (err) {
    tap.ok(err, 'Got expected error')
  }
  tap.end()
})

tap.test(`schema cannot have field ${constants.VALIDITY}`, t => {
  try {
    const NAME = 'bad'
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.VALIDITY] = { type: Date, required: false }
    badSchema.add(reservedField)

    badSchema.plugin(versioning, {collection: NAME + 's.versioning', ensureIndex: false})
    mongoose.model(NAME, badSchema)
    tap.fail('Should not get here')

  } catch (err) {
    tap.ok(err, 'Got expected error')
  }
  tap.end()
})

tap.test(`schema cannot have field ${constants.SESSION}`, tap => {
  try {
    const NAME = 'bad'
    let badSchema = new Schema({ })

    let reservedField = {}
    reservedField[constants.SESSION] = { type: Date, required: false }
    badSchema.add(reservedField)

    badSchema.plugin(versioning, {collection: NAME + 's.versioning', ensureIndex: false})
    mongoose.model(NAME, badSchema)
    tap.fail('Should not get here')

  } catch (err) {
    tap.ok(err, 'Got expected error')
  }
  tap.end()
})


tap.test(`default shadow collection is versions`, tap => {
  const NAME = 'default_document'
  let newSchema = new Schema({ })

  let reservedField = {date: { type: Date, required: false }}
  newSchema.add(reservedField)

  newSchema.plugin(versioning, {ensureIndex: false})
  mongoose.model(NAME, newSchema)

  console.log('xxx', newSchema.statics.VersionedModel);
  // TODO
  // tap.equal(newSchema.statics.VersionedModel.collection.collectionName, 'versions')
  tap.equal((newSchema.statics.VersionedModel as any).collection.collectionName, 'versions')

  tap.end()
})

tap.test(`shadow collection is set to provided string`, tap => {
  const NAME = 'document'
  let newSchema = new Schema({ })

  let field = {date: { type: Date, required: false }}
  newSchema.add(field)

  newSchema.plugin(versioning, {collection: NAME + 's.versioning', ensureIndex: false})
  mongoose.model(NAME, newSchema)

  console.log('yyy', newSchema.statics.VersionedModel);
  // TODO
  // tap.equal(newSchema.statics.VersionedModel.collection.collectionName, NAME + 's.versioning')
  tap.equal((newSchema.statics.VersionedModel as any).collection.collectionName, NAME + 's.versioning')

  tap.end()
})

tap.test(`shadow collection is set to provided object property`, tap => {
  const NAME = 'object_document'
  let newSchema = new Schema({ })

  let field = {date: { type: Date, required: false }}
  newSchema.add(field)

  newSchema.plugin(versioning, {collection: NAME + 's.versioning', ensureIndex: false})
  mongoose.model(NAME, newSchema)

  console.log('yyy', newSchema.statics.VersionedModel);
  // TODO
  // tap.equal(newSchema.statics.VersionedModel.collection.collectionName, NAME + 's.versioning')
  tap.equal((newSchema.statics.VersionedModel as any).collectionName, NAME + 's.versioning')

  tap.end()
})