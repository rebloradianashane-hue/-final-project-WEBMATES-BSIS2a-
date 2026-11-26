const protectRoute = (req, res, next) => {
  // Sinusuri kung may kasamang 'role' ang request headers
  if (!req.headers.role) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  // Kung mayroon, itutuloy na nito ang pagproseso sa sunod na function/route
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (!roles.includes(req.authUser.role)) {
    return res.status(403).json({ error: 'You do not have permission to access this resource.' });
  }
  return next();
};

module.exports = protectRoute;
module.exports.requireRole = requireRole;