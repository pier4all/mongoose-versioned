import { cloneSchema, isValidVersion, isWritable } from '../source/util'
import constants from '../source/constants'

import mongoose, { Schema } from 'mongoose'

// test util
import tap from 'tap'
tap.jobs = 3

tap.test('clone schema should keep original fields', tap => {
  let originalSchema = new Schema({
    data : { type: String, required: false, unique: false },
  })
  let clone = cloneSchema(originalSchema, mongoose)
  tap.equal(JSON.stringify(clone.paths.data), JSON.stringify(originalSchema.paths.data))
  tap.end()
})

tap.test('cloned schema fields not required', tap => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true },
  })
  let clone = cloneSchema(originalSchema, mongoose)
  tap.equal(originalSchema.paths.data.isRequired, true)
  tap.equal(clone.paths.data.isRequired, false)
  tap.end()
})

tap.test('cloned schema fields not unique', tap => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true },
  })
  let clone = cloneSchema(originalSchema, mongoose)
  // TODO
  // tap.equal(originalSchema.paths.data._index.unique, true)
  tap.equal((originalSchema.paths.data as any).index.unique, true)
  tap.equal(!!(clone.paths.data as any)._index?.unique, false)
  tap.end()
})

tap.test('cloned schema field version stays unique', tap => {
  let originalSchema = new Schema({
    data : { type: String, required: true, unique: true }
  })

  let versionField = {}
  versionField[constants.VERSION] = { type: Number, required: true, default: 0, select: true }
  originalSchema.add(versionField)

  let clone = cloneSchema(originalSchema, mongoose)

  tap.equal(clone.paths[constants.VERSION].isRequired, true)
  tap.end()
})

tap.test('valid is true for version "1"', t => {
  tap.equal(isValidVersion('1'), true)
  tap.end()
})

tap.test('valid is false for version "0"', t => {
   tap.equal(isValidVersion('0'), false)
   tap.end()
})

tap.test('valid is false for version "x"', t => {
   tap.equal(isValidVersion('x'), false)
   tap.end()
})

tap.test('valid is false for version " "', t => {
  tap.equal(isValidVersion(' '), false)
  tap.end()
})

tap.test('valid is false for int version', t => {
  tap.equal(isValidVersion(5 as any), false)
  tap.end()
})

tap.test('writable is false for field version', t => {
  tap.equal(isWritable(constants.VERSION), false)
  tap.end()
})

tap.test('writable is false for field name', t => {
  tap.equal(isWritable("name"), true)
  tap.end()
})
