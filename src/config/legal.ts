export const LEGAL_CONFIG = {
  privacyPolicyUrl:
    'https://docs.google.com/document/d/1Oy63z8tcrhtVPLUujAV9V9qf8k9-Cx1oqr_CFcil7z0/edit?tab=t.0#heading=h.yzmuvtpp19qb',
  termsOfServiceUrl:
    'https://docs.google.com/document/d/1O-MMIwwsA2L3VJJnA1F0Wd2swtdafLR5aAFI9qzPbxI/edit?tab=t.0#heading=h.alaglmbdo5n6',
  supportEmail: 'atharvaplayconsole@gmail.com',
  developerName: 'Atharva Sadavarte',
  packageName: 'com.preprole',
};

export interface LegalSection {
  title: string;
  content: string;
}

export const PRIVACY_POLICY_DATA: {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
} = {
  title: 'Privacy Policy',
  effectiveDate: 'November 10, 2026',
  sections: [
    {
      title: '1. Introduction',
      content:
        'Welcome to PrepRole ("the App"). PrepRole is an AI-powered career coaching, ATS resume evaluation, and interview preparation mobile application.\n\nWe are committed to protecting your privacy and ensuring transparency regarding how your data is collected, processed, stored, and safeguarded.\n\nThis Privacy Policy explains what information we collect when you use PrepRole, how we use and protect that information, your privacy rights, and how applicable laws protect you.\n\nBy using the App, you agree to the collection and use of information in accordance with this Privacy Policy.',
    },
    {
      title: '2. Information We Collect',
      content:
        'We collect only the information necessary to provide, improve, and secure our services.\n\n• Account Information: When you sign in using Google Sign-In or email, we receive your name, email address, profile picture URL, and user identifier. We do not collect or store external passwords.\n• Resume & Career Content: Resumes, CVs, text excerpts, target job roles, job descriptions, and skill profiles that you voluntarily upload or input into the App for scoring, ATS analysis, and feedback.\n• Audio & Voice Data: When you practice with the AI Mock Interviewer or Pitch Trainer, you may grant microphone permission to record your responses. This audio is processed to evaluate speech clarity, pacing, and provide conversational feedback. Audio is used solely for the live session and is not used for biometric identification.\n• Camera Access (Optional): When using video-assisted interview simulations, the App may request camera permission to display a local preview to simulate a real video interview. Camera feeds are processed locally in real time on your device and are never recorded, streamed, or uploaded to our servers.\n• In-App Purchases: PrepRole utilizes Google Play Billing and RevenueCat to process subscriptions (PrepRole Pro) and one-time scan packages. We do not collect or store credit cards, bank credentials, or UPI details. All financial transactions are handled securely by Google Play.\n• Technical & Diagnostic Data: Device model, OS version, app version, network state, and diagnostic logs to diagnose crashes and maintain service quality.',
    },
    {
      title: '3. How We Use Your Information',
      content:
        'We process your data strictly for legitimate operational purposes:\n\n1. Resume Analysis & ATS Scoring: To extract skills, analyze keyword relevance against target job descriptions, calculate ATS compatibility scores, and generate customized bullet-point recommendations.\n2. AI Career Coaching & Interview Simulations: To generate tailored interview questions, evaluate your voice or text responses, and provide actionable feedback.\n3. Monetization & Quota Management: To track remaining free scans, authenticate Pro membership status, and restore valid purchases across devices.\n4. Account Management & Security: To authenticate your identity and prevent fraud, abuse, or unauthorized access.\n5. App Performance & Support: To respond to user inquiries, fix crashes, and enhance functionality.',
    },
    {
      title: '4. Third-Party Services & AI Processing Disclosures',
      content:
        'To deliver our features, we partner with trusted third-party cloud and AI providers:\n\n• Google Sign-In: User authentication (Name, email, User ID)\n• Supabase Inc.: Encrypted cloud database and storage (Row-Level Security enforced)\n• Google Gemini API: Generative AI analysis and feedback\n• RevenueCat & Google Play: In-app billing and subscription state management\n\nArtificial Intelligence (AI) Data Handling:\n• Text excerpts from your CV and interview prompts are securely transmitted to the Google Gemini API (gemini-3.6-flash) via encrypted Supabase serverless Edge Functions.\n• Your personal data and uploaded resumes are NOT used to train public machine learning or foundation AI models.\n• Data sent to the AI model is processed to return your personalized evaluation and is not retained by the AI model for external purposes.',
    },
    {
      title: '5. Data Storage, Security & Retention',
      content:
        '• Encryption in Transit & at Rest: All data transmitted between the App, our servers, and third-party APIs uses industry-standard TLS/SSL (HTTPS) encryption. Uploaded resumes are stored in private cloud storage buckets protected by strict Row-Level Security (RLS) policies, ensuring only authorized users can access their documents.\n• User Control & Deletion: You can delete specific resume analyses directly from your History screen at any time. When deleted, the database record and associated storage file are permanently erased.',
    },
    {
      title: '6. Permissions Required by the App',
      content:
        '• Internet Access (android.permission.INTERNET): Required to communicate with Supabase, Gemini AI, and RevenueCat.\n• Microphone (android.permission.RECORD_AUDIO): Required exclusively for speech-to-text analysis during mock interviews and pitch drills.\n• Camera (android.permission.CAMERA): Optional. Used only for live visual preview during video interview simulations; never recorded or uploaded.\n• Audio Settings (android.permission.MODIFY_AUDIO_SETTINGS): Required to play back AI coach speech feedback.',
    },
    {
      title: '7. Your Rights and Data Deletion',
      content:
        'Under applicable privacy regulations (including GDPR and Google Play User Data policies), you have the right to access, rectify, or request permanent deletion of your data.\n\nTo request account deletion:\n1. Delete individual files from the History screen inside the App.\n2. Or send an email to atharvaplayconsole@gmail.com with the subject line "Account Deletion Request". We will permanently delete your profile, resumes, and score history within 30 days.',
    },
    {
      title: '8. Contact Information',
      content:
        'Developer: Atharva Sadavarte\nApplication: PrepRole (com.preprole)\nEmail: atharvaplayconsole@gmail.com',
    },
  ],
};

