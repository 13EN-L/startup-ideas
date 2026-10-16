# Startup 1: Motion

## Criteria Checklist

### 1. Solves one problem extremely well
- The single problem: Knowledge workers and teams lose hours manually deciding what to work on, scheduling it, and re-planning when things change. Motion takes tasks, deadlines, priorities and dependencies and automatically builds and continuously updates each person's calendar plan.

### 2. Target customers / direct access
- Who they are: Individuals and teams of any size, especially service businesses (IT providers, agencies, law firms, consultancies, construction) and functional teams (startups, sales, executives). Motion claims over 1 million users.
- How you know them or can reach them (job, community, existing contacts, forums): Reach them through ops/PM and productivity communities, ADHD and time-management forums (a common theme in Motion's reviews), and owner-operators of small service businesses. Add your own job and contact network here.

### 3. Familiar infrastructure
- What infrastructure is familiar: Google/Outlook/iCloud calendars, Gmail/Outlook email, Zoom/Meet/Teams, Slack, HubSpot and Salesforce, exposed through a public REST API and web, desktop and mobile apps. All are mainstream, well-documented integrations.

### 4. Reimagines the problem space
- Status quo: Task managers, project trackers, calendars, note-takers and docs are separate tools that need manual updating, chasing and re-planning.
- Reimagined approach: One AI-native workspace where a scheduling engine plans everyone's day from the full project context and re-optimizes automatically when anything changes.

### 5. LLM is core (not a sidebar chatbot)
- What the LLM generates/transforms that is the product itself: It turns project descriptions, docs, emails and meeting transcripts into structured projects and tasks (deadlines, assignees, stages) that feed the planner, and turns meetings into summaries and action items.
- Why the product can't exist without it: Without the LLM, users must hand-enter all of that structure, which is exactly the overhead the planner is meant to remove.

### 6. Validation guardrail
- Artifact(s) the LLM produces: A structured JSON plan (projects, tasks, durations, priorities, deadlines, dependencies, assignees).
- Validator(s): Pydantic/JSON Schema for structure, plus a rule engine for calendar conflicts, working hours, dependency cycles, deadline feasibility and assignee capacity.
- Rule: nothing reaches the user unless it passes. Flow: input → LLM → schema check → constraint check → PASS: write to planner/calendar | FAIL: errors → step 7.

### 7. Self-correction loop
- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: 3, then fail safely by saving the tasks as unscheduled in a "needs review" queue with the errors shown, never writing unvalidated output to a calendar.

### 8. Deployability
- Deployment target: A containerized API and worker on AWS (ECS/Fargate) with managed Postgres and a job queue for re-planning.
- IaC / CI/CD: Terraform for infrastructure, and GitHub Actions to run tests and validators, build the image and deploy on merge.
- Confirmation you can deploy it end to end: Not yet confirmed; deploy one minimal slice (text in, validated schedule out) through the full pipeline to verify.
