import {Linking, Alert} from 'react-native';
import {supabase} from '../lib/supabase';
import {CVAnalysisResult, ResumeAnalysisRecord} from '../types/resume';

/**
 * Saves a CV analysis to Supabase
 */
export async function saveAnalysis(
  userId: string,
  analysis: CVAnalysisResult,
  fileName?: string,
  fileUrl?: string,
): Promise<ResumeAnalysisRecord> {
  const {data, error} = await supabase
    .from('resume_analyses')
    .insert([
      {
        user_id: userId,
        target_role: analysis.target_role,
        job_description: analysis.job_description || null,
        file_name: fileName || analysis.file_name || null,
        file_url: fileUrl || analysis.file_url || null,
        overall_score: analysis.overall_score,
        score_tier: analysis.score_tier,
        breakdown: analysis.breakdown,
        summary: analysis.summary,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        skills_matched: analysis.skills_matched,
        skills_missing: analysis.skills_missing,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error saving resume analysis to Supabase:', error);
    throw error;
  }

  return data as ResumeAnalysisRecord;
}

/**
 * Fetches all past CV analyses for the current user
 */
export async function getUserAnalyses(
  userId: string,
): Promise<ResumeAnalysisRecord[]> {
  const {data, error} = await supabase
    .from('resume_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false});

  if (error) {
    console.error('Error fetching user analyses:', error);
    throw error;
  }

  return (data as ResumeAnalysisRecord[]) || [];
}

/**
 * Fetches a single analysis record by ID
 */
export async function getAnalysisById(
  id: string,
): Promise<ResumeAnalysisRecord | null> {
  const {data, error} = await supabase
    .from('resume_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching analysis by ID:', error);
    return null;
  }

  return data as ResumeAnalysisRecord;
}

/**
 * Deletes a CV analysis record
 */
export async function deleteAnalysis(id: string): Promise<boolean> {
  const {error} = await supabase
    .from('resume_analyses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting analysis:', error);
    return false;
  }

  return true;
}

/**
 * Uploads a physical resume file to Supabase Storage bucket 'resumes'
 */
export async function uploadResumeFile(
  userId: string,
  fileUri: string,
  fileName: string,
  contentType: string = 'application/pdf',
): Promise<{path: string} | null> {
  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${userId}/${Date.now()}_${cleanFileName}`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const {data, error} = await supabase.storage
      .from('resumes')
      .upload(filePath, blob, {
        contentType: contentType || 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return null;
    }

    return {path: data.path};
  } catch (err) {
    console.error('Failed to upload file to storage:', err);
    return null;
  }
}

/**
 * Generates a temporary signed URL to preview or download a resume
 */
export async function getResumeSignedUrl(
  filePath: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  try {
    const {data, error} = await supabase.storage
      .from('resumes')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Failed to get signed URL:', err);
    return null;
  }
}

/**
 * Opens a resume file in the system PDF viewer or browser
 */
export async function openResumeInViewer(
  fileUrlOrPath: string,
): Promise<boolean> {
  try {
    let targetUrl = fileUrlOrPath;

    // If it's a Supabase storage path, generate a signed URL
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const signed = await getResumeSignedUrl(targetUrl);
      if (!signed) {
        Alert.alert(
          'Document Not Found',
          'Could not retrieve document from storage.',
        );
        return false;
      }
      targetUrl = signed;
    }

    await Linking.openURL(targetUrl);
    return true;
  } catch (err) {
    console.error('Error opening resume document:', err);
    Alert.alert(
      'Cannot Open Document',
      'Could not open document viewer on your device.',
    );
    return false;
  }
}

/**
 * Sample resume text for 1-tap testing
 */
export const SAMPLE_RESUME_TEXT = `
ALEX CHEN
Full Stack & Mobile Engineer | alex.chen@example.com | San Francisco, CA | github.com/alexchen

PROFESSIONAL SUMMARY
Dynamic Software Engineer with 4+ years of experience specializing in React Native, TypeScript, Node.js, and cloud backends. Proven track record building cross-platform mobile apps for 250k+ active users. Passionate about performant mobile UX, clean architecture, and rapid feature delivery.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript (ES6+), Python, SQL
Frontend & Mobile: React Native, React.js, Redux Toolkit, React Navigation, TailwindCSS
Backend & Cloud: Node.js, Express, PostgreSQL, Supabase, Firebase, AWS S3
Tools: Git, GitHub Actions, Docker, Jest, Postman, Figma

PROFESSIONAL EXPERIENCE
Senior Mobile Developer | NovaTech Solutions | 2023 - Present
- Architected and released 2 major React Native apps on iOS & Android with a 99.8% crash-free rate.
- Reduced app launch time by 42% by optimizing bundle sizes and implementing Hermes JS engine.
- Integrated Supabase Auth, PostgreSQL database, and push notifications for 150,000 monthly active users.
- Mentored 4 junior engineers in modern React patterns and clean code practices.

Software Engineer | Apex Digital Apps | 2021 - 2023
- Developed cross-platform mobile features using React Native and TypeScript.
- Built reusable UI component library adhering to strict design system guidelines.
- Created RESTful microservices in Node.js and Express to support mobile client requests.
- Implemented automated testing with Jest, achieving 80% test coverage across core modules.

PROJECTS
PrepRole - AI Career & Interview Coach
- Developed a full-featured AI interview preparation platform using React Native and Gemini API.
- Implemented real-time resume ATS scoring and personalized role recommendations.

EDUCATION
B.S. in Computer Science | University of California, Davis | 2017 - 2021
`;
