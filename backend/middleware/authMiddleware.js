const protectRoute = (req, res, next) => {
  // Sinusuri kung may kasamang 'role' ang request headers
  if (!req.headers.role) {
    return res.status(401).json({ message: 'Unauthorized access' });
  }
  
  // Kung mayroon, itutuloy na nito ang pagproseso sa sunod na function/route
  next();
};

module.exports = protectRoute;