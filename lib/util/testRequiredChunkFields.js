const { MissingRequiredField } = require('../errors');
const { get } = require('lodash');

function testRequiredChunkFields(obj, fields, name, prefix) {
    const errors = [];
    for (let i = 0; i < fields.length; i++) {
        if (typeof get(obj, fields[i]) === 'undefined') {
            errors.push(new MissingRequiredField(`${name} missing chunk field ${[prefix, fields[i]].join('.')}`));
        }
    }
    return errors.length ? errors : null;
}

module.exports = testRequiredChunkFields;
