const test = require('tape');
const async = require('async');
const Pick = require('../lib/transform/Pick');

test('paths is string', (t) => {
    const stream = new Pick('metadata', 'extra');
    const SAMPLE = {
        chunk: {
            metadata: { a: 1 },
            extra: null,
            errors: [],
        },
        expected: {
            metadata: { a: 1 },
            extra: null,
        },
    };
    stream.once('data', (actual) => {
        t.deepEqual(actual, SAMPLE.expected, 'chunk match');
    });
    stream.write(SAMPLE.chunk);
    stream.once('end', t.end);
    stream.end();
});

test('paths is array', (t) => {
    const stream = new Pick(['metadata', 'extra']);
    const SAMPLE = {
        chunk: {
            metadata: { a: 1 },
            extra: null,
            errors: [],
        },
        expected: {
            metadata: { a: 1 },
            extra: null,
        },
    };
    stream.once('data', (actual) => {
        t.deepEqual(actual, SAMPLE.expected, 'chunk match');
    });
    stream.write(SAMPLE.chunk);
    stream.once('end', t.end);
    stream.end();
});

test('without paths', (t) => {
    const stream = new Pick();
    const SAMPLE = {
        chunk: {
            metadata: { a: 1 },
            errors: [],
        },
        expected: {},
    };
    stream.once('data', (actual) => {
        t.deepEqual(actual, SAMPLE.expected, 'chunk match');
    });
    stream.write(SAMPLE.chunk);
    stream.once('end', t.end);
    stream.end();
});

test('invalid chunk', (t) => {
    const stream = new Pick('metadata');
    async.series([
        (cb) => {
            stream.once('data', ({ errors }) => {
                t.ok(Array.isArray(errors), 'errors is array');
                t.equal(errors[0].name, 'InvalidChunk', 'chunk #1 error is `InvalidChunk`');
            });
            stream.write([], cb);
        },
    ], () => {
        stream.once('end', t.end);
        stream.end();
    });
});
