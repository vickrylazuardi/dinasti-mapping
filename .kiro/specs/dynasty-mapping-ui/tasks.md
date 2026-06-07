# Implementation Plan: Dynasty Mapping UI

## Overview

This implementation plan builds an interactive web-based visualization tool for mapping Indonesian political dynasties as hierarchical bubble graphs. The system uses TypeScript with D3.js for force-directed graph layout, Vite as the build tool, and Vitest + fast-check for testing. Implementation proceeds from foundational data types and pure logic through the graph model, visualization engine, and interaction layer, culminating with sample data and integration wiring.

## Tasks

- [ ] 1. Set up project structure, core types, and build configuration
  - [ ] 1.1 Initialize Vite project with TypeScript and install dependencies
    - Initialize a Vite project with TypeScript template in the repository root
    - Install dependencies: d3, vitest, fast-check
    - Install dev dependencies: @types/d3, typescript
    - Configure `tsconfig.json` with strict mode enabled
    - Configure `vitest.config.ts` for unit and property-based testing
    - Create directory structure: `src/`, `src/models/`, `src/components/`, `src/utils/`, `data/`, `tests/`
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Define core TypeScript types and interfaces
    - Create `src/models/types.ts` with all domain types: `NodeType`, `DynastyNode`, `RelationType`, `Relationship`, `IssueType`, `Issue`, `AggregateScore`, `Sentiment`, `EdgeStyle`, `ValidationError`
    - Define `NodeId`, `RelationshipId`, `DynastyId` as branded string type aliases
    - Define `RawDynasty`, `RawEntity`, `RawRelationship`, `RawIssue` interfaces for parsed JSON
    - Define `ValidDataSet` interface containing validated arrays of all domain objects
    - _Requirements: 1.2, 2.1–2.10, 3.1_

- [ ] 2. Implement Score Aggregation (pure computation)
  - [ ] 2.1 Implement the Score Aggregator function
    - Create `src/utils/scoreAggregator.ts`
    - Implement `classifySentiment(averageScore: number): Sentiment` using the non-overlapping ranges: >5 → StrongPositive, >0 & ≤5 → Positive, =0 → Neutral, ≥-5 & <0 → Negative, <-5 → StrongNegative
    - Implement `calculateAggregate(issues: Issue[]): AggregateScore` computing totalScore, positiveCount, negativeCount, neutralCount, averageScore (rounded to 2 decimal places), and sentiment
    - Handle empty issues list returning zero/neutral values
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.2 Write property tests for Score Aggregation
    - **Property 12: Score aggregation arithmetic** — For any list of issues with scores in [-10, +10], totalScore equals sum of all individual scores and averageScore equals totalScore / count rounded to 2 decimal places
    - **Property 13: Score aggregation partition completeness** — positiveCount + negativeCount + neutralCount equals total number of issues
    - **Property 14: Sentiment classification consistency** — sentiment classification matches exactly one non-overlapping range
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

  - [ ] 2.3 Implement Edge Style computation
    - Create `src/utils/edgeStyle.ts`
    - Implement `computeEdgeStyle(score: AggregateScore): EdgeStyle` mapping sentiment to visual properties (color, strokeWidth, dashArray)
    - EdgeStyle config: StrongPositive → 4px solid green, Positive → 2px solid green, Neutral → 1px solid gray, Negative → 2px solid red, StrongNegative → 4px dashed red
    - _Requirements: 7.3_

  - [ ]* 2.4 Write property test for Edge Style determinism
    - **Property 15: Edge style determinism** — For any two AggregateScores with same sentiment, computeEdgeStyle returns the same EdgeStyle
    - **Validates: Requirement 7.3**