export const TERMS_OF_SERVICE_DATA: {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
} = {
  title: 'Terms of Service',
  effectiveDate: 'November 10, 2026',
  sections: [
    {
      title: '1. Acceptance of Terms',
      content:
        'By downloading, installing, accessing, or using PrepRole ("the App", "we", "us", or "our"), you agree to be legally bound by these Terms of Service ("Terms").\n\nIf you do not agree to these Terms, do not install or use the App.',
    },
    {
      title: '2. Description of the Service',
      content:
        'PrepRole is an AI-driven career development platform providing:\n• Automated ATS resume evaluation and 0–100 scoring.\n• Target job role matching and keyword gap analysis.\n• Resume bullet-point rewriting and recommendations.\n• Interactive AI mock interview practice with live audio feedback.\n• Personal pitch coaching.',
    },
    {
      title: '3. User Accounts',
      content:
        'You access the App via Google Sign-In or verified Email & Password authentication. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.',
    },
    {
      title: '4. Subscriptions & Billing',
      content:
        '• Google Play Billing: Subscriptions (PrepRole Pro) and consumable credit packages are processed securely through Google Play Billing. We never store credit or debit card numbers.\n• Auto-Renewal: Subscriptions automatically renew at the end of each billing period unless canceled at least 24 hours prior to renewal.\n• Cancellation: You can cancel your subscription at any time via: Google Play Store → Profile → Payments & subscriptions → Subscriptions.\n• Refunds: Handled directly through Google Play Support in accordance with Google Play refund policies.',
    },
    {
      title: '5. Intellectual Property & Your Content',
      content:
        '• Your Content: You retain full ownership of all resumes, CVs, job descriptions, and spoken audio you upload or provide to the App.\n• Limited License: You grant PrepRole a limited license solely to analyze and format your content to deliver score reports and interview feedback.\n• No Model Training: Your private resumes and interview audio are never used to train public machine learning or foundation AI models.',
    },
    {
      title: '6. Acceptable Use Policy',
      content:
        'You agree not to attempt to reverse-engineer, decompile, or tamper with the App source code or AI prompts, bypass scan quota limits or paywalls, upload harmful materials, or commercially redistribute generated reports without authorization.',
    },
    {
      title: '7. AI Advisory Disclaimer',
      content:
        'All ATS scores, keyword match percentages, resume bullet rewrites, and interview feedback generated by Gemini AI are evaluative suggestions intended to support your career preparation.\n\nPrepRole does not guarantee employment, job interviews, selection, or specific hiring outcomes. Hiring decisions rest entirely with prospective employers.',
    },
    {
      title: '8. Contact Information',
      content:
        'Developer: Atharva Sadavarte\nApplication: PrepRole (com.preprole)\nEmail: atharvaplayconsole@gmail.com',
    },
  ],
};

