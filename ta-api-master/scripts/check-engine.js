#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function exitWithError(message) {
    console.error(`\n[engine-check] ${message}\n`);
    process.exit(1);
}

function getPackageJson() {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    return JSON.parse(raw);
}

function parseMajor(versionString) {
    // Accept forms like v22.10.0 or 22.10.0
    const cleaned = String(versionString).replace(/^v/, '');
    const major = parseInt(cleaned.split('.')[0], 10);
    return Number.isFinite(major) ? major : null;
}

function satisfiesEngine(currentNodeVersion, engineRange) {
    if (!engineRange || typeof engineRange !== 'string') return true;
    const currentMajor = parseMajor(currentNodeVersion);
    const engine = engineRange.trim();
    const expectedMajor = parseMajor(engine);

    if (currentMajor == null || expectedMajor == null) {
        // Fallback: strict prefix match (e.g., 22.*)
        return currentNodeVersion.startsWith(`v${engine.replace(/[*xX].*$/, '')}`);
    }

    if (engine.includes('>=')) {
        return currentMajor >= expectedMajor;
    }
    if (engine.includes('>')) {
        return currentMajor > expectedMajor;
    }
    if (engine.includes('<=')) {
        return currentMajor <= expectedMajor;
    }
    if (engine.includes('<')) {
        return currentMajor < expectedMajor;
    }
    if (engine.includes('^') || engine.includes('~') || engine.includes('*') || /\bx\b/i.test(engine)) {
        // Treat as same-major compatibility
        return currentMajor === expectedMajor;
    }
    // Default: match by major
    return currentMajor === expectedMajor;
}

(function main() {
    try {
        const pkg = getPackageJson();
        const engine = pkg.engines && pkg.engines.node;
        if (!engine) return;

        const nodeVersion = process.version; // e.g., v22.10.0
        if (!satisfiesEngine(nodeVersion, engine)) {
            exitWithError(`Node ${nodeVersion} does not satisfy engines.node="${engine}".\n` + `Please install a compatible Node version (e.g., with nvm).`);
        }
    } catch (err) {
        exitWithError(`Failed to validate Node engine: ${err && err.message ? err.message : err}`);
    }
})();
