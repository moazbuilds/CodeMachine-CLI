---
name: sprint-planning
description: 'Generate and manage sprint status tracking file, extracting all epics and stories and tracking their status through the development lifecycle'
---

# Sprint Planning - Sprint Status Generator

## EPICS

{epics}

## SPRINT STATUS TEMPLATE

{sprint_status_template}

---

## Step 1: Parse Epics and Extract All Work Items

For each epic, extract:

- Epic numbers from headers like `## Epic 1:` or `## Epic 2:`
- Story IDs and titles from patterns like `### Story 1.1: User Authentication`
- Convert story format from `Epic.Story: Title` to kebab-case key: `epic-story-title`

**Story ID Conversion Rules:**

- Original: `### Story 1.1: User Authentication`
- Replace period with dash: `1-1`
- Convert title to kebab-case: `user-authentication`
- Final key: `1-1-user-authentication`

Build complete inventory of all epics and stories.

## Step 2: Build Sprint Status Structure

For each epic found, create entries in this order:

1. **Epic entry** - Key: `epic-{num}`, Default status: `backlog`
2. **Story entries** - Key: `{epic}-{story}-{title}`, Default status: `backlog`
3. **Retrospective entry** - Key: `epic-{num}-retrospective`, Default status: `optional`

**Example structure:**

```yaml
development_status:
  epic-1: backlog
  1-1-user-authentication: backlog
  1-2-account-management: backlog
  epic-1-retrospective: optional
```

## Step 3: Generate Sprint Status File

Create `.codemachine/artifacts/sprint-status.yaml` with:

**File Structure:**

```yaml
# generated: {date}
# project: {project_name}
# project_key: {project_key}
# tracking_system: {tracking_system}
# story_location: {story_location}

# STATUS DEFINITIONS:
# ==================
# Epic Status:
#   - backlog: Epic not yet started
#   - in-progress: Epic actively being worked on
#   - done: All stories in epic completed
#
# Epic Status Transitions:
#   - backlog → in-progress: Automatically when first story is created (via create-story)
#   - in-progress → done: Manually when all stories reach 'done' status
#
# Story Status:
#   - backlog: Story only exists in epic file
#   - ready-for-dev: Story file created in stories folder
#   - in-progress: Developer actively working on implementation
#   - review: Ready for code review (via Dev's code-review workflow)
#   - done: Story completed
#
# Retrospective Status:
#   - optional: Can be completed but not required
#   - done: Retrospective has been completed
#
# WORKFLOW NOTES:
# ===============
# - Epic transitions to 'in-progress' automatically when first story is created
# - Stories can be worked in parallel if team capacity allows
# - SM typically creates next story after previous one is 'done' to incorporate learnings
# - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)

generated: { date }
project: { project_name }
project_key: { project_key }
tracking_system: { tracking_system }
story_location: { story_location }

development_status:
  # All epics, stories, and retrospectives in order
```

<action>Write the complete sprint status YAML to .codemachine/artifacts/sprint-status.yaml</action>
<action>CRITICAL: Metadata appears TWICE - once as comments (#) for documentation, once as YAML key:value fields for parsing</action>
<action>Ensure all items are ordered: epic, its stories, its retrospective, next epic...</action>
</step>

<step n="5" goal="Validate and report">
<action>Perform validation checks:</action>

- [ ] Every epic in epic files appears in .codemachine/artifacts/sprint-status.yaml
- [ ] Every story in epic files appears in .codemachine/artifacts/sprint-status.yaml
- [ ] Every epic has a corresponding retrospective entry
- [ ] No items in .codemachine/artifacts/sprint-status.yaml that don't exist in epic files
- [ ] All status values are legal (match state machine definitions)
- [ ] File is valid YAML syntax

<action>Count totals:</action>

- Total epics: {{epic_count}}
- Total stories: {{story_count}}
- Epics in-progress: {{in_progress_count}}
- Stories done: {{done_count}}

<action>Display completion summary to {user_name} in {communication_language}:</action>

**Sprint Status Generated Successfully**

- **File Location:** .codemachine/artifacts/sprint-status.yaml
- **Total Epics:** {{epic_count}}
- **Total Stories:** {{story_count}}
- **Epics In Progress:** {{epics_in_progress_count}}
- **Stories Completed:** {{done_count}}

**Next Steps:**

1. Review the generated .codemachine/artifacts/sprint-status.yaml
2. Use this file to track development progress
3. Agents will update statuses as they work
4. Re-run this workflow to refresh auto-detected statuses

</step>

</workflow>

## Additional Documentation

### Status State Machine

**Epic Status Flow:**

```
backlog → in-progress → done
```

- **backlog**: Epic not yet started
- **in-progress**: Epic actively being worked on (stories being created/implemented)
- **done**: All stories in epic completed

**Story Status Flow:**

```
backlog → ready-for-dev → in-progress → review → done
```

- **backlog**: Story only exists in epic file
- **ready-for-dev**: Story file created (e.g., `stories/1-3-plant-naming.md`)
- **in-progress**: Developer actively working
- **review**: Ready for code review (via Dev's code-review workflow)
- **done**: Completed

**Retrospective Status:**

```
optional ↔ done
```

- **optional**: Ready to be conducted but not required
- **done**: Finished

### Guidelines

1. **Epic Activation**: Mark epic as `in-progress` when starting work on its first story
2. **Sequential Default**: Stories are typically worked in order, but parallel work is supported
3. **Parallel Work Supported**: Multiple stories can be `in-progress` if team capacity allows
4. **Review Before Done**: Stories should pass through `review` before `done`
5. **Learning Transfer**: SM typically creates next story after previous one is `done` to incorporate learnings
