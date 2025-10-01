import jwt from "jsonwebtoken";

// Middleware for verifying JWT token
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  // Token check (format => "Bearer <token>")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }
  
  const token = authHeader.split(" ")[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_JWT);
    
    // Attach user info to request
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
