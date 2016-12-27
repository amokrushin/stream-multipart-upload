# stream-multipart-upload
[![NPM Stable Version][npm-stable-version-image]][npm-url]
[![Build Status][travis-master-image]][travis-url]
[![Test Coverage][codecov-image]][codecov-url-master]
[![Dependency Status][david-image]][david-url-master]
[![Node.js Version][node-version-image]][node-version-url]
[![License][license-image]][license-url]


## Features

## Install
 
```
npm install stream-multipart-upload
```

## Example

[Full example source](/example/index.js)

```js
const server = http.createServer((req, res) => {
    const multipart = req.pipe(new Multipart({ headers: req.headers }));
    const zip = new Zip();
    const FS_UPLOADS_DIR = '/var/www/uploads';
    const S3_BUCKET = 'test-stream-multipart-upload';
    const S3_UPLOADS_PATH = 'uploads';
    const S3_TEMP_PATH = 'temp';

    multipart.once('data', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
    });

    multipart.once('error', (err) => {
        if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });

    multipart.pipe(new MultipartError()).pipe(zip);
    multipart.pipe(new Pick('metadata')).pipe(zip);
    multipart.pipe(new FileSize()).pipe(zip);
    multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
    multipart.pipe(new StorageTempLocal()).pipe(zip);
    multipart.pipe(new StorageTempS3({ bucket: S3_BUCKET, path: S3_TEMP_PATH })).pipe(zip);
    multipart.pipe(new Exiftool()).pipe(zip);

    zip
        .pipe(new Merge())
        .pipe(new StorageLocal({ dir: FS_UPLOADS_DIR }))
        .pipe(new StorageS3({ bucket: S3_BUCKET, path: S3_UPLOADS_PATH, saveMetadata: true, skipDeleteTemp: true }))
        .pipe(new StringifyError())
        .pipe(new JsonStream())
        .pipe(res);
});
```

## API

[Documentation](https://amokrushin.github.io/stream-multipart-upload)

## Performance

### Hardware
```
KVM, 1 vCPU Intel Xeon E5-2670v2, 2GB RAM, SSD
```

### Local server, local client, 30 DSLR photos with average size of 10Mb each

```
    task: concurrency=3, files-per-request=10
    requests: 3
    files: 30
    size: 314.42 Mb
    speed: 891.96 Mbit/s, 10.64 files per second
```

### Local server, local client, 6610 exiftool sample images

[exiftool sample images][exiftool-sample-images]

```
    task: concurrency=10, files-per-request=10
    requests: 661
    files: 6610
    size: 181.34 Mb
    speed: 22.81 Mbit/s, 103.93 files per second
    cpu usage: 100% (40% node process, 60% exiftool process)
```


[npm-stable-version-image]: https://img.shields.io/npm/v/stream-multipart-upload.svg
[npm-url]: https://npmjs.com/package/stream-multipart-upload
[travis-master-image]: https://img.shields.io/travis/amokrushin/stream-multipart-upload/master.svg
[travis-url]: https://travis-ci.org/amokrushin/stream-multipart-upload
[codecov-image]: https://img.shields.io/codecov/c/github/amokrushin/stream-multipart-upload/master.svg
[codecov-url-master]: https://codecov.io/github/amokrushin/stream-multipart-upload?branch=master
[david-image]: https://img.shields.io/david/amokrushin/stream-multipart-upload.svg
[david-url-master]: https://david-dm.org/amokrushin/stream-multipart-upload
[node-version-image]: https://img.shields.io/node/v/stream-multipart-upload.svg
[node-version-url]: https://nodejs.org/en/download/
[license-image]: https://img.shields.io/npm/l/stream-multipart-upload.svg
[license-url]: https://raw.githubusercontent.com/amokrushin/stream-multipart-upload/master/LICENSE.txt

[exiftool-sample-images]: http://owl.phy.queensu.ca/~phil/exiftool/sample_images.html
