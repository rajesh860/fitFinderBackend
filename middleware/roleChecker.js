export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user.userRole; // decoded JWT me se role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access Denied" });
    }
    
    next();
  };
};
