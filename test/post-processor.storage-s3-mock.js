const test = require('tape');
const StorageS3 = require('../lib/post-processor/StorageS3');
const path = require('path');

const TEST_BUCKET = 'test-stream-multipart-upload';
const reUuidKey = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

test('missing option bucket', (t) => {
    t.throws(() => new StorageS3(), /Missing required key `bucket` in options/, 'missing options');
    t.throws(() => new StorageS3({}), /Missing required key `bucket` in options/, 'missing option `bucket`');
    t.end();
});

test('missing chunk fields', (t) => {
    t.plan(7);
    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) { callback(); },
            deleteObject(params, callback) { callback(); },
        },
    });
    stream
        .on('data', (chunk) => {
            t.ok(Array.isArray(chunk.errors), 'chunk errors is array'); // 1
            t.equal(chunk.errors.length, 4, '4 missing fields'); // 2
            chunk.errors.forEach((error, i) => {
                t.equal(error.name, 'MissingRequiredField', `chunk error #${i} is 'MissingRequiredField'`);
            }); // 3-6
        })
        .once('end', () => t.pass('stream end')) // 7
        .end({});
});

test('mock default', (t) => {
    t.plan(9);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
    };

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) {
                t.pass('s3 copy called');
                callback(); // 8
            },
            deleteObject(params, callback) {
                t.pass('s3 delete called'); // 9
                callback();
            },
        },
    });

    stream
        .on('data', ({ metadata, errors }) => {
            t.ok(!errors || !errors.length, 'no errors'); // 1
            t.ok(!Object.keys(metadata).includes('s3TempBucket'), 'metadata not includes `s3TempBucket`'); // 2
            t.ok(!Object.keys(metadata).includes('s3TempKey'), 'metadata not includes `s3TempKey`'); // 3
            t.ok(Object.keys(metadata).includes('s3Bucket'), 'metadata includes `s3Bucket`'); // 4
            t.ok(Object.keys(metadata).includes('s3Key'), 'metadata includes `s3Key`'); // 5
            t.equal(metadata.s3Bucket, TEST_BUCKET, 'metadata `s3Bucket` match'); // 6
        })
        .once('end', () => t.pass('stream end')) // 7
        .end({ metadata: METADATA });
});

test('mock options.path', (t) => {
    t.plan(4);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
        extra: 'value',
    };
    const UPLOADS_PATH = 'uploads';

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        path: UPLOADS_PATH,
        client: {
            copyObject(params, callback) { callback(); },
            deleteObject(params, callback) { callback(); },
        },
    });

    stream
        .on('data', ({ metadata }) => {
            t.ok(metadata.s3Key.includes(UPLOADS_PATH), 'metadata `s3Key` includes path'); // 1
            t.ok(reUuidKey.test(metadata.s3Key), 'metadata `s3Key` filename is uuid'); // 2
            t.equal(path.extname(metadata.s3Key), path.extname(METADATA.filename), 'metadata `s3Key` extension match');
        })
        .once('end', () => t.pass('stream end')) // 4
        .end({ metadata: METADATA });
});

test('mock options.saveMetadata', (t) => {
    t.plan(7);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
        extra: 'value',
    };

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) {
                t.equal(typeof params.Metadata, 'object', 'parameter Metadata set'); // 1
                t.equal(params.Metadata.filename, METADATA.filename, 'metadata field `filename` match'); // 2
                t.equal(params.Metadata['content-type'], METADATA.contentType, 'metadata field `contentType` match');
                t.equal(params.Metadata.extra, METADATA.extra, 'metadata field `contentType` match'); // 4
                t.equal(params.Metadata.s3TempBucket, undefined, 'metadata field `s3TempBucket` removed'); // 5
                t.equal(params.Metadata.s3TempKey, undefined, 'metadata field `s3TempKey` removed'); // 6
                callback();
            },
            deleteObject(params, callback) { callback(); },
        },
        saveMetadata: true,
    });

    stream
        .resume()
        .once('end', () => t.pass('stream end')) // 7
        .end({ metadata: METADATA });
});

test('mock chunk has errors', (t) => {
    t.plan(5);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
    };
    const ERRORS = [
        new Error('Some error'),
    ];

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) {
                t.fail('s3 copy not called');
                callback();
            },
            deleteObject(params, callback) {
                t.pass('s3 delete called'); // 5
                callback();
            },
        },
    });

    stream
        .on('data', ({ metadata, errors }) => {
            t.deepEqual(errors, ERRORS, 'errors match'); // 1
            t.ok(!Object.keys(metadata).includes('s3TempBucket'), 'metadata not includes `s3TempBucket`'); // 2
            t.ok(!Object.keys(metadata).includes('s3TempKey'), 'metadata not includes `s3TempKey`'); // 3
        })
        .once('end', () => t.pass('stream end')) // 4
        .end({ metadata: METADATA, errors: ERRORS });
});

test('mock chunk errors is null', (t) => {
    t.plan(2);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
    };
    const ERRORS = null;

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) { callback(); },
            deleteObject(params, callback) { callback(); },
        },
    });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors, undefined, 'no errors'); // 1
        })
        .once('end', () => t.pass('stream end')) // 2
        .end({ metadata: METADATA, errors: ERRORS });
});

test('mock S3CopyError ', (t) => {
    t.plan(4);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
    };

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) { callback(new Error()); },
            deleteObject(params, callback) {
                t.pass('s3 delete called'); // 4
                callback();
            },
        },
    });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'S3CopyError', 'error is S3CopyError'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end({ metadata: METADATA });
});

test('mock S3DeleteError ', (t) => {
    t.plan(4);
    const METADATA = {
        filename: '1px.jpg',
        s3TempBucket: 'test-stream-multipart-upload',
        s3TempKey: 'temp/a0cb9c50-c7e7-11e6-a136-7baaf95daff1',
        contentType: 'application/octet-stream',
    };

    const stream = new StorageS3({
        bucket: TEST_BUCKET,
        client: {
            copyObject(params, callback) {
                t.pass('s3 copy called'); // 4
                callback();
            },
            deleteObject(params, callback) { callback(new Error()); },
        },
    });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'S3DeleteError', 'error is S3DeleteError'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end({ metadata: METADATA });
});
