const test = require('tape');
const fs = require('fs-extra');
const path = require('path');
const { pick } = require('lodash');
const StorageLocal = require('../lib/post-processor/StorageLocal');

const reUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const tmpDir = `${process.cwd()}/temp`;
const dir = `${process.cwd()}/uploads`;

const testData = [
    {
        filepath: `${__dirname}/samples/1px.png`,
        metadata: {
            filename: '1px.png',
            localTmpFilepath: `${process.cwd()}/temp/1px.png`,
            id: 'file-1',
        },
    },
    {
        filepath: `${__dirname}/samples/1px.jpg`,
        metadata: {
            filename: '1px.jpg',
            localTmpFilepath: `${process.cwd()}/temp/1px.jpg`,
            id: 'file-2',
        },
    },
    {
        filepath: `${__dirname}/samples/1px.gif`,
        metadata: {
            filename: '1px.gif',
            localTmpFilepath: `${process.cwd()}/temp/1px.gif`,
            id: 'file-3',
        },
    },
];

test('constructor', (t) => {
    t.throws(() => new StorageLocal(), /Missing required key `dir` in options/, 'missing options');
    t.throws(() => new StorageLocal({}), /Missing required key `dir` in options/, 'missing option `dir`');
    t.end();
});

test('stream', (t) => {
    t.plan((testData.length * 7) + 1);
    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    const stream = new StorageLocal({ dir });
    let counter = 0;

    testData.forEach((obj) => {
        fs.copySync(obj.filepath, obj.metadata.localTmpFilepath);
        stream.write({ metadata: obj.metadata });
    });

    stream
        .on('data', ({ metadata, errors }) => {
            t.ok(!errors || !errors.length, 'no errors'); // 1
            t.equal(metadata.localTmpFilepath, undefined, `chunk #${counter} localTmpFilepath removed`); // 2
            t.ok(metadata.storageLocalFilename, `chunk #${counter} storageLocalFilename set`); // 3
            t.ok(reUuid.test(metadata.storageLocalFilename), `chunk #${counter} storageLocalFilename match uuid`); // 4
            t.ok(metadata.storageLocalFilepath, `chunk #${counter} storageLocalFilepath set`); // 5
            t.equal(path.dirname(metadata.storageLocalFilepath), dir, `chunk #${counter} path match`); // 6
            t.ok(fs.existsSync(metadata.storageLocalFilepath), 'file exists'); // 7
            counter++;
        })
        .once('end', () => t.pass('stream end')) // +1
        .end();
});

test('chunk has error', (t) => {
    t.plan(4);
    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    const stream = new StorageLocal({ dir });

    fs.copySync(testData[0].filepath, testData[0].metadata.localTmpFilepath);
    stream.write({ metadata: testData[0].metadata, errors: [new Error()] });

    stream
        .on('data', ({ metadata, errors }) => {
            t.deepEqual(errors, [new Error()], 'chunk has error'); // 1
            t.equal(metadata.localTmpFilepath, undefined, 'chunk "localTmpFilepath" removed'); // 2
            t.ok(!fs.existsSync(testData[0].metadata.localTmpFilepath), 'temp file removed'); // 3
        })
        .once('end', () => t.pass('stream end')) // 4
        .end();
});

test('chunk missing field', (t) => {
    t.plan(3);
    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    const stream = new StorageLocal({ dir });

    fs.copySync(testData[0].filepath, testData[0].metadata.localTmpFilepath);
    stream.write({ metadata: pick(testData[0].metadata, 'filename') });

    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'MissingRequiredField', 'error is "MissingRequiredField"'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end();
});

test('options.filenameProperty', (t) => {
    t.plan(5);
    const stream = new StorageLocal({ dir, filenameProperty: 'id' });

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    fs.copySync(testData[0].filepath, testData[0].metadata.localTmpFilepath);
    stream.write({ metadata: testData[0].metadata });

    stream
        .on('data', ({ metadata, errors }) => {
            t.ok(!errors || !errors.length, 'no errors'); // 1
            t.ok(metadata.storageLocalFilename.includes(testData[0].metadata.id),
                'chunk "storageLocalFilename" match'); // 2
            t.equal(path.dirname(metadata.storageLocalFilepath), dir, 'chunk path match'); // 3
            t.ok(fs.existsSync(metadata.storageLocalFilepath), 'file exists'); // 4
        })
        .once('end', () => t.pass('stream end')) // 5
        .end();
});

test('options.filenameFn', (t) => {
    t.plan(5);
    const stream = new StorageLocal({
        dir,
        filenameFn: metadata => `test-${metadata.id}`,
    });

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    fs.copySync(testData[0].filepath, testData[0].metadata.localTmpFilepath);
    stream.write({ metadata: testData[0].metadata });

    stream
        .on('data', ({ metadata, errors }) => {
            t.ok(!errors || !errors.length, 'no errors'); // 1
            t.ok(metadata.storageLocalFilename.includes(`test-${testData[0].metadata.id}`),
                'chunk storageLocalFilename match'); // 2
            t.equal(path.dirname(metadata.storageLocalFilepath), dir, 'chunk path match'); // 3
            t.ok(fs.existsSync(metadata.storageLocalFilepath), 'file exists'); // 4
        })
        .once('end', () => t.pass('stream end')) // 5
        .end();
});

test('without ensureDir option', (t) => {
    fs.removeSync(dir);
    t.throws(() => {
        // eslint-disable-next-line no-new
        new StorageLocal({ dir, ensureDir: false });
    }, /ENOENT/, 'no such file or directory error');
    t.end();
});

test('cleanup', (t) => {
    fs.removeSync(tmpDir);
    fs.removeSync(dir);
    t.end();
});
