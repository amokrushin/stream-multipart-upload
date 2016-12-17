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
    const multipart = req.pipe(new MultipartParser({ headers: req.headers }));
    const zip = new Zip();
    const uploadsDir = '/var/www/uploads';

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
    multipart.pipe(new Property('metadata')).pipe(zip);
    multipart.pipe(new FileSize()).pipe(zip);
    multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
    multipart.pipe(new Exiftool()).pipe(zip);
    multipart.pipe(new StorageTempLocal()).pipe(zip);

    zip
        .pipe(new Merge())
        .pipe(new StorageLocal({ dir: uploadsDir }))
        .pipe(new JsonStream())
        .pipe(res);
});
```

## API


## General purpose transform streams

### Multipart(`options`)
See: [stream-multipart](https://github.com/amokrushin/stream-multipart)

### Zip(`options`)
See: [stream-zip](https://github.com/amokrushin/stream-zip)

### Merge()

Merges array of objects to a single object for each chunk

### Property(`path`)

Outputs a property of input chunk. Lodash [get](https://lodash.com/docs/4.17.2#get) method used to resolved the value.

Example:
```
new Property(`property`)
{property: 123} -> 123
{property: {child: 123}} -> {child: 123}
```

### JsonStream()

Converts chunks to JSON


## Pre-processor transform streams

Each pre-processor is a transform object stream.

Input chunk
```
{
    file: ReadableStream,
    metadata: {
        filename: String,
        encoding: String,
        charset: String,
        mimetype: String,
    }
}
```

### MultipartError(`options`)

Handles file stream error

```
{
    file: ReadableStream
}
```

#### Output chunk format

```
{
    [error: String]
}
```

### FileSize()

Calculates file stream size

#### Input chunk required fields

```
{
    file: ReadableStream
}
```

#### Output chunk format

```
{
    size: Number
}
```

### FileHash(`options`)

Calculates file stream hash

* `options` - (Object) Optional uuid state to apply. Properties may include:

  * `algorithm` - (String) Default: `sha1`.
  * `encoding` - (Boolean) hex or [bs58](https://github.com/cryptocoinjs/bs58). Default: `hex`.

#### Input chunk required fields

```
{
    file: ReadableStream
}
```

#### Output chunk format

```
{
    [algorithm]: String
}
```

### Exiftool(`options`)

Extract file metadata using [exiftool](http://www.sno.phy.queensu.ca/~phil/exiftool/) and node.js [exiftool-vendored](https://github.com/mceachen/exiftool-vendored) wrapper.

Exiftool works in [-stay_open](http://www.sno.phy.queensu.ca/~phil/exiftool/#performance) mode.
That mode do not support streaming and requires files.
It is a reason that module creates temporary file for each incoming chunk and removes it at the end of chunk processing.

* `options` - (Object) Optional uuid state to apply. Properties may include:

  * `tmpDir` - (String) Dir for temporary files. Default: `os.tmpdir()`.
  * `ensureDir` - (Boolean) Ensure that dir exists, create if not. Default: true.
  * `readLimit` - (Number) The EXIF data located at the beginning of the file, so there is no reason to read the file completely. `readLimit` is a limit following which the reading will be aborted and temporary file will be passed to exiftool. Default: 524288 (512Kb).
  * `ExiftoolTask` - (Function) Override default exiftool task. Should inherit [Task](https://github.com/mceachen/exiftool-vendored/blob/master/src/task.ts) Default: [ExiftoolTask](lib/util/ExiftoolTask.js).

#### Input chunk required fields

```
{
    file: ReadableStream
}
```

#### Output chunk format (all fields are optional)

```
{
    create: String,             // YYYY.MM.DD HH:mm:ss
    modify: String,             // YYYY.MM.DD HH:mm:ss
    mimetype: String,

    width: Number,
    height: Number,
    orientation: Number,        // 1..8
    gps: {
        latitude: Number,       // <float>
        longitude: Number,      // <float>
        timestamp: Number,      // unix time
    },
    camera: {
        model: String,
        aperture: String,       // f/<number>
        exposureTime: String,   // <fraction>s
        focalLength: String,    // <number>mm
        iso: String,            // ISO<number>
        datetime: String,       // YYYY.MM.DD HH:mm:ss
        lensModel: String,
        flashMode: Number,
        flashFired: Boolean,
    },
    error: String,
}
```

#### Output chunk example
```
{
    "filename": "1px-asus-zenfone-5.jpg",
    "size": 33586,
    "sha1": "4VPX6DbQoDHoRUx757JSsoTUbrH5",
    "create": "2015.08.01 19:10:25",
    "modify": "2015.08.01 19:10:25",
    "mimetype": "image/jpeg",
    "width": 1,
    "height": 1,
    "orientation": 6,
    "gps": {
      "latitude": 56.1235333333333,
      "longitude": 38.6031527777778,
      "timestamp": 1438445417
    },
    "camera": {
      "model": "ASUS T00J",
      "aperture": "f/2",
      "exposureTime": "1/20s",
      "focalLength": "2.69mm",
      "iso": "ISO360",
      "datetime": "2015.08.01 19:10:25",
      "flashMode": 0,
      "flashFired": false
    }
}
```

#### Exiftool.end()

Static method. Shuts down exiftool child process.


### StorageTempLocal(`options`)

Save temporary files to disk.

If input chunk metadata has error field then temporary file will be removed otherwise it will be moved to `options.dir` and renamed with `options.filenameProperty` or `options.filenameFn` method.

* `options` - (Object) Optional uuid state to apply. Properties may include:

  * `tmpDir` - (String) Uploads dir. Default: `os.tmpdir()`.
  * `ensureDir` - (Boolean) Ensure that dir exists, create if not. Default: true.

#### Input chunk required fields

```
{
    file: ReadableStream
}
```

#### Output chunk format

```
{
    localTmpFilepath: String
}
```


## Post-processor transform streams

### StorageLocal(`options`)

Move temporary files to target dir.

If input chunk metadata has error field then temporary file will be removed otherwise it will be moved to `options.dir` and renamed with `options.filenameProperty` or `options.filenameFn` method.

* `options` - (Object) Optional uuid state to apply. Properties may include:

  * `dir` - (String) Uploads dir. Default: `undefined`. Will throw an error if not set.
  * `ensureDir` - (Boolean) Ensure that dir exists, create if not. Default: true.
  * `filenameProperty` - (String) Take target filename from metadata property `metadata[filenameProperty]`. Default: `null`.
  * `filenameFn` - (Function) Function for selecting target filename. `metadata` object passed as first argument. Example function: `(metadata) => metadata.id`. Default: `null`.

#### Input chunk required fields

```
{
    metadata: {
        localTmpFilepath: String,
        [error: Error|Array<Error>]
    }
}
```

#### Output chunk format

```
{
    storageLocalFilename: String,
    storageLocalFilepath: String,
    [error: Error|Array<Error>]
}
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