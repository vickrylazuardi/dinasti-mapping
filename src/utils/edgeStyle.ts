import { AggregateScore, EdgeStyle, Sentiment } from '../models/types';

/**
 * Maps an AggregateScore to a visual EdgeStyle for relationship arrows.
 * 
 * Style mapping:
 * - StrongPositive → 4px solid green
 * - Positive → 2px solid green
 * - Neutral → 1px solid gray
 * - Negative → 2px solid red
 * - StrongNegative → 4px dashed red
 * 
 * Preconditions:
 * - score is a valid AggregateScore with correctly classified sentiment
 * 
 * Postconditions:
 * - Returns an EdgeStyle that uniquely maps to the sentiment classification
 * - Mapping is deterministic and total (all sentiment values handled)
 */
export function computeEdgeStyle(score: AggregateScore): EdgeStyle {
  switch (score.sentiment) {
    case Sentiment.StrongPositive:
      return { color: '#22c55e', strokeWidth: 4, dashArray: 'none' };
    case Sentiment.Positive:
      return { color: '#22c55e', strokeWidth: 2, dashArray: 'none' };
    case Sentiment.Neutral:
      return { color: '#9ca3af', strokeWidth: 1, dashArray: 'none' };
    case Sentiment.Negative:
      return { color: '#ef4444', strokeWidth: 2, dashArray: 'none' };
    case Sentiment.StrongNegative:
      return { color: '#ef4444', strokeWidth: 4, dashArray: '8,4' };
  }
}
