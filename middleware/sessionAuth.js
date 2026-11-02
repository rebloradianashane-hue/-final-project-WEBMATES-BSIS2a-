const crypto = require('crypto');
const User = require('../models/user');

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        userId: String(userId),
        expiresAt: Date.now() + SESSION_DURATION_MS
    });
    return token;
}

async function requireSession(req, res, next) {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const session = sessions.get(token);

    if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    }

    try {
        const user = await User.findById(session.userId);
        if (!user) {
            sessions.delete(token);
            return res.status(401).json({ error: 'Your account could not be verified. Please sign in again.' });
        }
        req.authUser = user;
        return next();
    } catch (error) {
        console.error('Could not verify API session:', error);
        return res.status(500).json({ error: 'Could not verify your session.' });
    }
}

module.exports = { createSession, requireSession };