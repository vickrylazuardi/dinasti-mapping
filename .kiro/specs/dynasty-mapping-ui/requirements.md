# Requirements Document

## Introduction

The Dynasty Mapping UI is an interactive web-based visualization tool for mapping Indonesian political dynasties as hierarchical bubble graphs. Users navigate force-directed graphs starting from key political figures (root nodes), clicking to expand branches that reveal connected entities—parties, family members, allies, organizations—with typed arrows showing relationship nature. Each relationship carries an issues list with positive/negative scores, and the aggregate score visually reflects on the connecting arrow through color, thickness, and style. The system loads community-editable structured JSON data from the repository, enabling transparent contribution without requiring code knowledge.

## Glossary

- **Dynasty_Graph**: The force-directed hierarchical graph visualization displaying nodes and their relationships
- **Data_Loader**: The module responsible for fetching, parsing, and validating JSON data files from the repository
- **Graph_Model**: The in-memory data structure maintaining the dynasty hierarchy, expansion state, and relationship data
- **Visualization_Engine**: The SVG rendering system responsible for layout computation, node rendering, edge rendering, and animation
- **Interaction_Controller**: The module dispatching user interactions (click, hover) to appropriate handlers and coordinating state changes
- **Issue_Panel**: The UI component displaying the list of issues for a selected relationship with scores and aggregate calculation
- **Score_Aggregator**: The function that computes aggregate scores from a list of individual issue scores
- **DynastyNode**: A graph entity representing a person, party, organization, or institution within a political dynasty
- **Relationship**: A typed directed connection between two DynastyNodes carrying issues and an aggregate score
- **Issue**: A scored event or fact associated with a relationship, typed as positive, negative, or neutral
- **AggregateScore**: The computed summary of all issues on a relationship including total, average, counts, and sentiment classification
- **Sentiment**: A categorical classification of aggregate score (StrongPositive, Positive, Neutral, Negative, StrongNegative)
- **EdgeStyle**: The visual encoding of a relationship arrow determined by sentiment (color, thickness, dash pattern)
- **Root_Node**: A level-0 DynastyNode representing a key political figure that serves as the entry point for a dynasty
- **Validator**: The subsystem within Data_Loader that checks data integrity and referential consistency

## Requirements

### Requirement 1: Data Loading and Parsing

**User Story:** As a user, I want the application to load dynasty data automatically on startup, so that I can immediately see and explore political dynasty visualizations.

#### Acceptance Criteria

1. WHEN the application starts, THE Data_Loader SHALL fetch all four JSON data files (dynasties.json, entities.json, relationships.json, issues.json) from the /data directory, requiring all files to be present before proceeding
2. WHEN JSON files are successfully fetched, THE Data_Loader SHALL parse them into typed domain objects (DynastyNode, Relationship, Issue) within 5 seconds of application start
3. IF a JSON file is missing or contains invalid JSON syntax, THEN THE Data_Loader SHALL display an error message stating the file name and the nature of the failure (missing or parse error), and SHALL not proceed with visualization
4. IF a fetch operation fails due to a network or server error, THEN THE Data_Loader SHALL display an error message indicating the unreachable file and a suggestion to retry, and SHALL not proceed with visualization
5. WHEN data is successfully parsed, THE Data_Loader SHALL pass the parsed data to the Validator for integrity checking

### Requirement 2: Data Validation

**User Story:** As a data contributor, I want the system to validate my data contributions, so that I receive clear feedback about errors before they affect the visualization.

#### Acceptance Criteria

1. THE Validator SHALL verify that all DynastyNode IDs are unique across the entire dataset
2. THE Validator SHALL verify that every Relationship references existing DynastyNode IDs for both sourceId and targetId
3. THE Validator SHALL verify that every Issue has an integer score within the range [-10, +10] inclusive
4. THE Validator SHALL verify that Issue type is consistent with score sign (Positive type requires score > 0, Negative type requires score < 0, Neutral type requires score = 0)
5. THE Validator SHALL verify that DynastyNode name and Issue title and description fields are non-empty and not whitespace-only after trimming
6. IF validation detects one or more errors, THEN THE Validator SHALL execute all validation rules to completion and report every validation failure with the entity ID, field name, and a description of the violation
7. THE Validator SHALL verify that every Relationship has sourceId at a level less than or equal to targetId level (hierarchy flows downward)
8. THE Validator SHALL verify that every dynasty has at least one Root_Node (level-0 entity)
9. THE Validator SHALL verify that every Issue references an existing Relationship ID via its relationshipId field
10. IF validation detects no errors, THEN THE Validator SHALL return a success result indicating that the dataset passed all validation checks

