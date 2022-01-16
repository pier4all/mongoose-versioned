const constants = require("./constants")

exports.cloneSchema = (schema, mongoose) => {
    let clonedSchema = new mongoose.Schema({autoIndex: false})
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

exports.isWritable = (field) => {
    return !constants.RESERVED_FIELDS.find(
        key => key === field
    )
}

exports.isValidVersion = (v) => {
    if (typeof v != "string") return false // we only process strings!
    if (isNaN(v)) return false // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    if (isNaN(parseInt(v))) return false// ...and ensure strings of whitespace fail
    if (parseInt(v) < 1) return false
    return true
}
