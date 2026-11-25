import {isPdfAnalysis} from '../src/services/resumeService';
import {
  parseGoogleFontsCss,
  pickClosestFace,
} from '../src/services/fontResolverService';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {from: jest.fn()},
    functions: {invoke: jest.fn()},
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Resume PDF Eligibility Helpers', () => {
  test('detects PDF resumes from file_name or file_url', () => {
    expect(isPdfAnalysis({file_name: 'Atharva_Resume.pdf'})).toBe(true);
    expect(isPdfAnalysis({file_name: 'CV.PDF'})).toBe(true);
    expect(isPdfAnalysis({file_url: 'user-1/1234_cv.pdf'})).toBe(true);
    expect(isPdfAnalysis({file_name: 'Resume.docx'})).toBe(false);
    expect(isPdfAnalysis({file_name: 'Pasted Resume'})).toBe(false);
    expect(isPdfAnalysis({})).toBe(false);
  });
});

describe('PDF Font Style Matching Helpers', () => {
  const sampleCss = `
@font-face {
  font-family: 'Lato';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/lato/v24/regular.ttf) format('truetype');
}
@font-face {
  font-family: 'Lato';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/lato/v24/bold.ttf) format('truetype');
}
@font-face {
  font-family: 'Lato';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/lato/v24/italic.ttf) format('truetype');
}
`;

  test('parses @font-face TTF rules from Google Fonts CSS2 response', () => {
    const faces = parseGoogleFontsCss(sampleCss);
    expect(faces).toHaveLength(3);
    expect(faces[0]).toEqual({
      style: 'normal',
      weight: 400,
      url: 'https://fonts.gstatic.com/s/lato/v24/regular.ttf',
    });
    expect(faces[1]).toEqual({
      style: 'normal',
      weight: 700,
      url: 'https://fonts.gstatic.com/s/lato/v24/bold.ttf',
    });
    expect(faces[2]).toEqual({
      style: 'italic',
      weight: 400,
      url: 'https://fonts.gstatic.com/s/lato/v24/italic.ttf',
    });
  });

  test('selects closest weight and italic style match', () => {
    const faces = parseGoogleFontsCss(sampleCss);
    expect(pickClosestFace(faces, false, 600)?.url).toBe(
      'https://fonts.gstatic.com/s/lato/v24/bold.ttf',
    );
    expect(pickClosestFace(faces, true, 400)?.url).toBe(
      'https://fonts.gstatic.com/s/lato/v24/italic.ttf',
    );
    expect(pickClosestFace(faces, false, 400)?.url).toBe(
      'https://fonts.gstatic.com/s/lato/v24/regular.ttf',
    );
  });
});
