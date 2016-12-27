const { Transform } = require('stream');
const { castArray, omit } = require('lodash');

class StringifyError extends Transform {
    constructor() {
        super({ objectMode: true });
    }

    _transform(chunk, encoding, callback) {
        if (Array.isArray(chunk.errors) ? chunk.errors.length : chunk.errors) {
            callback(null, Object.assign(
                {},
                chunk,
                { errors: castArray(chunk.errors).map(err => err.message) }
            ));
        } else {
            callback(null, omit(chunk, ['errors']));
        }
    }
}

module.exports = StringifyError;
