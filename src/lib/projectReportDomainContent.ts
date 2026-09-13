/** Domain-specific project report sections (populated into generated reports). */

export type ProjectReportDomainSection = {
  projectTitle: string;
  introduction: string;
  objectives: string[];
  scope: string;
  methodology: string;
  toolsTechnologies: string[];
  expectedOutcomes: string[];
  conclusion: string;
};

const DEFAULT_SECTION: ProjectReportDomainSection = {
  projectTitle: "Internship Project Report",
  introduction:
    "This project report documents the internship training undertaken as part of the academic programme, covering practical exposure, applied learning, and domain-specific deliverables.",
  objectives: [
    "Understand core concepts and industry practices in the selected domain",
    "Apply theoretical knowledge to practical assignments and mini-projects",
    "Develop professional documentation and presentation skills",
  ],
  scope:
    "The project covers guided tasks, supervised activities, and structured deliverables aligned with the internship programme requirements.",
  methodology:
    "The internship follows a structured plan with orientation, guided tasks, review checkpoints, and final submission of the project report.",
  toolsTechnologies: ["Microsoft Office / Google Workspace", "Online learning platform", "Project documentation tools"],
  expectedOutcomes: [
    "Completion of assigned domain tasks",
    "Preparation of logbook and project documentation",
    "Demonstration of practical competency in the selected domain",
  ],
  conclusion:
    "The internship provides hands-on exposure and strengthens employability through structured project-based learning.",
};

function section(
  partial: Partial<ProjectReportDomainSection> & Pick<ProjectReportDomainSection, "projectTitle">
): ProjectReportDomainSection {
  return { ...DEFAULT_SECTION, ...partial };
}

/** Normalized lookup keys (lowercase trimmed). */
export const PROJECT_REPORT_DOMAIN_CONTENT: Record<string, ProjectReportDomainSection> = {
  "web development": section({
    projectTitle: "Web Development Internship Project",
    introduction:
      "This report presents the web development internship covering front-end, back-end fundamentals, and deployment of a responsive web application.",
    objectives: [
      "Build responsive user interfaces with HTML, CSS, and JavaScript",
      "Integrate REST APIs and manage application state",
      "Deploy a working web project with documentation",
    ],
    toolsTechnologies: ["HTML5", "CSS3", "JavaScript", "React", "Node.js", "Git", "VS Code"],
    expectedOutcomes: [
      "Functional web application prototype",
      "Clean, documented source code",
      "Project report with architecture overview",
    ],
  }),
  "full stack development": section({
    projectTitle: "Full Stack Development Internship Project",
    introduction:
      "A full stack internship project integrating client-side UI, server-side APIs, and database-backed features.",
    toolsTechnologies: ["React", "Node.js", "Express", "PostgreSQL", "REST API", "Git"],
  }),
  "data science": section({
    projectTitle: "Data Science Internship Project",
    introduction:
      "This report covers data collection, cleaning, exploratory analysis, visualization, and basic predictive modelling.",
    objectives: [
      "Perform exploratory data analysis on structured datasets",
      "Build visual dashboards and summary statistics",
      "Apply basic machine learning models where appropriate",
    ],
    toolsTechnologies: ["Python", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Jupyter Notebook"],
  }),
  "data analytics": section({
    projectTitle: "Data Analytics Internship Project",
    introduction:
      "An analytics-focused internship emphasizing business insights, KPI tracking, and data-driven decision support.",
    toolsTechnologies: ["Excel", "SQL", "Power BI / Tableau", "Python"],
  }),
  "artificial intelligence": section({
    projectTitle: "Artificial Intelligence Internship Project",
    introduction:
      "This project explores AI concepts including intelligent agents, search, knowledge representation, and applied AI use cases.",
    toolsTechnologies: ["Python", "TensorFlow / PyTorch", "Scikit-learn", "Jupyter"],
  }),
  "machine learning": section({
    projectTitle: "Machine Learning Internship Project",
    introduction:
      "A machine learning internship covering supervised and unsupervised learning, model evaluation, and deployment basics.",
    toolsTechnologies: ["Python", "Scikit-learn", "Pandas", "Matplotlib", "Jupyter Notebook"],
  }),
  "cyber security": section({
    projectTitle: "Cyber Security Internship Project",
    introduction:
      "This report documents security fundamentals, vulnerability assessment basics, and secure configuration practices.",
    toolsTechnologies: ["Linux", "Wireshark", "Nmap", "Security documentation tools"],
  }),
  "cybersecurity": section({
    projectTitle: "Cyber Security Internship Project",
    introduction:
      "This report documents security fundamentals, vulnerability assessment basics, and secure configuration practices.",
    toolsTechnologies: ["Linux", "Wireshark", "Nmap", "Security documentation tools"],
  }),
  "digital marketing": section({
    projectTitle: "Digital Marketing Internship Project",
    introduction:
      "A digital marketing internship covering SEO, social media campaigns, content strategy, and performance analytics.",
    toolsTechnologies: ["Google Analytics", "Meta Business Suite", "Canva", "SEO tools"],
  }),
  "python development": section({
    projectTitle: "Python Development Internship Project",
    introduction:
      "Python-focused internship project covering scripting, automation, and application development.",
    toolsTechnologies: ["Python 3", "VS Code", "Git", "Virtual environments"],
  }),
  "mobile app development": section({
    projectTitle: "Mobile App Development Internship Project",
    introduction:
      "Mobile development internship covering UI design, navigation, API integration, and app testing.",
    toolsTechnologies: ["Flutter / React Native", "Android Studio", "Firebase", "Git"],
  }),
};

export function resolveProjectReportDomainContent(domain: string): ProjectReportDomainSection {
  const key = String(domain || "")
    .trim()
    .toLowerCase();
  if (!key) return DEFAULT_SECTION;
  if (PROJECT_REPORT_DOMAIN_CONTENT[key]) return PROJECT_REPORT_DOMAIN_CONTENT[key]!;
  const fuzzy = Object.entries(PROJECT_REPORT_DOMAIN_CONTENT).find(
    ([k]) => key.includes(k) || k.includes(key)
  );
  return fuzzy ? fuzzy[1]! : { ...DEFAULT_SECTION, projectTitle: `${domain.trim()} Internship Project` };
}

export const PROJECT_REPORT_MODES = ["Online", "Offline", "Hybrid"] as const;
export type ProjectReportMode = (typeof PROJECT_REPORT_MODES)[number];
