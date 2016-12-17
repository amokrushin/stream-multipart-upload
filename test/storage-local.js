const test = require('tape');
const fs = require('fs-extra');
const path = require('path');
const { StorageLocal } = require('..');

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
    t.throws(() => {
        new StorageLocal(); // eslint-disable-line no-new
    }, /dir is not defined/, 'throws error if dir was not set');
    t.end();
});

test('stream', (t) => {
    const stream = new StorageLocal({ dir });
    let counter = 0;

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    testData.forEach((obj) => {
        fs.copySync(obj.filepath, obj.metadata.localTmpFilepath);
        stream.write(obj.metadata);
    });

    stream
        .on('data', (chunk) => {
            t.equal(chunk.localTmpFilepath, undefined, `chunk #${counter} localTmpFilepath removed`);
            t.ok(chunk.storageLocalFilename, `chunk #${counter} storageLocalFilename set`);
            t.ok(reUuid.test(chunk.storageLocalFilename), `chunk #${counter} storageLocalFilename match uuid`);
            t.ok(chunk.storageLocalFilepath, `chunk #${counter} storageLocalFilepath set`);
            t.equal(path.dirname(chunk.storageLocalFilepath), dir, `chunk #${counter} path match`);
            t.ok(fs.existsSync(chunk.storageLocalFilepath), 'file exists');
            counter++;
        })
        .on('end', t.end)
        .end();
});

test('stream - cleanup, then pass error', (t) => {
    const stream = new StorageLocal({ dir });
    let counter = 0;
    const error = new Error();

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    testData.forEach((obj) => {
        fs.copySync(obj.filepath, obj.metadata.localTmpFilepath);
        stream.write(Object.assign({ error }, obj.metadata));
    });

    stream
        .on('data', (chunk) => {
            t.equal(chunk.error, error, `chunk #${counter} has error`);
            t.equal(chunk.localTmpFilepath, undefined, `chunk #${counter} localTmpFilepath removed`);
            t.ok(!fs.existsSync(testData[counter].metadata.localTmpFilepath), 'temp file removed');
            counter++;
        })
        .on('end', t.end)
        .end();
});

test('options.filenameProperty', (t) => {
    const stream = new StorageLocal({ dir, filenameProperty: 'id' });
    let counter = 0;

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    testData.forEach((obj) => {
        fs.copySync(obj.filepath, obj.metadata.localTmpFilepath);
        stream.write(obj.metadata);
    });

    stream
        .on('data', (chunk) => {
            t.ok(chunk.storageLocalFilename.includes(testData[counter].metadata.id),
                `chunk #${counter} storageLocalFilename match`);
            t.equal(path.dirname(chunk.storageLocalFilepath), dir, `chunk #${counter} path match`);
            t.ok(fs.existsSync(chunk.storageLocalFilepath), 'file exists');
            counter++;
        })
        .on('end', t.end)
        .end();
});

test('options.filenameFn', (t) => {
    const stream = new StorageLocal({
        dir,
        filenameFn: metadata => `test-${metadata.id}`,
    });
    let counter = 0;

    fs.emptyDirSync(tmpDir);
    fs.emptyDirSync(dir);

    testData.forEach((obj) => {
        fs.copySync(obj.filepath, obj.metadata.localTmpFilepath);
        stream.write(obj.metadata);
    });

    stream
        .on('data', (chunk) => {
            t.ok(chunk.storageLocalFilename.includes(`test-${testData[counter].metadata.id}`),
                `chunk #${counter} storageLocalFilename match`);
            t.equal(path.dirname(chunk.storageLocalFilepath), dir, `chunk #${counter} path match`);
            t.ok(fs.existsSync(chunk.storageLocalFilepath), 'file exists');
            counter++;
        })
        .on('end', t.end)
        .end();
});

test('options.ensureDir = false', (t) => {
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
