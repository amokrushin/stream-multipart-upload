const _ = require('lodash');
const math = require('mathjs');
const { omitByRecursively } = require('./index');

class ExiftoolOutputMapping {
    static parse(data) {
        return this.postProcessor(this.mapping(data));
    }

    static mapping(metadata) {
        /*
         * ExifTool Tag Names: http://www.sno.phy.queensu.ca/~phil/exiftool/TagNames/index.html
         */
        return {
            create: this.datetime(metadata.CreateDate),
            modify: this.datetime(metadata.ModifyDate),
            mimetype: this.string(metadata.MIMEType),

            width: this.number(metadata.ImageWidth),
            height: this.number(metadata.ImageHeight),
            orientation: this.number(metadata.Orientation),
            gps: {
                latitude: this.number(metadata.GPSLatitude),
                longitude: this.number(metadata.GPSLongitude),
                timestamp: this.gpsTimestamp(metadata.GPSDateStamp, metadata.GPSTimeStamp),
            },
            camera: {
                model: this.cameraModel(metadata.Make, metadata.Model),
                aperture: this.aperture(metadata.FNumber),
                exposureTime: this.exposureTime(metadata.ExposureTime),
                focalLength: this.focalLength(metadata.FocalLength),
                iso: this.iso(metadata.ISO),
                datetime: this.datetime(metadata.DateTimeOriginal),
                lensModel: this.string(metadata.LensModel),
                flashMode: this.number(metadata.Flash),
                flashFired: this.flashFired(this.number(metadata.Flash)),
            },
            warning: metadata.Warning || undefined,
        };
    }

    static string(value) {
        return value || undefined;
    }

    static number(value) {
        return isNaN(parseInt(value, 10)) ? undefined : Number(value);
    }

    static fraction(value) {
        if (!this.number(value)) return undefined;
        const f = math.fraction(Number(value));
        return `${f.n}/${f.d}`;
    }

    static datetime(value) {
        if (!/^\d{4}:\d{2}:\d{2}\s\d{2}:\d{2}:\d{2}$/.test(value)) return undefined;
        return value ? value.replace(':', '.').replace(':', '.') : undefined;
    }

    static gpsTimestamp(date, time) {
        if (!date || !time) return undefined;
        if (!/^\d{4}:\d{2}:\d{2}$/.test(date)) return undefined;
        if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) return undefined;
        return Date.parse(`${date.replace(/:/g, '-')}T${time}`) / 1000;
    }

    static aperture(value) {
        return this.number(value) ? `f/${Number(Number(value).toFixed(2))}` : undefined;
    }

    static exposureTime(value) {
        if (!this.number(value)) return undefined;
        return value ? `${this.fraction(value)}s` : undefined;
    }

    static focalLength(value) {
        return value ? `${value}mm` : undefined;
    }

    static iso(value) {
        return value ? `ISO${value}` : undefined;
    }

    static cameraModel(make, model) {
        if (!make && !model) return undefined;
        if (!make && model) return model;
        return String(model).indexOf(make) === 0 ? model : [make, model].join(' ');
    }

    static flashFired(flashMode) {
        // eslint-disable-next-line no-bitwise
        return _.isUndefined(flashMode) ? undefined : Boolean(flashMode & 0b1);
    }

    static postProcessor(metadata) {
        return _(metadata)
            .thru(_.partial(omitByRecursively, _, _.isUndefined))
            .thru(_.partial(omitByRecursively, _, val => _.isObject(val) && _.isEmpty(val)))
            .value();
    }
}

module.exports = { ExiftoolOutputMapping };
