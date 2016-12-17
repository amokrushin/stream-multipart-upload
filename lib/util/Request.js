const { Duplex, PassThrough } = require('stream');
const { request } = require('http');

class Request extends Duplex {
    constructor(requestOptions, streamOptions) {
        super(streamOptions);
        this.request = request(requestOptions);
        this.response = new PassThrough();
        this.request.on('response', (res) => {
            res.pipe(this.response);
            res.once('end', () => this.push(null));
        });
        this.once('finish', () => {
            this.request.end();
        });
    }

    _read() {
        const chunk = this.response.read();
        if (chunk) {
            const next = this.push(chunk);
            if (next) {
                this._read();
            }
        } else {
            this.response.once('readable', () => {
                this.response.removeAllListeners('readable');
                this._read();
            });
        }
    }

    _write(chunk, encoding, cb) {
        this.request.write(chunk, encoding, cb);
    }
}

module.exports = Request;
