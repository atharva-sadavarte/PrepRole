import {NativeModules, Platform, PermissionsAndroid, Alert} from 'react-native';

const {InterviewMediaModule} = NativeModules;

export interface MediaRecordingResult {
  uri: string;
  durationSeconds: number;
  mimeType: 'audio/mp4' | 'video/mp4';
  base64?: string;
}

/**
 * Request audio recording permission on Android
 */
export async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message:
          'PrepRole needs access to your microphone so you can record your interview introduction.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Error requesting audio permission:', err);
    return false;
  }
}

/**
 * Request camera permission on Android
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message:
          'PrepRole needs access to your camera so you can record your video interview pitch.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Error requesting camera permission:', err);
    return false;
  }
}

/**
 * Starts recording audio natively
 */
export async function startNativeAudioRecording(): Promise<boolean> {
  if (Platform.OS === 'android' && InterviewMediaModule?.startAudioRecording) {
    const res = await InterviewMediaModule.startAudioRecording();
    return !!res?.success;
  }

  // Simulated fallback for simulator/testing
  console.log('[InterviewMediaService] Audio recording started (simulated or web/iOS)');
  return true;
}

/**
 * Stops recording audio and returns the recorded file with base64 data
 */
export async function stopNativeAudioRecording(
  simulatedDurationSeconds: number = 60,
): Promise<MediaRecordingResult> {
  if (Platform.OS === 'android' && InterviewMediaModule?.stopAudioRecording) {
    try {
      const res = await InterviewMediaModule.stopAudioRecording();
      return {
        uri: res.uri,
        durationSeconds: res.durationSeconds || simulatedDurationSeconds,
        mimeType: 'audio/mp4',
        base64: res.base64,
      };
    } catch (err) {
      console.warn('Native stopAudioRecording error:', err);
    }
  }

  // Fallback simulator payload
  return {
    uri: 'file://simulated_audio_recording.m4a',
    durationSeconds: simulatedDurationSeconds,
    mimeType: 'audio/mp4',
    base64: '',
  };
}

/**
 * Cancels current audio recording session
 */
export async function cancelNativeAudioRecording(): Promise<void> {
  if (Platform.OS === 'android' && InterviewMediaModule?.cancelAudioRecording) {
    try {
      await InterviewMediaModule.cancelAudioRecording();
    } catch (e) {
      console.warn('cancelNativeAudioRecording error:', e);
    }
  }
}

/**
 * Plays an audio recording
 */
export async function playNativeAudio(uri: string): Promise<boolean> {
  if (Platform.OS === 'android' && InterviewMediaModule?.startAudioPlayback) {
    try {
      await InterviewMediaModule.startAudioPlayback(uri);
      return true;
    } catch (e) {
      console.warn('playNativeAudio error:', e);
    }
  }
  return false;
}

/**
 * Stops audio playback
 */
export async function stopNativeAudio(): Promise<void> {
  if (Platform.OS === 'android' && InterviewMediaModule?.stopAudioPlayback) {
    try {
      await InterviewMediaModule.stopAudioPlayback();
    } catch (e) {
      console.warn('stopNativeAudio error:', e);
    }
  }
}

/**
 * Launches native video recording intent (max 90s duration limit)
 */
export async function captureNativeVideo(
  fallbackDuration: number = 60,
): Promise<MediaRecordingResult> {
  if (Platform.OS === 'android' && InterviewMediaModule?.captureVideo) {
    try {
      const res = await InterviewMediaModule.captureVideo();
      return {
        uri: res.uri,
        durationSeconds: res.durationSeconds || fallbackDuration,
        mimeType: 'video/mp4',
        base64: res.base64,
      };
    } catch (err: any) {
      if (err?.message?.includes('cancelled')) {
        throw new Error('USER_CANCELLED');
      }
      console.warn('Native captureVideo error:', err);
      throw err;
    }
  }

  // Simulator fallback
  return {
    uri: 'file://simulated_video_recording.mp4',
    durationSeconds: fallbackDuration,
    mimeType: 'video/mp4',
    base64: '',
  };
}

/**
 * Speaks question text using native Android TTS (with fallback simulated speech).
 * Default speechRate = 0.83 provides a calm, clear, standard interview interviewer cadence
 * so candidates can comfortably absorb and understand every part of the question.
 */
export async function speakQuestionText(
  text: string,
  languageTag: string = 'en-US',
  speechRate: number = 0.83,
): Promise<boolean> {
  // 1. Try native Android TextToSpeech engine with custom calm speech rate
  if (Platform.OS === 'android' && InterviewMediaModule?.speakTextWithRate) {
    try {
      const res = await InterviewMediaModule.speakTextWithRate(text, languageTag, speechRate);
      if (res?.success) return true;
    } catch (e) {
      console.warn('Native speakTextWithRate failed, trying standard speakText:', e);
    }
  }

  if (Platform.OS === 'android' && InterviewMediaModule?.speakText) {
    try {
      const res = await InterviewMediaModule.speakText(text, languageTag);
      if (res?.success) return true;
    } catch (e) {
      console.warn('Native speakText failed, falling back to audio playback stream:', e);
    }
  }

  // 2. High-fidelity audio stream fallback via MediaPlayer
  try {
    const langCode = languageTag.split('-')[0] || 'en';
    const cleanText = encodeURIComponent(text.substring(0, 180));
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${cleanText}`;
    if (Platform.OS === 'android' && InterviewMediaModule?.startAudioPlayback) {
      const res = await InterviewMediaModule.startAudioPlayback(ttsUrl);
      return !!res?.playing;
    }
  } catch (err) {
    console.warn('Google TTS audio playback failed:', err);
  }

  return true;
}

/**
 * Stops question speech playback
 */
export async function stopQuestionSpeech(): Promise<void> {
  if (Platform.OS === 'android' && InterviewMediaModule?.stopSpeech) {
    try {
      await InterviewMediaModule.stopSpeech();
    } catch (e) {
      console.warn('stopQuestionSpeech error:', e);
    }
  }
}

/**
 * Reads local media file as base64 string
 */
export async function readMediaFileAsBase64(uriString: string): Promise<string> {
  if (Platform.OS === 'android' && InterviewMediaModule?.readFileAsBase64) {
    try {
      return await InterviewMediaModule.readFileAsBase64(uriString);
    } catch (e) {
      console.warn('readMediaFileAsBase64 error:', e);
    }
  }
  return '';
}

