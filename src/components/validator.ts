import {
  RawDataSet,
  ValidationResult,
  ValidationError,
  ValidationErrorType,
  DynastyNode,
  Relationship,
  Issue,
  NodeId,
  RelationshipId,
  DynastyId,
  IssueId,
  NodeType,
  RelationType,
  IssueType,
} from '../models/types';
import { validateImageUrl } from '../utils/sanitize';

/**
 * Validates that a string is a valid NodeType enum value.
 */
function isValidNodeType(type: string): type is NodeType {
  return Object.values(NodeType).includes(type as NodeType);
}

/**
 * Validates that a string is a valid RelationType enum value.
 */
function isValidRelationType(type: string): type is RelationType {
  return Object.values(RelationType).includes(type as RelationType);
}

/**
 * Validates that a string is a valid IssueType enum value.
 */
function isValidIssueType(type: string): type is IssueType {
  return Object.values(IssueType).includes(type as IssueType);
}

/**
 * Validates the entire raw dataset, running all validation rules to completion
 * and accumulating all errors found.
 * 
 * Validation rules:
 * 1. All DynastyNode IDs are unique
 * 2. Every Relationship references existing DynastyNode IDs
 * 3. Every Issue has an integer score within [-10, +10]
 * 4. Issue type is consistent with score sign
 * 5. DynastyNode name and Issue title/description are non-empty after trimming
 * 6. Reports all failures with entity ID, field name, and description
 * 7. Relationship sourceId level <= targetId level
 * 8. Every dynasty has at least one Root_Node (level-0 entity)
 * 9. Every Issue references an existing Relationship ID
 * 10. Returns success if no errors found
 */
