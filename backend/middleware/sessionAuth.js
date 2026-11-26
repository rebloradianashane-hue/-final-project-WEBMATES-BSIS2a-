
const crypto = require('crypto');
const User = require('../models/user');
const Admin = require('../models/admin');

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();


function createSession(userId, accountType = 'user') {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        userId: String(userId),
        accountType,
        expiresAt: Date.now() + SESSION_DURATION_MS
    });
    return token;
}

function revokeUserSessions(userId, accountType) {
    const targetUserId = String(userId);
    for (const [token, session] of sessions) {
        if (session.userId === targetUserId &&
            (!accountType || session.accountType === accountType)) {
            sessions.delete(token);
        }
    }
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
        const Account = session.accountType === 'admin' ? Admin : User;
        const user = await Account.findById(session.userId);
        if (!user || user.deletedAt) {
            sessions.delete(token);
            return res.status(401).json({ error: 'This account has been deleted and can no longer be accessed.' });
        }
        req.authUser = user;
        req.authAccountType = session.accountType || 'user';
        return next();
    } catch (error) {
        console.error('Could not verify API session:', error);
        return res.status(500).json({ error: 'Could not verify your session.' });
    }
}

module.exports = { createSession, requireSession, revokeUserSessions };

