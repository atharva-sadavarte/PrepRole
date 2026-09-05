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
