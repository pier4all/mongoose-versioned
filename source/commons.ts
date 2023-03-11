import constants from './constants'

export async function filterAndModifyOne <T>(query: any, next: any) {
    // load the base version
    let base = await queryOne (query, next)
    if (base === null) {
        next()
    }
    else {
        // get the transaction session
        const session = query.options.session

        // store the session for the save method
        base[constants.SESSION] = session

        if (!query._update) {
            // special case for delete operations
            base[constants.DELETER] = query.options[constants.DELETER] || constants.DEFAULT_DELETER
        } else {
            // special case for update operations
            base[constants.EDITOR] = query.options[constants.EDITOR] || constants.DEFAULT_EDITOR
        }

        await base.save({ session })

        // special case for the replace document, avoid the version to get reseted to zero
        if ((query._update) && (!query._update['$set'])) {
            query._update[constants.VERSION] = base[constants.VERSION]
            query._update[constants.VALIDITY] = base[constants.VALIDITY]
        }
    }
    next()
}

export async function filterAndModifyMany (query: any, next: any) {

    // load the base version
    let bases = await query.model
        .find(query._conditions)

    // get the transaction session
    const session = query.options.session

    for(let base of bases) {

        // store the session for the save method
        base[constants.SESSION] = session

        if (!query._update) {
            // special case for delete operations
            base[constants.DELETER] = query.options[constants.DELETER] || constants.DEFAULT_DELETER
        } else {
            // special case for update operations
            base[constants.EDITOR] = query.options[constants.EDITOR] || constants.DEFAULT_EDITOR
        }

        await base.save({session})
    }
    next()
}

function getQueryOptions (query: any) {
    // only for findOneAndUpdate
    let sort = {}
    let skip = 0

    if (query.op.startsWith('find')) {
        sort = query.options.sort || {}
    }

    return { sort, skip }
}

async function queryOne (query: any, next: any) {
    // load the base version
    let base = await query.model.findOne(query._conditions, null, getQueryOptions(query))
    return base
}
