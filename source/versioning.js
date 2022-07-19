const util = require("./util")
const constants = require("./constants")
const ObjectId = require('mongoose').Types.ObjectId
const { fromJS } = require('immutable')
const commons = require("./commons")
"use strict"

module.exports = function (schema, options) {

    //Handling of the options (inherited from vermongo)
    if (typeof (options) == 'string') {
        options = {
            collection: options
        }
    }

    options = options || {}
    options.collection = options.collection || 'versions'
    options.logError = options.logError || false
    options.ensureIndex = options.ensureIndex ?? true
    options.mongoose = options.mongoose || require('mongoose')
    const mongoose = options.mongoose
    const connection = options.connection || mongoose

    // Make sure there's no reserved paths
    constants.RESERVED_FIELDS.map(
        key =>  { if (schema.path(key)) throw Error(`Schema can't have a path called "${key}"`) }
    )

    // create the versioned schema
    let versionedSchema = util.cloneSchema(schema, mongoose)

    // Copy schema options in the versioned schema
    Object.keys(options).forEach(key => versionedSchema.set(key, options[key]));

    // Define Custom fields
    let validityField = {}
    validityField[constants.VALIDITY] = {
        start: { type: Date, required: true, default: Date.now },
        end: { type: Date, required: false }
    }

    let versionedValidityField = {}
    versionedValidityField[constants.VALIDITY] = {
        start: { type: Date, required: true },
        end: { type: Date, required: true}
    }

    let versionField = {}
    versionField[constants.VERSION] = { type: Number, required: true, default: 0, select: true }

    let versionedIdField = {}
    versionedIdField[constants.ID] = mongoose.Schema.Types.Mixed
    versionedIdField[constants.VERSION] = versionField[constants.VERSION]

    let editorField = {}
    editorField[constants.EDITOR] = { type: String, required: true, default: constants.DEFAULT_EDITOR }

    let deleterField = {}
    deleterField[constants.DELETER] = { type: String, required: false}

    // Add Custom fields
    schema.add(validityField)
    schema.add(versionField)
    schema.add(editorField)
    schema.add(deleterField)

    versionedSchema.add(versionField)
    versionedSchema.add(versionedIdField)
    versionedSchema.add(versionedValidityField)
    versionedSchema.add(editorField)
    versionedSchema.add(deleterField)

    // add index to versioning (id, validity),
    const validity_end = constants.VALIDITY + ".end"
    const validity_start = constants.VALIDITY + ".start"

    let versionedValidityIndex = {}
    versionedValidityIndex[constants.ID + '.' + constants.ID] = 1
    versionedValidityIndex[validity_start] = 1
    versionedValidityIndex[validity_end] = 1
    const indexName = { name: "_id_validity_start_validity_end"};
    versionedSchema.index(versionedValidityIndex, indexName)

    // Turn off internal versioning, we don't need this since we version on everything
    schema.set("versionKey", false)
    versionedSchema.set("versionKey", false)

    // Add reference to model to original schema
    schema.statics.VersionedModel = connection.model(options.collection, versionedSchema)

    // calling create index from MongoDB to be sure index is created
    if (options.ensureIndex)
        schema.statics.VersionedModel.collection.createIndex(versionedValidityIndex, indexName)

    // Add special find by id and validity date that includes versioning
    schema.statics.findValidVersion = async (id, date, model) => {

        // 1. check if in current collection is valid
        const validity_end = constants.VALIDITY + ".end"
        const validity_start = constants.VALIDITY + ".start"

        let query = { "_id": ObjectId(id)}
        query[validity_start] = { $lte: date }

        let current = await model.findOne(query)
        if (current)
            return current

        // 2. if not, check versioned collection
        let versionedModel = schema.statics.VersionedModel
        query = {}
        query[constants.ID + "." + constants.ID] = ObjectId(id)
        query[validity_start] = { $lte: date }
        query[validity_end] = { $gt: date }

        let version = await versionedModel.findOne(query)
        // We are modifying _id here in order to match configList's id.
        version._id = version._id._id ? version._id._id : version._id;
        return version
    }

    // Add special find by id and version number that includes versioning
    schema.statics.findVersion = async (id, version, model) => {

        // 1. check if version is the main collection
        let query = {}
        query[constants.ID] = ObjectId(id)
        query[constants.VERSION] = version

        let current = await model.findOne(query)
        if (current) {
            { return current }
        }

        // 2. if not, check versioned collection
        let versionedModel = schema.statics.VersionedModel
        query = {}
        let versionedId = {}
        versionedId[constants.ID] = ObjectId(id)
        versionedId[constants.VERSION] = version
        query[constants.ID] = versionedId

        let document = await versionedModel.findOne(query)
        // We are modifying _id here in order to match configList's id.
        document._id = document._id._id ? document._id._id : document._id;
        return document
    }

    // document level middleware
    schema.pre('save', async function (next) {

        if (!this.isVersionToBeUpdated()) {
            return next()
        }
        
        if (this.isNew) {
            this[constants.VERSION] = 1
            return next()
        }

        let baseVersion = this[constants.VERSION]
        // load the base version
        let base = await this.collection
            .findOne({ [constants.ID]: this[constants.ID] })
            .then((foundBase) => {
            if (foundBase === null) {
                let err = new Error('document to update not found in collection')
                throw (err)
            }
            return foundBase})

        let bV = base[constants.VERSION]
        if (baseVersion !== bV) {
            let err = new Error('modified and base versions do not match')
            throw (err)
        }

        // get the transaction session
        const session = {session: this._session}
        delete this._session

        // clone base document to create an archived version
        let clone = fromJS(base).toJS()

        // Build Vermongo historical ID
        clone[constants.ID] = { [constants.ID]: this[constants.ID], [constants.VERSION]: this[constants.VERSION] }

        // Set validity to end now for versioned and to start now for current
        const now = new Date()
        const start = base[constants.VALIDITY]["start"]

        clone[constants.VALIDITY] = {
            "start": start,
            "end": now
        }

        this[constants.VALIDITY] = { "start": now }

        // Special case for the findAndDelete to include deletion information
        if (this[constants.DELETION]) {
            let delete_info = this[constants.DELETION]
            delete this[constants.DELETION]
            clone[constants.DELETER] = delete_info[constants.DELETER]
        }

        // Increment version number
        this[constants.VERSION] = this[constants.VERSION] + 1

        // Save versioned document
        var versionedDoc = new schema.statics.VersionedModel(clone)
        await versionedDoc.save(session)
        next()
        return null
    })

    schema.pre('remove', async function (next) {

        // get the transaction session
        const session = {session: this._session}
        delete this._session

        // save current version clone in shadow collection
        let delete_info = this[constants.DELETION] || {}
        delete this[constants.DELETION]

        let clone = fromJS(this.toObject()).toJS()

        // Build Vermongo historical ID
        clone[constants.ID] = { [constants.ID]: this[constants.ID], [constants.VERSION]: this[constants.VERSION] }

        const now = new Date()
        const start = this[constants.VALIDITY]["start"]
        clone[constants.VALIDITY] = {
            "start": start,
            "end": now
        }
        clone[constants.DELETER] = delete_info[constants.DELETER] || constants.DEFAULT_DELETER

        await new schema.statics.VersionedModel(clone).save(session)

        next()
        return null
    })

    // model level middleware
    schema.pre('insertMany', async function (next, docs) {
        docs.forEach(d => { d[constants.VERSION] = 1; })
        next()
    })

    //updateOne (includes document and model/query level)
    schema.pre('updateOne', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    //updateMany (query level)
    schema.pre('updateMany', async function (next) {
        await commons.filterAndModifyMany(this, next)
    })

    // findOneAndUpdate (query level)
    schema.pre('findOneAndUpdate', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    // findOneAndReplace (query level)
    schema.pre('findOneAndReplace', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    // findOneAndReplace (query level)
    schema.pre('replaceOne', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    //deleteOne (includes document and model/query level)
    schema.pre('deleteOne', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    //findOneAndRemove (query level)
    schema.pre('findOneAndRemove', async function (next) {
        await commons.filterAndModifyOne(this, next)
    })

    //findOneAndRemove (query level)
    schema.pre('findOneAndDelete', async function (next) {
    await commons.filterAndModifyOne(this, next)
    })

    //deleteMany (query level)
    schema.pre('deleteMany', async function (next) {
        await commons.filterAndModifyMany(this, next)
    })
}
