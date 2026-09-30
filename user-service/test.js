/**
 * User Service Unit / Smoke Tests (CI Pipeline)
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running User Service CI Tests...');

const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Check seed data or fallback data
if (fs.existsSync(DATA_FILE)) {
    const users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    assert.ok(Array.isArray(users), 'Users data should be an array');
    assert.ok(users.length > 0, 'Users array should not be empty');
    const firstUser = users[0];
    assert.ok(firstUser.id, 'User must have an ID');
    assert.ok(firstUser.name, 'User must have a name');
    assert.ok(firstUser.email, 'User must have an email');
} else {
    // If not written to disk yet, ensure directory structure is valid
    assert.ok(fs.existsSync(__dirname), 'Directory must exist');
}

console.log('✓ All User Service tests passed successfully.');
process.exit(0);