- [ ] 3. Implement Data Loading and Validation
  - [ ] 3.1 Implement the Data Loader module
    - Create `src/components/dataLoader.ts`
    - Implement `fetchAllData(basePath: string): Promise<RawDataSet>` that fetches `dynasties.json`, `entities.json`, `relationships.json`, `issues.json` from the /data directory
    - All four files must be fetched; if any file is missing or has invalid JSON, throw a descriptive error with file name and failure nature
    - Handle fetch errors (network/server) with descriptive error messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 3.2 Implement the Validator module
    - Create `src/components/validator.ts`
    - Implement `validateDataSet(data: RawDataSet): ValidationResult` that runs all validation rules to completion, accumulating all errors
    - Validation rules: unique node IDs, relationship references exist, issue scores in [-10, +10], issue type/score consistency, non-empty/whitespace-only name/title/description fields, source level ≤ target level, every dynasty has a root node, every issue references existing relationship
    - Return either success result or complete list of validation errors with entity ID, field name, and violation description
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.3 Write property tests for Data Validation
    - **Property 2: Validation rejects all violation types** — For any dataset with a single injected violation, Validator rejects and reports the specific violation
    - **Property 3: Validation error reports are complete** — Every error report contains entity ID, field name, and description
    - **Validates: Requirements 2.1–2.9**

  - [ ] 3.4 Implement URL validation and HTML sanitization utilities
    - Create `src/utils/sanitize.ts`
    - Implement `sanitizeHtml(text: string): string` that escapes <, >, &, ", ' to HTML entity equivalents
    - Implement `validateUrl(url: string): { valid: boolean; sanitized: string }` that accepts only http:/https: URLs conforming to standard URL syntax
    - Invalid or disallowed-scheme URLs return the URL as sanitized plain text
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 3.5 Write property tests for sanitization and URL validation
    - **Property 18: HTML sanitization** — For any string containing HTML special characters, sanitization escapes all such characters to HTML entity equivalents
    - **Property 19: URL scheme validation** — Only http/https URLs with valid syntax are accepted; all others rejected
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [ ] 4. Implement Graph Model
  - [ ] 4.1 Implement the Graph Model with DAG construction and queries
    - Create `src/components/graphModel.ts`
    - Implement `buildGraph(data: ValidDataSet): GraphModel` that constructs a directed acyclic graph
    - Implement cycle detection that reports all node IDs participating in cycles
    - Implement reachability check ensuring every node is reachable from at least one root node
    - Implement query methods: `getNode(id)`, `getChildren(id)`, `getRelationship(sourceId, targetId)`, `getIssues(relId)`, `getRootNodes()`
    - Identify all level-0 nodes as root nodes for initial display
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.2 Write property tests for Graph Model queries
    - **Property 4: Graph query correctness** — getNode returns correct node or no result, getChildren returns correct targets, getRelationship returns correct relationship, getIssues returns correct issues
    - **Property 5: Root node identification** — Root nodes equal exactly the set of level-0 DynastyNodes
    - **Property 6: Graph acyclicity and reachability** — Graph is a DAG and every node is reachable from a root
    - **Validates: Requirements 3.1–3.8**

  - [ ] 4.3 Implement expansion/collapse state management
    - Add expansion state tracking to `GraphModel`: `isExpanded(id)`, `expandNode(id)`, `collapseNode(id)`
    - `expandNode`: if node has children and is collapsed, mark as expanded and add children to visible set; if already expanded, no-op (idempotent)
    - `collapseNode`: recursively collapse all expanded descendants, remove them from visible set
    - Leaf nodes (no children): click produces no state change
    - `getVisibleNodes()` returns only root nodes and nodes whose ancestors are all expanded
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 4.4 Write property tests for expand/collapse logic
    - **Property 7: Expand reveals children and marks state** — Expanding a collapsed node with children adds them to visible set
    - **Property 8: Collapse hides all descendants recursively** — Collapsing removes all descendants from visible set
    - **Property 9: Expand is idempotent** — expandNode(expandNode(model, id), id) = expandNode(model, id)
    - **Property 10: Leaf node click is a no-op** — Clicking a leaf node produces no state change
    - **Property 11: Collapse reverses expand for leaf-parent nodes** — Collapse after expand restores original state
    - **Validates: Requirements 4.1–4.7**

