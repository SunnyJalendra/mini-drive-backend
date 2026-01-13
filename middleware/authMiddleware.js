const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        req.user = { id: user._id, isAdmin: user.isAdmin, email: user.email };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token error', error: err.message });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Admins only' });
    next();
};

module.exports = { auth, adminOnly };
