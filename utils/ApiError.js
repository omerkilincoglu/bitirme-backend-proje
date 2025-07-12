class ApiError extends Error {
  constructor(message, returnCode) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    this.returnCode = returnCode;
  }
}

module.exports = ApiError;
