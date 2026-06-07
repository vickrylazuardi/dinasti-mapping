import {
  RawDataSet,
  RawDynasty,
  RawEntity,
  RawRelationship,
  RawIssue,
} from '../models/types';

/**
 * Error thrown when data loading fails.
 */
export class DataLoadError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly reason: 'missing' | 'parse_error' | 'network_error',
    message: string
  ) {
    super(message);
    this.name = 'DataLoadError';
  }
}

/**
 * Fetches a single JSON file from the given path.
 * Throws DataLoadError with descriptive message on failure.
 */
async function fetchJsonFile<T>(basePath: string, fileName: string): Promise<T> {
  const url = `${basePath}/${fileName}`;
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new DataLoadError(
      fileName,
      'network_error',
      `Failed to fetch "${fileName}": Network or server error. Please check your connection and retry.`
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new DataLoadError(
        fileName,
        'missing',
        `File "${fileName}" is missing from the data directory.`
      );
    }
    throw new DataLoadError(
      fileName,
      'network_error',
      `Failed to fetch "${fileName}": Server returned ${response.status}. Please retry.`
    );
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new DataLoadError(
      fileName,
      'parse_error',
      `File "${fileName}" contains invalid JSON syntax.`
    );
  }
}

/**
 * Fetches all four JSON data files from the specified base path.
 * All files must be present and valid JSON for loading to succeed.
 *
 * Preconditions:
 * - basePath points to an accessible directory (e.g., '/data' or './data')
 * - Directory should contain: dynasties.json, entities.json, relationships.json, issues.json
 *
 * Postconditions:
 * - Returns RawDataSet containing all parsed JSON arrays
 * - Throws DataLoadError if any file is missing, malformed, or unreachable
 *
 * @param basePath - Path to the data directory (default: '/data')
 */
export async function fetchAllData(basePath: string = '/data'): Promise<RawDataSet> {
  const [dynasties, entities, relationships, issues] = await Promise.all([
    fetchJsonFile<RawDynasty[]>(basePath, 'dynasties.json'),
    fetchJsonFile<RawEntity[]>(basePath, 'entities.json'),
    fetchJsonFile<RawRelationship[]>(basePath, 'relationships.json'),
    fetchJsonFile<RawIssue[]>(basePath, 'issues.json'),
  ]);

  return { dynasties, entities, relationships, issues };
}
