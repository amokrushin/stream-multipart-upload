const test = require('tape');
const fs = require('fs');
const _ = require('lodash');
const os = require('os');
const uuid = require('uuid');
const Exiftool = require('../lib/pre-processor/Exiftool');

const testData = require('./fixtures/test-data.json')
    .filter(obj => !/^dummy/.test(obj.filename))
    // eslint-disable-next-line no-confusing-arrow
    .map(obj => obj.size === 0 ? _.omit(obj, ['contentType']) : obj)
    .map(obj => ({
        file: fs.createReadStream(`${__dirname}/samples/${obj.filename}`),
        metadata: { filename: obj.filename, contentType: obj.contentType },
        expected: _.pick(obj, [
            'create',
            'modify',
            'contentType',
            'width',
            'height',
            'orientation',
            'gpsLatitude',
            'gpsLongitude',
            'gpsTimestamp',
            'cameraModel',
            'cameraAperture',
            'cameraExposureTime',
            'cameraFocalLength',
            'cameraISO',
            'cameraDatetime',
            'cameraLensModel',
            'cameraFlashMode',
            'cameraFlashFired',
            'warning',
        ]),
    }));

const TMP_DIR = `${os.tmpdir()}/${uuid.v1()}`;

test('constructor', (t) => {
    t.throws(() => {
        new Exiftool({ ExiftoolTask: () => {} }); // eslint-disable-line no-new
    }, /ExiftoolTask should inherit Task/, 'throws error if invalid ExiftoolTask');
    t.end();
});

test('stream', (t) => {
    const stream = new Exiftool({ tmpDir: TMP_DIR });
    let counter = 0;
    testData.forEach(obj => stream.write(obj));
    stream.end();
    stream.on('data', ({ metadata, errors }) => {
        if (errors) {
            t.fail(errors);
        }
        t.deepEqual(metadata, testData[counter].expected, `${testData[counter].metadata.filename} metadata match`);
        counter++;
    });
    stream.on('end', t.end);
});

test('teardown', (t) => {
    Exiftool.end();
    fs.rmdir(TMP_DIR, (err) => {
        t.ok(!err, 'temp dir is empty');
        t.ifError(err, 'temp dir removed');
        t.end();
    });
});

test('invalid chunk format', (t) => {
    t.plan(3);
    const stream = new Exiftool();
    stream
        .on('data', ({ errors }) => {
            t.equal(errors.length, 1, 'single error'); // 1
            t.equal(errors[0].name, 'InvalidChunk', 'chunk error is `InvalidChunk`'); // 2
        })
        .once('end', () => t.pass('stream end')) // 3
        .end({});
});
