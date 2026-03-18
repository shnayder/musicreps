// Preview comment system: inline annotations for design review.
// Each Section gets a comment icon that expands into a textarea.
// Comments persist in localStorage, with copy/clear at tab level.

import type { ComponentChildren } from 'preact';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'preview_comments';

type CommentStore = Record<string, string>;

function loadComments(): CommentStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveComments(store: CommentStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

function commentKey(tabId: string, sectionTitle: string): string {
  return `${tabId}::${sectionTitle}`;
}

function getTabComments(
  store: CommentStore,
  tabId: string,
): Record<string, string> {
  const prefix = tabId + '::';
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(store)) {
    if (k.startsWith(prefix) && v.trim()) {
      result[k.slice(prefix.length)] = v;
    }
  }
  return result;
}

function formatComments(comments: Record<string, string>): string {
  return Object.entries(comments)
    .map(([section, text]) => `## ${section}\n${text}`)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type CommentCtx = {
  store: CommentStore;
  setComment: (key: string, text: string) => void;
  clearTab: (tabId: string) => void;
};

const CommentContext = createContext<CommentCtx>({
  store: {},
  setComment: () => {},
  clearTab: () => {},
});

export function CommentProvider(
  { children }: { children: ComponentChildren },
) {
  const [store, setStore] = useState<CommentStore>(loadComments);

  const setComment = useCallback((key: string, text: string) => {
    setStore((prev) => {
      const next = { ...prev };
      if (text.trim()) next[key] = text;
      else delete next[key];
      saveComments(next);
      return next;
    });
  }, []);

  const clearTab = useCallback((tabId: string) => {
    setStore((prev) => {
      const next = { ...prev };
      const prefix = tabId + '::';
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix)) delete next[k];
      }
      saveComments(next);
      return next;
    });
  }, []);

  const ctx = useMemo(
    () => ({ store, setComment, clearTab }),
    [store, setComment, clearTab],
  );

  return (
    <CommentContext.Provider value={ctx}>
      {children}
    </CommentContext.Provider>
  );
}

function useComments() {
  return useContext(CommentContext);
}

// ---------------------------------------------------------------------------
// CommentBubble — inline comment icon + expandable textarea
// ---------------------------------------------------------------------------

export function CommentBubble(
  { tabId, sectionTitle }: { tabId: string; sectionTitle: string },
) {
  const { store, setComment } = useComments();
  const key = commentKey(tabId, sectionTitle);
  const text = store[key] || '';
  const hasComment = text.trim().length > 0;
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  function handleInput(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    setComment(key, val);
  }

  return (
    <span class='comment-bubble-wrap'>
      <button
        type='button'
        class={'comment-bubble-btn' + (hasComment ? ' has-comment' : '')}
        title={hasComment ? 'Edit comment' : 'Add comment'}
        onClick={() => setOpen(!open)}
      >
        {'\uD83D\uDCAC'}
      </button>
      {open && (
        <div class='comment-popover'>
          <textarea
            ref={textareaRef}
            class='comment-textarea'
            placeholder='Design feedback...'
            value={text}
            onInput={handleInput}
            rows={3}
          />
          <button
            type='button'
            class='comment-close-btn'
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CommentToolbar — tab-level copy-all + clear-all
// ---------------------------------------------------------------------------

export function CommentToolbar({ tabId }: { tabId: string }) {
  const { store, clearTab } = useComments();
  const comments = getTabComments(store, tabId);
  const count = Object.keys(comments).length;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = formatComments(comments);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleClear() {
    if (count === 0) return;
    clearTab(tabId);
  }

  if (count === 0) return null;

  return (
    <div class='comment-toolbar'>
      <span class='comment-toolbar-count'>
        {count} comment{count !== 1 ? 's' : ''}
      </span>
      <button
        type='button'
        class='comment-toolbar-btn'
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy all'}
      </button>
      <button
        type='button'
        class='comment-toolbar-btn comment-toolbar-clear'
        onClick={handleClear}
      >
        Clear all
      </button>
    </div>
  );
}
