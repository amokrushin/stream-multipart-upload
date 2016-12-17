const _ = require('lodash');
const Table = require('cli-table');

function debugFlow(stream) {
    const flow = [];

    function flowPushPipes(s, level) {
        flow[level] = flow[level] || [];
        flow[level].push(s);
        if (!s._readableState) return;
        const pipes = _.castArray(s._readableState.pipes);
        pipes.forEach((pipe) => {
            flowPushPipes(pipe, level + 1);
        });
    }

    flowPushPipes(stream, 0);

    return {
        print() {
            const table = new Table({
                head: ['Name', 'WR ended', 'RD ended'],
            });
            for (let i = 0; i < flow.length; i++) {
                const level = flow[i];
                level.forEach((item) => {
                    table.push([
                        item.constructor.name,
                        item._writableState ? item._writableState.ended : '',
                        item._readableState ? item._readableState.ended : '',
                    ]);
                });
            }
            process.stdout.write(`${table.toString()}\n`);
        },
    };
}

const randomBoundary = () => Math.random().toString(36).slice(2);

const dummyMultipartFile = (boundary, size) => [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="file-${_.uniqueId()}.jpg"`,
    'Content-Type: image/jpeg',
    '',
    'A'.repeat(size || 42),
].join('\r\n').concat('\r\n');

module.exports = {
    debugFlow,
    randomBoundary,
    dummyMultipartFile,
};
