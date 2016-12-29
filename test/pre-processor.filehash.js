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

test('algorithmNameAsKey option', (t) => {
    const stream = new FileHash({ algorithmNameAsKey: false });
    stream.end({
        file: fs.createReadStream(`${__dirname}/samples/1px-canon-650d.jpg`),
        metadata: { filename: '1px-canon-650d.jpg', contentType: 'image/jpeg' },
    });
    stream.on('data', ({ metadata }) => {
        t.deepEqual(metadata, {
            hash: '189bb3ac57b640235ace1b8f1a1a76a2db7b46bc',
        }, 'chunk match');
    });
    stream.on('end', t.end);
});
