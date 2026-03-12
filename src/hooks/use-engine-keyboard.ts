// useEngineKeyboard — keyboard routing for quiz engine phases.
// Extracted from useQuizEngine for clarity.

import { useEffect } from 'preact/hooks';
import type { EngineState } from '../types.ts';
import { engineRouteKey } from '../quiz-engine-state.ts';
import type { QuizEngineConfig } from './quiz-engine-types.ts';

export function useEngineKeyboard(
  state: EngineState,
  stateRef: { current: EngineState },
  configRef: { current: QuizEngineConfig },
  stop: () => void,
  nextQuestionRef: { current: () => void },
  continueQuiz: () => void,
  submitAnswer: (input: string) => void,
): void {
  useEffect(() => {
    if (state.phase === 'idle') return;
    function handleKeydown(e: KeyboardEvent) {
      const routed = engineRouteKey(stateRef.current, e.key);
      switch (routed.action) {
        case 'stop':
          e.stopImmediatePropagation();
          stop();
          break;
        case 'next':
          e.preventDefault();
          nextQuestionRef.current();
          break;
        case 'continue':
          if (e.target instanceof HTMLButtonElement) break;
          e.preventDefault();
          continueQuiz();
          break;
        case 'delegate':
          if (e.target instanceof HTMLInputElement) break;
          configRef.current.handleKey?.(e, { submitAnswer });
          break;
        case 'ignore':
          break;
      }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [state.phase !== 'idle', stop, continueQuiz, submitAnswer]);
}
