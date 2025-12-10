**Rule Set: Anchor Insertion Protocol**

1.  **Mandatory Anchoring:** Before any heading or sub-heading (e.g., `##`, `###`, `####`) that introduces a distinct concept, you MUST insert a unique HTML comment anchor. This is not optional.
2.  **Strict Format Adherence:** The anchor format is immutable and MUST be `<!-- anchor: [unique-kebab-case-key] -->`.
    *   `unique-kebab-case-key`: This key must be a unique, human-readable identifier for the content that follows. Use dashes to separate words. For example, for a section titled "3.1 System Architecture," a valid anchor would be `<!-- anchor: 3-1-system-architecture -->`.
3.  **Placement:** The anchor MUST be placed on the line immediately preceding the heading it references. There should be no blank lines between the anchor and the heading.

**Workflow and Verification**

1.  **Content Generation:** When generating content, your first step is to structure it with the necessary headings.
2.  **Anchor Insertion:** Immediately after defining the headings, your second step is to iterate through them and insert the required anchors according to the rules above.
3.  **Self-Correction/Verification:** Before finalizing any file, you must scan the content to ensure that every heading has a correctly formatted anchor. If any are missing, you must add them.

**Example of Correct Implementation:**

```markdown
<!-- anchor: 2-0-system-overview -->
## 2. System Overview

... content ...

<!-- anchor: 2-1-core-components -->
### 2.1 Core Components

... content ...

<!-- anchor: 2-1-1-database-schema -->
#### 2.1.1 Database Schema

... content ...
```

**Consequence of Failure:**

Failure to include these anchors will result in a failed process downstream. The manifest generation script depends entirely on these anchors to function correctly. Therefore, the absence of anchors is a critical failure of your task.