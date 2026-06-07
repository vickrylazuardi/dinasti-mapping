import { Issue, AggregateScore, Sentiment } from '../models/types';

/**
 * Classifies a numeric average score into a Sentiment category.
 * Uses non-overlapping ranges:
 * - StrongPositive: avg > 5
 * - Positive: avg > 0 and avg <= 5
 * - Neutral: avg = 0
 * - Negative: avg >= -5 and avg < 0
 * - StrongNegative: avg < -5
 */
export function classifySentiment(averageScore: number): Sentiment {
  if (averageScore > 5) return Sentiment.StrongPositive;
  if (averageScore > 0) return Sentiment.Positive;
  if (averageScore === 0) return Sentiment.Neutral;
  if (averageScore >= -5) return Sentiment.Negative;
  return Sentiment.StrongNegative;
}

/**
 * Rounds a number to the specified number of decimal places.
 */
function roundToDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Computes the aggregate score for a list of issues associated with a relationship.
 * 
 * Preconditions:
 * - All issues have valid scores in range [-10, +10]
 * - Issue list may be empty
 * 
 * Postconditions:
 * - totalScore = sum of all issue scores
 * - positiveCount + negativeCount + neutralCount = issues.length
 * - averageScore = totalScore / issues.length (rounded to 2 decimal places)
 * - sentiment correctly classifies the average score
 */
export function calculateAggregate(issues: Issue[]): AggregateScore {
  if (issues.length === 0) {
    return {
      totalScore: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      averageScore: 0,
      sentiment: Sentiment.Neutral,
    };
  }

  let totalScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  for (const issue of issues) {
    totalScore += issue.score;
    if (issue.score > 0) {
      positiveCount++;
    } else if (issue.score < 0) {
      negativeCount++;
    } else {
      neutralCount++;
    }
  }

  const averageScore = roundToDecimal(totalScore / issues.length, 2);
  const sentiment = classifySentiment(averageScore);

  return {
    totalScore,
    positiveCount,
    negativeCount,
    neutralCount,
    averageScore,
    sentiment,
  };
}
