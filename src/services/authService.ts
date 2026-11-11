import {supabase} from '../lib/supabase';
import type {AuthResponse, UserResponse, Session} from '@supabase/supabase-js';

export interface AuthResult<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  isEmailUnconfirmed?: boolean;
  isAlreadyRegistered?: boolean;
  requiresConfirmation?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validates password strength (minimum 6 characters for Supabase)
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult<AuthResponse['data']>> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {success: false, message: 'Please enter your email address.'};
  }

  if (!isValidEmail(cleanEmail)) {
    return {success: false, message: 'Please enter a valid email address.'};
  }

  if (!password) {
    return {success: false, message: 'Please enter your password.'};
  }

  try {
    const {data, error} = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('email not confirmed') ||
        error.message.includes('email_not_confirmed')
      ) {
        return {
          success: false,
          isEmailUnconfirmed: true,
          message:
            'Please confirm your email address before signing in. Check your inbox for the activation link.',
        };
      }

      if (
        msg.includes('invalid login credentials') ||
        msg.includes('invalid credentials')
      ) {
        return {
          success: false,
          message: 'Incorrect email or password. Please check and try again.',
        };
      }

      return {
        success: false,
        message: error.message || 'Failed to sign in. Please try again.',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred during sign in.',
    };
  }
}

/**
 * Register a new user with email, password, and optional full name
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthResult<AuthResponse['data']>> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName?.trim();

  if (!cleanName) {
    return {success: false, message: 'Please enter your full name.'};
  }

  if (!cleanEmail) {
    return {success: false, message: 'Please enter your email address.'};
  }

  if (!isValidEmail(cleanEmail)) {
    return {success: false, message: 'Please enter a valid email address.'};
  }

  if (!password) {
    return {success: false, message: 'Please create a password.'};
  }

  if (!isValidPassword(password)) {
    return {
      success: false,
      message: 'Password must be at least 6 characters long.',
    };
  }

  try {
    const {data, error} = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already exists')
      ) {
        return {
          success: false,
          isAlreadyRegistered: true,
          message:
            'An account with this email already exists. Please sign in instead.',
        };
      }

      if (
        msg.includes('rate limit') ||
        msg.includes('over_email_send_rate_limit')
      ) {
        return {
          success: false,
          message:
            'Too many requests right now. Please wait a moment and try again, or continue with Google.',
        };
      }

      return {
        success: false,
        message: error.message || 'Registration failed. Please try again.',
      };
    }

    // If confirmation is required, data.session is null and user is created
    const requiresConfirmation = Boolean(data.user && !data.session);

    return {
      success: true,
      data,
      requiresConfirmation,
      message: requiresConfirmation
        ? `We have sent a verification email to ${cleanEmail}. Please verify your email to log in.`
        : 'Account created successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred during signup.',
    };
  }
}

/**
 * Send password reset email with recovery link / OTP
 */
export async function sendPasswordResetEmail(
  email: string,
): Promise<AuthResult<void>> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return {success: false, message: 'Please enter your email address.'};
  }

  if (!isValidEmail(cleanEmail)) {
    return {success: false, message: 'Please enter a valid email address.'};
  }

  try {
    const {error} = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: 'preprole://reset-password',
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('rate limit') ||
        msg.includes('over_email_send_rate_limit')
      ) {
        return {
          success: false,
          message:
            'Too many requests sent. Please wait a minute before requesting another reset code.',
        };
      }

      return {
        success: false,
        message: error.message || 'Could not send reset email. Please try again.',
      };
    }

    return {
      success: true,
      message: `Password reset instructions have been sent to ${cleanEmail}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred.',
    };
  }
}

/**
 * Verify OTP token received in recovery email
 */
export async function verifyPasswordResetOtp(
  email: string,
  token: string,
): Promise<AuthResult<AuthResponse['data']>> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return {success: false, message: 'Invalid email address.'};
  }

  if (!cleanToken) {
    return {success: false, message: 'Please enter the verification code.'};
  }

  try {
    const {data, error} = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'recovery',
    });

    if (error) {
      return {
        success: false,
        message:
          error.message || 'Invalid or expired verification code. Please try again.',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to verify reset code.',
    };
  }
}

/**
 * Updates the user's password once an authenticated or recovery session is active
 */
export async function updateUserPassword(
  newPassword: string,
): Promise<AuthResult<UserResponse['data']>> {
  if (!newPassword) {
    return {success: false, message: 'Please enter a new password.'};
  }

  if (!isValidPassword(newPassword)) {
    return {
      success: false,
      message: 'Password must be at least 6 characters long.',
    };
  }

  try {
    const {data, error} = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        message: error.message || 'Failed to update password.',
      };
    }

    return {
      success: true,
      data,
      message: 'Password updated successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to update password.',
    };
  }
}

/**
 * Resend verification email for unconfirmed accounts
 */
export async function resendVerificationEmail(
  email: string,
): Promise<AuthResult<void>> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return {success: false, message: 'Please enter a valid email address.'};
  }

  try {
    const {error} = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('rate limit') ||
        msg.includes('over_email_send_rate_limit')
      ) {
        return {
          success: false,
          message:
            'Please wait at least one minute before requesting another confirmation email.',
        };
      }

      return {
        success: false,
        message: error.message || 'Failed to resend confirmation email.',
      };
    }

    return {
      success: true,
      message: `A new confirmation email has been sent to ${cleanEmail}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not resend email.',
    };
  }
}

/**
 * Parses deep link parameters from URL query string or hash fragment
 */
export function parseAuthUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!url) return params;

  // URL may have parameters in hash fragment (#access_token=...) or query (?code=...)
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');

  let rawString = '';
  if (hashIdx !== -1) {
    rawString = url.substring(hashIdx + 1);
  } else if (queryIdx !== -1) {
    rawString = url.substring(queryIdx + 1);
  }

  if (rawString) {
    rawString.split('&').forEach(part => {
      const [k, v] = part.split('=');
      if (k && v !== undefined) {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    });
  }

  return params;
}

/**
 * Handles deep link authentication URLs (recovery, confirmation, oauth)
 */
export async function handleAuthUrl(url: string): Promise<{
  handled: boolean;
  type?: string;
  session?: Session | null;
  error?: string;
}> {
  try {
    const params = parseAuthUrl(url);

    if (params.error_description || params.error) {
      return {
        handled: true,
        error: params.error_description || params.error,
      };
    }

    // Direct token flow (hash fragment: access_token & refresh_token)
    if (params.access_token && params.refresh_token) {
      const {data, error} = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (error) {
        return {handled: true, error: error.message};
      }

      return {
        handled: true,
        type: params.type || 'session',
        session: data.session,
      };
    }

    // PKCE code exchange flow (?code=...)
    if (params.code) {
      const {data, error} = await supabase.auth.exchangeCodeForSession(
        params.code,
      );

      if (error) {
        return {handled: true, error: error.message};
      }

      return {
        handled: true,
        type: params.type || 'code',
        session: data.session,
      };
    }

    return {handled: false};
  } catch (err: any) {
    return {
      handled: false,
      error: err?.message || 'Failed to process authentication link.',
    };
  }
}

