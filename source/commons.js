const constants = require("./constants")

exports.filterAndUpdateOne = async (query, next) => {

    // load the base version
    let base = await queryOne (query, next)
    if (base === null) next()
        
    // get the transaction session
    const session = query.options.session

    // store the session for the save method
    base[constants.SESSION] = session
    
    await base.save({session})

    // special case for the replace document, avoid the version to get reseted to zero
    if (!query._update["$set"]) {
        query._update[constants.VERSION] = base[constants.VERSION]
        query._update[constants.VALIDITY] = base[constants.VALIDITY]
    }
    
    next()
}

exports.filterAndUpdate = async (query, next) => {
    
    // load the base version
    let bases = await query.model
        .find(query._conditions)
        .then((foundBases) => {
            return foundBases})
    
    // get the transaction session
    const session = query.options.session

    for(base of bases) {
    
        // store the session for the save method
        base[constants.SESSION] = session
        
        await base.save({session})
    }
    next()
}

getQueryOptions = (query) => {
    let sort = query.options.sort || {}
    let skip = query.options.skip || 0

    return {sort, skip}
}

queryOne = async (query, next) => {
    // load the base version
    let base = await query.model.findOne(query._conditions, null, getQueryOptions(query))
    return base
}