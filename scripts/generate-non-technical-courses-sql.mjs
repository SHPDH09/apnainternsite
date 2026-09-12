#!/usr/bin/env node
/**
 * Generates SQL migration for non-technical category courses.
 * Run: node scripts/generate-non-technical-courses-sql.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CATEGORIES = {
  business: {
    id: "a1000001-0001-4001-8001-000000000002",
    name: "Business",
    slug: "business",
    description: "Management, marketing, finance, and entrepreneurship",
  },
  design: {
    id: "a1000001-0001-4001-8001-000000000003",
    name: "Design",
    slug: "design",
    description: "Graphic design, fashion, and creative skills",
  },
  career: {
    id: "a1000001-0001-4001-8001-000000000004",
    name: "Career Skills",
    slug: "career-skills",
    description: "Communication, education, psychology, and professional skills",
  },
};

const DEFAULT_INSTRUCTOR = "Apna Intern Expert Faculty";

const THUMBNAILS = {
  marketing: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  business: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80",
  finance: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
  hr: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80",
  hospitality: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  media: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
  design: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80",
  education: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
  legal: "https://images.unsplash.com/photo-1589829545855-d9d063a05908?w=800&q=80",
  policy: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",
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

function mod(title, lessons) {
  return { title, lessons };
}

const courses = [
  {
    title: "Digital Marketing",
    category: "business",
    subcategory: "Marketing",
    thumb: "marketing",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "SEO, social media, content marketing, paid ads, and analytics for modern digital campaigns.",
    full: "Learn end-to-end digital marketing skills used in internships across agencies, startups, and brands. Cover search engine optimization, social media strategy, content planning, Google Ads basics, email marketing, and campaign analytics with practical assignments.",
    modules: [
      mod("Digital Marketing Foundations", ["Marketing Funnel & Customer Journey", "Brand Positioning Online", "Marketing Analytics Intro"]),
      mod("Channels & Content", ["SEO Fundamentals", "Social Media Strategy", "Content Marketing & Copy"]),
      mod("Campaigns & Measurement", ["Paid Ads Overview", "Email Marketing", "Digital Marketing Capstone"]),
    ],
    learn: ["Plan multi-channel digital campaigns", "Optimize content for search and social", "Measure ROI with analytics tools"],
    req: ["Basic computer and internet skills", "No prior marketing experience required"],
    includes: ["15 video lessons", "Campaign templates", "Analytics checklist", "Certificate of completion"],
    audience: ["BBA/MBA students", "Marketing internship aspirants"],
  },
  {
    title: "Business Management",
    category: "business",
    subcategory: "Management",
    thumb: "business",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: true,
    short: "Core management principles — planning, organizing, leading, and controlling for business success.",
    full: "Build a strong foundation in business management covering organizational behavior, leadership styles, decision-making frameworks, and operational planning. Ideal for commerce and management students preparing for corporate internships.",
    modules: [
      mod("Management Essentials", ["Functions of Management", "Organizational Structures", "Leadership Styles"]),
      mod("Planning & Execution", ["Strategic vs Operational Planning", "Goal Setting & KPIs", "Team Coordination"]),
      mod("Applied Management", ["Conflict Resolution", "Performance Management", "Management Case Study"]),
    ],
    learn: ["Apply management frameworks to real scenarios", "Lead teams and delegate effectively", "Analyze business operations"],
    req: ["Interest in business and management", "Basic English communication"],
    includes: ["14 video lessons", "Case study pack", "Management toolkit PDF", "Certificate"],
    audience: ["BBA/B.Com students", "Management trainee internship candidates"],
  },
  {
    title: "Human Resource Management (HR)",
    category: "business",
    subcategory: "Human Resources",
    thumb: "hr",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: true,
    short: "Recruitment, onboarding, payroll basics, employee relations, and HR operations.",
    full: "Comprehensive HR internship preparation covering talent acquisition, job descriptions, interview coordination, onboarding workflows, leave policies, performance reviews, and HR compliance fundamentals used in Indian organizations.",
    modules: [
      mod("HR Foundations", ["Role of HR in Organizations", "HR Policies & Compliance", "Employee Lifecycle Overview"]),
      mod("Talent Management", ["Recruitment & Sourcing", "Interview & Selection", "Onboarding Best Practices"]),
      mod("HR Operations", ["Payroll & Attendance Basics", "Employee Relations", "HR Capstone Project"]),
    ],
    learn: ["Manage recruitment pipelines", "Draft HR policies and job descriptions", "Handle employee relations professionally"],
    req: ["Good communication skills", "Interest in people management"],
    includes: ["15 video lessons", "HR document templates", "Interview guides", "Certificate"],
    audience: ["MBA HR specialization students", "HR internship aspirants"],
  },
  {
    title: "Financial Accounting",
    category: "business",
    subcategory: "Finance",
    thumb: "finance",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Journal entries, ledgers, trial balance, financial statements, and GST-aware accounting.",
    full: "Master accounting fundamentals aligned with Indian commerce curricula and internship expectations. Learn double-entry bookkeeping, preparation of financial statements, bank reconciliation, and introductory GST accounting with Tally-oriented practice exercises.",
    modules: [
      mod("Accounting Basics", ["Accounting Principles", "Journal & Ledger", "Trial Balance"]),
      mod("Financial Statements", ["Trading & P&L Account", "Balance Sheet", "Cash Flow Intro"]),
      mod("Applied Accounting", ["Bank Reconciliation", "GST Accounting Basics", "Accounting Project"]),
    ],
    learn: ["Record transactions using double-entry system", "Prepare financial statements", "Apply GST basics in accounting"],
    req: ["Basic mathematics", "B.Com or equivalent background helpful"],
    includes: ["16 video lessons", "Practice worksheets", "Tally exercise guide", "Certificate"],
    audience: ["Commerce students", "Accounts internship candidates"],
  },
  {
    title: "Banking & Finance",
    category: "business",
    subcategory: "Finance",
    thumb: "finance",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "Retail banking, loans, investments, RBI regulations, and financial services operations.",
    full: "Understand the banking and financial services sector for internships in banks, NBFCs, and fintech companies. Cover banking products, KYC/AML compliance, loan processing, mutual funds basics, and customer relationship management in BFSI.",
    modules: [
      mod("Banking Overview", ["Indian Banking System", "Types of Accounts & Products", "KYC & AML Compliance"]),
      mod("Lending & Investments", ["Loan Processing Workflow", "Credit Assessment Basics", "Mutual Funds & Insurance Intro"]),
      mod("BFSI Operations", ["Customer Service in Banking", "Digital Banking Trends", "Banking Case Study"]),
    ],
    learn: ["Explain banking products to customers", "Understand loan and KYC processes", "Navigate BFSI compliance basics"],
    req: ["Commerce or finance background helpful", "Professional communication skills"],
    includes: ["15 video lessons", "BFSI glossary", "Process flowcharts", "Certificate"],
    audience: ["Finance students", "Banking internship aspirants"],
  },
  {
    title: "Sales & Business Development",
    category: "business",
    subcategory: "Sales",
    thumb: "business",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: true,
    short: "Prospecting, pitching, negotiation, CRM usage, and B2B/B2C sales strategies.",
    full: "Develop practical sales and business development skills for internships in SaaS, retail, and service companies. Learn lead generation, consultative selling, objection handling, pipeline management, and partnership outreach with role-play exercises.",
    modules: [
      mod("Sales Foundations", ["Sales Funnel & Prospecting", "Consultative Selling", "CRM Tools Intro"]),
      mod("Pitching & Closing", ["Effective Sales Presentations", "Negotiation Techniques", "Objection Handling"]),
      mod("Business Development", ["B2B Outreach Strategies", "Partnership Development", "Sales Capstone Pitch"]),
    ],
    learn: ["Build and manage a sales pipeline", "Deliver persuasive sales pitches", "Negotiate and close deals professionally"],
    req: ["Confident communication", "No prior sales experience required"],
    includes: ["14 video lessons", "Pitch deck templates", "CRM practice exercises", "Certificate"],
    audience: ["MBA marketing/sales students", "Business development internship candidates"],
  },
  {
    title: "Business Communication",
    category: "career",
    subcategory: "Communication",
    thumb: "business",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [249900, 149900],
    featured: false,
    short: "Professional emails, presentations, meetings, reports, and workplace communication etiquette.",
    full: "Strengthen written and verbal business communication skills essential for every internship. Practice email writing, meeting facilitation, presentation design, report structuring, and cross-functional communication in professional Indian workplace contexts.",
    modules: [
      mod("Written Communication", ["Professional Email Writing", "Business Reports & Memos", "Documentation Standards"]),
      mod("Verbal Communication", ["Presentation Skills", "Meeting Etiquette", "Active Listening"]),
      mod("Workplace Communication", ["Cross-functional Collaboration", "Handling Difficult Conversations", "Communication Portfolio"]),
    ],
    learn: ["Write clear professional emails and reports", "Deliver confident presentations", "Communicate effectively in teams"],
    req: ["Basic English proficiency", "Willingness to practice speaking"],
    includes: ["12 video lessons", "Email templates", "Presentation checklist", "Certificate"],
    audience: ["All UG/PG students", "Internship candidates across domains"],
  },
  {
    title: "Entrepreneurship & Startup Management",
    category: "business",
    subcategory: "Entrepreneurship",
    thumb: "business",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "Idea validation, business models, MVP, funding basics, and startup operations.",
    full: "Learn how to validate ideas, build business models, create MVPs, and manage early-stage startup operations. Covers lean startup methodology, pitch preparation, basic financial projections, and go-to-market planning for aspiring founders and startup interns.",
    modules: [
      mod("Startup Foundations", ["Idea Validation & Market Research", "Business Model Canvas", "Lean Startup Method"]),
      mod("Building & Launching", ["MVP Development Strategy", "Go-to-Market Planning", "Startup Metrics"]),
      mod("Growth & Funding", ["Pitch Deck Creation", "Funding Options in India", "Startup Capstone Plan"]),
    ],
    learn: ["Validate business ideas with research", "Create investor-ready pitch decks", "Plan MVP and go-to-market strategy"],
    req: ["Entrepreneurial mindset", "Basic business awareness"],
    includes: ["15 video lessons", "Business model templates", "Pitch deck samples", "Certificate"],
    audience: ["Startup internship candidates", "Aspiring founders and innovators"],
  },
  {
    title: "Project Management",
    category: "business",
    subcategory: "Management",
    thumb: "business",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "Agile, Scrum, Gantt charts, risk management, and project delivery frameworks.",
    full: "Master project management fundamentals used across IT, construction, marketing, and operations internships. Learn scope, schedule, cost, quality, and risk management with practical tools like Gantt charts, Kanban boards, and Agile/Scrum ceremonies.",
    modules: [
      mod("PM Foundations", ["Project Lifecycle", "Scope & WBS", "Scheduling & Gantt Charts"]),
      mod("Agile & Scrum", ["Agile Principles", "Scrum Roles & Ceremonies", "Kanban & Hybrid Methods"]),
      mod("Delivery & Risk", ["Risk Management", "Stakeholder Communication", "PM Capstone Project"]),
    ],
    learn: ["Plan and track projects end-to-end", "Run Agile/Scrum ceremonies", "Manage risks and stakeholders"],
    req: ["Organizational skills", "Basic teamwork experience"],
    includes: ["16 video lessons", "Project plan templates", "Agile cheat sheets", "Certificate"],
    audience: ["MBA and engineering students", "Project coordinator internship candidates"],
  },
  {
    title: "Operations Management",
    category: "business",
    subcategory: "Operations",
    thumb: "business",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Process optimization, quality control, capacity planning, and operational efficiency.",
    full: "Understand how organizations deliver products and services efficiently. Study process mapping, capacity planning, quality management (Six Sigma intro), inventory basics, and KPI dashboards used in operations and supply chain internships.",
    modules: [
      mod("Operations Basics", ["Operations Strategy", "Process Mapping", "Capacity Planning"]),
      mod("Quality & Efficiency", ["Quality Management Systems", "Six Sigma Intro", "Lean Operations"]),
      mod("Applied Operations", ["Inventory Management Basics", "Operations KPIs", "Operations Case Study"]),
    ],
    learn: ["Map and improve business processes", "Apply quality control techniques", "Monitor operations KPIs"],
    req: ["Analytical thinking", "Management or engineering background helpful"],
    includes: ["15 video lessons", "Process map templates", "KPI dashboard samples", "Certificate"],
    audience: ["Operations internship candidates", "MBA operations specialization students"],
  },
  {
    title: "Supply Chain & Logistics Management",
    category: "business",
    subcategory: "Supply Chain",
    thumb: "business",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: false,
    short: "Procurement, warehousing, transportation, inventory, and supply chain analytics.",
    full: "Learn supply chain and logistics management from procurement to last-mile delivery. Covers vendor management, warehouse operations, transportation modes, inventory optimization, and supply chain technology used in e-commerce and manufacturing internships.",
    modules: [
      mod("Supply Chain Overview", ["SCM Concepts & Flows", "Procurement & Sourcing", "Vendor Management"]),
      mod("Logistics Operations", ["Warehousing & Inventory", "Transportation Management", "Last-Mile Delivery"]),
      mod("SCM Analytics", ["Demand Forecasting Intro", "Supply Chain KPIs", "SCM Capstone Case"]),
    ],
    learn: ["Design efficient supply chain flows", "Manage inventory and logistics", "Analyze supply chain performance"],
    req: ["Basic business knowledge", "Interest in operations and logistics"],
    includes: ["15 video lessons", "SCM case studies", "Inventory calculation exercises", "Certificate"],
    audience: ["Logistics internship candidates", "MBA operations/supply chain students"],
  },
  {
    title: "Retail Management",
    category: "business",
    subcategory: "Retail",
    thumb: "business",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Store operations, visual merchandising, customer service, and retail sales management.",
    full: "Prepare for retail internships in stores, malls, and e-commerce companies. Learn store layout, visual merchandising, inventory on the shop floor, customer service excellence, POS operations, and retail sales target management.",
    modules: [
      mod("Retail Foundations", ["Retail Industry Overview", "Store Operations", "Visual Merchandising"]),
      mod("Customer & Sales", ["Customer Service Excellence", "Upselling & Cross-selling", "POS & Billing Systems"]),
      mod("Retail Management", ["Inventory on Shop Floor", "Sales Target Management", "Retail Capstone Project"]),
    ],
    learn: ["Manage daily store operations", "Create effective visual merchandising", "Deliver excellent customer service"],
    req: ["Customer-facing attitude", "No prior retail experience required"],
    includes: ["13 video lessons", "Merchandising checklist", "Customer service scripts", "Certificate"],
    audience: ["Retail management students", "Store operations internship candidates"],
  },
  {
    title: "Event Management",
    category: "business",
    subcategory: "Events",
    thumb: "hospitality",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Event planning, budgeting, vendor coordination, marketing, and on-site execution.",
    full: "Learn to plan and execute corporate events, college fests, weddings, and conferences. Cover budgeting, venue selection, vendor negotiations, event marketing, timeline management, and on-ground coordination for event management internships.",
    modules: [
      mod("Event Planning", ["Types of Events", "Budgeting & Timeline", "Venue & Vendor Selection"]),
      mod("Event Marketing", ["Promotion & Registration", "Sponsorship Outreach", "Branding for Events"]),
      mod("Event Execution", ["On-site Coordination", "Crisis Management", "Post-Event Evaluation"]),
    ],
    learn: ["Plan events from concept to execution", "Manage vendors and budgets", "Coordinate on-site event operations"],
    req: ["Organizational skills", "Creative problem-solving"],
    includes: ["13 video lessons", "Event planning templates", "Vendor checklist", "Certificate"],
    audience: ["Event management students", "College fest organizers seeking internships"],
  },
  {
    title: "Hotel & Hospitality Management",
    category: "business",
    subcategory: "Hospitality",
    thumb: "hospitality",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: true,
    short: "Front office, housekeeping, F&B service, guest relations, and hotel operations.",
    full: "Comprehensive introduction to hotel and hospitality management covering front desk operations, reservations, housekeeping standards, food & beverage service, guest complaint handling, and hospitality software used in hotel internships.",
    modules: [
      mod("Hospitality Industry", ["Hotel Departments Overview", "Guest Experience Standards", "Hospitality Branding"]),
      mod("Hotel Operations", ["Front Office & Reservations", "Housekeeping Management", "F&B Service Basics"]),
      mod("Guest Relations", ["Complaint Handling", "Upselling Hotel Services", "Hospitality Capstone"]),
    ],
    learn: ["Manage front office and reservations", "Maintain hospitality service standards", "Handle guest relations professionally"],
    req: ["Professional grooming and etiquette", "Interest in hospitality sector"],
    includes: ["15 video lessons", "SOP templates", "Guest service scripts", "Certificate"],
    audience: ["Hotel management students", "Hospitality internship candidates"],
  },
  {
    title: "Tourism Management",
    category: "business",
    subcategory: "Tourism",
    thumb: "hospitality",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Tour packages, travel operations, destination marketing, and customer itinerary planning.",
    full: "Learn tourism business operations including tour package design, travel agency workflows, destination marketing, visa and documentation basics, and customer itinerary planning for internships in travel companies and tourism boards.",
    modules: [
      mod("Tourism Industry", ["Tourism Ecosystem in India", "Types of Tourism", "Regulatory Basics"]),
      mod("Tour Operations", ["Itinerary Planning", "Package Pricing", "Travel Documentation"]),
      mod("Tourism Marketing", ["Destination Marketing", "Digital Promotion for Tours", "Tourism Capstone Plan"]),
    ],
    learn: ["Design tour packages and itineraries", "Handle travel bookings and documentation", "Market tourism products digitally"],
    req: ["Interest in travel and tourism", "Good communication skills"],
    includes: ["13 video lessons", "Itinerary templates", "Package pricing worksheet", "Certificate"],
    audience: ["Tourism management students", "Travel agency internship candidates"],
  },
  {
    title: "Content Writing & Copywriting",
    category: "career",
    subcategory: "Writing",
    thumb: "media",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [249900, 149900],
    featured: true,
    short: "Blog writing, SEO content, ad copy, social captions, and brand voice development.",
    full: "Develop professional content writing and copywriting skills for internships in agencies, startups, and media companies. Learn SEO writing, blog structure, ad copy formulas, social media captions, and maintaining consistent brand voice across channels.",
    modules: [
      mod("Writing Foundations", ["Content Types & Formats", "SEO Writing Basics", "Brand Voice & Tone"]),
      mod("Copywriting Skills", ["Headlines & Hooks", "Ad Copy Formulas", "Landing Page Copy"]),
      mod("Content Strategy", ["Editorial Calendars", "Content Repurposing", "Writing Portfolio Project"]),
    ],
    learn: ["Write SEO-friendly blog content", "Create compelling ad copy", "Build a content writing portfolio"],
    req: ["Good English writing skills", "Creativity and curiosity"],
    includes: ["12 video lessons", "Copywriting swipe file", "Portfolio project brief", "Certificate"],
    audience: ["English and media students", "Content writing internship candidates"],
  },
  {
    title: "Journalism & Mass Communication",
    category: "career",
    subcategory: "Media",
    thumb: "media",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: true,
    short: "News reporting, editing, media ethics, broadcasting basics, and digital journalism.",
    full: "Introduction to journalism and mass communication covering news gathering, writing for print and digital, editing, media law and ethics, photography basics, and broadcasting fundamentals for internships in newsrooms and media houses.",
    modules: [
      mod("Journalism Basics", ["News Values & Reporting", "Interview Techniques", "Media Ethics & Law"]),
      mod("Content Production", ["News Writing & Editing", "Digital Journalism", "Photo & Video Basics"]),
      mod("Mass Communication", ["Broadcasting Intro", "Media Planning", "Journalism Portfolio Piece"]),
    ],
    learn: ["Report and write news stories", "Edit content for print and digital", "Apply media ethics in reporting"],
    req: ["Strong language skills", "Interest in current affairs"],
    includes: ["15 video lessons", "News writing templates", "Ethics case studies", "Certificate"],
    audience: ["Mass communication students", "Journalism internship candidates"],
  },
  {
    title: "Public Relations (PR)",
    category: "business",
    subcategory: "Public Relations",
    thumb: "media",
    difficulty: "intermediate",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: false,
    short: "Media relations, press releases, crisis communication, and brand reputation management.",
    full: "Learn public relations strategies for corporate and agency internships. Cover press release writing, media pitching, event PR, crisis communication, stakeholder messaging, and measuring PR campaign effectiveness.",
    modules: [
      mod("PR Foundations", ["Role of PR in Organizations", "Media Landscape in India", "PR vs Advertising"]),
      mod("PR Tactics", ["Press Release Writing", "Media Pitching", "Event PR"]),
      mod("Reputation Management", ["Crisis Communication", "Stakeholder Messaging", "PR Campaign Project"]),
    ],
    learn: ["Write and distribute press releases", "Build media relationships", "Manage crisis communication"],
    req: ["Excellent writing and communication", "Interest in media and brands"],
    includes: ["13 video lessons", "Press release templates", "Media list guide", "Certificate"],
    audience: ["Mass comm and MBA students", "PR agency internship candidates"],
  },
  {
    title: "Social Media Management",
    category: "business",
    subcategory: "Marketing",
    thumb: "marketing",
    difficulty: "beginner",
    duration: "6 weeks",
    price: [299900, 179900],
    featured: true,
    short: "Platform strategy, content calendars, community management, and social analytics.",
    full: "Hands-on social media management course for internships managing brand accounts on Instagram, LinkedIn, Facebook, and Twitter/X. Learn content calendars, community engagement, influencer coordination, paid boost basics, and social media reporting.",
    modules: [
      mod("Social Strategy", ["Platform Selection", "Content Pillars & Calendars", "Brand Guidelines for Social"]),
      mod("Content & Community", ["Creating Engaging Posts", "Community Management", "Influencer Collaboration"]),
      mod("Analytics & Growth", ["Social Media Metrics", "Paid Boost Basics", "Social Media Capstone"]),
    ],
    learn: ["Manage brand social media accounts", "Create content calendars", "Report on social media performance"],
    req: ["Active on social media platforms", "Creative content sense"],
    includes: ["13 video lessons", "Content calendar template", "Analytics report template", "Certificate"],
    audience: ["Digital marketing students", "Social media internship candidates"],
  },
  {
    title: "Graphic Design",
    category: "design",
    subcategory: "Graphic Design",
    thumb: "design",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: true,
    short: "Adobe tools, typography, color theory, branding, and portfolio-ready design projects.",
    full: "Learn graphic design fundamentals using industry-standard tools and principles. Cover typography, color theory, layout design, logo creation, social media graphics, and print design to build a portfolio suitable for design internships.",
    modules: [
      mod("Design Principles", ["Typography & Color Theory", "Layout & Composition", "Visual Hierarchy"]),
      mod("Tools & Techniques", ["Design Software Workflow", "Logo & Brand Identity", "Social Media Graphics"]),
      mod("Portfolio Building", ["Print Design Basics", "Client Brief Practice", "Design Portfolio Project"]),
    ],
    learn: ["Apply design principles to real projects", "Create logos and brand assets", "Build a graphic design portfolio"],
    req: ["Creativity and visual sense", "Access to design software (Canva/Adobe)"],
    includes: ["15 video lessons", "Design asset templates", "Portfolio project brief", "Certificate"],
    audience: ["Design students", "Graphic design internship candidates"],
  },
  {
    title: "Fashion Design",
    category: "design",
    subcategory: "Fashion",
    thumb: "design",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: false,
    short: "Fashion illustration, fabric knowledge, garment construction, and trend forecasting.",
    full: "Introduction to fashion design covering sketching, fabric types, pattern basics, garment construction overview, trend research, and fashion portfolio development for internships in design houses, retail brands, and export units.",
    modules: [
      mod("Fashion Foundations", ["Fashion Illustration", "Fabric Types & Properties", "Color in Fashion"]),
      mod("Design Process", ["Trend Forecasting", "Collection Planning", "Pattern Making Intro"]),
      mod("Fashion Portfolio", ["Garment Construction Basics", "Lookbook Creation", "Fashion Design Capstone"]),
    ],
    learn: ["Sketch fashion illustrations", "Select fabrics for designs", "Create a fashion design portfolio"],
    req: ["Interest in fashion and textiles", "Basic drawing skills helpful"],
    includes: ["15 video lessons", "Sketchbook exercises", "Fabric swatch guide", "Certificate"],
    audience: ["Fashion design students", "Apparel industry internship candidates"],
  },
  {
    title: "Psychology & Counseling",
    category: "career",
    subcategory: "Psychology",
    thumb: "education",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Counseling basics, active listening, mental health awareness, and ethical practice.",
    full: "Foundational course in psychology and counseling for internships in schools, NGOs, HR, and wellness organizations. Learn counseling micro-skills, active listening, basic assessment, mental health awareness, referral ethics, and documentation practices.",
    modules: [
      mod("Psychology Foundations", ["Introduction to Counseling", "Theories of Personality", "Mental Health Awareness"]),
      mod("Counseling Skills", ["Active Listening & Empathy", "Questioning Techniques", "Ethical Boundaries"]),
      mod("Applied Counseling", ["Case Formulation Basics", "Referral & Documentation", "Counseling Role-play Project"]),
    ],
    learn: ["Apply basic counseling micro-skills", "Practice active listening and empathy", "Maintain ethical counseling boundaries"],
    req: ["Empathy and patience", "Psychology academic background helpful"],
    includes: ["15 video lessons", "Counseling ethics guide", "Role-play scenarios", "Certificate"],
    audience: ["Psychology students", "School counseling internship candidates"],
  },
  {
    title: "Teaching & Education",
    category: "career",
    subcategory: "Education",
    thumb: "education",
    difficulty: "beginner",
    duration: "8 weeks",
    price: [299900, 179900],
    featured: true,
    short: "Lesson planning, classroom management, assessment, and modern teaching methods.",
    full: "Prepare for teaching internships and education roles with lesson planning, pedagogical methods, classroom management strategies, student assessment techniques, and integration of digital tools in teaching and learning environments.",
    modules: [
      mod("Teaching Foundations", ["Learning Theories", "Lesson Planning", "Classroom Management"]),
      mod("Instructional Methods", ["Active Learning Strategies", "Assessment & Feedback", "Inclusive Education"]),
      mod("Modern Education", ["EdTech Tools in Classroom", "Online Teaching Basics", "Teaching Practice Project"]),
    ],
    learn: ["Plan effective lessons", "Manage diverse classrooms", "Use EdTech tools for teaching"],
    req: ["Passion for teaching", "Good subject knowledge in chosen area"],
    includes: ["14 video lessons", "Lesson plan templates", "Assessment rubrics", "Certificate"],
    audience: ["B.Ed and D.El.Ed students", "Teaching internship candidates"],
  },
  {
    title: "Legal Studies & Legal Research",
    category: "career",
    subcategory: "Legal",
    thumb: "legal",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [399900, 249900],
    featured: false,
    short: "Legal research methods, case analysis, drafting basics, and Indian legal system overview.",
    full: "Foundational legal studies course for law internships covering the Indian legal system, statutory and case law research, legal drafting basics, citation methods, and memo writing used in law firms, corporate legal teams, and courts.",
    modules: [
      mod("Legal System Overview", ["Indian Legal Structure", "Sources of Law", "Court Hierarchy"]),
      mod("Legal Research", ["Case Law Research", "Statutory Interpretation", "Legal Citation Methods"]),
      mod("Legal Drafting", ["Legal Memo Writing", "Contract Basics", "Legal Research Project"]),
    ],
    learn: ["Conduct legal research effectively", "Analyze case law and statutes", "Draft basic legal documents"],
    req: ["Law student or legal studies background", "Strong reading and writing skills"],
    includes: ["16 video lessons", "Research methodology guide", "Drafting templates", "Certificate"],
    audience: ["LLB students", "Legal internship candidates"],
  },
  {
    title: "Public Policy & Administration",
    category: "business",
    subcategory: "Public Policy",
    thumb: "policy",
    difficulty: "intermediate",
    duration: "8 weeks",
    price: [349900, 219900],
    featured: false,
    short: "Policy analysis, governance, public administration, and government scheme research.",
    full: "Understand public policy formulation, implementation, and evaluation for internships in think tanks, NGOs, government offices, and research organizations. Cover governance structures, policy analysis frameworks, and public administration in the Indian context.",
    modules: [
      mod("Policy Foundations", ["Public Policy Cycle", "Governance in India", "Constitutional Framework"]),
      mod("Policy Analysis", ["Policy Research Methods", "Stakeholder Analysis", "Cost-Benefit Intro"]),
      mod("Public Administration", ["Government Schemes", "Implementation Challenges", "Policy Brief Project"]),
    ],
    learn: ["Analyze public policies critically", "Research government schemes", "Write policy briefs and reports"],
    req: ["Interest in governance and public affairs", "Research and writing skills"],
    includes: ["15 video lessons", "Policy brief template", "Scheme analysis worksheet", "Certificate"],
    audience: ["Political science and public admin students", "Policy research internship candidates"],
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
  const courseNum = idx + 30;
  const slug = slugify(course.title);
  const category = CATEGORIES[course.category];
  const courseId = padId(courseNum, "b2000001-0001-4001-8001-");
  const topic = course.title.replace(/\s*\([^)]*\)/g, "").trim();
  const lessonCount = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const moduleCount = course.modules.length;
  const [original, discount] = course.price;

  courseRows.push({
    id: courseId,
    title: course.title,
    slug,
    categoryId: category.id,
    subcategory: course.subcategory,
    thumbnail: THUMBNAILS[course.thumb],
    short: course.short,
    full: course.full,
    original,
    discount,
    duration: course.duration,
    difficulty: course.difficulty,
    featured: course.featured,
    meta_title: `${topic} Course | Apna Intern`,
    meta_description: course.short,
    meta_keywords: `${topic}, non-technical course, internship training, Apna Intern, ${course.subcategory.toLowerCase()}`,
    lessonCount,
    moduleCount,
  });

  course.modules.forEach((modEntry, modIdx) => {
    const moduleNum = courseNum * 100 + modIdx + 1;
    const moduleId = padId(moduleNum, "c3000001-0001-4001-8001-");
    moduleRows.push({ id: moduleId, courseId, title: modEntry.title, sort_order: modIdx + 1 });
    modEntry.lessons.forEach((lessonTitle, lessonIdx) => {
      lessonRows.push({
        moduleId,
        title: lessonTitle,
        duration_minutes: 20 + lessonIdx * 5,
        sort_order: lessonIdx + 1,
      });
    });
  });

  course.learn.forEach((body, i) => learningRows.push({ courseId, body, sort_order: i + 1 }));
  course.req.forEach((body, i) => requirementRows.push({ courseId, body, sort_order: i + 1 }));
  course.includes.forEach((body, i) => includeRows.push({ courseId, body, sort_order: i + 1 }));
  course.audience.forEach((body, i) => audienceRows.push({ courseId, body, sort_order: i + 1 }));
});

function buildMigration(headerComment) {
  const lines = [headerComment, ""];

  for (const cat of Object.values(CATEGORIES)) {
    lines.push(`INSERT INTO public.course_categories (id, name, slug, description, is_active, sort_order)`);
    lines.push(`VALUES (${sqlStr(cat.id)}, ${sqlStr(cat.name)}, ${sqlStr(cat.slug)}, ${sqlStr(cat.description)}, true, ${cat.slug === "business" ? 2 : cat.slug === "design" ? 3 : 4})`);
    lines.push("ON CONFLICT (slug) DO UPDATE SET");
    lines.push("  name = EXCLUDED.name,");
    lines.push("  description = EXCLUDED.description,");
    lines.push("  is_active = EXCLUDED.is_active;");
    lines.push("");
  }

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
    const rating = (4.2 + (i % 5) * 0.1).toFixed(1);
    const students = 95 + i * 29;
    const reviews = 18 + i * 2;
    lines.push("  (");
    lines.push(`    ${sqlStr(row.id)},`);
    lines.push(`    ${sqlStr(row.title)},`);
    lines.push(`    ${sqlStr(row.slug)},`);
    lines.push(`    ${sqlStr(row.categoryId)},`);
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
const migrationPath = join(root, "supabase/migrations/20260912160000_non_technical_category_courses.sql");
const rdsPath = join(root, "aws/scripts/68-rds-non-technical-category-courses.sql");

const migration = buildMigration(
  "-- Seed 25 non-technical courses (Business, Design, Career Skills) with full LMS content."
);
const rds = `-- Mirror of supabase/migrations/20260912160000_non_technical_category_courses.sql\n${migration}`;

writeFileSync(migrationPath, migration + "\n");
writeFileSync(rdsPath, rds + "\n");

console.log(`Wrote ${migrationPath}`);
console.log(`Wrote ${rdsPath}`);
console.log(`Courses: ${courseRows.length}, Modules: ${moduleRows.length}, Lessons: ${lessonRows.length}`);
