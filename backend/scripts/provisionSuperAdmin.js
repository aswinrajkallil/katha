// One-time, server-side Super Admin provisioning.
//
//   node scripts/provisionSuperAdmin.js --email you@example.com            (dry run: shows what would happen)
//   node scripts/provisionSuperAdmin.js --email you@example.com --apply    (performs the change)
//
// Design rules:
//  - Runs only where someone has shell access and the production MONGO_URI. There is NO HTTP
//    endpoint for this, and no API call can create or remove a Super Admin.
//  - No passwords, no default credentials: the account must already exist (registered normally).
//  - Idempotent: running it again for an existing Super Admin changes nothing.
//  - Guarded: once a Super Admin exists it refuses to add another unless --allow-additional is given,
//    so a stray re-run can't quietly mint more.
//  - Never touches other accounts: existing Admins are NOT promoted.
//  - Every change is written to the audit log (actor: system).
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/connectDB.js";
import User from "../models/User.js";
import { recordAudit, AUDIT_ACTIONS } from "../services/auditService.js";

dotenv.config();

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 ? args[i + 1] : undefined;
};

const finish = async (code, message) => {
    if (message) (code === 0 ? console.log : console.error)(message);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(code);
};

const run = async () => {
    const email = (value("email") || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.error("Usage: node scripts/provisionSuperAdmin.js --email <registered email> [--apply] [--allow-additional]");
        process.exit(1);
    }
    const apply = flag("apply");
    const allowAdditional = flag("allow-additional");

    await connectDB();

    // Active accounts only: a deactivated account must be restored through the admin panel first
    const user = await User.findOne({ email });
    if (!user) return finish(1, `No active account is registered with ${email}. Register it normally first.`);

    if (user.role === "superadmin") {
        return finish(0, `@${user.username} is already a Super Admin. Nothing to do.`);
    }

    const existing = await User.countDocuments({ role: "superadmin" });
    if (existing > 0 && !allowAdditional) {
        return finish(
            1,
            `${existing} Super Admin account(s) already exist. Refusing to create another.\n` +
                "If you really intend to add one, re-run with --allow-additional."
        );
    }

    const summary = `@${user.username} <${user.email}> (currently "${user.role}") -> superadmin`;
    if (!apply) {
        return finish(0, `DRY RUN - no changes made.\nWould promote ${summary}\nRe-run with --apply to perform it.`);
    }

    const previousRole = user.role;
    const now = new Date();
    const result = await User.updateOne(
        { _id: user._id, role: previousRole },
        { $set: { role: "superadmin", roleChangedAt: now, roleChangedBy: null } }
    );
    if (result.matchedCount === 0) return finish(1, "The account changed while running. No changes made; try again.");

    await recordAudit(
        null,
        {
            action: AUDIT_ACTIONS.ROLE_PROVISION_SUPERADMIN,
            targetType: "user",
            targetId: user._id,
            targetLabel: `@${user.username}`,
            reason: "Provisioned with scripts/provisionSuperAdmin.js",
            metadata: { from: previousRole, to: "superadmin", viaScript: true }
        },
        { strict: true }
    );

    return finish(0, `Done. Promoted ${summary}.\nAsk them to sign out and back in at /admin/login.`);
};

run().catch((error) => finish(1, `Provisioning failed: ${error.message}`));
