
// Constants
const VERSION = "_version"
const ID = "_id"
const VALIDITY = "_validity"
const EDITOR = "_editor"
const DELETER = "_deleter"
const DEFAULT_EDITOR = "default"
const DELETION = "_deletion"
const DEFAULT_DELETER = "deleter"
const EDITION = "_edition"
const SESSION = "_session"

const RESERVED_FIELDS = [
    VERSION,
    VALIDITY,
    EDITOR,
    DELETER,
    DELETION,
    EDITION,
    SESSION ]

module.exports = {
    VERSION,
    ID,
    VALIDITY,
    EDITOR,
    DELETER,
    DEFAULT_EDITOR,
    DEFAULT_DELETER,
    DELETION,
    EDITION,
    SESSION, 
    RESERVED_FIELDS
}