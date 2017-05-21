const path = require('path');
const { ExifToolTask: Task } = require('exiftool-vendored/dist/ExifToolTask');
const { ExiftoolOutputMapping } = require('./ExiftoolOutputMapping');

class ExiftoolTask extends Task {
    constructor(sourceFile, args) {
        super(args);
        this.sourceFile = sourceFile;
    }

    static extractInfo(sourceFile) {
        const args = [
            '-e', // do not calculate composite tags
            '-n', // no print conversion
            '-json',
            '-fast2', // avoid extracting JPEG trailer and MakerNote information
            sourceFile,
        ];
        return new this(sourceFile, args);
    }

    parse(data) {
        this.rawTags = JSON.parse(data)[0];
        // ExifTool does humorous things to paths, like flip slashes. resolve() undoes that.
        const sourceFile = path.resolve(this.rawTags.SourceFile);
        // Sanity check that the result is for the file we want:
        if (sourceFile !== this.sourceFile) {
            // Throw an error rather than add an errors string because this is *really* bad:
            throw new Error(`Internal error: unexpected SourceFile of ${this.rawTags.SourceFile}` +
                `for file ${this.sourceFile}`);
        }
        return ExiftoolOutputMapping.parse(this.rawTags);
    }
}
module.exports = { ExiftoolTask };
