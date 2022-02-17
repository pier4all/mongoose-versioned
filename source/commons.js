const constants = require("./constants")

exports.filterAndModifyOne = async (query, next) => {

    // load the base version
    let base = await queryOne (query, next)
    if (base === null) next()
    else {
        // get the transaction session
        const session = query.options.session

        // store the session for the save method
        base[constants.SESSION] = session

        if (!query._update) {
            // special case for delete operations
            let delete_info = query.options[constants.DELETION] || {}
            delete_info[constants.DELETER] = delete_info[constants.DELETER] || constants.DEFAULT_DELETER
            base[constants.DELETION] = delete_info
        }

        await base.save({session})

        // special case for the replace document, avoid the version to get reseted to zero
        if ((query._update) && (!query._update["$set"])) {
            query._update[constants.VERSION] = base[constants.VERSION]
            query._update[constants.VALIDITY] = base[constants.VALIDITY]
        }

    }

    next()
}

exports.filterAndModifyMany = async (query, next) => {

    // load the base version
    let bases = await query.model
        .find(query._conditions)
    
    // get the transaction session
    const session = query.options.session

    for(base of bases) {

        // store the session for the save method
        base[constants.SESSION] = session

        if (!query._update) {
            // special case for delete operations
            let delete_info = query.options[constants.DELETION] || {}
            delete_info[constants.DELETER] = delete_info[constants.DELETER] || constants.DEFAULT_DELETER
            base[constants.DELETION] = delete_info
        }

        await base.save({session})
    }
    next()
}

getQueryOptions = (query) => {
    // only for findOneAndUpdate
    let sort = {}
    let skip = 0

    if (query.op.startsWith("find")) {
        sort = query.options.sort || {}
    }

    return {sort, skip}
}

queryOne = async (query, next) => {
    // load the base version
    let base = await query.model.findOne(query._conditions, null, getQueryOptions(query))
    return base
}
