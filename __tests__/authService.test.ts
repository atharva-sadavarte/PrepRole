import {
  isValidEmail,
  isValidPassword,
  parseAuthUrl,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
  verifyPasswordResetOtp,
  updateUserPassword,
  resendVerificationEmail,
} from '../src/services/authService';
import {supabase} from '../src/lib/supabase';

// Mock Supabase client
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
      resend: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    test('isValidEmail accepts valid email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@sub.domain.co')).toBe(true);
      expect(isValidEmail('user@domain.org')).toBe(true);
    });

    test('isValidEmail rejects invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@example')).toBe(false);
    });

    test('isValidPassword checks length >= 6', () => {
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('securePass123!')).toBe(true);
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('')).toBe(false);
    });
  });

  describe('parseAuthUrl', () => {
    test('parses hash fragment params correctly', () => {
      const url =
        'preprole://reset-password#access_token=test_acc&refresh_token=test_ref&type=recovery';
      const params = parseAuthUrl(url);
      expect(params.access_token).toBe('test_acc');
      expect(params.refresh_token).toBe('test_ref');
      expect(params.type).toBe('recovery');
    });

    test('parses query params correctly', () => {
      const url = 'preprole://auth/callback?code=pkce_code_123&type=signup';
      const params = parseAuthUrl(url);
      expect(params.code).toBe('pkce_code_123');
      expect(params.type).toBe('signup');
    });

    test('handles empty or missing url', () => {
      expect(parseAuthUrl('')).toEqual({});
    });
  });

  describe('signInWithEmail', () => {
    test('returns error for empty email', async () => {
      const res = await signInWithEmail('', 'password123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('email');
    });

    test('returns error for invalid email', async () => {
      const res = await signInWithEmail('bademail', 'password123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('valid email');
    });

    test('returns error for empty password', async () => {
      const res = await signInWithEmail('user@test.com', '');
      expect(res.success).toBe(false);
      expect(res.message).toContain('password');
    });

    test('handles successful login', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {session: {access_token: 'abc'}, user: {id: '123'}},
        error: null,
      });

      const res = await signInWithEmail('user@test.com', 'password123');
      expect(res.success).toBe(true);
      expect(res.data?.session?.access_token).toBe('abc');
    });

    test('handles unconfirmed email error gracefully', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {session: null, user: null},
        error: {message: 'Email not confirmed'},
      });

      const res = await signInWithEmail('user@test.com', 'password123');
      expect(res.success).toBe(false);
      expect(res.isEmailUnconfirmed).toBe(true);
    });

    test('handles invalid credentials error gracefully', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {session: null, user: null},
        error: {message: 'Invalid login credentials'},
      });

      const res = await signInWithEmail('user@test.com', 'wrongpassword');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Incorrect email or password');
    });
  });

  describe('signUpWithEmail', () => {
    test('requires full name', async () => {
      const res = await signUpWithEmail('user@test.com', 'pass123', '');
      expect(res.success).toBe(false);
      expect(res.message).toContain('full name');
    });

    test('requires valid password length', async () => {
      const res = await signUpWithEmail('user@test.com', '123', 'John Doe');
      expect(res.success).toBe(false);
      expect(res.message).toContain('at least 6 characters');
    });

    test('detects when confirmation is required', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: {
          user: {id: 'user_123', email: 'user@test.com'},
          session: null,
        },
        error: null,
      });

      const res = await signUpWithEmail(
        'user@test.com',
        'password123',
        'John Doe',
      );
      expect(res.success).toBe(true);
      expect(res.requiresConfirmation).toBe(true);
    });

    test('handles existing user error', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: {user: null, session: null},
        error: {message: 'User already registered'},
      });

      const res = await signUpWithEmail(
        'user@test.com',
        'password123',
        'John Doe',
      );
      expect(res.success).toBe(false);
      expect(res.isAlreadyRegistered).toBe(true);
    });

    test('handles email rate limit exceeded gracefully', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: {user: null, session: null},
        error: {message: 'email rate limit exceeded'},
      });

      const res = await signUpWithEmail(
        'user@test.com',
        'password123',
        'John Doe',
      );
      expect(res.success).toBe(false);
      expect(res.message).toContain('Too many requests');
    });
  });

  describe('sendPasswordResetEmail', () => {
    test('calls supabase resetPasswordForEmail with deep link redirect', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const res = await sendPasswordResetEmail('user@test.com');
      expect(res.success).toBe(true);
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@test.com',
        {redirectTo: 'preprole://reset-password'},
      );
    });
  });

  describe('verifyPasswordResetOtp & updateUserPassword', () => {
    test('verifyPasswordResetOtp calls supabase verifyOtp', async () => {
      (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
        data: {session: {access_token: 'token123'}},
        error: null,
      });

      const res = await verifyPasswordResetOtp('user@test.com', '123456');
      expect(res.success).toBe(true);
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@test.com',
        token: '123456',
        type: 'recovery',
      });
    });

    test('updateUserPassword rejects short passwords', async () => {
      const res = await updateUserPassword('123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('at least 6 characters');
    });

    test('updateUserPassword updates password successfully', async () => {
      (supabase.auth.updateUser as jest.Mock).mockResolvedValue({
        data: {user: {id: '123'}},
        error: null,
      });

      const res = await updateUserPassword('newSecretPassword123');
      expect(res.success).toBe(true);
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newSecretPassword123',
      });
    });
  });

  describe('resendVerificationEmail', () => {
    test('resendVerificationEmail triggers signup resend', async () => {
      (supabase.auth.resend as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const res = await resendVerificationEmail('user@test.com');
      expect(res.success).toBe(true);
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'user@test.com',
      });
    });
  });
});