- [ ] 5. Checkpoint - Core logic verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Visualization Engine
  - [ ] 6.1 Implement force-directed layout with D3.js
    - Create `src/components/visualizationEngine.ts`
    - Initialize D3 force simulation with: charge force (repulsion), link force (edges), center force, collision force (prevent bubble overlap with minimum separation = sum of radii)
    - Implement `updateLayout(visibleNodes, visibleEdges)` that recalculates positions; simulation stabilizes within 3 seconds
    - Implement zoom behavior (0.25x to 4x scale) and pan in all directions using D3 zoom
    - Animate node position transitions (300–800ms duration) when nodes added/removed
    - Cease node movement when simulation stabilizes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 6.2 Implement bubble node rendering
    - Create `src/components/bubbleRenderer.ts`
    - Render each DynastyNode as an SVG `<g>` containing: circle, clipped image (if imageUrl valid and loads), text label
    - Truncate label with ellipsis if name > 24 characters
    - Scale bubble diameter based on direct children count: minimum at 0 children, proportionally increasing, maximum at 20+ children
    - Color-code by node type: Person=blue, Party=orange, Organization=purple, Institution=green
    - Handle image load failure gracefully (show color fill + label only, no broken image indicator)
    - Apply glow effect (SVG filter) on expanded nodes; no glow on collapsed nodes
    - Visually distinguish expandable nodes (with hidden children) from leaf nodes using a distinct indicator (e.g., "+" icon)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 4.8_

  - [ ] 6.3 Implement relationship arrow rendering
    - Create `src/components/arrowRenderer.ts`
    - Render directed SVG paths with arrowhead markers from source to target for each visible relationship
    - Position relationship type label at midpoint without overlapping nodes
    - Style arrows based on AggregateScore sentiment using computeEdgeStyle (color, strokeWidth, dashArray)
    - Minimum click target area of 8px width regardless of visual stroke width (invisible wider hit area)
    - Offset multiple arrows between same node pair so all are visually distinguishable and individually clickable
    - Animate arrow style updates within 300ms when AggregateScore changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 6.4 Write unit tests for bubble and arrow rendering logic
    - Test label truncation at 24 characters
    - Test bubble size scaling formula (0 children → min, 20+ → max)
    - Test color mapping for each node type
    - Test arrow offset calculation for multiple relationships between same nodes
    - **Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.6**

- [ ] 7. Implement Interaction Controller
  - [ ] 7.1 Implement click handlers and expand/collapse coordination
    - Create `src/components/interactionController.ts`
    - Implement `onNodeClick(nodeId)`: determine if node is expandable/collapsible, queue clicks during animation, process after current animation completes (within 500ms)
    - On expand: update graph model state, trigger visualization to add child nodes and edges with animation
    - On collapse: update graph model state, recursively remove descendants from visualization with animation
    - Implement `onEdgeClick(relationshipId)`: open Issue Panel for that relationship
    - Implement `onBackgroundClick()`: close Issue Panel if open
    - _Requirements: 4.1, 4.2, 4.7, 4.9, 7.5_

  - [ ] 7.2 Implement tooltip display on hover
    - Implement `onNodeHover(nodeId)`: display tooltip with entity description within 200ms
    - Dismiss tooltip when cursor leaves the node
    - If node has no description, show tooltip with entity name only
    - _Requirements: 12.3, 12.4_

