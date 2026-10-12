// Throw this from anywhere in a route to send a clean JSON error to the browser.
class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}
module.exports = HttpError;
