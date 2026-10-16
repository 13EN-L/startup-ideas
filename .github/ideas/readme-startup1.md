Startup 1: Motion

Items marked (YC page) come from https://www.ycombinator.com/companies/motion. Items marked (inferred) are assumptions, because the page says nothing about Motion's internals. Sections 6-8 are a proposed design for a build in this space, not facts about Motion.

Criteria Checklist
1. Solves one problem extremely well
The single problem: Teams spend about 58% of their day coordinating work instead of doing it. Motion automatically plans who works on what, and when, from their projects, deadlines, priorities and calendars. (YC page)
2. Target customers / direct access
Who they are: Teams and knowledge workers who juggle many tasks, meetings and deadlines and need to know "who's doing what and when." The YC page tags it B2B SaaS productivity. (YC page)
How you know them or can reach them (job, community, existing contacts, forums): Motion's founder is a quant trader turned founder, and the company says it ran thousands of user interviews. For you, reach would be through ops and PM communities, productivity subreddits, and teams you've worked on. (YC page, partly inferred)
3. Familiar infrastructure
What infrastructure is familiar: Calendar and task APIs (Google/Outlook), a web SaaS app, a relational database and a scheduling/optimization backend. These are mainstream, well-documented building blocks. (inferred)
4. Reimagines the problem space
Status quo: Task apps are passive lists. Users dump everything in and manually prioritize, schedule and re-plan when things slip. (YC page)
Reimagined approach: Motion treats scheduling as an automated planning problem. It sets each person's daily schedule from duration, priority, deadline and dependencies, and re-plans automatically when things change. It now also lets teams build AI Employees inside the same work platform. (YC page)
5. LLM is core (not a sidebar chatbot)
What the LLM generates/transforms that is the product itself: Motion's original core was a scheduling algorithm, and its current positioning is an AI-native suite with AI Employees. A defensible LLM-core version would turn messy inputs (emails, meeting notes, chat) into structured tasks with durations, priorities, dependencies and deadlines, which feed the planner. (YC page for positioning, rest inferred)
Why the product can't exist without it: Without an LLM, users must enter all that structure by hand, which is the manual overhead the product is meant to remove. (inferred)
6. Validation guardrail
Artifact(s) the LLM produces: A JSON task/plan object (title, duration, priority, deadline, dependencies, assignee, proposed time blocks). (proposed)
Validator(s): Pydantic/JSON Schema for structure, plus rule-engine checks:
No double-booked calendar slots.
Work stays inside available hours.
Deadlines are met.
Dependencies are acyclic and ordered.
Assignee exists and has capacity.
Rule: nothing reaches the user's calendar unless it passes.
input -> LLM -> schema check -> constraint check -> PASS: write to calendar
                                      |
                                    FAIL: errors -> back to LLM (step 7)
7. Self-correction loop
On failure, the validator's error messages are sent back to the LLM with the original prompt. For example: "Task 3 overlaps the 2pm meeting; dependency B->A is circular."
Max retries: 3. Fallback: fail safely by showing the task as unscheduled in a "needs review" queue with the validation errors, and never write unvalidated output to a calendar.
8. Deployability
Deployment target: A containerized web API plus worker on AWS (ECS/Fargate or Lambda) or a similar managed platform, with managed Postgres and a queue for re-planning jobs. (proposed)
IaC / CI/CD: Terraform or CDK for infrastructure, and GitHub Actions to run tests and validators, build the image and deploy on merge. (proposed)
Confirmation you can deploy it end to end: TODO (yours to confirm). Before committing to this idea, deploy a minimal slice (one endpoint that takes text, validates and returns a schedule) through the full pipeline.