### Requirement 3: Graph Model Construction

**User Story:** As a user, I want the validated data to be structured as a navigable graph, so that I can traverse dynasty hierarchies interactively.

#### Acceptance Criteria

1. WHEN validated data is provided, THE Graph_Model SHALL construct a directed acyclic graph where DynastyNodes are vertices and Relationships are directed edges from sourceId to targetId
2. THE Graph_Model SHALL identify all level-0 DynastyNodes as Root_Nodes for initial display
3. THE Graph_Model SHALL support lookup of any DynastyNode by its unique ID, returning the matching node if it exists or returning no result if the ID is not present in the graph
4. THE Graph_Model SHALL support retrieval of all child DynastyNodes for a given parent node, where a child is defined as the target DynastyNode of any Relationship whose sourceId equals the parent node's ID, returning an empty collection if the node has no children
5. THE Graph_Model SHALL support retrieval of the Relationship connecting any two DynastyNodes by their IDs, returning the matching Relationship if one exists or returning no result if no Relationship connects the specified nodes
6. THE Graph_Model SHALL support retrieval of all Issues associated with a given Relationship by its ID, returning an empty collection if no Issues are associated with the Relationship
7. IF a cycle is detected during graph construction, THEN THE Graph_Model SHALL reject the data and report an error identifying all DynastyNode IDs participating in the cycle
8. WHEN graph construction completes successfully, THE Graph_Model SHALL ensure that every DynastyNode in the graph is reachable from at least one Root_Node by traversing directed edges

### Requirement 4: Node Expansion and Collapse

**User Story:** As a user, I want to click on nodes to reveal their connections, so that I can progressively explore a dynasty's network at my own pace.

#### Acceptance Criteria

1. WHEN a user clicks on a collapsed DynastyNode that has one or more child nodes, THE Interaction_Controller SHALL add all direct child nodes and their connecting Relationships to the visible set and render them in the Dynasty_Graph
2. WHEN a user clicks on an expanded DynastyNode, THE Interaction_Controller SHALL collapse it and remove all descendant nodes recursively from the visible set in the Dynasty_Graph
3. WHEN a node is expanded, THE Graph_Model SHALL mark that node as expanded and track its expansion state
4. IF a node that is already expanded receives an expand action, THEN THE Graph_Model SHALL make no state change (expand is idempotent)
5. WHEN a node is collapsed, THE Graph_Model SHALL recursively collapse all its descendant nodes that are currently expanded, setting each to collapsed state
6. WHEN the application finishes data loading successfully, THE Dynasty_Graph SHALL display only Root_Nodes in a collapsed state as the initial visible set
7. IF a user clicks on a DynastyNode that has no child nodes (leaf node), THEN THE Interaction_Controller SHALL make no expansion or collapse state change
8. THE Visualization_Engine SHALL visually distinguish expandable DynastyNodes (nodes with hidden children) from leaf DynastyNodes (nodes with no children) using a distinct indicator
9. WHILE a node expansion or collapse animation is in progress, THE Interaction_Controller SHALL queue any additional click events on DynastyNodes and process them after the current animation completes within 500 milliseconds

### Requirement 5: Force-Directed Layout

**User Story:** As a user, I want nodes to be automatically positioned in a clear layout, so that I can understand the structure without manual arrangement.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL compute force-directed layout positions for all currently visible nodes such that no two node bubbles overlap (minimum separation equal to the sum of their radii)
2. WHEN new nodes are revealed through expansion, THE Visualization_Engine SHALL recalculate layout positions so that all visible nodes are positioned without overlap and the simulation stabilizes within 3 seconds
3. WHEN nodes are hidden through collapse, THE Visualization_Engine SHALL recalculate layout positions for the remaining visible nodes so that all visible nodes are positioned without overlap and the simulation stabilizes within 3 seconds
4. THE Visualization_Engine SHALL animate node position transitions with a duration between 300 milliseconds and 800 milliseconds when nodes are added or removed from the layout
5. THE Visualization_Engine SHALL support user-initiated zoom between 0.25x and 4x scale and pan in all directions to navigate the graph
6. WHEN the force-directed simulation stabilizes, THE Visualization_Engine SHALL cease node movement and allow user interaction with the positioned nodes

