const test = require('tape');
const fs = require('fs-extra');
const StorageTempS3 = require('../lib/pre-processor/StorageTempS3');

const TEST_BUCKET = 'test-stream-multipart-upload';

const reUuidKey = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('missing option bucket', (t) => {
    t.throws(() => new StorageTempS3(), /Missing required key `bucket` in options/, 'missing options');
    t.throws(() => new StorageTempS3({}), /Missing required key `bucket` in options/, 'missing option `bucket`');
    t.end();
});

test('stream default mock', (t) => {
    t.plan(3);

    const CHUNK = {
        file: fs.createReadStream(`${__dirname}/samples/1px.png`),
        metadata: { filename: '1px.png' },
    };

    const stream = new StorageTempS3({
        bucket: TEST_BUCKET,
        client: {
            upload(params, callback) {
                params.Body.resume();
                callback(null, { Bucket: params.Bucket, Key: params.Key });
            },
        },
    });

    stream
        .on('data', ({ metadata }) => {
            t.equal(metadata.s3TempBucket, TEST_BUCKET, 'metadata `s3TempBucket` match'); // 1
            t.ok(reUuidKey.test(metadata.s3TempKey), 'metadata `s3TempKey` is uuid'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end(CHUNK);
});

test('mock S3CopyError ', (t) => {
    t.plan(3);

    const CHUNK = {
        file: fs.createReadStream(`${__dirname}/samples/1px.png`),
        metadata: { filename: '1px.png' },
    };

    const stream = new StorageTempS3({
        bucket: TEST_BUCKET,
        client: {
            upload(params, callback) {
                params.Body.resume();
                callback(new Error());
            },
        },
    });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'S3UploadError', 'error is S3UploadError'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end(CHUNK);
});

test('invalid chunk ', (t) => {
    t.plan(3);

    const CHUNK = {
        metadata: { filename: '1px.png' },
    };

    const stream = new StorageTempS3({
        bucket: TEST_BUCKET,
        client: {
            upload(params, callback) {
                params.Body.resume();
                callback(new Error());
            },
        },
    });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'InvalidChunk', 'chunk error is `InvalidChunk`'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end(CHUNK);
});
