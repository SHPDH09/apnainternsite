#!/usr/bin/env node
/**
 * Generates SQL migration for technical category courses from seed data.
 * Run: node scripts/generate-technical-courses-sql.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TECHNOLOGY_CATEGORY_ID = "a1000001-0001-4001-8001-000000000001";
const DEFAULT_INSTRUCTOR = "Apna Intern Expert Faculty";

const THUMBNAILS = {
  web: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
  code: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
  data: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
  ai: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
  cloud: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  security: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80",
  mobile: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
  design: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
  database: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&q=80",
};

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function padId(num, prefix) {
  return `${prefix}${String(num).padStart(12, "0")}`;
}

function buildCourseMeta(course) {
  const topic = course.title.replace(/\s*\([^)]*\)/g, "").trim();
  return {
    short_description: course.short,
    full_description: course.full,
    meta_title: `${topic} Course | Apna Intern Technology`,
    meta_description: course.short,
    meta_keywords: `${topic}, internship course, online training, Apna Intern, technology`,
    modules: course.modules,
    learning_points: course.learn,
    requirements: course.req,
    includes: course.includes,
    target_audience: course.audience,
  };
}

const courses = [
  {
    title: "Full Stack Web Development",
    subcategory: "Web Development",
    thumb: "web",
    difficulty: "intermediate",
    duration: "12 weeks",
    price: [499900, 299900],
    featured: true,
    short: "Build complete web applications with HTML, CSS, JavaScript, React, Node.js, and databases.",
    full: "This comprehensive full stack web development course takes you from front-end fundamentals to back-end APIs and deployment. Learn to design responsive UIs, build RESTful services, integrate databases, and ship production-ready projects suitable for internships and junior developer roles.",
    modules: [
      { title: "Front-end Foundations", lessons: ["HTML5 & Semantic Markup", "CSS Layouts & Responsive Design", "JavaScript ES6+ Essentials"] },
      { title: "React & Modern UI", lessons: ["Components, Props & State", "Hooks & Routing", "API Integration in React"] },
      { title: "Back-end & Deployment", lessons: ["Node.js & Express APIs", "Database Integration", "Authentication & Deployment"] },
    ],
    learn: ["Build responsive websites and SPAs", "Create REST APIs with Node.js", "Deploy full stack projects to the cloud"],
    req: ["Basic computer literacy", "No prior coding experience required"],
    includes: ["18+ video lessons", "Hands-on projects", "Certificate of completion", "Internship-ready portfolio guidance"],
    audience: ["CS/IT engineering students", "Career switchers entering web development"],
  },
  {
    title: "Frontend Web Development",
    subcategory: "Web Development",
    thumb: "web",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "Master HTML, CSS, JavaScript, and React to create modern, responsive user interfaces.",
    full: "Focused entirely on the client side, this course covers semantic HTML, advanced CSS, JavaScript programming, and React component architecture. You will build portfolio-worthy front-end projects and learn industry best practices for accessibility, performance, and maintainable UI code.",
    modules: [
      { title: "HTML & CSS Mastery", lessons: ["Document Structure & Accessibility", "Flexbox, Grid & Animations", "Mobile-first Responsive Design"] },
      { title: "JavaScript for the Browser", lessons: ["DOM Manipulation & Events", "Fetch API & Async JavaScript", "ES Modules & Tooling Intro"] },
      { title: "React Front-end Development", lessons: ["Component Design Patterns", "State Management Basics", "Build a Portfolio Project"] },
    ],
    learn: ["Create pixel-perfect responsive layouts", "Write clean, reusable React components", "Optimize front-end performance"],
    req: ["Laptop with modern browser", "Willingness to practice daily"],
    includes: ["15 video lessons", "UI project templates", "Code reviews checklist", "Completion certificate"],
    audience: ["Students targeting front-end internships", "Designers moving into UI development"],
  },
  {
    title: "Backend Development",
    subcategory: "Web Development",
    thumb: "code",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: false,
    short: "Design and build scalable server-side applications, APIs, and database-backed services.",
    full: "Learn server-side programming with Node.js and Express, REST API design, authentication, middleware, and database integration. This course prepares you for backend developer internships by emphasizing secure, testable, and maintainable server architecture.",
    modules: [
      { title: "Server Fundamentals", lessons: ["HTTP, REST & API Design", "Node.js & Express Setup", "Routing & Middleware"] },
      { title: "Data & Security", lessons: ["SQL & ORM Integration", "JWT Authentication", "Input Validation & Error Handling"] },
      { title: "Production Backends", lessons: ["Caching & Performance", "Logging & Monitoring", "Deploying API Services"] },
    ],
    learn: ["Design RESTful APIs", "Implement authentication and authorization", "Connect applications to relational databases"],
    req: ["Basic JavaScript knowledge recommended", "Understanding of HTTP helpful"],
    includes: ["16 video lessons", "API project starter kit", "Postman collection", "Certificate of completion"],
    audience: ["Full stack aspirants focusing on server-side", "Engineering students preparing for backend roles"],
  },
  {
    title: "Python Programming",
    subcategory: "Programming",
    thumb: "code",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: true,
    short: "Learn Python from scratch — syntax, OOP, file handling, and real-world scripting projects.",
    full: "Python is one of the most versatile languages for internships in software, data, and automation. This course covers fundamentals, object-oriented programming, modules, virtual environments, and practical scripting exercises used in industry workflows.",
    modules: [
      { title: "Python Basics", lessons: ["Variables, Types & Control Flow", "Functions & Modules", "File I/O & Exceptions"] },
      { title: "Object-Oriented Python", lessons: ["Classes & Objects", "Inheritance & Polymorphism", "Working with Libraries"] },
      { title: "Applied Python", lessons: ["Automation Scripts", "APIs with requests", "Mini Capstone Project"] },
    ],
    learn: ["Write clean Python programs", "Use OOP for maintainable code", "Automate tasks with Python scripts"],
    req: ["No prior programming experience required"],
    includes: ["14 video lessons", "Practice notebooks", "Coding exercises", "Certificate"],
    audience: ["Beginners starting their coding journey", "Students preparing for data/AI tracks"],
  },
  {
    title: "Java Programming",
    subcategory: "Programming",
    thumb: "code",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Master Java fundamentals, OOP, collections, and application development for enterprise roles.",
    full: "Java remains essential for enterprise software and Android ecosystems. Learn syntax, object-oriented design, collections framework, exception handling, and build console and basic GUI applications aligned with academic and internship expectations.",
    modules: [
      { title: "Java Fundamentals", lessons: ["Syntax & Data Types", "Control Structures", "Methods & Arrays"] },
      { title: "OOP in Java", lessons: ["Classes & Objects", "Inheritance & Interfaces", "Collections Framework"] },
      { title: "Application Development", lessons: ["Exception Handling", "File Handling", "Mini Java Project"] },
    ],
    learn: ["Develop object-oriented Java applications", "Use collections and generics effectively", "Apply Java best practices for internships"],
    req: ["Basic logic and problem-solving skills"],
    includes: ["15 video lessons", "IDE setup guide", "Assignment pack", "Certificate"],
    audience: ["Engineering students with Java in curriculum", "Aspirants targeting enterprise Java roles"],
  },
  {
    title: "C & C++ Programming",
    subcategory: "Programming",
    thumb: "code",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Understand systems programming with C and modern C++ for performance-critical applications.",
    full: "Build a strong foundation in C for memory management and low-level concepts, then extend into C++ with classes, STL, and modern features. Ideal for students pursuing embedded systems, competitive programming, and systems software internships.",
    modules: [
      { title: "C Programming", lessons: ["Pointers & Memory", "Structures & File I/O", "Dynamic Memory Management"] },
      { title: "C++ Essentials", lessons: ["Classes & Constructors", "STL Containers", "Templates Intro"] },
      { title: "Applied Systems", lessons: ["Debugging & Optimization", "Data Structures Practice", "Systems Mini Project"] },
    ],
    learn: ["Manage memory safely in C/C++", "Use STL containers and algorithms", "Solve DSA problems efficiently"],
    req: ["Basic programming logic", "Comfort with mathematics helpful"],
    includes: ["16 video lessons", "DSA problem sets", "Compiler setup guide", "Certificate"],
    audience: ["CS students preparing for placements", "Embedded/systems internship aspirants"],
  },
  {
    title: "Data Science",
    subcategory: "Data Science",
    thumb: "data",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "End-to-end data science with Python, statistics, pandas, visualization, and ML basics.",
    full: "Learn the complete data science workflow: data collection, cleaning, exploratory analysis, visualization, statistical inference, and introductory machine learning. Work on real datasets and build a portfolio project demonstrating business-ready insights.",
    modules: [
      { title: "Data Foundations", lessons: ["Statistics for Data Science", "NumPy & pandas", "Data Cleaning Techniques"] },
      { title: "Exploration & Visualization", lessons: ["EDA Best Practices", "matplotlib & seaborn", "Storytelling with Data"] },
      { title: "Introductory ML", lessons: ["Supervised Learning Basics", "Model Evaluation", "Capstone Analysis Project"] },
    ],
    learn: ["Analyze datasets with Python", "Create compelling data visualizations", "Build baseline predictive models"],
    req: ["Basic Python recommended", "High school mathematics"],
    includes: ["18 video lessons", "Dataset pack", "Jupyter notebooks", "Certificate"],
    audience: ["Students targeting data science internships", "Analysts upskilling into DS roles"],
  },
  {
    title: "Data Analytics",
    subcategory: "Data Science",
    thumb: "data",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Transform raw data into actionable insights using Excel, SQL, and Python analytics tools.",
    full: "Focus on practical analytics skills used in business and operations roles. Learn spreadsheet modeling, SQL queries, dashboard thinking, and Python-based analysis to support data-driven decision making in internships and entry-level analyst positions.",
    modules: [
      { title: "Analytics Foundations", lessons: ["Metrics & KPIs", "Excel for Analysis", "Data Quality Checks"] },
      { title: "SQL for Analysts", lessons: ["SELECT, JOIN & Aggregations", "Subqueries & Window Functions", "Reporting Queries"] },
      { title: "Python Analytics", lessons: ["pandas Reporting", "Visualization Dashboards", "Business Case Study"] },
    ],
    learn: ["Write SQL for business reporting", "Build analytics dashboards", "Present insights to stakeholders"],
    req: ["Basic computer skills", "No prior SQL required"],
    includes: ["14 video lessons", "SQL practice database", "Case study templates", "Certificate"],
    audience: ["Commerce and management students", "Internship aspirants in business analytics"],
  },
  {
    title: "Artificial Intelligence (AI)",
    subcategory: "Artificial Intelligence",
    thumb: "ai",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [499900, 299900],
    featured: true,
    short: "Explore AI concepts, search algorithms, knowledge representation, and intelligent systems.",
    full: "Understand the foundations of artificial intelligence including problem solving, search strategies, knowledge graphs, expert systems, and ethical AI. This course bridges academic AI concepts with practical applications relevant to modern internships and research roles.",
    modules: [
      { title: "AI Foundations", lessons: ["History & Types of AI", "Search Algorithms", "Heuristics & Optimization"] },
      { title: "Knowledge & Reasoning", lessons: ["Knowledge Representation", "Logic & Inference", "Planning Systems"] },
      { title: "Applied AI", lessons: ["NLP & Vision Overview", "AI Ethics & Governance", "AI Project Workshop"] },
    ],
    learn: ["Implement classic AI search algorithms", "Understand knowledge-based systems", "Evaluate ethical implications of AI"],
    req: ["Basic Python", "Introductory statistics helpful"],
    includes: ["17 video lessons", "Algorithm labs", "Research reading list", "Certificate"],
    audience: ["CS/AI students", "Research internship candidates"],
  },
  {
    title: "Machine Learning",
    subcategory: "Artificial Intelligence",
    thumb: "ai",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "Supervised and unsupervised learning with scikit-learn, model tuning, and real ML projects.",
    full: "Hands-on machine learning course covering regression, classification, clustering, feature engineering, cross-validation, and model deployment basics. Build end-to-end ML pipelines using Python and scikit-learn with internship-ready project documentation.",
    modules: [
      { title: "ML Foundations", lessons: ["ML Workflow & Data Prep", "Regression Models", "Classification Algorithms"] },
      { title: "Advanced Techniques", lessons: ["Ensemble Methods", "Clustering & Dimensionality Reduction", "Feature Engineering"] },
      { title: "Model Deployment", lessons: ["Hyperparameter Tuning", "Model Evaluation Metrics", "ML Capstone Project"] },
    ],
    learn: ["Train and evaluate ML models", "Perform feature engineering", "Document ML projects professionally"],
    req: ["Python & pandas basics", "Linear algebra fundamentals"],
    includes: ["18 video lessons", "Project datasets", "Model evaluation toolkit", "Certificate"],
    audience: ["Data science track students", "AI/ML internship aspirants"],
  },
  {
    title: "Generative AI",
    subcategory: "Artificial Intelligence",
    thumb: "ai",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "LLMs, prompt engineering, RAG, fine-tuning concepts, and building GenAI applications.",
    full: "Stay ahead with generative AI skills in high demand. Learn how large language models work, craft effective prompts, build RAG pipelines, integrate APIs, and apply responsible AI practices for productivity and product development internships.",
    modules: [
      { title: "GenAI Essentials", lessons: ["LLM Architecture Overview", "Prompt Engineering", "API Integration Patterns"] },
      { title: "Building with GenAI", lessons: ["Retrieval-Augmented Generation", "Embeddings & Vector Search", "Agent Workflows Intro"] },
      { title: "Responsible GenAI", lessons: ["Safety & Guardrails", "Evaluation & Testing", "GenAI Capstone App"] },
    ],
    learn: ["Design effective prompts and workflows", "Build RAG-based applications", "Apply responsible AI guidelines"],
    req: ["Basic Python", "API concepts helpful"],
    includes: ["15 video lessons", "Prompt libraries", "Starter app templates", "Certificate"],
    audience: ["Developers adding AI to products", "Students pursuing AI internship roles"],
  },
  {
    title: "Cloud Computing",
    subcategory: "Cloud Computing",
    thumb: "cloud",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: false,
    short: "Cloud fundamentals — IaaS, PaaS, SaaS, virtualization, networking, and multi-cloud concepts.",
    full: "Gain a vendor-neutral understanding of cloud computing models, virtualization, storage, networking, identity, and cost management. This course prepares you for cloud practitioner certifications and cloud support internships across AWS, Azure, and GCP ecosystems.",
    modules: [
      { title: "Cloud Concepts", lessons: ["Cloud Service Models", "Virtualization & Containers Intro", "Cloud Economics"] },
      { title: "Core Services", lessons: ["Compute & Storage Services", "Networking & DNS", "Identity & Access Management"] },
      { title: "Cloud Operations", lessons: ["Monitoring & Logging", "Backup & DR Basics", "Cloud Migration Overview"] },
    ],
    learn: ["Compare IaaS, PaaS, and SaaS", "Design basic cloud architectures", "Understand cloud security fundamentals"],
    req: ["Basic IT/networking awareness"],
    includes: ["14 video lessons", "Architecture diagrams", "Lab exercises", "Certificate"],
    audience: ["IT students entering cloud roles", "DevOps internship aspirants"],
  },
  {
    title: "AWS Cloud Computing",
    subcategory: "Cloud Computing",
    thumb: "cloud",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "Hands-on AWS — EC2, S3, RDS, Lambda, IAM, VPC, and solution architecture patterns.",
    full: "Deep dive into Amazon Web Services with practical labs on core services. Learn to provision compute, storage, databases, serverless functions, and secure VPC architectures aligned with AWS Cloud Practitioner and Solutions Architect Associate internship expectations.",
    modules: [
      { title: "AWS Core Services", lessons: ["IAM & Account Setup", "EC2 & Auto Scaling", "S3 & Storage Classes"] },
      { title: "Databases & Serverless", lessons: ["RDS & DynamoDB", "Lambda & API Gateway", "CloudWatch & SNS"] },
      { title: "Architecture & Security", lessons: ["VPC Design", "Well-Architected Framework", "AWS Capstone Lab"] },
    ],
    learn: ["Deploy workloads on AWS", "Configure IAM policies securely", "Design cost-effective AWS solutions"],
    req: ["Cloud computing basics recommended", "Free-tier AWS account for labs"],
    includes: ["17 video lessons", "Hands-on lab guide", "Architecture templates", "Certificate"],
    audience: ["Cloud engineer internship candidates", "Developers deploying to AWS"],
  },
  {
    title: "DevOps",
    subcategory: "DevOps",
    thumb: "cloud",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "CI/CD, Git, Docker, Kubernetes, infrastructure as code, and DevOps culture.",
    full: "Learn the DevOps toolchain and practices that power modern software delivery. Cover version control workflows, automated testing pipelines, containerization, orchestration basics, and infrastructure as code to prepare for DevOps and platform engineering internships.",
    modules: [
      { title: "DevOps Foundations", lessons: ["DevOps Culture & Practices", "Git Workflows", "CI/CD Pipeline Design"] },
      { title: "Containers & Orchestration", lessons: ["Docker Images & Compose", "Kubernetes Basics", "Helm Intro"] },
      { title: "Infrastructure Automation", lessons: ["Terraform Fundamentals", "Monitoring & SRE Basics", "DevOps Capstone Pipeline"] },
    ],
    learn: ["Build CI/CD pipelines", "Containerize applications with Docker", "Automate infrastructure provisioning"],
    req: ["Linux command line basics", "Basic scripting knowledge"],
    includes: ["18 video lessons", "Pipeline templates", "Docker lab environment", "Certificate"],
    audience: ["Developers moving into DevOps", "SRE/platform internship aspirants"],
  },
  {
    title: "Cyber Security",
    subcategory: "Cybersecurity",
    thumb: "security",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "Security fundamentals, threats, cryptography, network defense, and SOC basics.",
    full: "Comprehensive introduction to cybersecurity covering threat landscapes, vulnerability management, cryptography, network security controls, incident response, and security operations center workflows. Prepare for security analyst internships and CompTIA Security+ aligned knowledge.",
    modules: [
      { title: "Security Foundations", lessons: ["CIA Triad & Threat Models", "Cryptography Essentials", "Authentication Protocols"] },
      { title: "Network & Application Security", lessons: ["Firewalls & IDS/IPS", "Web Application Vulnerabilities", "Secure Configuration"] },
      { title: "Operations & Response", lessons: ["SIEM & Log Analysis", "Incident Response Lifecycle", "Security Capstone Lab"] },
    ],
    learn: ["Identify common cyber threats", "Apply security controls across layers", "Participate in incident response workflows"],
    req: ["Basic networking knowledge", "Linux familiarity helpful"],
    includes: ["17 video lessons", "Security lab scenarios", "Checklist templates", "Certificate"],
    audience: ["Cybersecurity internship candidates", "IT students specializing in security"],
  },
  {
    title: "Ethical Hacking",
    subcategory: "Cybersecurity",
    thumb: "security",
    difficulty: "advanced",
    duration: "10 weeks",
    price: [499900, 299900],
    featured: false,
    short: "Penetration testing methodology, reconnaissance, exploitation, and responsible disclosure.",
    full: "Learn ethical hacking within legal and professional boundaries. Study reconnaissance, scanning, vulnerability assessment, exploitation techniques, post-exploitation basics, and reporting — all in controlled lab environments suitable for penetration testing internship preparation.",
    modules: [
      { title: "Pen Test Methodology", lessons: ["Legal & Scope Framework", "Reconnaissance & OSINT", "Scanning & Enumeration"] },
      { title: "Exploitation Techniques", lessons: ["Web App Pen Testing", "Network Exploitation Basics", "Password Attacks & Defense"] },
      { title: "Reporting & Hardening", lessons: ["Vulnerability Reporting", "Remediation Recommendations", "Ethical Hacking Capstone"] },
    ],
    learn: ["Conduct authorized penetration tests", "Document findings professionally", "Recommend remediation strategies"],
    req: ["Cybersecurity fundamentals", "Networking & Linux proficiency"],
    includes: ["16 video lessons", "Lab VM setup guide", "Report templates", "Certificate"],
    audience: ["Advanced security students", "Pen testing internship aspirants"],
  },
  {
    title: "Mobile App Development",
    subcategory: "Mobile Development",
    thumb: "mobile",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: true,
    short: "Cross-platform mobile apps with React Native — UI, navigation, APIs, and publishing.",
    full: "Build mobile applications for iOS and Android using React Native. Learn component design, navigation patterns, state management, native module integration, and app store deployment fundamentals for mobile developer internships.",
    modules: [
      { title: "Mobile UI with React Native", lessons: ["Components & Styling", "Navigation & Screens", "Forms & User Input"] },
      { title: "Data & Device Features", lessons: ["API Integration", "AsyncStorage & State", "Camera & Location APIs"] },
      { title: "Publishing Apps", lessons: ["Performance Optimization", "Testing on Devices", "Store Submission Basics"] },
    ],
    learn: ["Build cross-platform mobile apps", "Integrate REST APIs in mobile clients", "Prepare apps for store deployment"],
    req: ["JavaScript/React basics recommended"],
    includes: ["17 video lessons", "App starter template", "Publishing checklist", "Certificate"],
    audience: ["Mobile developer internship candidates", "Full stack devs adding mobile skills"],
  },
  {
    title: "Android App Development",
    subcategory: "Mobile Development",
    thumb: "mobile",
    difficulty: "intermediate",
    duration: "10 weeks",
    price: [449900, 279900],
    featured: false,
    short: "Native Android development with Kotlin, Jetpack, Material Design, and Play Store publishing.",
    full: "Create native Android applications using Kotlin and modern Android Jetpack libraries. Cover activities, fragments, RecyclerView, Room database, ViewModel architecture, and Google Play publishing workflow for Android developer internships.",
    modules: [
      { title: "Android & Kotlin Basics", lessons: ["Kotlin Syntax & OOP", "Activities & Layouts", "Material Design Components"] },
      { title: "Architecture & Data", lessons: ["ViewModel & LiveData", "Room Database", "Networking with Retrofit"] },
      { title: "Advanced Android", lessons: ["Navigation Component", "Notifications & Services", "Play Store Publishing"] },
    ],
    learn: ["Develop native Android apps in Kotlin", "Apply MVVM architecture patterns", "Publish apps to Google Play"],
    req: ["Java or Kotlin basics helpful", "Android Studio installed"],
    includes: ["18 video lessons", "Sample Android projects", "Play Console guide", "Certificate"],
    audience: ["Android internship aspirants", "Java developers moving to mobile"],
  },
  {
    title: "UI/UX Design",
    subcategory: "Design",
    thumb: "design",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "User research, wireframing, prototyping, design systems, and usability testing in Figma.",
    full: "Learn user-centered design from research through high-fidelity prototypes. Master Figma workflows, design systems, accessibility, and usability testing to deliver portfolio projects suitable for UI/UX design internships in tech companies.",
    modules: [
      { title: "UX Research & Strategy", lessons: ["User Research Methods", "Personas & Journey Maps", "Information Architecture"] },
      { title: "UI Design in Figma", lessons: ["Wireframes to Hi-fi UI", "Design Systems & Components", "Responsive Design Patterns"] },
      { title: "Testing & Handoff", lessons: ["Usability Testing", "Developer Handoff", "UX Portfolio Project"] },
    ],
    learn: ["Conduct user research and usability tests", "Create professional Figma prototypes", "Build a UX case study for your portfolio"],
    req: ["No design background required", "Figma free account"],
    includes: ["15 video lessons", "Figma template kit", "Portfolio review checklist", "Certificate"],
    audience: ["Design internship candidates", "Developers improving product design skills"],
  },
  {
    title: "Database Management & SQL",
    subcategory: "Database",
    thumb: "database",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Relational databases, SQL queries, normalization, indexing, and PostgreSQL administration.",
    full: "Master database concepts essential for developer and analyst internships. Learn ER modeling, normalization, SQL (DDL/DML/DCL), joins, subqueries, indexing, transactions, and PostgreSQL administration basics used in production environments.",
    modules: [
      { title: "Database Concepts", lessons: ["ER Diagrams & Normalization", "Relational Model", "Keys & Constraints"] },
      { title: "SQL Mastery", lessons: ["SELECT, JOIN & Aggregations", "Subqueries & CTEs", "Indexes & Query Plans"] },
      { title: "Administration Basics", lessons: ["Backups & Recovery", "Users & Permissions", "SQL Capstone Project"] },
    ],
    learn: ["Design normalized database schemas", "Write efficient SQL queries", "Perform basic PostgreSQL administration"],
    req: ["Basic computer literacy", "Logical thinking skills"],
    includes: ["14 video lessons", "Practice SQL database", "Schema design exercises", "Certificate"],
    audience: ["Developers and analysts needing SQL", "DBA internship aspirants"],
  },
];

const courseRows = [];
const moduleRows = [];
const lessonRows = [];
const learningRows = [];
const requirementRows = [];
const includeRows = [];
const audienceRows = [];

courses.forEach((course, idx) => {
  const courseNum = idx + 10;
  const slug = slugify(course.title);
  // Reuse seeded LMS id when slug already exists from 46-rds-courses-platform.sql
  const courseId =
    slug === "full-stack-web-development"
      ? "b2000001-0001-4001-8001-000000000001"
      : padId(courseNum, "b2000001-0001-4001-8001-");
  const meta = buildCourseMeta(course);
  const lessonCount = meta.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const moduleCount = meta.modules.length;
  const [original, discount] = course.price;

  courseRows.push({
    id: courseId,
    title: course.title,
    slug,
    subcategory: course.subcategory,
    thumbnail: THUMBNAILS[course.thumb],
    short: meta.short_description,
    full: meta.full_description,
    original,
    discount,
    duration: course.duration,
    difficulty: course.difficulty,
    featured: course.featured,
    meta_title: meta.meta_title,
    meta_description: meta.meta_description,
    meta_keywords: meta.meta_keywords,
    lessonCount,
    moduleCount,
  });

  meta.modules.forEach((mod, modIdx) => {
    const moduleNum = courseNum * 100 + modIdx + 1;
    const moduleId = padId(moduleNum, "c3000001-0001-4001-8001-");
    moduleRows.push({ id: moduleId, courseId, title: mod.title, sort_order: modIdx + 1 });
    mod.lessons.forEach((lessonTitle, lessonIdx) => {
      lessonRows.push({
        moduleId,
        title: lessonTitle,
        duration_minutes: 20 + lessonIdx * 5,
        sort_order: lessonIdx + 1,
      });
    });
  });

  meta.learning_points.forEach((body, i) => learningRows.push({ courseId, body, sort_order: i + 1 }));
  meta.requirements.forEach((body, i) => requirementRows.push({ courseId, body, sort_order: i + 1 }));
  meta.includes.forEach((body, i) => includeRows.push({ courseId, body, sort_order: i + 1 }));
  meta.target_audience.forEach((body, i) => audienceRows.push({ courseId, body, sort_order: i + 1 }));
});

function buildMigration(headerComment) {
  const lines = [headerComment, ""];

  lines.push("-- Ensure Technology category exists");
  lines.push("INSERT INTO public.course_categories (id, name, slug, description, is_active, sort_order)");
  lines.push("VALUES (");
  lines.push(`  ${sqlStr(TECHNOLOGY_CATEGORY_ID)},`);
  lines.push("  'Technology',");
  lines.push("  'technology',");
  lines.push("  'Programming, cloud, software, data, and technical skills',");
  lines.push("  true,");
  lines.push("  1");
  lines.push(")");
  lines.push("ON CONFLICT (slug) DO UPDATE SET");
  lines.push("  name = EXCLUDED.name,");
  lines.push("  description = EXCLUDED.description,");
  lines.push("  is_active = EXCLUDED.is_active;");
  lines.push("");

  lines.push("INSERT INTO public.courses (");
  lines.push("  id, title, slug, category_id, subcategory, instructor_name,");
  lines.push("  thumbnail_url, short_description, full_description,");
  lines.push("  original_price_paise, discount_price_paise, is_free,");
  lines.push("  duration_text, language, difficulty, status, is_featured,");
  lines.push("  meta_title, meta_description, meta_keywords,");
  lines.push("  rating_avg, rating_count, students_count, lessons_count, modules_count, published_at");
  lines.push(")");
  lines.push("VALUES");
  courseRows.forEach((row, i) => {
    const rating = (4.3 + (i % 5) * 0.1).toFixed(1);
    const students = 120 + i * 37;
    const reviews = 24 + i * 3;
    lines.push(`  (`);
    lines.push(`    ${sqlStr(row.id)},`);
    lines.push(`    ${sqlStr(row.title)},`);
    lines.push(`    ${sqlStr(row.slug)},`);
    lines.push(`    ${sqlStr(TECHNOLOGY_CATEGORY_ID)},`);
    lines.push(`    ${sqlStr(row.subcategory)},`);
    lines.push(`    ${sqlStr(DEFAULT_INSTRUCTOR)},`);
    lines.push(`    ${sqlStr(row.thumbnail)},`);
    lines.push(`    ${sqlStr(row.short)},`);
    lines.push(`    ${sqlStr(row.full)},`);
    lines.push(`    ${row.original}, ${row.discount}, false,`);
    lines.push(`    ${sqlStr(row.duration)}, 'English', ${sqlStr(row.difficulty)}, 'published', ${row.featured},`);
    lines.push(`    ${sqlStr(row.meta_title)},`);
    lines.push(`    ${sqlStr(row.meta_description)},`);
    lines.push(`    ${sqlStr(row.meta_keywords)},`);
    lines.push(`    ${rating}, ${reviews}, ${students}, ${row.lessonCount}, ${row.moduleCount}, now()`);
    lines.push(`  )${i < courseRows.length - 1 ? "," : ""}`);
  });
  lines.push("ON CONFLICT (slug) DO UPDATE SET");
  lines.push("  title = EXCLUDED.title,");
  lines.push("  category_id = EXCLUDED.category_id,");
  lines.push("  subcategory = EXCLUDED.subcategory,");
  lines.push("  instructor_name = EXCLUDED.instructor_name,");
  lines.push("  thumbnail_url = EXCLUDED.thumbnail_url,");
  lines.push("  short_description = EXCLUDED.short_description,");
  lines.push("  full_description = EXCLUDED.full_description,");
  lines.push("  original_price_paise = EXCLUDED.original_price_paise,");
  lines.push("  discount_price_paise = EXCLUDED.discount_price_paise,");
  lines.push("  duration_text = EXCLUDED.duration_text,");
  lines.push("  difficulty = EXCLUDED.difficulty,");
  lines.push("  status = EXCLUDED.status,");
  lines.push("  is_featured = EXCLUDED.is_featured,");
  lines.push("  meta_title = EXCLUDED.meta_title,");
  lines.push("  meta_description = EXCLUDED.meta_description,");
  lines.push("  meta_keywords = EXCLUDED.meta_keywords,");
  lines.push("  lessons_count = EXCLUDED.lessons_count,");
  lines.push("  modules_count = EXCLUDED.modules_count,");
  lines.push("  updated_at = now();");
  lines.push("");

  lines.push("DELETE FROM public.course_modules");
  lines.push("WHERE course_id IN (");
  lines.push(`  ${courseRows.map((r) => sqlStr(r.id)).join(", ")}`);
  lines.push(");");
  lines.push("");

  lines.push("INSERT INTO public.course_modules (id, course_id, title, sort_order) VALUES");
  moduleRows.forEach((row, i) => {
    lines.push(`  (${sqlStr(row.id)}, ${sqlStr(row.courseId)}, ${sqlStr(row.title)}, ${row.sort_order})${i < moduleRows.length - 1 ? "," : ""}`);
  });
  lines.push("ON CONFLICT (id) DO UPDATE SET");
  lines.push("  title = EXCLUDED.title,");
  lines.push("  sort_order = EXCLUDED.sort_order,");
  lines.push("  updated_at = now();");
  lines.push("");

  lines.push("INSERT INTO public.course_lessons (module_id, title, duration_minutes, sort_order) VALUES");
  lessonRows.forEach((row, i) => {
    lines.push(`  (${sqlStr(row.moduleId)}, ${sqlStr(row.title)}, ${row.duration_minutes}, ${row.sort_order})${i < lessonRows.length - 1 ? "," : ""}`);
  });
  lines.push(";");
  lines.push("");

  function listInsert(table, rows, valueFn) {
    lines.push(`DELETE FROM public.${table}`);
    lines.push(`WHERE course_id IN (${courseRows.map((r) => sqlStr(r.id)).join(", ")});`);
    lines.push("");
    lines.push(`INSERT INTO public.${table} (course_id, body, sort_order) VALUES`);
    rows.forEach((row, i) => {
      lines.push(`  ${valueFn(row)}${i < rows.length - 1 ? "," : ""}`);
    });
    lines.push(";");
    lines.push("");
  }

  listInsert("course_learning_points", learningRows, (r) => `(${sqlStr(r.courseId)}, ${sqlStr(r.body)}, ${r.sort_order})`);
  listInsert("course_requirements", requirementRows, (r) => `(${sqlStr(r.courseId)}, ${sqlStr(r.body)}, ${r.sort_order})`);
  listInsert("course_includes", includeRows, (r) => `(${sqlStr(r.courseId)}, ${sqlStr(r.body)}, ${r.sort_order})`);
  listInsert("course_target_audience", audienceRows, (r) => `(${sqlStr(r.courseId)}, ${sqlStr(r.body)}, ${r.sort_order})`);

  return lines.join("\n");
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = join(root, "supabase/migrations/20260912150000_technical_category_courses.sql");
const rdsPath = join(root, "aws/scripts/67-rds-technical-category-courses.sql");

const migration = buildMigration(
  "-- Seed 20 Technology category courses with curriculum, descriptions, and metadata."
);
const rds = `-- Mirror of supabase/migrations/20260912150000_technical_category_courses.sql\n${migration}`;

writeFileSync(migrationPath, migration + "\n");
writeFileSync(rdsPath, rds + "\n");

console.log(`Wrote ${migrationPath}`);
console.log(`Wrote ${rdsPath}`);
console.log(`Courses: ${courseRows.length}, Modules: ${moduleRows.length}, Lessons: ${lessonRows.length}`);
