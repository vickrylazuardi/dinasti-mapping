import { Issue, RelationshipId, AggregateScore, Sentiment, GraphModel, IssueType } from '../models/types';
import { calculateAggregate } from '../utils/scoreAggregator';
import { sanitizeHtml, validateUrl } from '../utils/sanitize';

type SortField = 'score' | 'date';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'positive' | 'negative' | 'neutral';

/**
 * The IssuePanel displays detailed issues for a relationship
 * with sorting, filtering, and aggregate score summary.
 */
export class IssuePanel {
  private container: HTMLElement;
  private model: GraphModel;
  private currentRelationshipId: RelationshipId | null = null;
  private sortField: SortField = 'date';
  private sortDirection: SortDirection = 'desc';
  private filterType: FilterType = 'all';
  private onClose: () => void;

  constructor(parentElement: HTMLElement, model: GraphModel, onClose: () => void) {
    this.model = model;
    this.onClose = onClose;

    // Create panel container
    this.container = document.createElement('div');
    this.container.className = 'issue-panel';
    this.container.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      width: 380px;
      background: #fff;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0,0,0,0.1);
      overflow-y: auto;
      z-index: 1000;
      display: none;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    parentElement.appendChild(this.container);

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.container.style.display !== 'none' &&
          !this.container.contains(e.target as Node)) {
        // Check if click is on SVG (handled by interaction controller)
      }
    });
  }

  /**
   * Opens the panel for a specific relationship.
   */
  open(relationshipId: RelationshipId): void {
    this.currentRelationshipId = relationshipId;
    this.sortField = 'date';
    this.sortDirection = 'desc';
    this.filterType = 'all';
    this.container.style.display = 'block';
    this.render();
  }

  /**
   * Closes the panel.
   */
  close(): void {
    this.container.style.display = 'none';
    this.currentRelationshipId = null;
    this.onClose();
  }

  /**
   * Renders the panel content.
   */
  private render(): void {
    if (!this.currentRelationshipId) return;

    const issues = this.model.getIssues(this.currentRelationshipId);
    const aggregate = calculateAggregate(issues);
    const filteredIssues = this.applyFilter(issues);
    const sortedIssues = this.applySort(filteredIssues);

    this.container.innerHTML = `
      <div style="padding: 16px;">
        ${this.renderHeader()}
        ${this.renderAggregateSummary(aggregate)}
        ${this.renderControls()}
        ${this.renderIssueList(sortedIssues)}
      </div>
    `;

    this.bindPanelEvents();
  }

  /**
   * Renders the panel header with close button.
   */
  private renderHeader(): string {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;color:#111827;">Relationship Issues</h3>
        <button class="close-btn" style="border:none;background:none;font-size:20px;cursor:pointer;color:#6b7280;">&#x2715;</button>
      </div>
    `;
  }

  /**
   * Renders the aggregate score summary at the top.
   */
  private renderAggregateSummary(aggregate: AggregateScore): string {
    const sentimentColor = this.getSentimentColor(aggregate.sentiment);
    const sentimentLabel = this.getSentimentLabel(aggregate.sentiment);

    return `
      <div style="background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:600;color:${sentimentColor};">${sentimentLabel}</span>
          <span style="font-size:24px;font-weight:700;color:${sentimentColor};">${aggregate.totalScore > 0 ? '+' : ''}${aggregate.totalScore}</span>
        </div>
        <div style="display:flex;gap:12px;font-size:12px;color:#6b7280;">
          <span>Avg: ${aggregate.averageScore.toFixed(1)}</span>
          <span style="color:#22c55e;">+${aggregate.positiveCount}</span>
          <span style="color:#ef4444;">-${aggregate.negativeCount}</span>
          <span style="color:#9ca3af;">${aggregate.neutralCount} neutral</span>
        </div>
      </div>
    `;
  }

  /**
   * Renders sorting and filtering controls.
   */
  private renderControls(): string {
    return `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;gap:4px;align-items:center;">
          <label style="font-size:12px;color:#6b7280;">Sort:</label>
          <select class="sort-field" style="font-size:12px;padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;">
            <option value="date" ${this.sortField === 'date' ? 'selected' : ''}>Date</option>
            <option value="score" ${this.sortField === 'score' ? 'selected' : ''}>Score</option>
          </select>
          <button class="sort-direction" style="font-size:12px;border:1px solid #d1d5db;border-radius:4px;padding:2px 6px;cursor:pointer;background:#fff;">
            ${this.sortDirection === 'desc' ? '\u2193' : '\u2191'}
          </button>
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <label style="font-size:12px;color:#6b7280;">Filter:</label>
          <select class="filter-type" style="font-size:12px;padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;">
            <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All</option>
            <option value="positive" ${this.filterType === 'positive' ? 'selected' : ''}>Positive</option>
            <option value="negative" ${this.filterType === 'negative' ? 'selected' : ''}>Negative</option>
            <option value="neutral" ${this.filterType === 'neutral' ? 'selected' : ''}>Neutral</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Renders the list of issues.
   */
  private renderIssueList(issues: Issue[]): string {
    if (issues.length === 0) {
      return `<p style="text-align:center;color:#9ca3af;font-size:14px;padding:24px 0;">No issues match the selected filter.</p>`;
    }

    return issues.map(issue => this.renderIssueCard(issue)).join('');
  }

  /**
   * Renders a single issue card.
   */
  private renderIssueCard(issue: Issue): string {
    const color = this.getIssueColor(issue.issueType);
    const scoreSign = issue.score > 0 ? '+' : '';
    const description = issue.description.length > 200
      ? `${sanitizeHtml(issue.description.substring(0, 200))}&hellip; <button class="show-more" data-id="${issue.id}" style="color:#3b82f6;background:none;border:none;cursor:pointer;font-size:12px;">show more</button>`
      : sanitizeHtml(issue.description);

    const dateStr = issue.date || 'No date';
    const urlHtml = issue.sourceUrl
      ? (() => {
          const result = validateUrl(issue.sourceUrl);
          return result.valid
            ? `<a href="${result.sanitized}" target="_blank" rel="noopener" style="color:#3b82f6;font-size:11px;text-decoration:none;">Source &#x2197;</a>`
            : `<span style="color:#9ca3af;font-size:11px;">${result.sanitized}</span>`;
        })()
      : '';

    return `
      <div style="border-left:3px solid ${color};padding:8px 12px;margin-bottom:8px;background:#fafafa;border-radius:0 6px 6px 0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <h4 style="margin:0;font-size:13px;color:#111827;">${sanitizeHtml(issue.title)}</h4>
          <span style="font-weight:600;color:${color};font-size:14px;white-space:nowrap;margin-left:8px;">${scoreSign}${issue.score}</span>
        </div>
        <p style="margin:4px 0;font-size:12px;color:#4b5563;line-height:1.4;">${description}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="font-size:11px;color:#9ca3af;">${sanitizeHtml(dateStr)}</span>
          ${urlHtml}
        </div>
      </div>
    `;
  }

  /**
   * Binds event listeners within the panel.
   */
  private bindPanelEvents(): void {
    // Close button
    const closeBtn = this.container.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Sort field change
    const sortField = this.container.querySelector('.sort-field') as HTMLSelectElement;
    sortField?.addEventListener('change', () => {
      this.sortField = sortField.value as SortField;
      this.render();
    });

    // Sort direction toggle
    const sortDir = this.container.querySelector('.sort-direction');
    sortDir?.addEventListener('click', () => {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
      this.render();
    });

    // Filter type change
    const filterType = this.container.querySelector('.filter-type') as HTMLSelectElement;
    filterType?.addEventListener('change', () => {
      this.filterType = filterType.value as FilterType;
      this.render();
    });
  }

  /**
   * Applies the current filter to the issue list.
   */
  private applyFilter(issues: Issue[]): Issue[] {
    if (this.filterType === 'all') return issues;
    return issues.filter(issue => {
      switch (this.filterType) {
        case 'positive': return issue.score > 0;
        case 'negative': return issue.score < 0;
        case 'neutral': return issue.score === 0;
        default: return true;
      }
    });
  }

  /**
   * Applies the current sort to the issue list.
   */
  private applySort(issues: Issue[]): Issue[] {
    const sorted = [...issues];
    const multiplier = this.sortDirection === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      if (this.sortField === 'score') {
        return (a.score - b.score) * multiplier;
      } else {
        // Sort by date
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateA.localeCompare(dateB) * multiplier;
      }
    });

    return sorted;
  }

  /**
   * Returns color for issue type.
   */
  private getIssueColor(type: IssueType): string {
    switch (type) {
      case IssueType.Positive: return '#22c55e';
      case IssueType.Negative: return '#ef4444';
      default: return '#9ca3af';
    }
  }

  /**
   * Returns color for sentiment.
   */
  private getSentimentColor(sentiment: Sentiment): string {
    switch (sentiment) {
      case Sentiment.StrongPositive:
      case Sentiment.Positive:
        return '#22c55e';
      case Sentiment.Neutral:
        return '#6b7280';
      case Sentiment.Negative:
      case Sentiment.StrongNegative:
        return '#ef4444';
    }
  }

  /**
   * Returns label for sentiment.
   */
  private getSentimentLabel(sentiment: Sentiment): string {
    switch (sentiment) {
      case Sentiment.StrongPositive: return 'Strong Positive';
      case Sentiment.Positive: return 'Positive';
      case Sentiment.Neutral: return 'Neutral';
      case Sentiment.Negative: return 'Negative';
      case Sentiment.StrongNegative: return 'Strong Negative';
    }
  }
}
