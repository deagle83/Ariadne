# JD-RESUME COMPARISON PROMPT

### INPUT SOURCES
> **Instructions to AI:** Read from the target role folder.

- **Folder path:** Provided by user, or default to most recent in `/Users/davideagle/Documents/JobSearch/InProgress/`
- **JD:** Any .pdf file containing "JD" in the filename
- **Resume:** Any .pdf or .pages file containing "Resume" in the filename

---

### OUTPUT DESTINATION
> **Instructions to AI:** Write analysis to files, not just chat.

**Primary Analysis:** `[Role Folder]/comparison-analysis.md`
- Keeps the analysis with the application materials for future reference

**Actionable Edits:** `[Role Folder]/resume-edits.md`
- A checklist of specific changes, e.g.:
  - [ ] Add keyword: "distributed systems" to infrastructure section
  - [ ] Quantify: Add team size to Netflix role
  - [ ] Rephrase: Change "helped with" to "led"

---

### ANALYSIS INSTRUCTIONS

You are an expert in executive recruiting, technical leadership hiring, and AI-driven resume evaluation. Compare the following resumes to the provided job description. Your task is to:
Identify exact and conceptual matches between the resume and the job description across skills, responsibilities, achievements, scope, and domain expertise.
Highlight gaps, including missing keywords, missing competencies, insufficient scope signals, or mismatched industry/domain expectations.
Provide ATS-specific insights, including must-have keywords, phrasing, seniority signals, and formatting considerations that increase the likelihood of passing automated screeners.
Provide executive-review insights, focusing on what a human director/VP/CTO would look for: clarity of impact, business alignment, scale of ownership, narrative cohesion, evidence-based achievements, and leadership behaviors.
Provide a final “fit assessment” describing whether the candidate appears to exceed, match, or fall short of the role based on leadership scope, technical depth, industry 	alignment, and measurable outcomes.
Use the following comparison framework:
• Strategic Alignment: Does the resume show ownership of strategy, vision, roadmaps, multi-year planning, or transformation?
• Operational Alignment: Does the resume demonstrate delivery predictability, process optimization, metrics, incident reduction, cost efficiency, and platform/system stewardship?
• People Leadership Alignment: Match against expected team sizes, manager-of-managers scope, coaching signals, hiring, and cross-functional influence.
• Technical Domain Alignment: Match specific technologies, platforms, methodologies, cloud environments, and SDLC phases from the job description with items in the resume.
• Business & Impact Alignment: Match quantitative outcomes (revenue, cost savings, quality, productivity, engagement) from the resume to expectations in the JD.
• ATS Requirements:
Identify required keywords and whether they appear in the resume.
Identify missing domain/tech stack phrases.
Flag risks such as passive phrasing, non-standard headings, missing dates, abbreviations without definitions, or bullets without verbs.
When producing the comparison, structure your answer into:
(0) Results table, show 1-5 score for each of the evaluated areas listed below
(1) Summary of Alignment
(2) Strengths: High-Confidence Matches
(3) Gaps & Risks (ATS + Executive Reviewer)
(5) Recommended Keywords & Phrases to Add
(6) Overall Fit Judgment
Use concise, evaluative language suitable for a senior hiring committee.

---

**COMMAND:** Run the comparison now using the input sources specified above.



