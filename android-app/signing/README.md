# Test-only signing key — NOT for Play Store

`nfcstore-test-only.jks` (alias `nfcstore-test`, password `nfcstore-test-only`)
exists so every internal test APK built by GitHub Actions carries the SAME
signature. Without it each CI runner generated a fresh random debug key, and
Android refused to install a newer build over an older one:

> App not installed as package conflicts with an existing package.

Rules:
- Internal testing only. It is committed on purpose, so it is public — never
  use it for a Google Play upload key. Generate a real, private release key
  for that (see `keystore.properties.example`) and keep it out of git.
- The workflow writes `keystore.properties` pointing at this file before
  `expo prebuild`; `plugins/withReleaseSigning.js` then wires it into the
  release build type.
- Users who installed an APK from before this key existed must uninstall
  once; after that, every build installs over the previous one.
