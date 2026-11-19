module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@react-native-async-storage|@react-native-documents|@react-native-google-signin|react-native-screens|react-native-safe-area-context|react-native-vector-icons|react-native-linear-gradient|react-native-purchases|react-native-gesture-handler|react-native-url-polyfill)/)',
  ],
};

