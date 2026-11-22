import { HttpError } from "./httpError.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESETS = { "7d": 7, "30d": 30, "90d": 90 };
const MAX_CUSTOM_DAYS = 366;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * ?range=7d|30d|90d (default 30d), or ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD.
 * Returns an inclusive UTC window: from = 00:00 of the first day, to = end of the last day.
 */
export const parseDateRange = (query = {}, now = new Date()) => {
    const range = typeof query.range === "string" ? query.range : "30d";

    if (range === "custom") {
        const { from, to } = query;
        if (typeof from !== "string" || typeof to !== "string" || !ISO_DAY.test(from) || !ISO_DAY.test(to)) {
            throw new HttpError(400, "Custom ranges need from and to dates in YYYY-MM-DD format");
        }
        const start = new Date(`${from}T00:00:00.000Z`);
        const endDay = new Date(`${to}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(endDay.getTime())) {
            throw new HttpError(400, "Invalid date");
        }
        if (start > endDay) throw new HttpError(400, "The start date must be on or before the end date");
        const days = Math.round((endDay - start) / DAY_MS) + 1;
        if (days > MAX_CUSTOM_DAYS) {
            throw new HttpError(400, `Custom ranges are limited to ${MAX_CUSTOM_DAYS} days`);
        }
        return { key: "custom", from: start, to: new Date(endDay.getTime() + DAY_MS - 1), days };
    }

    const days = PRESETS[range];
    if (!days) throw new HttpError(400, "range must be 7d, 30d, 90d or custom");
    const today = startOfUtcDay(now);
    return {
        key: range,
        from: new Date(today.getTime() - (days - 1) * DAY_MS),
        to: new Date(today.getTime() + DAY_MS - 1),
        days
    };
};

/** Turn sparse `{ _id: "YYYY-MM-DD", ...counts }` rows into one entry per day, zero-filled. */
export const fillDailySeries = ({ from, days }, rows, keys) => {
    const byDay = new Map(rows.map((row) => [row._id, row]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
        const date = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
        const row = byDay.get(date);
        const point = { date };
        for (const key of keys) point[key] = row?.[key] || 0;
        series.push(point);
    }
    return series;
};

export const dailyGroup = (field = "$createdAt") => ({
    $dateToString: { format: "%Y-%m-%d", date: field, timezone: "UTC" }
});
