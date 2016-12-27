const test = require('tape');
const fs = require('fs');
const path = require('path');
const StorageTempS3 = require('../../lib/pre-processor/StorageTempS3');
const StorageS3 = require('../../lib/post-processor/StorageS3');
const Merge = require('../../lib/post-processor/Merge');
const Pick = require('../../lib/transform/Pick');
const Zip = require('stream-zip');
const aws = require('aws-sdk');
const async = require('async');

if (process.env.TRAVIS) {
    aws.config.update({ region: 'eu-west-1' });
} else {
    aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'test-stream-multipart-upload' });
}

const s3 = new aws.S3({ apiVersion: '2006-03-01' });

const TEST_BUCKET = 'test-stream-multipart-upload';
const TEMP_DIR = 'temp';
const UPLOADS_DIR = 'uploads';

const SAMPLES = [
    {
        file: fs.createReadStream(path.resolve(__dirname, '../samples', '1px.png')),
        metadata: { filename: '1px.png', contentType: 'image/png', size: 95 },
    },
    {
        file: fs.createReadStream(path.resolve(__dirname, '../samples', '1px.jpg')),
        metadata: { filename: '1px.jpg', contentType: 'image/jpeg', size: 631 },
    },
    {
        file: fs.createReadStream(path.resolve(__dirname, '../samples', '1px.gif')),
        metadata: { filename: '1px.gif', contentType: 'image/gif', size: 35 },
    },
];

const state = {
    tempFiles: [],
    uploadedFiles: [],
    errors: [],
};

test('upload to the temporary storage', (t) => {
    t.plan(3);

    const storageTempS3 = new StorageTempS3({
        bucket: TEST_BUCKET,
        path: TEMP_DIR,
    });
    const storageS3 = new StorageS3({
        bucket: TEST_BUCKET,
        path: UPLOADS_DIR,
        saveMetadata: true,
    });
    const pickMetadata = new Pick('metadata');
    const zip = new Zip();
    const merge = new Merge();

    storageTempS3.once('end', () => t.pass('`storageTempS3` end'));
    storageS3.once('end', () => {
        t.equal(state.errors.length, 0, 'no errors');
        t.pass('`storageS3` end');
    });

    storageTempS3.pipe(zip);
    pickMetadata.pipe(zip);

    storageTempS3.on('data', data => state.tempFiles.push(data.metadata));
    storageS3.on('data', (data) => {
        if (data.errors) {
            state.errors.push(data.errors);
        }
        state.uploadedFiles.push(data.metadata);
    });

    zip.pipe(merge).pipe(storageS3).resume();
    SAMPLES.forEach((sample) => {
        storageTempS3.write(sample);
        pickMetadata.write(sample);
    });
    storageTempS3.end();
    pickMetadata.end();
});

test('check temporary files', (t) => {
    async.eachOf(state.tempFiles, (item, n, next) => {
        s3.headObject({
            Bucket: item.s3TempBucket,
            Key: item.s3TempKey,
        }, (err) => {
            t.ok(err instanceof Error, `#${n} response is error`);
            t.equal(err.code, 'NotFound', `#${n} error is "Not Found"`);
            next();
        });
    }, t.end);
});

test('check uploaded files', (t) => {
    async.eachOf(state.uploadedFiles, (item, n, next) => {
        s3.headObject({
            Bucket: item.s3Bucket,
            Key: item.s3Key,
        }, (err, res) => {
            t.ifError(err, `#${n} no errors`);
            t.equal(res.ContentType, SAMPLES[n].metadata.contentType, `#${n} content type match`);
            t.equal(Number(res.ContentLength), SAMPLES[n].metadata.size, `#${n} size match`);
            next();
        });
    }, t.end);
});

test('cleanup', (t) => {
    async.eachOf(state.uploadedFiles, (item, n, next) => {
        s3.deleteObject({
            Bucket: item.s3Bucket,
            Key: item.s3Key,
        }, next);
    }, (err) => {
        t.ifError(err, 'done without errors');
        t.end();
    });
});
