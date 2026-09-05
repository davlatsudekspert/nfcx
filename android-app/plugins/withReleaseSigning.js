/**
 * Local Expo config plugin — wires a release signingConfig into the
 * generated `android/app/build.gradle` so it survives every
 * `expo prebuild` (including `--clean`, which deletes and fully
 * regenerates the `android/` folder) — hand-editing that generated file
 * directly would be wiped on the very next prebuild.
 *
 * The credentials file itself (`keystore.properties`) is read from the
 * PROJECT ROOT (sibling to `app.json`, NOT inside the generated `android/`
 * folder) for exactly that reason: anything inside `android/` is
 * disposable and regenerated from scratch by `--clean`, so that is the one
 * location guaranteed to survive every prebuild.
 *
 * SAFE BY DEFAULT: if `keystore.properties` doesn't exist at the project
 * root (the normal state of this repo — no real keystore is generated
 * here per the brief's own rule, see
 * android/docs/16-PHASE13-RELEASE-REPORT.md), this plugin does nothing and
 * the release build type falls back to the automatic debug signing
 * Android/Gradle already provides — so a keystore-less checkout (like this
 * one) never fails a build over signing. Once a real keystore exists:
 *
 *   1. Copy keystore.properties.example to keystore.properties (project
 *      root, gitignored — never commit real credentials) and fill in the
 *      real values, including the path to the real .jks/.keystore file
 *      (also kept OUTSIDE version control).
 *   2. Re-run `npx expo prebuild -p android` (or `-p android --clean`).
 *   3. `./gradlew bundleRelease` / `assembleRelease` now signs with it.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const SIGNING_CONFIG_MARKER = '// nfcstore-release-signing-config';

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    const propsPath = path.join(cfg.modRequest.projectRoot, 'keystore.properties');
    if (!fs.existsSync(propsPath)) {
      // No real keystore configured — leave the generated Gradle file
      // untouched, release falls back to Android's default debug signing.
      return cfg;
    }

    if (cfg.modResults.contents.includes(SIGNING_CONFIG_MARKER)) return cfg; // already applied

    const injected = `
${SIGNING_CONFIG_MARKER}
def keystorePropertiesFile = rootProject.file("../keystore.properties")
def keystoreProperties = new Properties()
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;
    cfg.modResults.contents += injected;
    return cfg;
  });
}

module.exports = withReleaseSigning;
