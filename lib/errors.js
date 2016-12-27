class CustomError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}

class MissingRequiredParameter extends CustomError {}
class MissingRequiredField extends CustomError {}
class InvalidChunk extends CustomError {}

module.exports = {
    CustomError,
    MissingRequiredParameter,
    MissingRequiredField,
    InvalidChunk,
};
