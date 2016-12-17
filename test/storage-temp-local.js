const test = require('tape');
const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const os = require('os');
const { StorageTempLocal } = require('..');
const uuid = require('uuid');

const reUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const testData = [
    {
        file: fs.createReadStream(`${__dirname}/samples/1px.png`),
        metadata: { filename: '1px.png' },
    },
    {
        file: fs.createReadStream(`${__dirname}/samples/1px.jpg`),
        metadata: { filename: '1px.jpg' },
    },
    {
        file: fs.createReadStream(`${__dirname}/samples/1px.gif`),
        metadata: { filename: '1px.gif' },
    },
];
const tmpFiles = [];
const TMP_DIR = `${process.cwd()}/${uuid.v1()}`;

test('os.tmpdir', (t) => {
    t.plan(1);
    const stream = new StorageTempLocal();

    stream.write({
        file: fs.createReadStream(`${__dirname}/samples/1px.png`),
        metadata: { filename: '1px.png' },
    });

    stream
        .on('data', (chunk) => {
            t.equal(path.dirname(chunk.localTmpFilepath), os.tmpdir(), 'path match os.tmpdir()');
            tmpFiles.push(chunk.localTmpFilepath);
        })
        .on('end', t.end)
        .end();
});

test('options.tmpDir', (t) => {
    t.plan(1);
    const stream = new StorageTempLocal({ tmpDir: TMP_DIR });

    stream.write({
        file: fs.createReadStream(`${__dirname}/samples/1px.png`),
        metadata: { filename: '1px.png' },
    });

    stream
        .on('data', (chunk) => {
            t.equal(path.dirname(chunk.localTmpFilepath), TMP_DIR, 'path match TMP_DIR');
            tmpFiles.push(chunk.localTmpFilepath);
        })
        .on('end', t.end)
        .end();
});

test('stream', (t) => {
    t.plan(3 * 3);
    const stream = new StorageTempLocal();
    let counter = 0;

    testData.forEach(obj => stream.write(obj));

    stream
        .on('data', (chunk) => {
            t.ok(chunk.localTmpFilepath, `chunk #${counter} localTmpFilepath set`);
            t.equal(path.dirname(chunk.localTmpFilepath), os.tmpdir(), `chunk #${counter} temp path match`);
            t.ok(reUuid.test(path.basename(chunk.localTmpFilepath)), `chunk #${counter} temp filename match uuid`);
            tmpFiles.push(chunk.localTmpFilepath);
            counter++;
        })
        .on('end', t.end)
        .end();
});

test('invalid chunk format', (t) => {
    t.plan(1);
    const stream = new StorageTempLocal();
    stream.once('error', (err) => {
        t.ok(/Invalid chunk format: file is not readable stream/.test(err.message), 'invalid chunk error');
        t.end();
    });
    stream.end({});
});

test('teardown', (t) => {
    async.each(tmpFiles, fs.unlink, (err) => {
        t.ifError(err, 'temp files removed');
        fs.rmdir(TMP_DIR, (e) => {
            t.ifError(e, 'temp dir removed');
            t.end();
        });
    });
});
