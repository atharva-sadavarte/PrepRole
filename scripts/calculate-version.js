#!/usr/bin/env node

/**
 * calculate-version.js
 * 
 * Automatically calculates incremented versionCode and versionName for Android releases.
 * - Reads base version from android/gradle.properties or package.json
 * - In CI: versionCode = baseVersionCode + GITHUB_RUN_NUMBER
 *         versionName = major.minor.(basePatch + GITHUB_RUN_NUMBER)
 * - Supports manual overrides via OVERRIDE_VERSION_CODE and OVERRIDE_VERSION_NAME
 * - Exports variables to $GITHUB_OUTPUT and $GITHUB_ENV
 * - Optionally updates android/gradle.properties and package.json when --update-files is passed
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const gradlePropertiesPath = path.join(rootDir, 'android', 'gradle.properties');
const packageJsonPath = path.join(rootDir, 'package.json');

// 1. Read base version from android/gradle.properties
let baseVersionCode = 4;
let baseVersionName = '1.1.0';

if (fs.existsSync(gradlePropertiesPath)) {
  const content = fs.readFileSync(gradlePropertiesPath, 'utf8');
  const codeMatch = content.match(/^VERSION_CODE\s*=\s*(\d+)/m);
  const nameMatch = content.match(/^VERSION_NAME\s*=\s*([^\r\n]+)/m);

  if (codeMatch) {
    baseVersionCode = parseInt(codeMatch[1], 10);
  }
  if (nameMatch) {
    baseVersionName = nameMatch[1].trim();
  }
} else if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg.version) {
    baseVersionName = pkg.version;
  }
}

// 2. Parse major, minor, patch
const nameParts = baseVersionName.split('.').map(p => parseInt(p, 10) || 0);
const major = nameParts[0] !== undefined ? nameParts[0] : 1;
const minor = nameParts[1] !== undefined ? nameParts[1] : 0;
const patch = nameParts[2] !== undefined ? nameParts[2] : 0;

// 3. Determine new version
const runNumberEnv = process.env.GITHUB_RUN_NUMBER;
const overrideCode = process.env.OVERRIDE_VERSION_CODE || process.env.CUSTOM_VERSION_CODE;
const overrideName = process.env.OVERRIDE_VERSION_NAME || process.env.CUSTOM_VERSION_NAME;

let nextVersionCode;
let nextVersionName;

if (overrideCode && !isNaN(parseInt(overrideCode, 10))) {
  nextVersionCode = parseInt(overrideCode, 10);
} else if (runNumberEnv && !isNaN(parseInt(runNumberEnv, 10))) {
  const runNumber = parseInt(runNumberEnv, 10);
  nextVersionCode = baseVersionCode + runNumber;
} else {
  nextVersionCode = baseVersionCode + 1;
}

if (overrideName && overrideName.trim().length > 0) {
  nextVersionName = overrideName.trim();
} else if (runNumberEnv && !isNaN(parseInt(runNumberEnv, 10))) {
  const runNumber = parseInt(runNumberEnv, 10);
  const nextPatch = patch + runNumber;
  nextVersionName = `${major}.${minor}.${nextPatch}`;
} else {
  nextVersionName = `${major}.${minor}.${patch + 1}`;
}

console.log('========================================');
console.log(' Android Version Increment Configuration');
console.log('========================================');
console.log(`Previous Version Code : ${baseVersionCode}`);
console.log(`Previous Version Name : ${baseVersionName}`);
console.log(`New Version Code      : ${nextVersionCode}`);
console.log(`New Version Name      : ${nextVersionName}`);
if (runNumberEnv) {
  console.log(`CI Run Number         : ${runNumberEnv}`);
}
console.log('========================================');

// 4. Update files in place if requested
const shouldUpdateFiles = process.argv.includes('--update-files');
if (shouldUpdateFiles) {
  // Update android/gradle.properties
  if (fs.existsSync(gradlePropertiesPath)) {
    let gradleProps = fs.readFileSync(gradlePropertiesPath, 'utf8');
    if (/^VERSION_CODE\s*=/m.test(gradleProps)) {
      gradleProps = gradleProps.replace(/^VERSION_CODE\s*=.*/m, `VERSION_CODE=${nextVersionCode}`);
    } else {
      gradleProps = `VERSION_CODE=${nextVersionCode}\n` + gradleProps;
    }

    if (/^VERSION_NAME\s*=/m.test(gradleProps)) {
      gradleProps = gradleProps.replace(/^VERSION_NAME\s*=.*/m, `VERSION_NAME=${nextVersionName}`);
    } else {
      gradleProps = `VERSION_NAME=${nextVersionName}\n` + gradleProps;
    }
    fs.writeFileSync(gradlePropertiesPath, gradleProps, 'utf8');
    console.log(`Updated android/gradle.properties with new versions.`);
  }

  // Update package.json
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    pkg.version = nextVersionName;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`Updated package.json version to ${nextVersionName}.`);
  }
}

// 5. Export to GitHub Actions environment / outputs
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput && fs.existsSync(path.dirname(githubOutput))) {
  fs.appendFileSync(githubOutput, `version_code=${nextVersionCode}\n`);
  fs.appendFileSync(githubOutput, `version_name=${nextVersionName}\n`);
  fs.appendFileSync(githubOutput, `prev_version_code=${baseVersionCode}\n`);
  fs.appendFileSync(githubOutput, `prev_version_name=${baseVersionName}\n`);
  console.log('Written variables to GITHUB_OUTPUT.');
}

const githubEnv = process.env.GITHUB_ENV;
if (githubEnv && fs.existsSync(path.dirname(githubEnv))) {
  fs.appendFileSync(githubEnv, `APP_VERSION_CODE=${nextVersionCode}\n`);
  fs.appendFileSync(githubEnv, `APP_VERSION_NAME=${nextVersionName}\n`);
  console.log('Written variables to GITHUB_ENV.');
}