### Requirement 6: Bubble Node Rendering

**User Story:** As a user, I want each entity displayed as a visually distinct bubble, so that I can quickly identify the type and importance of each entity.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL render each visible DynastyNode as a circular bubble containing a label with the entity name, truncated with an ellipsis if the name exceeds 24 characters
2. THE Visualization_Engine SHALL scale bubble size based on the number of direct children, where a node with 0 children receives the minimum bubble diameter and each additional child increases the diameter proportionally, up to a maximum bubble diameter for nodes with 20 or more children
3. THE Visualization_Engine SHALL color-code bubbles by node type (Person=blue, Party=orange, Organization=purple, Institution=green)
4. WHEN a DynastyNode has an imageUrl and the image loads successfully, THE Visualization_Engine SHALL display the image clipped to a circle within the bubble
5. IF a DynastyNode has an imageUrl and the image fails to load, THEN THE Visualization_Engine SHALL display the bubble with the type-based color fill and label only, without showing a broken image indicator
6. WHILE a DynastyNode is in the expanded state, THE Visualization_Engine SHALL apply a visible glow effect around the bubble that is not present on collapsed nodes

### Requirement 7: Relationship Arrow Rendering

**User Story:** As a user, I want to see typed and scored arrows between entities, so that I can understand the nature and health of each political relationship at a glance.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL render a directed arrow with a visible arrowhead from source to target for each Relationship where both the source and target DynastyNodes are currently visible
2. THE Visualization_Engine SHALL display the relationship type label (Family, Political, Business, Appointment, Alliance, Rivalry) positioned at the midpoint of the arrow without overlapping the source or target node
3. THE Visualization_Engine SHALL style each arrow based on its AggregateScore sentiment using stroke widths of 4px for StrongPositive (solid green), 2px for Positive (solid green), 1px for Neutral (solid gray), 2px for Negative (solid red), and 4px for StrongNegative (dashed red)
4. WHEN the AggregateScore of a Relationship changes, THE Visualization_Engine SHALL update the arrow style to reflect the new sentiment within 300 milliseconds
5. WHEN a user clicks on a relationship arrow, THE Visualization_Engine SHALL open the Issue_Panel for that Relationship, with a minimum click target area of 8px width regardless of the arrow's visual stroke width
6. IF multiple Relationships exist between the same two DynastyNodes, THEN THE Visualization_Engine SHALL offset each arrow so that all arrows between the pair are visually distinguishable and individually clickable

### Requirement 8: Score Aggregation

**User Story:** As a user, I want relationship scores computed automatically from individual issues, so that I can see an overall health indicator for each connection.

#### Acceptance Criteria

1. THE Score_Aggregator SHALL compute totalScore as the sum of all individual Issue scores for a given Relationship, where each Issue score is an integer in the range [-10, +10]
2. THE Score_Aggregator SHALL compute positiveCount as the number of Issues with score > 0, negativeCount as the number of Issues with score < 0, and neutralCount as the number of Issues with score = 0, such that their sum equals the total number of Issues
3. THE Score_Aggregator SHALL compute averageScore as totalScore divided by the number of Issues, rounded to 2 decimal places
4. WHEN the issue list is empty, THE Score_Aggregator SHALL return an AggregateScore with totalScore of 0, averageScore of 0.0, positiveCount of 0, negativeCount of 0, neutralCount of 0, and Neutral sentiment
5. THE Score_Aggregator SHALL classify sentiment into exactly one category using the following non-overlapping ranges evaluated in order: StrongPositive when averageScore > 5, Positive when averageScore > 0 and averageScore <= 5, Neutral when averageScore = 0, Negative when averageScore >= -5 and averageScore < 0, and StrongNegative when averageScore < -5

### Requirement 9: Issue Panel Display

