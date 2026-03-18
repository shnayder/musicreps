// Component preview page: renders Preact components with mock data.
// Entry point for the preview bundle — built alongside the main app.

import { render } from 'preact';
import { useState } from 'preact/hooks';
import { type GroupSel, mockSelector } from './preview-shared.tsx';
import { CommentProvider, CommentToolbar } from './preview-comments.tsx';
import { FlowTab } from './preview-tab-flow.tsx';
import { ButtonsTab } from './preview-tab-buttons.tsx';
import { QuizUITab } from './preview-tab-quiz-ui.tsx';
import { ScopeStatsTab } from './preview-tab-scope-stats.tsx';
import { StructureTab } from './preview-tab-structure.tsx';
import { DesignSystemTab } from './preview-tab-design-system.tsx';
import { FretboardTab } from './preview-tab-fretboard.tsx';
import { PracticeRedesignTab } from './preview-tab-practice.tsx';

// ---------------------------------------------------------------------------
// Tab navigation + PreviewApp
// ---------------------------------------------------------------------------

const TABS = [
  'practice-redesign',
  'flow',
  'buttons',
  'quiz-ui',
  'scope-stats',
  'structure',
  'design-system',
  'fretboard',
] as const;

type PreviewTab = typeof TABS[number];

const TAB_LABELS: Record<PreviewTab, string> = {
  'practice-redesign': 'Practice Redesign',
  'flow': 'Full Flow',
  'buttons': 'Answer Buttons',
  'quiz-ui': 'Quiz UI',
  'scope-stats': 'Scope & Stats',
  'structure': 'Screen Structure',
  'design-system': 'Design System',
  'fretboard': 'Fretboard',
};

const STORAGE_KEY = 'preview_active_tab';

function loadSavedTab(): PreviewTab {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (TABS as readonly string[]).includes(saved)) {
      return saved as PreviewTab;
    }
  } catch { /* ignore */ }
  return 'flow';
}

function PreviewApp() {
  const [activeTab, setActiveTab] = useState<PreviewTab>(loadSavedTab);

  const sel = mockSelector();
  const groupSel: GroupSel = {
    getSpeedScore: sel.getSpeedScore,
    getFreshness: sel.getFreshness,
  };

  function switchTab(tab: PreviewTab) {
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY, tab);
    } catch { /* ignore */ }
  }

  return (
    <CommentProvider>
      <div>
        <h1>Component Preview</h1>
        <div class='subtitle'>
          Preact components with mock data — edit{' '}
          <code>src/ui/preview.tsx</code>, rebuild or refresh{' '}
          <code>/preview</code>.
        </div>
        <div class='page-nav'>
          <a href='colors.html'>Colors &rarr;</a>
        </div>
        <div class='preview-tabs'>
          {TABS.map((tab) => (
            <button
              key={tab}
              type='button'
              class={`preview-tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => switchTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <CommentToolbar tabId={activeTab} />
        {activeTab === 'practice-redesign' && (
          <PracticeRedesignTab
            sel={sel}
            groupSel={groupSel}
            tabId={activeTab}
          />
        )}
        {activeTab === 'flow' && (
          <FlowTab sel={sel} groupSel={groupSel} tabId={activeTab} />
        )}
        {activeTab === 'buttons' && <ButtonsTab tabId={activeTab} />}
        {activeTab === 'quiz-ui' && <QuizUITab tabId={activeTab} />}
        {activeTab === 'scope-stats' && (
          <ScopeStatsTab sel={sel} groupSel={groupSel} tabId={activeTab} />
        )}
        {activeTab === 'structure' && (
          <StructureTab sel={sel} groupSel={groupSel} tabId={activeTab} />
        )}
        {activeTab === 'design-system' && (
          <DesignSystemTab tabId={activeTab} />
        )}
        {activeTab === 'fretboard' && <FretboardTab tabId={activeTab} />}
      </div>
    </CommentProvider>
  );
}

const root = document.getElementById('preview-root');
if (root) render(<PreviewApp />, root);
