import PlatformSetting from "../models/PlatformSetting.js";

// The complete list of settings the platform understands. Anything else is rejected, so an API
// caller cannot write arbitrary keys.
export const SETTING_DEFINITIONS = Object.freeze({
    registrationOpen: { type: "boolean", default: true, description: "Allow new people to create accounts" }
});

export const getSettings = async () => {
    const rows = await PlatformSetting.find({ key: { $in: Object.keys(SETTING_DEFINITIONS) } }).lean();
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(
        Object.entries(SETTING_DEFINITIONS).map(([key, def]) => [key, stored.has(key) ? stored.get(key) : def.default])
    );
};

export const isRegistrationOpen = async () => {
    const row = await PlatformSetting.findOne({ key: "registrationOpen" }).lean();
    return row ? row.value !== false : SETTING_DEFINITIONS.registrationOpen.default;
};