**User Story:** As a user, I want to view detailed issues for any relationship, so that I can understand what specific events or facts contribute to the relationship score.

#### Acceptance Criteria

1. WHEN a user clicks on a relationship arrow, THE Issue_Panel SHALL open displaying all Issues associated with that Relationship, sorted by date descending (most recent first) as the default order
2. THE Issue_Panel SHALL color-code each Issue based on its type (green for Positive, red for Negative, gray for Neutral)
3. THE Issue_Panel SHALL display each Issue with its title, description (up to 200 characters with a "show more" control for longer text), score, date (in YYYY-MM-DD format), and source URL rendered as a clickable link opening in a new tab
4. THE Issue_Panel SHALL display the AggregateScore summary at the top of the panel showing: totalScore, averageScore (rounded to one decimal place), positiveCount, negativeCount, neutralCount, and the sentiment classification
5. THE Issue_Panel SHALL provide sorting controls to order issues by score (highest to lowest) or date (newest to oldest), with a toggle to reverse the sort direction
6. THE Issue_Panel SHALL provide filtering controls to show only Positive, Negative, or Neutral issues
7. IF the active filter results in zero matching Issues, THEN THE Issue_Panel SHALL display a message indicating no issues match the selected filter
8. WHEN the user clicks outside the Issue_Panel or clicks a close button, THE Issue_Panel SHALL close

### Requirement 10: Data Integrity and Security

**User Story:** As a user, I want the application to safely render community-contributed data, so that malicious data cannot compromise my browser.

#### Acceptance Criteria

1. THE Visualization_Engine SHALL sanitize all community-contributed text fields (DynastyNode names, Issue titles, Issue descriptions, Relationship type labels) by escaping the characters <, >, &, ", and ' to their HTML entity equivalents before DOM insertion
2. THE Data_Loader SHALL validate that sourceUrl fields contain URLs matching only the http: or https: scheme and conforming to standard URL syntax before rendering them as clickable links
3. IF a sourceUrl uses a disallowed scheme or does not conform to standard URL syntax, THEN THE Data_Loader SHALL omit the link and display the URL value as sanitized plain text (with HTML entities escaped)
4. THE Data_Loader SHALL validate that DynastyNode imageUrl fields contain URLs matching only the http: or https: scheme before passing them to the Visualization_Engine for rendering

### Requirement 11: Performance Management

**User Story:** As a user, I want the visualization to remain responsive even when exploring large dynasties, so that my experience is not degraded by data volume.

#### Acceptance Criteria

1. WHEN a node expansion causes more than 200 nodes to be visible simultaneously, THE Visualization_Engine SHALL display a non-blocking dismissible warning banner indicating the number of visible nodes and suggesting branch collapse to improve performance
2. THE Visualization_Engine SHALL render only currently visible nodes in the DOM (collapsed subtrees are excluded)
3. WHEN the Issue_Panel displays more than 50 issues, THE Issue_Panel SHALL use virtual scrolling such that scroll interactions render within 100 milliseconds regardless of the total issue count
4. THE Visualization_Engine SHALL cache computed AggregateScores per Relationship and invalidate a cached entry when an Issue belonging to that Relationship is added, removed, or has its score modified
5. WHILE more than 100 nodes are visible, THE Visualization_Engine SHALL maintain a minimum frame rate of 30 frames per second during force-directed layout animation and user interactions (zoom, pan, click)

### Requirement 12: Initial Application State

**User Story:** As a user, I want to see the key political figures immediately upon loading, so that I have a clear starting point for exploration.

#### Acceptance Criteria

1. WHEN data loading and validation succeed, THE Dynasty_Graph SHALL display all Root_Nodes as the initial visible set in a collapsed state (no children revealed)
2. WHEN data loading and validation succeed, THE Dynasty_Graph SHALL position Root_Nodes using the force-directed layout algorithm such that all Root_Nodes are visible within the initial viewport without requiring user pan or zoom
3. WHEN the user hovers over a Root_Node, THE Visualization_Engine SHALL display a tooltip with the entity description within 200 milliseconds, and dismiss the tooltip when the cursor leaves the node
4. IF a Root_Node has no description, THEN THE Visualization_Engine SHALL display the tooltip with only the entity name
