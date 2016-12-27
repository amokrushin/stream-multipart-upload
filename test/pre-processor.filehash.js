const test = require('tape');
const fs = require('fs');
const _ = require('lodash');
const FileHash = require('../lib/pre-processor/FileHash');

const testData = require('./fixtures/test-data.json')
    .filter(obj => !/^dummy/.test(obj.filename))
    .map(obj => ({
        file: fs.createReadStream(`${__dirname}/samples/${obj.filename}`),
        metadata: { filename: obj.filename, contentType: obj.contentType },
        expected: _.pick(obj, ['sha1']),
    }));

test('stream', (t) => {
    const stream = new FileHash({ encoding: 'bs58' });
    let counter = 0;
    testData.forEach(obj => stream.write(_.pick(obj, 'file')));
    stream.end();
    stream.on('data', ({ metadata }) => {
        t.deepEqual(metadata, testData[counter].expected, `chunk #${counter} match`);
        counter++;
    });
    stream.on('end', t.end);
});

test('invalid chunk format', (t) => {
    t.plan(3);
    const stream = new FileHash();
    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'InvalidChunk', 'chunk error is `InvalidChunk`'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end({});
});
