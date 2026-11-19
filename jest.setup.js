/* eslint-env jest */

// include this line if you use react-navigation with react-native-gesture-handler
try {
  require('react-native-gesture-handler/jestSetup');
} catch (e) {}

// AsyncStorage mock
const mockAsyncStorage = {
  getItem: jest.fn((key) => Promise.resolve(null)),
  setItem: jest.fn((key, value) => Promise.resolve()),
  removeItem: jest.fn((key) => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  getMany: jest.fn(() => Promise.resolve({})),
  setMany: jest.fn(() => Promise.resolve()),
  removeMany: jest.fn(() => Promise.resolve()),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  createAsyncStorage: () => mockAsyncStorage,
  ...mockAsyncStorage,
}));

// Safe Area Context mock
jest.mock('react-native-safe-area-context', () => {
  const inset = {top: 0, right: 0, bottom: 0, left: 0};
  return {
    SafeAreaProvider: jest.fn(({children}) => children),
    SafeAreaConsumer: jest.fn(({children}) => children(inset)),
    useSafeAreaInsets: jest.fn(() => inset),
    useSafeAreaFrame: jest.fn(() => ({x: 0, y: 0, width: 390, height: 844})),
    SafeAreaView: jest.fn(({children}) => children),
    initialWindowMetrics: {
      insets: inset,
      frame: {x: 0, y: 0, width: 390, height: 844},
    },
  };
});

// Google Sign-In mock
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: {
        idToken: 'mock-id-token',
        user: {email: 'mock@example.com', id: '123'},
      },
    }),
    signOut: jest.fn().mockResolvedValue(null),
    isSignedIn: jest.fn().mockResolvedValue(false),
    getCurrentUser: jest.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// RevenueCat Purchases mock
jest.mock('react-native-purchases', () => ({
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getCustomerInfo: jest.fn().mockResolvedValue({entitlements: {active: {}}}),
  getOfferings: jest.fn().mockResolvedValue({current: null}),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn().mockResolvedValue({entitlements: {active: {}}}),
  LOG_LEVEL: {DEBUG: 'DEBUG'},
}));

// Linear Gradient mock
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Vector Icons mock
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Feather', () => 'Icon');

// Document Picker mock
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {},
}));
