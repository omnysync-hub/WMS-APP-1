module.exports = {
  dependencies: {
    // Force RN/Expo autolinking to pick up ORT (often missing from Expo rnConfig).
    "onnxruntime-react-native": {
      root: __dirname + "/node_modules/onnxruntime-react-native",
      platforms: {
        android: {
          sourceDir: __dirname + "/node_modules/onnxruntime-react-native/android",
          packageImportPath: "import ai.onnxruntime.reactnative.OnnxruntimePackage;",
          packageInstance: "new OnnxruntimePackage()",
        },
        ios: {
          podspecPath: __dirname + "/node_modules/onnxruntime-react-native/onnxruntime-react-native.podspec",
        },
      },
    },
  },
};
