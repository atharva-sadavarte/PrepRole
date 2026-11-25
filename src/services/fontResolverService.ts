import {PdfExtractedFontSignature} from '../types/resume';
import {ensureFontFileCached} from './pdfService';

export interface ParsedFontFace {
  style: 'normal' | 'italic';
  weight: number;
  url: string;
}

const GOOGLE_FONT_CSS_SUPPORTED = new Set([
  'Arimo',
  'Tinos',
  'Cousine',
  'Carlito',
  'Caladea',
  'Roboto',
  'Lato',
  'Open Sans',
  'Poppins',
  'Inter',
  'Source Sans 3',
  'Raleway',
  'Nunito',
  'Merriweather',
  'Lora',
  'EB Garamond',
  'Playfair Display',
]);

export function parseGoogleFontsCss(cssText: string): ParsedFontFace[] {
  const faces: ParsedFontFace[] = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cssText)) !== null) {
    const body = match[1];
    const styleMatch = body.match(/font-style:\s*(normal|italic)/i);
    const weightMatch = body.match(/font-weight:\s*(\d+)/i);
    const urlMatch = body.match(/url\(([^)]+\.ttf[^)]*)\)/i) || body.match(/url\(([^)]+)\)/i);
    if (urlMatch?.[1]) {
      const cleanUrl = urlMatch[1].replace(/['"]/g, '').trim();
      faces.push({
        style: styleMatch?.[1]?.toLowerCase() === 'italic' ? 'italic' : 'normal',
        weight: weightMatch ? parseInt(weightMatch[1], 10) : 400,
        url: cleanUrl,
      });
    }
  }
  return faces;
}

async function fetchGoogleFontCssFaces(family: string): Promise<ParsedFontFace[]> {
  if (!GOOGLE_FONT_CSS_SUPPORTED.has(family)) return [];
  const encoded = encodeURIComponent(family).replace(/%20/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(url, {
      headers: {
        // Non-WOFF2 user-agent prompts Google Fonts CSS2 to serve direct .ttf URLs
        'User-Agent': 'Mozilla/4.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const cssText = await resp.text();
    return parseGoogleFontsCss(cssText);
  } catch {
    return [];
  }
}

export function pickClosestFace(
  faces: ParsedFontFace[],
  isItalic: boolean,
  targetWeight: number,
): ParsedFontFace | null {
  if (faces.length === 0) return null;
  const desiredStyle = isItalic ? 'italic' : 'normal';
  const sameStyle = faces.filter(f => f.style === desiredStyle);
  const pool = sameStyle.length > 0 ? sameStyle : faces;

  let best = pool[0];
  let bestDist = Math.abs(best.weight - targetWeight);
  for (const candidate of pool) {
    const d = Math.abs(candidate.weight - targetWeight);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Resolves and caches TrueType (.ttf) font files matching the exact fonts detected in the PDF.
 * Returns a map of styleKey -> local cached .ttf path for PdfSurgicalEditor.
 */
export async function resolveMatchingFontFiles(
  signatures: PdfExtractedFontSignature[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!signatures || signatures.length === 0) return result;

  // Group by canonicalFamily to minimize CSS lookups (usually 1-3 families per resume)
  const uniqueFamilies = Array.from(
    new Set(
      signatures
        .map(s => s.canonicalFamily)
        .filter(f => f && f !== 'Montserrat'), // Montserrat is already bundled in APK assets
    ),
  );

  const familyFacesMap: Record<string, ParsedFontFace[]> = {};
  await Promise.all(
    uniqueFamilies.map(async fam => {
      familyFacesMap[fam] = await fetchGoogleFontCssFaces(fam);
    }),
  );

  await Promise.all(
    signatures.map(async sig => {
      if (sig.canonicalFamily === 'Montserrat') return;
      const faces = familyFacesMap[sig.canonicalFamily] || [];
      const targetWeight =
        sig.isBold || sig.fontWeight >= 600
          ? 700
          : sig.fontWeight >= 500
          ? 500
          : 400;
      const chosen = pickClosestFace(faces, sig.isItalic, targetWeight);
      if (!chosen?.url) return;

      const safeFam = sig.canonicalFamily.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cacheName = `${safeFam}_${targetWeight}_${sig.isItalic ? 'italic' : 'normal'}.ttf`;
      const localPath = await ensureFontFileCached(chosen.url, cacheName);
      if (localPath) {
        result[sig.styleKey] = localPath;
        const canonicalKey = `${safeFam}_${targetWeight}_${sig.isItalic ? 'italic' : 'normal'}`;
        result[canonicalKey] = localPath;
      }
    }),
  );

  return result;
}
