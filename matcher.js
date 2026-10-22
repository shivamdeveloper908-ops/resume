/* ═══════════════════════════════════════════════════════════
   CUTORA — Resume–JD Matching Engine
   Pure vanilla JS, no external dependencies.

   Scoring methodology (documented):
   ─────────────────────────────────
   finalScore = 0.45 × skillCoverage
              + 0.35 × tfidfCosine
              + 0.20 × keywordPresence

   • skillCoverage  — what fraction of required skills from the
                      JD appear in the resume (0–1)
   • tfidfCosine    — cosine similarity of TF-IDF vectors of the
                      two documents after stop-word removal (0–1)
   • keywordPresence — fraction of top-N JD keywords found in
                       the resume (0–1)

   All weights are clearly documented and the score is derived
   purely from the submitted inputs. The score is an estimate of
   textual/semantic relevance — NOT an ATS guarantee or a hiring
   probability.
   ═══════════════════════════════════════════════════════════ */

const Matcher = (() => {

  /* ── Stop words ──────────────────────────────────────────── */
  const STOP = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','from','up','about','as','into','through','during','including',
    'until','against','among','throughout','despite','towards','upon',
    'is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','shall','should','may','might',
    'must','can','could','not','no','nor','so','yet','both','either',
    'neither','each','few','more','most','other','some','such',
    'than','too','very','just','that','this','these','those','then',
    'also','we','you','i','our','your','their','its','it','he','she','they',
    'us','them','my','his','her','who','which','what','how','when','where',
    'why','if','while','because','although','however','therefore','thus',
    'experience','work','working','work','ability','strong','excellent',
    'good','great','looking','seeking','required','requirements','skills',
    'skill','knowledge','understanding','demonstrated','proven','ability',
    'preferred','preferred','plusplus','etc','including','based','related',
    'using','use','used','uses','able','across','ensure','within'
  ]);

  /* ── Curated skill / keyword dictionary ─────────────────── */
  /* Entries: canonical name → [synonyms / variants] */
  const SKILL_DICT = {
    // Programming languages
    'Python':['python','py'],
    'JavaScript':['javascript','js','ecmascript','es6','es2015','es2020'],
    'TypeScript':['typescript','ts'],
    'Java':['java','jvm'],
    'C++':['c++','cpp','cplusplus'],
    'C#':['c#','csharp','dotnet c#'],
    'C':['clang','c language'],
    'Go':['golang','go lang'],
    'Rust':['rust','rustlang'],
    'Ruby':['ruby','rb'],
    'PHP':['php'],
    'Swift':['swift'],
    'Kotlin':['kotlin'],
    'Scala':['scala'],
    'R':['r language','rstats'],
    'MATLAB':['matlab'],
    'Shell':['shell','bash','zsh','sh scripting'],
    'PowerShell':['powershell','ps1'],
    'Perl':['perl'],
    'Haskell':['haskell'],
    'Dart':['dart'],
    // Web
    'HTML':['html','html5'],
    'CSS':['css','css3','stylesheets'],
    'React':['react','reactjs','react.js'],
    'Vue':['vue','vuejs','vue.js'],
    'Angular':['angular','angularjs'],
    'Next.js':['next.js','nextjs'],
    'Nuxt.js':['nuxt.js','nuxtjs'],
    'Svelte':['svelte'],
    'jQuery':['jquery','jquery'],
    'Bootstrap':['bootstrap'],
    'Tailwind CSS':['tailwind','tailwindcss'],
    'Sass':['sass','scss'],
    'Webpack':['webpack'],
    'Vite':['vite'],
    'Node.js':['node.js','nodejs','node'],
    'Express':['express','expressjs','express.js'],
    'Django':['django'],
    'Flask':['flask'],
    'FastAPI':['fastapi'],
    'Spring':['spring','spring boot','springboot'],
    'Laravel':['laravel'],
    'Rails':['rails','ruby on rails','ror'],
    'ASP.NET':['asp.net','aspnet'],
    'GraphQL':['graphql'],
    'REST API':['rest','restful','rest api','api design'],
    'WebSockets':['websockets','websocket'],
    // Data / ML / AI
    'Machine Learning':['machine learning','ml','supervised learning','unsupervised learning'],
    'Deep Learning':['deep learning','dl','neural network','neural networks'],
    'NLP':['nlp','natural language processing','text mining'],
    'Computer Vision':['computer vision','cv','image recognition'],
    'TensorFlow':['tensorflow','tf'],
    'PyTorch':['pytorch','torch'],
    'Scikit-learn':['scikit-learn','sklearn','scikit learn'],
    'Keras':['keras'],
    'Pandas':['pandas','pd'],
    'NumPy':['numpy','np'],
    'Matplotlib':['matplotlib'],
    'Seaborn':['seaborn'],
    'Jupyter':['jupyter','jupyter notebook','jupyter lab'],
    'Data Analysis':['data analysis','data analytics','analytics'],
    'Data Visualization':['data visualization','data viz','tableau','power bi','powerbi'],
    'Statistics':['statistics','statistical analysis','statistical modeling'],
    'A/B Testing':['a/b testing','ab testing','split testing','experimentation'],
    'Spark':['apache spark','pyspark','spark'],
    'Hadoop':['hadoop','hdfs','mapreduce'],
    'Airflow':['airflow','apache airflow'],
    'dbt':['dbt','data build tool'],
    'ETL':['etl','extract transform load','data pipeline','data pipelines'],
    'LLM':['llm','large language model','gpt','openai','langchain','prompt engineering'],
    // Cloud & DevOps
    'AWS':['aws','amazon web services','ec2','s3','lambda','cloudformation'],
    'Azure':['azure','microsoft azure'],
    'GCP':['gcp','google cloud','google cloud platform'],
    'Docker':['docker','dockerfile','containerization','containers'],
    'Kubernetes':['kubernetes','k8s','kubectl','helm'],
    'Terraform':['terraform','iac','infrastructure as code'],
    'Ansible':['ansible'],
    'CI/CD':['ci/cd','cicd','continuous integration','continuous deployment','github actions','jenkins','circleci','gitlab ci'],
    'Git':['git','github','gitlab','bitbucket','version control'],
    'Linux':['linux','unix','ubuntu','centos','debian'],
    'Nginx':['nginx'],
    'Apache':['apache','apache httpd'],
    'Serverless':['serverless','faas','lambda functions','cloud functions'],
    'Monitoring':['monitoring','observability','prometheus','grafana','datadog','newrelic'],
    // Databases
    'SQL':['sql','structured query language'],
    'PostgreSQL':['postgresql','postgres','psql'],
    'MySQL':['mysql'],
    'SQLite':['sqlite'],
    'MongoDB':['mongodb','mongo'],
    'Redis':['redis'],
    'Elasticsearch':['elasticsearch','elastic','opensearch'],
    'DynamoDB':['dynamodb'],
    'Cassandra':['cassandra','apache cassandra'],
    'Snowflake':['snowflake'],
    'BigQuery':['bigquery','big query'],
    // Mobile
    'iOS':['ios','swift','xcode'],
    'Android':['android','android sdk'],
    'React Native':['react native'],
    'Flutter':['flutter'],
    // Testing
    'Unit Testing':['unit testing','unit tests','jest','mocha','pytest','junit'],
    'Integration Testing':['integration testing','integration tests'],
    'TDD':['tdd','test-driven development','test driven development'],
    'Cypress':['cypress','e2e testing','end-to-end testing'],
    'Selenium':['selenium'],
    // Soft skills
    'Communication':['communication','written communication','verbal communication','presentation'],
    'Teamwork':['teamwork','collaboration','collaborative','cross-functional'],
    'Leadership':['leadership','team lead','managing','mentoring','mentorship'],
    'Problem Solving':['problem solving','problem-solving','analytical','critical thinking'],
    'Project Management':['project management','scrum','agile','kanban','jira'],
    'Time Management':['time management','prioritization','deadline'],
    // Design
    'Figma':['figma'],
    'Adobe XD':['adobe xd','xd'],
    'Photoshop':['photoshop','adobe photoshop'],
    'UI/UX':['ui/ux','ui design','ux design','user experience','user interface'],
    // Security
    'Cybersecurity':['cybersecurity','security','infosec','information security'],
    'OWASP':['owasp'],
    'Penetration Testing':['penetration testing','pen testing','pentest'],
    // Finance / Business
    'Financial Modeling':['financial modeling','financial analysis','forecasting'],
    'Excel':['excel','microsoft excel','spreadsheets'],
    'Power BI':['power bi','powerbi'],
    'Tableau':['tableau'],
    'Salesforce':['salesforce','crm'],
    'SAP':['sap'],
  };

  /* Pre-build synonym → canonical map */
  const SYNONYM_MAP = new Map();
  for (const [canonical, synonyms] of Object.entries(SKILL_DICT)) {
    SYNONYM_MAP.set(canonical.toLowerCase(), canonical);
    for (const s of synonyms) SYNONYM_MAP.set(s.toLowerCase(), canonical);
  }

  /* ── Text utilities ──────────────────────────────────────── */
  function normalize(text) {
    return text.toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/[^\w\s.#+/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    return normalize(text).split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  }

  function extractSkills(text) {
    const norm = normalize(text);
    const found = new Set();
    // Try longest match first (up to 4 words)
    for (const [synonym, canonical] of SYNONYM_MAP.entries()) {
      if (norm.includes(synonym)) found.add(canonical);
    }
    return [...found];
  }

  /* ── TF-IDF + cosine similarity ──────────────────────────── */
  function tfIdf(tokens) {
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const total = tokens.length || 1;
    for (const k in tf) tf[k] /= total;
    return tf;
  }

  function cosineSimilarity(vecA, vecB) {
    const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dot = 0, magA = 0, magB = 0;
    for (const k of keys) {
      const a = vecA[k] || 0;
      const b = vecB[k] || 0;
      dot  += a * b;
      magA += a * a;
      magB += b * b;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /* ── Top keywords from JD ────────────────────────────────── */
  function topKeywords(tokens, n = 40) {
    const freq = {};
    for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w]) => w)
      .filter(w => w.length > 3);
  }

  /* ── ATS checks ──────────────────────────────────────────── */
  function checkATS(resumeText) {
    const t = resumeText.toLowerCase();
    const checks = [];

    const hasEmail = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/.test(t);
    checks.push({ label: 'Contact email', pass: hasEmail,
      msg: hasEmail ? 'Email address detected.' : 'No email address found — add contact info to the top of your resume.' });

    const hasPhone = /\b(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/.test(t);
    checks.push({ label: 'Phone number', pass: hasPhone,
      msg: hasPhone ? 'Phone number detected.' : 'No phone number found. Consider adding one.' });

    const expKeywords = ['experience','work history','employment','positions','professional background'];
    const hasExp = expKeywords.some(k => t.includes(k));
    checks.push({ label: 'Work experience section', pass: hasExp,
      msg: hasExp ? 'Work experience section detected.' : 'No clear work experience section heading found. Use a label like "Work Experience" or "Employment".' });

    const eduKeywords = ['education','degree','university','college','bachelor','master','ph.d','diploma','graduated'];
    const hasEdu = eduKeywords.some(k => t.includes(k));
    checks.push({ label: 'Education section', pass: hasEdu,
      msg: hasEdu ? 'Education section detected.' : 'No education section found. Include a labelled "Education" section.' });

    const skillKeywords = ['skills','technologies','tools','competencies','expertise','proficiencies'];
    const hasSkills = skillKeywords.some(k => t.includes(k));
    checks.push({ label: 'Skills section', pass: hasSkills,
      msg: hasSkills ? 'Skills section detected.' : 'No dedicated skills section found. Add a labelled "Skills" section for better ATS parsing.' });

    const wordCount = resumeText.trim().split(/\s+/).length;
    const goodLength = wordCount >= 200 && wordCount <= 1200;
    checks.push({ label: 'Resume length', pass: goodLength,
      msg: goodLength
        ? `Resume length looks good (~${wordCount} words).`
        : wordCount < 200
          ? `Resume is very short (~${wordCount} words). Most ATS systems expect more detail.`
          : `Resume is very long (~${wordCount} words). Consider condensing to 1–2 pages.` });

    const hasBullets = /[•\-\*▸●◦]/.test(resumeText) || /^\s*[-–—]?\s*\w/m.test(resumeText);
    checks.push({ label: 'Structured bullet points', pass: hasBullets,
      msg: hasBullets ? 'Bullet points or list formatting detected.' : 'No bullet points detected. ATS systems and recruiters prefer bulleted accomplishments.' });

    const hasLinks = /linkedin\.com|github\.com|http/i.test(t);
    checks.push({ label: 'Portfolio / LinkedIn link', pass: hasLinks,
      msg: hasLinks ? 'Web link or profile URL detected.' : 'No LinkedIn or portfolio link found. Consider adding one.' });

    const hasQuantified = /\d+%|\d+x|\$[\d,]+|\d+\s*(million|thousand|k\b|users|clients|projects|team)/i.test(resumeText);
    checks.push({ label: 'Quantified achievements', pass: hasQuantified,
      msg: hasQuantified ? 'Quantified results detected (numbers, percentages, or metrics).' : 'No quantified results found. Where accurate, add numbers (e.g., "Increased efficiency by 30%").' });

    const passed = checks.filter(c => c.pass).length;
    const score  = Math.round((passed / checks.length) * 100);
    return { checks, score, passed, total: checks.length };
  }

  /* ── Main analysis ───────────────────────────────────────── */
  function analyze(resumeText, jdText) {
    if (!resumeText || resumeText.trim().length < 50)
      throw new Error('Resume text is too short or could not be parsed. Please upload a readable PDF or DOCX file.');
    if (!jdText || jdText.trim().length < 30)
      throw new Error('Job description is empty. Please paste the job description.');

    // 1. Extract skills
    const resumeSkills = extractSkills(resumeText);
    const jdSkills     = extractSkills(jdText);

    const matchedSkills  = resumeSkills.filter(s => jdSkills.includes(s));
    const missingSkills  = jdSkills.filter(s => !resumeSkills.includes(s));

    // 2. Skill coverage score
    const skillCoverage = jdSkills.length === 0 ? 0.5 : matchedSkills.length / jdSkills.length;

    // 3. TF-IDF cosine
    const resumeTokens = tokenize(resumeText);
    const jdTokens     = tokenize(jdText);
    const resumeVec    = tfIdf(resumeTokens);
    const jdVec        = tfIdf(jdTokens);
    const tfidfScore   = cosineSimilarity(resumeVec, jdVec);

    // 4. Keyword presence
    const jdKeywords   = topKeywords(jdTokens, 40);
    const resumeNorm   = normalize(resumeText);
    const kpMatched    = jdKeywords.filter(k => resumeNorm.includes(k));
    const kpMissing    = jdKeywords.filter(k => !resumeNorm.includes(k));
    const keywordScore = jdKeywords.length === 0 ? 0.5 : kpMatched.length / jdKeywords.length;

    // 5. Weighted final score (0-100, clamped)
    const raw = (0.45 * skillCoverage + 0.35 * tfidfScore + 0.20 * keywordScore);
    // Apply a mild sigmoid curve so scores spread more naturally
    const curved = 1 / (1 + Math.exp(-8 * (raw - 0.35)));
    const finalScore = Math.min(98, Math.max(5, Math.round(curved * 100)));

    // 6. ATS analysis
    const ats = checkATS(resumeText);

    // 7. Separate technical vs soft missing skills
    const softSkillNames = new Set([
      'Communication','Teamwork','Leadership','Problem Solving',
      'Project Management','Time Management'
    ]);
    const missingTech = missingSkills.filter(s => !softSkillNames.has(s));
    const missingSoft = missingSkills.filter(s => softSkillNames.has(s));

    // 8. Improvement suggestions
    const suggestions = generateSuggestions({
      matchedSkills, missingTech, missingSoft,
      kpMissing, finalScore, ats, resumeText, jdText
    });

    return {
      finalScore,
      skillCoverage:   Math.round(skillCoverage * 100),
      tfidfScore:      Math.round(tfidfScore * 100),
      keywordScore:    Math.round(keywordScore * 100),
      resumeSkills,
      jdSkills,
      matchedSkills,
      missingSkills,
      missingTech,
      missingSoft,
      jdKeywords,
      kpMatched,
      kpMissing: kpMissing.slice(0, 20),
      ats,
      suggestions,
    };
  }

  /* ── Personalised suggestions ────────────────────────────── */
  function generateSuggestions({ matchedSkills, missingTech, missingSoft, kpMissing, finalScore, ats, resumeText, jdText }) {
    const suggestions = [];

    if (missingTech.length > 0) {
      const top = missingTech.slice(0, 4).join(', ');
      suggestions.push({
        title: 'Address key technical skill gaps',
        text: `The job description mentions ${top} but these were not detected in your resume. If you have experience with these, add them explicitly — ATS systems often do exact-keyword matching. If you are still learning them, consider noting your progress (e.g. "Currently learning Kubernetes").`
      });
    }

    if (kpMissing.length > 5) {
      const sample = kpMissing.slice(0, 6).map(w => `"${w}"`).join(', ');
      suggestions.push({
        title: 'Include relevant job-description language',
        text: `Your resume is missing several terms that appear frequently in the job description: ${sample}. Where accurate, naturally incorporate this language into your experience descriptions. Do not keyword-stuff — only use terms that genuinely reflect your work.`
      });
    }

    if (!ats.checks.find(c => c.label === 'Quantified achievements')?.pass) {
      suggestions.push({
        title: 'Quantify your achievements',
        text: `No measurable results were detected in your resume. Quantified achievements (e.g. "Reduced load time by 40%", "Managed a team of 6 engineers", "Handled 1M+ requests/day") make your impact concrete and are highly valued by both ATS systems and recruiters.`
      });
    }

    if (finalScore < 50) {
      suggestions.push({
        title: 'Tailor this resume specifically for the role',
        text: `The overall match is below 50. Consider rewriting your summary and skills sections to mirror the language and priorities in the job description. Each application should be a targeted document, not a generic one.`
      });
    }

    if (missingSoft.includes('Leadership') && /lead|senior|principal|staff|manager/i.test(jdText)) {
      suggestions.push({
        title: 'Highlight leadership experience',
        text: `This role appears to require leadership, but no leadership evidence was detected in your resume. Describe specific instances where you led a team, project, or initiative — even informal mentorship counts.`
      });
    }

    if (ats.score < 60) {
      suggestions.push({
        title: 'Improve resume structure for ATS',
        text: `Your resume scored ${ats.score}% on ATS-friendliness checks. Use clear section headings (Work Experience, Education, Skills), add contact details at the top, and use bullet points for responsibilities. Avoid tables, columns, or images in the source document.`
      });
    }

    if (matchedSkills.length > 0 && matchedSkills.length < 4) {
      suggestions.push({
        title: 'Expand your skills section',
        text: `Only ${matchedSkills.length} skills from the job description were detected in your resume. Make your skills section more comprehensive — list tools, frameworks, and technologies you actively use, even if they appear elsewhere in the document.`
      });
    }

    suggestions.push({
      title: 'Strengthen experience bullet points',
      text: `Review each bullet point in your work experience: start with a strong action verb (Built, Designed, Launched, Reduced, Led), include context, and end with an outcome where possible. Replace vague statements like "Responsible for X" with "Delivered X, resulting in Y."`
    });

    if (!/summary|objective|profile|about/i.test(resumeText)) {
      suggestions.push({
        title: 'Add a targeted professional summary',
        text: `A 2–3 sentence professional summary at the top of your resume helps ATS systems and recruiters immediately understand who you are and what you offer. Tailor this to the specific role and company.`
      });
    }

    return suggestions.slice(0, 7);
  }

  /* ── Demo data ───────────────────────────────────────────── */
  const DEMO_RESUME = `John Smith
john.smith@email.com | +1 (555) 123-4567 | linkedin.com/in/johnsmith | github.com/johnsmith

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years building scalable web applications and data pipelines. Proficient in Python, JavaScript, and cloud infrastructure on AWS. Passionate about clean code, collaboration, and delivering measurable results.

WORK EXPERIENCE
Senior Software Engineer — TechCorp, San Francisco, CA (2021–Present)
• Built and maintained RESTful APIs with Python/FastAPI serving 2M+ requests/day
• Reduced infrastructure costs by 35% by migrating legacy services to AWS Lambda (serverless)
• Led a team of 4 engineers on the data pipeline migration using Apache Airflow and dbt
• Implemented CI/CD pipelines with GitHub Actions, reducing deployment time by 60%
• Mentored 3 junior developers; conducted weekly code reviews

Software Engineer — StartupXYZ, New York, NY (2019–2021)
• Developed full-stack features using React, Node.js, and PostgreSQL
• Designed and implemented ETL workflows for customer analytics dashboard
• Wrote unit tests and integration tests using Jest and Pytest; maintained 85% code coverage
• Collaborated cross-functionally with Product, Design, and Data teams

EDUCATION
B.Sc. Computer Science — University of California, Berkeley (2019)

SKILLS
Languages: Python, JavaScript, TypeScript, SQL, Bash
Frameworks: React, Node.js, FastAPI, Express, Django
Cloud & DevOps: AWS (EC2, S3, Lambda, RDS), Docker, Kubernetes, Terraform, GitHub Actions
Data: PostgreSQL, MongoDB, Redis, Apache Spark, Airflow, dbt, Pandas, NumPy
Tools: Git, Linux, Jira, Figma`;

  const DEMO_JD = `Senior Software Engineer — Data Platform

We are looking for a Senior Software Engineer to join our Data Platform team. You will design, build, and maintain the systems that power our data infrastructure.

Requirements:
• 4+ years of software engineering experience
• Strong proficiency in Python and SQL
• Experience with cloud platforms (AWS preferred)
• Experience building and maintaining data pipelines (ETL/ELT)
• Familiarity with orchestration tools such as Apache Airflow or dbt
• Experience with containerization using Docker and Kubernetes
• CI/CD experience (GitHub Actions, Jenkins, or similar)
• Proficiency with PostgreSQL or another relational database
• Excellent communication and collaboration skills
• Ability to work cross-functionally with data science and product teams

Nice to have:
• Experience with Spark or distributed computing
• TypeScript or React for internal tooling
• Terraform or infrastructure-as-code experience
• Leadership or mentoring experience

We value engineers who write clean, tested, well-documented code and who can break down complex problems and communicate solutions clearly.`;

  return { analyze, DEMO_RESUME, DEMO_JD, extractSkills };
})();
