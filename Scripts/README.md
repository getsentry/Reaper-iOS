# Reaper Scripts

These scripts process an app bundle to determine the set of types that can be detected by reaper. All ObjC classes are supported, non-generic Swift classes and some Swift value types are supported.

Processing an app required typescript and node, you can install them with `npm install -g ts-node typescript`

Setup:
```bash
npm install
tsc
```

Processing an app:
```bash
node .build/main.js PATH_TO_APP.app OUTPUT_FILE.txt
```

