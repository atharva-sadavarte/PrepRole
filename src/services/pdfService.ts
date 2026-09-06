import {NativeModules, Platform, Linking} from 'react-native';

const {PdfPreviewModule} = NativeModules;

export interface PdfPreviewResult {
  pageCount: number;
  pageUris: string[];
  pageWidths: number[];
  pageHeights: number[];
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
