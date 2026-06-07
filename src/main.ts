import './style.css';
import { fetchAllData, DataLoadError } from './components/dataLoader';
import { validateDataSet } from './components/validator';
import { buildGraph, GraphCycleError, UnreachableNodesError } from './components/graphModel';
import { VisualizationEngine } from './components/visualizationEngine';
import { InteractionController } from './components/interactionController';
import { IssuePanel } from './components/issuePanel';
import { RelationshipId } from './models/types';

/**
 * Main application entry point.
 * Implements the full initialization sequence:
 * fetch data → validate → build graph → initialize visualization → render root nodes
 */
async function main(): Promise<void> {
  const appElement = document.querySelector<HTMLDivElement>('#app');
  if (!appElement) {
    console.error('Application container #app not found');
    return;
  }

  try {
    // Step 1: Fetch all data files
    const rawData = await fetchAllData('/data');

    // Step 2: Validate data
    const validationResult = validateDataSet(rawData);
    if (!validationResult.success) {
      showError(appElement, 'Data Validation Failed', validationResult.errors.map(e =>
        `[${e.entityId}] ${e.field}: ${e.message}`
      ));
      return;
    }

    // Step 3: Build graph model
    const model = buildGraph(validationResult.data);

    // Step 4: Initialize visualization
    const vizContainer = document.createElement('div');
    vizContainer.id = 'viz-container';
    vizContainer.style.cssText = 'width:100%;height:100vh;';
    appElement.appendChild(vizContainer);

    const engine = new VisualizationEngine();
    engine.initialize(vizContainer, model);

    // Step 5: Initialize Issue Panel
    const issuePanel = new IssuePanel(appElement, model, () => {});

    // Step 6: Initialize Interaction Controller
    new InteractionController(model, engine, {
      onIssuesPanelOpen: (relId: RelationshipId) => {
        issuePanel.open(relId);
      },
      onIssuesPanelClose: () => {
        issuePanel.close();
      },
    });

    // Step 7: Render initial state (root nodes in collapsed state)
    engine.updateLayout();

  } catch (error) {
    if (error instanceof DataLoadError) {
      showError(appElement, 'Data Loading Failed', [error.message]);
    } else if (error instanceof GraphCycleError) {
      showError(appElement, 'Data Error: Cycle Detected', [error.message]);
    } else if (error instanceof UnreachableNodesError) {
      showError(appElement, 'Data Error: Unreachable Nodes', [error.message]);
    } else {
      showError(appElement, 'Unexpected Error', [(error as Error).message]);
    }
  }
}

/**
 * Displays an error message in the application container.
 */
function showError(container: HTMLElement, title: string, messages: string[]): void {
  container.innerHTML = `
    <div style="max-width:600px;margin:80px auto;padding:24px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;">
      <h2 style="margin:0 0 12px;color:#dc2626;font-size:18px;">\u26A0\uFE0F ${title}</h2>
      <ul style="margin:0;padding:0 0 0 20px;color:#7f1d1d;font-size:14px;line-height:1.6;">
        ${messages.map(m => `<li>${m}</li>`).join('')}
      </ul>
      <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">Please check the data files in the /data directory and fix the issues above.</p>
    </div>
  `;
}

// Start the application
main();
