const test = require('tape');
const FormData = require('form-data');
const fs = require('fs');
const _ = require('lodash');
const { Readable } = require('stream');
const Multipart = require('stream-multipart');

test('class', (t) => {
    t.equal(typeof Multipart, 'function');
    t.equal(typeof Multipart.constructor, 'function');
    t.end();
});

test('normal', (t) => {
    t.plan(14);

    const form = new FormData();
    const parser = new Multipart({ headers: form.getHeaders() });
    let counter = 1;

    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.png`));
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.jpg`));
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.gif`));
    form.pipe(parser);

    parser.on('data', (chunk) => {
        t.ok(chunk.file instanceof Readable, `chunk[${counter}].file is a Readable stream`);
        t.equal(typeof chunk.metadata, 'object', `chunk[${counter}].metadata is an object`);
        t.equal(typeof chunk.metadata.filename, 'string', `chunk[${counter}].metadata.filename is a string`);
        t.equal(typeof chunk.metadata.contentType, 'string', `chunk[${counter}].metadata.contentType is a string`);
        chunk.file.resume();
        counter++;
    }); // 1-12

    parser.on('finish', () => t.pass('parser finish')); // 13
    parser.on('end', () => t.pass('parser end')); // 14
});

test('broken boundary - multiple files', (t) => {
    t.plan(4);

    const form = new FormData();
    const parser = new Multipart({ headers: form.getHeaders() });
    let counter = 1;

    form._lastBoundary = () => `--invalid--${FormData.LINE_BREAK}`;
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.png`));
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.jpg`));
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.gif`));
    form.pipe(parser);

    parser.on('data', (chunk) => {
        chunk.file.once('error', (err) => {
            if (counter >= 3) {
                t.ok(err.message.includes('Part terminated early due to unexpected end of multipart data'),
                    'last file error: unexpected end'); // 1
            } else {
                t.fail('unexpected error');
            }
        });
        chunk.file.resume();
        counter++;
    }); // 1

    parser.on('finish', () => t.pass('parser finish')); // 2
    parser.on('end', () => t.pass('parser end')); // 3
    parser.on('error', (err) => {
        t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end'); // 4
    }); // 4
});

test('broken boundary - single file', (t) => {
    t.plan(4);

    const form = new FormData();
    const parser = new Multipart({ headers: form.getHeaders() });

    form._lastBoundary = () => `--invalid--${FormData.LINE_BREAK}`;
    form.append('file', fs.createReadStream(`${__dirname}/samples/1px.png`));
    form.pipe(parser);

    parser.on('data', (chunk) => {
        chunk.file.once('error', (err) => {
            t.ok(err.message.includes('Part terminated early due to unexpected end of multipart data'),
                'last file error: unexpected end'); // 1
        });
        chunk.file.resume();
    }); // 1

    parser.on('finish', () => t.pass('parser finish')); // 2
    parser.on('end', () => t.pass('parser end')); // 3
    parser.on('error', (err) => {
        t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end');
    }); // 4
});

test('broken boundary - no files', (t) => {
    t.plan(3);

    const form = new FormData();
    const parser = new Multipart({ headers: form.getHeaders() });

    parser.end('some data');

    parser.on('data', () => t.fail('no files'));
    parser.on('finish', () => t.pass('parser finish')); // 1
    parser.on('end', () => t.pass('parser end')); // 2
    parser.on('error', (err) => {
        t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end');
    }); // 3
});

const randomBoundary = () => Math.random().toString(36).slice(2);

const dummyMultipartFile = (boundary, size) => [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="file-${_.uniqueId()}.jpg"`,
    'Content-Type: image/jpeg',
    '',
    _.repeat('0', size || 42),
].join('\r\n').concat('\r\n');

test('broken boundary - dummy files', (t) => {
    t.plan(6);
    const boundary = randomBoundary();
    const parser = new Multipart({
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });

    parser.on('data', (chunk) => {
        chunk.file.once('error', (err) => {
            t.equal(err.message, 'Part terminated early due to unexpected end of multipart data',
                'last file error: unexpected end'); // 1
        });
        chunk.file.once('end', () => {
            t.pass('file end');
        });
        chunk.file.resume();
    }); // 1-3

    parser.on('finish', () => t.pass('parser finish')); // 4
    parser.on('end', () => t.pass('parser end')); // 5
    parser.on('error', (err) => {
        t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end');
    }); // 6

    parser.write(dummyMultipartFile(boundary, 1024));
    parser.write(dummyMultipartFile(boundary, 1024));
    parser.end();
});