export function validateDataSet(data: RawDataSet): ValidationResult {
  const errors: ValidationError[] = [];

  // Build lookup maps
  const nodeMap = new Map<string, { level: number; dynasty: string }>();
  const relationshipIds = new Set<string>();
  const dynastyIds = new Set<string>();
  const nodeIds = new Set<string>();

  // Register dynasty IDs
  for (const dynasty of data.dynasties) {
    dynastyIds.add(dynasty.id);
  }

  // Rule 1: Unique node IDs + Rule 5: Non-empty name
  for (const entity of data.entities) {
    if (nodeIds.has(entity.id)) {
      errors.push({
        type: ValidationErrorType.DuplicateId,
        entityId: entity.id,
        field: 'id',
        message: `Duplicate node ID: "${entity.id}"`,
      });
    } else {
      nodeIds.add(entity.id);
      nodeMap.set(entity.id, { level: entity.level, dynasty: entity.dynasty });
    }

    // Rule 5: Non-empty name
    if (!entity.name || entity.name.trim().length === 0) {
      errors.push({
        type: ValidationErrorType.EmptyField,
        entityId: entity.id,
        field: 'name',
        message: `Entity "${entity.id}" has an empty or whitespace-only name`,
      });
    }

    // Validate node type
    if (!isValidNodeType(entity.type)) {
      errors.push({
        type: ValidationErrorType.InconsistentType,
        entityId: entity.id,
        field: 'type',
        message: `Entity "${entity.id}" has invalid type: "${entity.type}". Valid types: ${Object.values(NodeType).join(', ')}`,
      });
    }
  }

  // Rule 8: Every dynasty has at least one root node (level-0 entity)
  const dynastiesWithRoots = new Set<string>();
  for (const entity of data.entities) {
    if (entity.level === 0) {
      dynastiesWithRoots.add(entity.dynasty);
    }
  }
  for (const dynasty of data.dynasties) {
    if (!dynastiesWithRoots.has(dynasty.id)) {
      errors.push({
        type: ValidationErrorType.MissingRootNode,
        entityId: dynasty.id,
        field: 'rootEntityId',
        message: `Dynasty "${dynasty.id}" has no level-0 root node`,
      });
    }
  }

  // Validate relationships
  for (const rel of data.relationships) {
    relationshipIds.add(rel.id);

    // Rule 2: References existing nodes
    if (!nodeIds.has(rel.sourceId)) {
      errors.push({
        type: ValidationErrorType.MissingReference,
        entityId: rel.id,
        field: 'sourceId',
        message: `Relationship "${rel.id}" references non-existent source node: "${rel.sourceId}"`,
      });
    }
    if (!nodeIds.has(rel.targetId)) {
      errors.push({
        type: ValidationErrorType.MissingReference,
        entityId: rel.id,
        field: 'targetId',
        message: `Relationship "${rel.id}" references non-existent target node: "${rel.targetId}"`,
      });
    }

    // Rule 7: Source level <= target level
    const sourceInfo = nodeMap.get(rel.sourceId);
    const targetInfo = nodeMap.get(rel.targetId);
    if (sourceInfo && targetInfo && sourceInfo.level > targetInfo.level) {
      errors.push({
        type: ValidationErrorType.LevelViolation,
        entityId: rel.id,
        field: 'sourceId',
        message: `Relationship "${rel.id}" has source at level ${sourceInfo.level} which is greater than target at level ${targetInfo.level}`,
      });
    }

    // Validate relationship type
    if (!isValidRelationType(rel.type)) {
      errors.push({
        type: ValidationErrorType.InconsistentType,
        entityId: rel.id,
        field: 'type',
        message: `Relationship "${rel.id}" has invalid type: "${rel.type}". Valid types: ${Object.values(RelationType).join(', ')}`,
      });
    }
  }

  // Validate issues
  for (const issue of data.issues) {
    // Rule 9: References existing relationship
    if (!relationshipIds.has(issue.relationshipId)) {
      errors.push({
        type: ValidationErrorType.DanglingIssueReference,
        entityId: issue.id,
        field: 'relationshipId',
        message: `Issue "${issue.id}" references non-existent relationship: "${issue.relationshipId}"`,
      });
    }

    // Rule 3: Score in [-10, +10]
    if (!Number.isInteger(issue.score) || issue.score < -10 || issue.score > 10) {
      errors.push({
        type: ValidationErrorType.InvalidScore,
        entityId: issue.id,
        field: 'score',
        message: `Issue "${issue.id}" has invalid score: ${issue.score}. Must be an integer in [-10, +10]`,
      });
    }

    // Rule 4: Type/score consistency
    if (isValidIssueType(issue.type)) {
      if (issue.type === IssueType.Positive && issue.score <= 0) {
        errors.push({
          type: ValidationErrorType.InconsistentType,
          entityId: issue.id,
          field: 'type',
          message: `Issue "${issue.id}" has type "positive" but score ${issue.score} is not > 0`,
        });
      } else if (issue.type === IssueType.Negative && issue.score >= 0) {
        errors.push({
          type: ValidationErrorType.InconsistentType,
          entityId: issue.id,
          field: 'type',
          message: `Issue "${issue.id}" has type "negative" but score ${issue.score} is not < 0`,
        });
      } else if (issue.type === IssueType.Neutral && issue.score !== 0) {
        errors.push({
          type: ValidationErrorType.InconsistentType,
          entityId: issue.id,
          field: 'type',
          message: `Issue "${issue.id}" has type "neutral" but score ${issue.score} is not 0`,
        });
      }
    } else {
      errors.push({
        type: ValidationErrorType.InconsistentType,
        entityId: issue.id,
        field: 'type',
        message: `Issue "${issue.id}" has invalid type: "${issue.type}". Valid types: ${Object.values(IssueType).join(', ')}`,
      });
    }

    // Rule 5: Non-empty title and description
    if (!issue.title || issue.title.trim().length === 0) {
      errors.push({
        type: ValidationErrorType.EmptyField,
        entityId: issue.id,
        field: 'title',
        message: `Issue "${issue.id}" has an empty or whitespace-only title`,
      });
    }
    if (!issue.description || issue.description.trim().length === 0) {
      errors.push({
        type: ValidationErrorType.EmptyField,
        entityId: issue.id,
        field: 'description',
        message: `Issue "${issue.id}" has an empty or whitespace-only description`,
      });
    }
  }

  // If errors found, return failure
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Transform raw data into validated domain objects
  const nodes: DynastyNode[] = data.entities.map((entity) => ({
    id: entity.id as NodeId,
    name: entity.name,
    nodeType: entity.type as NodeType,
    dynasty: entity.dynasty as DynastyId,
    level: entity.level,
    description: entity.description,
    imageUrl: validateImageUrl(entity.imageUrl) ?? undefined,
  }));

  const relationships: Relationship[] = data.relationships.map((rel) => ({
    id: rel.id as RelationshipId,
    sourceId: rel.sourceId as NodeId,
    targetId: rel.targetId as NodeId,
    relationType: rel.type as RelationType,
    label: rel.label,
  }));

  const issues: Issue[] = data.issues.map((issue) => ({
    id: issue.id as IssueId,
    relationshipId: issue.relationshipId as RelationshipId,
    title: issue.title,
    description: issue.description,
    issueType: issue.type as IssueType,
    score: issue.score,
    date: issue.date,
    sourceUrl: issue.sourceUrl,
  }));

  return {
    success: true,
    data: {
      dynasties: data.dynasties,
      nodes,
      relationships,
      issues,
    },
  };
}
