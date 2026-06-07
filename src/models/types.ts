// ============================================================
// Branded ID Types
// ============================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type NodeId = Brand<string, 'NodeId'>;
export type RelationshipId = Brand<string, 'RelationshipId'>;
export type DynastyId = Brand<string, 'DynastyId'>;
export type IssueId = Brand<string, 'IssueId'>;

// ============================================================
// Enumerations
// ============================================================

export enum NodeType {
  Person = 'person',
  Party = 'party',
  Organization = 'organization',
  Institution = 'institution',
}

export enum RelationType {
  Family = 'family',
  Political = 'political',
  Business = 'business',
  Appointment = 'appointment',
  Alliance = 'alliance',
  Rivalry = 'rivalry',
}

export enum IssueType {
  Positive = 'positive',
  Negative = 'negative',
  Neutral = 'neutral',
}

export enum Sentiment {
  StrongPositive = 'strong_positive',
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
  StrongNegative = 'strong_negative',
}

// ============================================================
// Domain Models
// ============================================================

export interface DynastyNode {
  id: NodeId;
  name: string;
  nodeType: NodeType;
  dynasty: DynastyId;
  level: number;
  description?: string;
  imageUrl?: string;
}

export interface Relationship {
  id: RelationshipId;
  sourceId: NodeId;
  targetId: NodeId;
  relationType: RelationType;
  label: string;
}

export interface Issue {
  id: IssueId;
  relationshipId: RelationshipId;
  title: string;
  description: string;
  issueType: IssueType;
  score: number; // Range: -10 to +10
  date?: string;
  sourceUrl?: string;
}

export interface AggregateScore {
  totalScore: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  averageScore: number;
  sentiment: Sentiment;
}

export interface EdgeStyle {
  color: string;
  strokeWidth: number;
  dashArray: string;
}

// ============================================================
// Raw Data Interfaces (parsed from JSON)
// ============================================================

export interface RawDynasty {
  id: string;
  name: string;
  description: string;
  rootEntityId: string;
}

export interface RawEntity {
  id: string;
  name: string;
  type: string;
  dynasty: string;
  level: number;
  description?: string;
  imageUrl?: string;
}

export interface RawRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label: string;
}

export interface RawIssue {
  id: string;
  relationshipId: string;
  title: string;
  description: string;
  type: string;
  score: number;
  date?: string;
  sourceUrl?: string;
}

export interface RawDataSet {
  dynasties: RawDynasty[];
  entities: RawEntity[];
  relationships: RawRelationship[];
  issues: RawIssue[];
}

// ============================================================
// Validated Data Set
// ============================================================

export interface ValidDataSet {
  dynasties: RawDynasty[];
  nodes: DynastyNode[];
  relationships: Relationship[];
  issues: Issue[];
}

// ============================================================
// Validation Error Types
// ============================================================

export enum ValidationErrorType {
  DuplicateId = 'duplicate_id',
  MissingReference = 'missing_reference',
  InvalidScore = 'invalid_score',
  InconsistentType = 'inconsistent_type',
  EmptyField = 'empty_field',
  LevelViolation = 'level_violation',
  MissingRootNode = 'missing_root_node',
  DanglingIssueReference = 'dangling_issue_reference',
}

export interface ValidationError {
  type: ValidationErrorType;
  entityId: string;
  field: string;
  message: string;
}

export type ValidationResult =
  | { success: true; data: ValidDataSet }
  | { success: false; errors: ValidationError[] };

// ============================================================
// Graph Model Types
// ============================================================

export interface GraphModel {
  rootNodes: DynastyNode[];
  getNode: (id: NodeId) => DynastyNode | undefined;
  getChildren: (id: NodeId) => DynastyNode[];
  getRelationship: (sourceId: NodeId, targetId: NodeId) => Relationship | undefined;
  getIssues: (relId: RelationshipId) => Issue[];
  isExpanded: (id: NodeId) => boolean;
  expandNode: (id: NodeId) => void;
  collapseNode: (id: NodeId) => void;
  getVisibleNodes: () => DynastyNode[];
  getVisibleRelationships: () => Relationship[];
}
