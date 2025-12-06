name: v0.3.2 Task
description: Track a task for the v0.3.2 milestone (in progress)
labels: ["v0.3.2", "task"]
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What is the task and why is it needed?
    validations:
      required: true
  - type: textarea
    id: scope
    attributes:
      label: Scope
      description: Define scope, acceptance criteria, and any non-goals.
  - type: textarea
    id: plan
    attributes:
      label: Plan
      description: Steps, owner, and expected timeline (Week 1/Week 2).
  - type: checkboxes
    id: links
    attributes:
      label: Links
      options:
        - label: Linked to milestone v0.3.2
        - label: References DEVELOPMENT_PLAN.md
        - label: Updates docs/tests as applicable
