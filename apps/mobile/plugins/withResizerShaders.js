// Android: VisionCamera's resizer compiles a Vulkan compute shader with glslc during the Gradle build. Android
// Gradle Plugin 9 does not do that on its own, and without the shader no frame is resized (M0 finding).
// This turns shader builds on and points Gradle at the NDK's glslc (local.properties glslc.dir).
// Every build machine needs an NDK with shader-tools, or GLSLC_DIR set to the folder holding glslc.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const byVersionDesc = (a, b) => b.localeCompare(a, undefined, { numeric: true });
const sdkDir = () =>
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library/Android/sdk');

function findGlslcDir() {
  if (process.env.GLSLC_DIR) return process.env.GLSLC_DIR;
  const ndkDir = path.join(sdkDir(), 'ndk');
  const roots = [process.env.ANDROID_NDK_HOME, process.env.ANDROID_NDK_ROOT].filter(Boolean);
  if (fs.existsSync(ndkDir)) roots.push(...fs.readdirSync(ndkDir).sort(byVersionDesc).map((v) => path.join(ndkDir, v)));
  for (const root of roots) {
    const tools = path.join(root, 'shader-tools');
    if (!fs.existsSync(tools)) continue;
    for (const host of fs.readdirSync(tools)) {
      if (fs.existsSync(path.join(tools, host, 'glslc'))) return path.join(tools, host);
    }
  }
  return null;
}

module.exports = function withResizerShaders(config) {
  config = withGradleProperties(config, (c) => {
    const key = 'android.defaults.buildfeatures.shaders';
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === key));
    c.modResults.push({ type: 'property', key, value: 'true' });
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = findGlslcDir();
      if (!dir) {
        throw new Error(
          'withResizerShaders: glslc not found. Install an Android NDK (it ships shader-tools/<host>/glslc) or set GLSLC_DIR.',
        );
      }
      const file = path.join(c.modRequest.platformProjectRoot, 'local.properties');
      const kept = fs.existsSync(file)
        ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('glslc.dir='))
        : [];
      // Creating the file would hide ANDROID_HOME-less setups' SDK from Gradle, so keep or add sdk.dir too.
      if (!kept.some((l) => l.startsWith('sdk.dir=')) && fs.existsSync(sdkDir())) kept.unshift(`sdk.dir=${sdkDir()}`);
      fs.writeFileSync(file, [...kept, `glslc.dir=${dir}`].join('\n') + '\n');
      return c;
    },
  ]);
};
