/**
 * Utility functions for Speech-to-Text validation and transcript sanitation.
 */

/**
 * Verifies if transcribed text contains genuine human speech rather than
 * silence placeholders, noise tags, or LLM hallucinated timestamps (e.g., "00:03", "[00:01]")
 */
export function isValidSpokenSpeech(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (trimmed === '[NO_SPEECH]') return false;

  // Noise / silence indicators
  if (
    /^(\[|\()(no\s*speech|silence|silent|inaudible|ambient(\s*noise)?|quiet|music|laughter|cough|applause|unclear)(\]|\))$/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  // Exact timestamp or range, e.g. "00:03", "0:03", "[00:03]", "00:00 - 00:03", "(00:03:00)"
  if (
    /^(\[|\()?\s*(\d{1,2}:)?\d{1,2}:\d{2}(\s*[-–—]\s*(\d{1,2}:)?\d{1,2}:\d{2})?\s*(\]|\))?$/.test(
      trimmed,
    )
  ) {
    return false;
  }

  // Check if string contains actual letters (supports unicode letters across all languages)
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, '');
  if (lettersOnly.length < 2) {
    return false;
  }

  return true;
}

/**
 * Strips hallucinated timestamps and silence markers from speech-to-text outputs
 */
export function cleanSpokenTranscript(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/^["']|["']$/g, '').trim();

  if (!isValidSpokenSpeech(cleaned)) {
    return '';
  }

  // Strip leading timestamps like "00:03 ", "[00:02] ", "00:00 - 00:04 "
  cleaned = cleaned
    .replace(
      /^(\[|\()?\s*(\d{1,2}:)?\d{1,2}:\d{2}(\s*[-–—]\s*(\d{1,2}:)?\d{1,2}:\d{2})?\s*(\]|\))?[\s:-]*/,
      '',
    )
    .trim();

  // Strip trailing timestamps like " [00:03]", " (00:05)"
  cleaned = cleaned
    .replace(
      /[\s:-]*(\[|\()?\s*(\d{1,2}:)?\d{1,2}:\d{2}\s*(\]|\))?$/,
      '',
    )
    .trim();

  if (!isValidSpokenSpeech(cleaned)) {
    return '';
  }

  return cleaned;
}
