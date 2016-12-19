const chalk = require('chalk');
const { inspect } = require('util');

module.exports = (debugName, group) => {
    const isDebug = process.env.NODE_DEBUG && /* istanbul ignore next */ process.env.NODE_DEBUG.includes(debugName);
    let debug = () => () => {};
    let debugId = () => {};
    const counters = {};
    if (isDebug) {
        debug = (color, name, ...payload) => {
            process.stderr.write(`${chalk.bgWhite.black(` ${group} `)} `);
            process.stderr.write(`${chalk[color](name)} `);
            Object.keys(payload).forEach((key) => {
                if (typeof payload[key] === 'object') {
                    process.stderr.write(`\n${inspect(payload[key])}`);
                } else {
                    process.stderr.write(`${payload[key]} `);
                }
            });
            process.stderr.write('\n');
        };

        debugId = (name) => {
            if (!counters[name]) counters[name] = 0;
            return ++counters[name];
        };
    }

    return {
        debug,
        debugId,
    };
};
