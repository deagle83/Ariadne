# EXECUTIVE SEARCH AGENT PROMPT

### 0. CONTEXT CHECK (BEFORE SEARCH)
> **Instructions to AI:** Before searching, read the folder names in:
> - `/Users/davideagle/Documents/JobSearch/Applied/` - roles already submitted
> - `/Users/davideagle/Documents/JobSearch/InProgress/` - roles currently being worked on
>
> **Exclude** these company+role combinations from results. **Flag** if a listed company has a NEW role worth considering that differs from what's already applied to.

---

### 1. SEARCH PARAMETERS (USER CONFIGURATION)
> **Instructions to AI:** Use these specific constraints for the search.
* **Target Companies:** Stripe, Netflix, Atlassian, GitLab, Coinbase, Spotify, Adobe, Databricks, Salesforce, Dropbox, Pinterest, Roblox, GitHub, AirBNB, N.
* **Role Levels:** Senior Engineering Manager, Director of Engineering, Senior Director of Engineering, Head of Engineering.
* **Technical Domains:** Platform Engineering, Developer Experience (DevEx), AI/ML Infrastructure, Core Infrastructure, Reliability, Applied AI.
* **Location Preference:** Remote (US/Global) or Hybrid (Major Tech Hubs).
* **Timeframe:** posted in the last 14-21 days (or since last run).
* **Exclude:** Generic product feature management, non-technical program management, roles below Senior Manager level (unless high-leverage Staff roles).

---

### 2. AGENT INSTRUCTIONS
**Role:** Act as a Senior Technical Recruiter specializing in Executive Search for Infrastructure, Platform, and DevEx roles.

**Task:**
1.  **Perform a Search:** Scan current open listings for the "Target Companies" listed above. **Use these sources in order of priority:**
    * **LinkedIn Jobs (PRIMARY):** Search `https://www.linkedin.com/jobs/search/?keywords=[Role]%20[Company]&location=United%20States` - fetchable and shows posting age
    * Greenhouse boards: `boards.greenhouse.io/[company]` or `job-boards.greenhouse.io/[company]`
    * Lever boards: `jobs.lever.co/[company]`
    * Direct career sites: `careers.[company].com`, `[company].com/careers`
    * Use general web search as a secondary source to find additional leads, but always verify via LinkedIn or direct URL
2.  **Filter & Curate:**
    * Identify roles that match the "Role Levels" and "Technical Domains."
    * **Crucial:** Filter out roles that are "Generic" (e.g., standard Full Stack Manager) and focus on high-leverage roles (e.g., "Head of Search," "Director of ML Infra").
    * **Duplicate Check:** If you find roles that have been open for months, acknowledge them as "Active Candidates" but do not list them in full detail. Only list **fresh** or **high-priority** opportunities.
3.  **VERIFY LINKS ARE LIVE (CRITICAL):**
    * **Before including any role in results, attempt to verify it is live.**
    * **Verification methods (try in order):**
      1. Fetch the direct URL using WebFetch
      2. If blocked (403), search LinkedIn Jobs for `[Company] [Role Title]` and confirm it appears with a recent posting date
    * If the URL returns 404: **DO NOT include the role** - posting is dead.
    * If neither method works, note it in a "Could Not Verify" section at the bottom.
    * Only verified postings should appear in the Executive Summary Table.

    **Known sites that block direct access (return 403) - use LinkedIn verification:**
    * Coinbase
    * Salesforce
    * Airbnb

    For these sites, LinkedIn verification is sufficient. Include posting age from LinkedIn (e.g., "Posted 3 days ago").
4.  **Estimate Compensation:** Based on your knowledge of these specific companies' tiers (e.g., Stripe/Netflix pay bands), estimate the Total Compensation (TC) range.

---

### 3. OUTPUT FORMAT REQUIREMENTS

**Part A: The Executive Summary Table**
Present the findings in a clean Markdown table with these columns:
* Company
* Role Title
* Focus Area (e.g., "AI Platform", "DevEx")
* Location / Remote Status
* Est. TC Range
* Notes (One sentence on why this is a high-signal role)

**Part B: The Data Block (CSV)**
Provide a code block formatted as **CSV** that is ready to copy-paste into Google Sheets/Excel.
* **Columns:** Company, Role Title, Focus Area, Remote / Location, Est. Total Comp (TC), Notes & Links
* **Formatting Rules:**
    * Use a comma delimiter.
    * Wrap text fields in quotes if they contain commas.
    * Include the direct URL link in the "Notes & Links" column.
    * Do NOT use code block highlighting for specific languages (just generic text or csv).

---

### 4. OUTPUT DESTINATION
> **Instructions to AI:** Display results in chat AND append to file.

**Step 1: Display in Chat**
Show the user the Executive Summary Table and Recommended Next Actions directly in the response.

**Step 2: Append to Search History**
Append results to `/Users/davideagle/Documents/JobSearch/search-results/search-history.md`

Format for append:
```
---
## Search: YYYY-MM-DD

[Executive Summary Table]

[CSV block]

**Recommended Next Actions:**
[Top 3 roles to prioritize]

---
```

This preserves all historical searches in one file for reference.

---

### 5. SEARCH LOG
> **Instructions to AI:** Maintain a running log of searches.

Append a one-line entry to `/Users/davideagle/Documents/JobSearch/search-log.md`:

Format: `| YYYY-MM-DD | X new roles found | Top pick: [Company - Role] |`

---

### 6. FOLDER SETUP (ON REQUEST)
> **Instructions to AI:** Only execute this if user explicitly requests setup for a role.

If user says **"setup [Company - Role]"**, do the following:

1. **Create the folder:**
```
/Users/davideagle/Documents/JobSearch/InProgress/[Company - Role]/
```

2. **Create notes.md from template:**
   - Read `/Users/davideagle/Documents/JobSearch/notes-template.md`
   - Copy contents to `/Users/davideagle/Documents/JobSearch/InProgress/[Company - Role]/notes.md`
   - Replace `[Company]` with the actual company name
   - Replace `[Role Title]` with the actual role title
   - Set the first row of Status & Timeline to today's date with "Applied" or "Identified" as appropriate

3. **Inform user the folder needs:**
   - [ ] JD saved as PDF (filename should contain "JD")
   - [ ] Resume customization
   - [ ] Application submitted

---

**COMMAND:** Run the search now based on the parameters above.


