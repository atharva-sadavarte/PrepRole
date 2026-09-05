// Safe environment configuration loader
declare const process: {
  env?: {
    GEMINI_API_KEY?: string;
  };
};

let localApiKey = '';

try {
  const localEnv = require('./env.local');
  localApiKey = localEnv.GEMINI_API_KEY || '';
} catch {
  // env.local is gitignored and might not exist in production / CI
}

export const GEMINI_API_KEY: string =
  localApiKey || (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
