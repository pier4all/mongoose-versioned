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
    editorField[constants.EDITOR] = { type: String, required: false}

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

        let query = { "_id": new ObjectId(id)}
        query[validity_start] = { $lte: date }

        let current = await model.findOne(query)
        if (current)
            return current

        // 2. if not, check versioned collection
        let versionedModel = schema.statics.VersionedModel
        query = {}
        query[constants.ID + "." + constants.ID] = new ObjectId(id)
        query[validity_start] = { $lte: date }
        query[validity_end] = { $gt: date }

        let version = await versionedModel.findOne(query)
        return version
    }

    // Add special find by id and version number that includes versioning
    schema.statics.findVersion = async (id, version, model) => {

        // 1. check if version is the main collection
        let query = {}
        query[constants.ID] = new ObjectId(id)
        query[constants.VERSION] = version

        let current = await model.findOne(query)
        if (current) {
            { return current }
        }

        // 2. if not, check versioned collection
        let versionedModel = schema.statics.VersionedModel
        query = {}
        let versionedId = {}
        versionedId[constants.ID] = new ObjectId(id)
        versionedId[constants.VERSION] = version
        query[constants.ID] = versionedId

        let document = await versionedModel.findOne(query)
        return document
    }

    // Add special bulk save that supports versioning, note that the
    // documents are the updated documents and the originals a clone (simple JS object) of what is 
    // already in the DB
    schema.statics.bulkSaveVersioned = async (documents, originals, model, options={}) => {

        // check inputs have the proper length
        if(documents.length != originals.length && originals.length>0) {
            let err = new Error('documents and originals lengths do not match')
            throw (err)
        }

        const now = new Date()
        // loop over the inputs to create a bulk write set
        for (let i = 0; i < documents.length; i += 1) {

            // Set fields for update
            documents[i][constants.VALIDITY] = { "start": now }

            if (originals.length>0) {
                // create the versioned 
                originals[i] = new schema.statics.VersionedModel(originals[i])

                // remove editor info
                originals[i][constants.EDITOR] = documents[i][constants.EDITOR]|| constants.DEFAULT_EDITOR
                delete documents[i][constants.EDITOR]

                // set fields for original
                originals[i][constants.VALIDITY]["end"] = now

                let versionedId = {}
                versionedId[constants.ID] = originals[i][constants.ID]
                versionedId[constants.VERSION] = originals[i][constants.VERSION]
                originals[i][constants.ID] = versionedId

                // check and increase version number
                if (documents[i][constants.VERSION] == originals[i][constants.VERSION]){
                    documents[i][constants.VERSION] = documents[i][constants.VERSION] + 1
                } else {
                    let err = new Error('document and original versions do not match for _id: ' +  documents[i]._id)
                    throw (err)
                }
            } else {
                documents[i][constants.VERSION] = 1
            }
        }

        let resUpdated = undefined
        let resVersioned = undefined
        
        if (originals.length>0) {
            //call buildBulkWriteOperations for the modified documents to avoid middleware hooks
            let ops = model.buildBulkWriteOperations(documents, { skipValidation: true});
            resUpdated = await model.bulkWrite(ops, options)

            // call mongoos bulkSave since the versioned collection has no middleware hooks
            let versionedModel = schema.statics.VersionedModel
            resVersioned = await versionedModel.bulkSave(originals, options)
            
            // raise an error if not all the documents were modified
            if (resUpdated.nModified < documents.length) {
                let err = new Error('bulk update failed, only ' + resUpdated.nModified + ' out of ' + documents.length + ' were updated')
                throw (err)               
            }

        } else {
            resUpdated = await model.bulkSave(documents, options)
        }

        return resUpdated
    }

    // Add special find by id and version number that includes versioning
    schema.statics.bulkDeleteVersioned = async (documents, model, options={}) => {

        const now = new Date()
        let versionedModel = schema.statics.VersionedModel

        // loop over the inputs to create a bulk deletr set
        let ops = []
        for (let i = 0; i < documents.length; i += 1) {
            documents[i] = new versionedModel(fromJS(documents[i].toObject()).toJS())

            // Set fields for versioned
            documents[i][constants.VALIDITY]["end"] = now
            documents[i][constants.DELETER] = documents[i][constants.DELETER]|| constants.DEFAULT_DELETER

            let versionedId = {}
            versionedId[constants.ID] = documents[i][constants.ID]
            versionedId[constants.VERSION] = documents[i][constants.VERSION]
            documents[i][constants.ID] = versionedId

            let op =   {
                "deleteOne": {
                  "filter": { "_id": documents[i]._id }
                }
              }
            
            ops.push(op)
        }

        let resDeleted = undefined
        let resVersioned = undefined

        // delete on the main collection
        resDeleted = await model.bulkWrite(ops, options)

        // raise an error if not all the documents were modified
        if (resDeleted.nRemoved < documents.length) {
            let err = new Error('bulk delete failed, only ' + resDeleted.nRemoved + ' out of ' + documents.length + ' were removed')
            throw (err)               
        }

        // save latest version in the versioned collection
        resVersioned = await versionedModel.bulkSave(documents, options)
      
        return resDeleted
    }

    // document level middleware
    schema.pre('save', async function (next) {

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

        // Special case for the findAndDelete to include deleter information
        if (this[constants.DELETER]) {
            clone[constants.DELETER] = this[constants.DELETER] 
        }
        // store edition info
        else {
            let editor_info = this[constants.EDITOR] || constants.DEFAULT_EDITOR
            this[constants.EDITOR] = undefined
            clone[constants.EDITOR] = editor_info
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
        let clone = fromJS(this.toObject()).toJS()

        // Build Vermongo historical ID
        clone[constants.ID] = { [constants.ID]: this[constants.ID], [constants.VERSION]: this[constants.VERSION] }

        const now = new Date()
        const start = this[constants.VALIDITY]["start"]
        clone[constants.VALIDITY] = {
            "start": start,
            "end": now
        }

        clone[constants.DELETER] = this[constants.DELETER]|| constants.DEFAULT_DELETER

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
