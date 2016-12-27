const test = require('tape');
const StringifyError = require('../lib/transform/StringifyError');

const testData = [
    // 0
    {
        metadata: { description: 'without error' },
        expected: { description: 'without error' },
    },
    // 1
    {
        metadata: {
            description: 'single error',
            errors: new Error('Error A'),
        },
        expected: {
            description: 'single error',
            errors: ['Error A'],
        },
    },
    // 2
    {
        metadata: {
            description: 'multiple errors',
            errors: [new Error('Error A'), new TypeError('Error B')],
        },
        expected: {
            description: 'multiple errors',
            errors: ['Error A', 'Error B'],
        },
    },
    // 3
    {
        metadata: {
            description: 'empty error string',
            errors: '',
        },
        expected: {
            description: 'empty error string',
        },
    },
    // 4
    {
        metadata: {
            description: 'empty error array',
            errors: [],
        },
        expected: {
            description: 'empty error array',
        },
    },
    // 5
    {
        metadata: {
            description: 'empty error null',
            errors: '',
        },
        expected: {
            description: 'empty error null',
        },
    },
];

test('stream', (t) => {
    const stream = new StringifyError();
    let counter = 0;
    testData.forEach(sample => stream.write(sample.metadata));
    stream.end();
    stream.on('data', (chunk) => {
        t.deepEqual(chunk, testData[counter].expected, `chunk #${counter} match`);
        counter++;
    });
    stream.on('end', t.end);
});
