import {NativeModules, Platform, Linking} from 'react-native';
import type {
  PdfDocumentStructure,
  PdfEditInstruction,
} from '../types/resume';

const {PdfPreviewModule} = NativeModules;

export interface PdfPreviewResult {
  pageCount: number;
  pageUris: string[];
  pageWidths: number[];
  pageHeights: number[];
}

export interface PdfApplyEditsResult {
  outputPath: string;
  outputUri: string;
  appliedCount: number;
  pageCount: number;
  fontMatchDetails: string[];
}

export interface PdfSaveDownloadsResult {
  uri: string;
  fileName: string;
  location: string;
}

export function isNativePdfEditingSupported(): boolean {
  return (
    Platform.OS === 'android' &&
    !!PdfPreviewModule?.extractPdfStructure &&
    !!PdfPreviewModule?.applyPdfEdits
  );
}

/**
 * Renders pages of a local PDF document to high-resolution PNG preview images
 * using Android's built-in native PdfRenderer.
 *
 * @param uriString Local URI (content:// or file://)
 * @param maxPages Maximum number of pages to render (default 5)
 */
export async function renderPdfPages(
  uriString: string,
  maxPages: number = 5,
): Promise<PdfPreviewResult> {
  if (Platform.OS === 'android' && PdfPreviewModule?.renderPdfPages) {
    return await PdfPreviewModule.renderPdfPages(uriString, maxPages);
  }
  throw new Error('Native PDF rendering is currently supported on Android.');
}

/**
 * Reads a PDF file as base64 string for direct multimodal AI analysis.
 * Tries native PdfPreviewModule first, then falls back to fetch + FileReader.
 */
export async function getPdfBase64(uriString: string): Promise<string> {
  if (Platform.OS === 'android' && PdfPreviewModule?.getPdfBase64) {
    try {
      return await PdfPreviewModule.getPdfBase64(uriString);
    } catch (err) {
      console.warn('Native getPdfBase64 fallback to fetch:', err);
    }
  }

  const response = await fetch(uriString);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Copies a content:// or file:// PDF URI into app cache for persistent reuse
 */
export async function copyPdfUriToCache(
  uriString: string,
  fileName: string,
): Promise<string> {
  if (Platform.OS === 'android' && PdfPreviewModule?.copyUriToCache) {
    return await PdfPreviewModule.copyUriToCache(uriString, fileName);
  }
  return uriString;
}

/**
 * Downloads a signed/remote PDF URL directly to local app cache
 */
export async function downloadPdfToCache(
  urlString: string,
  fileName: string,
): Promise<string> {
  if (Platform.OS === 'android' && PdfPreviewModule?.downloadPdfToCache) {
    return await PdfPreviewModule.downloadPdfToCache(urlString, fileName);
  }
  throw new Error('Native PDF cache download is only supported on Android.');
}

/**
 * Downloads and caches a .ttf font file locally for exact PDF font matching
 */
export async function ensureFontFileCached(
  urlString: string,
  cacheFileName: string,
): Promise<string | null> {
  if (Platform.OS === 'android' && PdfPreviewModule?.ensureFontFileCached) {
    try {
      return await PdfPreviewModule.ensureFontFileCached(urlString, cacheFileName);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extracts per-line layout coordinates, fonts, weights, colors, and columns from a PDF
 */
export async function extractPdfStructure(
  uriString: string,
): Promise<PdfDocumentStructure> {
  if (Platform.OS === 'android' && PdfPreviewModule?.extractPdfStructure) {
    return await PdfPreviewModule.extractPdfStructure(uriString);
  }
  throw new Error(
    'In-place PDF editing is currently supported on Android devices.',
  );
}

/**
 * Applies surgical style- and font-preserving text edits onto the uploaded PDF
 */
export async function applyPdfEdits(
  uriString: string,
  edits: PdfEditInstruction[],
  fontPaths: Record<string, string>,
  outputFileName: string,
): Promise<PdfApplyEditsResult> {
  if (Platform.OS === 'android' && PdfPreviewModule?.applyPdfEdits) {
    return await PdfPreviewModule.applyPdfEdits(
      uriString,
      JSON.stringify(edits),
      JSON.stringify(fontPaths),
      outputFileName,
    );
  }
  throw new Error(
    'In-place PDF editing is currently supported on Android devices.',
  );
}

/**
 * Opens a PDF in the device's system viewer (e.g., Google Drive PDF Viewer, Adobe)
 */
export async function openSystemPdfViewer(uriString: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && PdfPreviewModule?.openSystemViewer) {
      await PdfPreviewModule.openSystemViewer(uriString);
      return true;
    }
    if (await Linking.canOpenURL(uriString)) {
      await Linking.openURL(uriString);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to open system PDF viewer:', error);
    return false;
  }
}

/**
 * Opens the native system share sheet for a local PDF file
 */
export async function sharePdfFile(
  uriString: string,
  title?: string,
): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && PdfPreviewModule?.sharePdfFile) {
      await PdfPreviewModule.sharePdfFile(uriString, title || 'Updated Resume PDF');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to share PDF file:', error);
    return false;
  }
}

/**
 * Saves a local PDF file into the device's Downloads/PrepRole folder
 */
export async function savePdfToDownloads(
  uriString: string,
  displayName: string,
): Promise<PdfSaveDownloadsResult> {
  if (Platform.OS === 'android' && PdfPreviewModule?.savePdfToDownloads) {
    return await PdfPreviewModule.savePdfToDownloads(uriString, displayName);
  }
  throw new Error('Saving PDF to Downloads is currently supported on Android.');
}
