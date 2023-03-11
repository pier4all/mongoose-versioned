import { Schema, Mongoose } from 'mongoose'
import constants from './constants'

export function cloneSchema (schema: Schema, mongoose: Mongoose): Schema {
    let clonedSchema = new Schema({autoIndex: false})
    schema.eachPath(function (path, type) {
        if (path === constants.ID) {
            return
        }
        // clone schema
        let clonedPath = {}
        clonedPath[path] = type.options

        // shadowed props are not unique
        clonedPath[path].unique = false

        // shadowed props are not all required
        if (path !== constants.VERSION) {
            clonedPath[path].required = false
        }

        clonedSchema.add(clonedPath)
    })
    return clonedSchema
}

export function isWritable (field): boolean {
    return !constants.RESERVED_FIELDS.find(
        key => key === field
    )
}

export function isValidVersion (version: string): boolean {
    if (typeof version !== "string") {
        return false // we only process strings!
    }
    if (isNaN(Number(version))) {
        return false // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    }
    if (isNaN(parseInt(version))) {
        return false // ...and ensure strings of whitespace fail
    }
    if (parseInt(version) < 1) {
        return false
    }
    return true
}
