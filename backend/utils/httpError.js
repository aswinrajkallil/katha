// Small error type + async wrapper so new controllers can `throw new HttpError(404, "...")`
// and still produce the platform's usual `{ success: false, message }` JSON shape.

export class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        this.extra = extra;
    }
}

export const handle = (fn, fallbackMessage = "Something went wrong") => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        if (error instanceof HttpError) {
            return res.status(error.status).json({ success: false, message: error.message, ...error.extra });
        }
        if (error?.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid identifier" });
        }
        console.error(`${req.method} ${req.originalUrl}:`, error);
        return res.status(500).json({ success: false, message: fallbackMessage });
    }
};
