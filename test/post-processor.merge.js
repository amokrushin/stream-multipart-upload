const test = require('tape');
const async = require('async');
const Merge = require('../lib/post-processor/Merge');

test('metadata and errors', (t) => {
    const stream = new Merge();
    const SAMPLES = [
        {
            chunk: [
                {},
                {},
                {},
            ],
            expected: {},
        },
        {
            chunk: [
                { metadata: { a: 1 } },
                { errors: [] },
            ],
            expected: {
                metadata: { a: 1 },
                errors: [],
            },
        },
        {
            chunk: [
                { metadata: { a: 1 } },
                { metadata: { b: 2 } },
                { metadata: { c: 3 } },
                { metadata: { a: 4 } },
            ],
            expected: {
                metadata: { a: 4, b: 2, c: 3 },
            },
        },
        {
            chunk: [
                { metadata: { a: 1 }, errors: [new Error('a')] },
                { metadata: { b: 2 }, errors: [new Error('b')] },
                { metadata: { a: 3 } },
            ],
            expected: {
                metadata: { a: 3, b: 2 },
                errors: [new Error('a'), new Error('b')],
            },
        },
    ];
    async.eachOfSeries(SAMPLES, (sample, n, cb) => {
        stream.once('data', (actual) => {
            t.deepEqual(actual, sample.expected, `chunk ${n} match`);
        });
        stream.write(sample.chunk, cb);
    }, () => {
        stream.once('end', t.end);
        stream.end();
    });
});

test('invalid chunk', (t) => {
    const stream = new Merge();
    async.series([
        (cb) => {
            stream.once('data', ({ errors }) => {
                t.ok(Array.isArray(errors), 'errors is array');
                t.equal(errors[0].name, 'InvalidChunk', 'chunk #1 error is `InvalidChunk`');
            });
            stream.write({}, cb);
        },
        (cb) => {
            stream.once('data', ({ errors }) => {
                t.ok(Array.isArray(errors), 'errors is array');
                t.equal(errors[0].name, 'InvalidChunk', 'chunk #2 error is `InvalidChunk`');
            });
            stream.write([1, 2, 3], cb);
        },
    ], () => {
        stream.once('end', t.end);
        stream.end();
    });
});
