import mongoose from "mongoose";

// Key/value platform settings. Writes are Super Admin only and always audited.
const platformSettingSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: mongoose.Schema.Types.Mixed, default: null },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    { timestamps: true }
);

const PlatformSetting = mongoose.model("PlatformSetting", platformSettingSchema);
export default PlatformSetting;