- [ ] 8. Implement Issue Panel
  - [ ] 8.1 Implement Issue Panel display component
    - Create `src/components/issuePanel.ts`
    - Implement panel that opens when relationship arrow is clicked
    - Display AggregateScore summary at top: totalScore, averageScore (1 decimal place), positiveCount, negativeCount, neutralCount, sentiment classification
    - Render each issue with: title, description (up to 200 chars with "show more" control), score, date (YYYY-MM-DD), sourceUrl as clickable link (opens in new tab)
    - Color-code issues: green for Positive, red for Negative, gray for Neutral
    - Default sort: date descending (most recent first)
    - Close panel on click outside or close button click
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.8_

  - [ ] 8.2 Implement sorting and filtering controls
    - Implement sort by score (highest to lowest) and sort by date (newest to oldest) with toggle to reverse direction
    - Implement filter controls: show only Positive, Negative, or Neutral issues
    - Display "no issues match the selected filter" message when filter results in zero matches
    - _Requirements: 9.5, 9.6, 9.7_

  - [ ]* 8.3 Write property tests for Issue Panel sorting and filtering
    - **Property 16: Issue sorting correctness** — Sorting by score produces descending order; sorting by date produces descending chronological order
    - **Property 17: Issue filtering correctness** — Filtering returns only matching issues and excludes no matching issue
    - **Validates: Requirements 9.1, 9.5, 9.6**

- [ ] 9. Implement Performance Optimizations
  - [ ] 9.1 Implement performance management features
    - Display dismissible warning banner when visible nodes exceed 200, showing count and suggesting branch collapse
    - Ensure only visible nodes are rendered in DOM (collapsed subtrees excluded)
    - Implement AggregateScore caching per Relationship with invalidation when issues change
    - Implement virtual scrolling in Issue Panel when issues exceed 50 (scroll interactions render within 100ms)
    - Target 30fps minimum during layout animation and interactions when >100 nodes visible
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 10. Checkpoint - UI components verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create sample data and wire application together
  - [ ] 11.1 Create sample JSON data files for Indonesian political dynasties
    - Create `data/dynasties.json` with at least 2 dynasties (Solo/Jokowi dynasty, Cendana/Prabowo dynasty)
    - Create `data/entities.json` with at least 10 entities across dynasties (persons, parties, organizations) at various levels
    - Create `data/relationships.json` with at least 8 relationships of various types (Family, Political, Business, Appointment, Alliance, Rivalry)
    - Create `data/issues.json` with at least 8 issues across relationships with positive, negative, and neutral scores
    - Follow the exact JSON schema defined in the design document
    - Use realistic Indonesian political dynasty data as examples
    - _Requirements: 1.1, 12.1_

  - [ ] 11.2 Wire application entry point and initial load sequence
    - Create `src/main.ts` as application entry point
    - Create `index.html` with SVG container and panel container
    - Implement the full initialization sequence: fetch data → validate → build graph → initialize visualization → render root nodes
    - Display root nodes in collapsed state as initial visible set, positioned within initial viewport
    - Display clear error messages on data loading or validation failure (file name + failure nature)
    - Wire all components together: InteractionController listens to Visualization events, updates GraphModel, triggers re-renders
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.6, 12.1, 12.2_

  - [ ]* 11.3 Write integration tests for data loading pipeline
    - Test full pipeline: load sample data → validate → build graph → verify root nodes
    - Test error handling: missing file, invalid JSON, validation failures
    - Test click interaction: expand root node → verify children visible
    - **Validates: Requirements 1.1–1.5, 3.1, 3.2, 12.1**

- [ ] 12. Final checkpoint - Full application verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- TypeScript is the implementation language with strict mode enabled
- D3.js is used for force-directed layout and SVG manipulation
- fast-check is the property-based testing library used with Vitest
- All community-contributed text must be HTML-sanitized before DOM insertion
- The application is client-side only with static JSON data files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "3.5"] },
    { "id": 4, "tasks": ["2.4", "3.2"] },
    { "id": 5, "tasks": ["3.3", "4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3"] },
    { "id": 7, "tasks": ["4.4", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4", "7.1", "7.2"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3", "9.1"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["11.2"] },
    { "id": 15, "tasks": ["11.3"] }
  ]
}
```
