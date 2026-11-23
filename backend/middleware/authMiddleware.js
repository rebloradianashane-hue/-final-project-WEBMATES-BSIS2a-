const protectRoute = (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  next();
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
    return res.status(403).json({ error: 'You do not have permission to access this resource.' });
  }
  next();
};

module.exports = protectRoute;
module.exports.requireRole = requireRole;