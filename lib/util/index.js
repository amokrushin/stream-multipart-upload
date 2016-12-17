const _ = require('lodash');

function omitByRecursively(value, iteratee) {
    return _.isObject(value) ?
        _(value)
            .mapValues(v => omitByRecursively(v, iteratee))
            .omitBy(iteratee)
            .value() :
        value;
}

module.exports = {
    omitByRecursively,
};
