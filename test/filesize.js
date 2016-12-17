const test = require('tape');
const fs = require('fs');
const _ = require('lodash');
const { FileSize } = require('..');

const testData = require('./fixtures/test-data.json')
    .filter(obj => !/^dummy/.test(obj.filename))
    .map(obj => ({
        file: fs.createReadStream(`${__dirname}/samples/${obj.filename}`),
        metadata: { filename: obj.filename, mimetype: obj.mimetype },
        expected: _.pick(obj, ['size']),
    }));

test('stream', (t) => {
    const stream = new FileSize();
    let counter = 0;
    testData.forEach(obj => stream.write(obj));
    stream.end();
    stream.on('data', (chunk) => {
        t.deepEqual(chunk, testData[counter].expected, `chunk #${counter} match`);
        counter++;
    });
    stream.on('end', t.end);
});
