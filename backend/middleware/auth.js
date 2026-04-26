const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { tierRank } = require("../services/tier");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload; // { sub, role } — see auth routes
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== "admin") {
    return res.status(403).json({ message: "Admin role required" });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: `Required role: ${roles.join(" or ")}` });
    }
    next();
  };
}

/** Optional: attach full user document when you need tier, etc. */
async function attachUser(req, res, next) {
  try {
    req.user = await User.findById(req.auth.sub).select("-password");
    if (!req.user) return res.status(401).json({ message: "User not found" });
    next();
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

/** Require JWT tier at least `minTier` (silver | gold | diamond). */
function requireMinTier(minTier) {
  return async (req, res, next) => {
    // Admin routes should never be blocked by subscription tier checks.
    if (req.auth?.role === "admin") return next();

    let t = req.auth?.tier;
    // Token can be stale/missing tier after account changes; fallback to DB.
    if (!t && req.auth?.sub) {
      try {
        const u = await User.findById(req.auth.sub).select("tier role").lean();
        if (u?.role === "admin") return next();
        t = u?.tier || null;
      } catch (e) {
        return res.status(500).json({ message: e.message });
      }
    }

    if (!t || tierRank(t) < tierRank(minTier)) {
      return res.status(403).json({
        message: `This action requires tier ${minTier} or higher.`,
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireRole,
  attachUser,
  requireMinTier,
};
