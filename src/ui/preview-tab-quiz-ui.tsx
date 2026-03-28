// Quiz UI tab — prompts, feedback, session header, and timer components.

import {
  feedbackCorrect,
  feedbackWrong,
  sessionEarlyRound,
  timerMidRound,
  timerWarning,
} from '../fixtures/index.ts';
import { CountdownBar, FeedbackDisplay, TextPrompt } from './quiz-ui.tsx';
import { QuizSession, SessionInfo } from './mode-screen.tsx';
import { PreviewGrid, Section } from './preview-shared.tsx';

export function QuizUITab({ tabId }: { tabId: string }) {
  return (
    <>
      <h2>Prompts & Feedback</h2>
      <PreviewGrid>
        <Section title='Text Prompt' tabId={tabId}>
          <TextPrompt text='C + 5' />
        </Section>
        <Section title='Feedback — Correct' tabId={tabId}>
          <FeedbackDisplay
            text={feedbackCorrect.text}
            className={feedbackCorrect.className}
            correct={feedbackCorrect.correct}
            onNext={() => {}}
          />
        </Section>
        <Section title='Feedback — Incorrect' tabId={tabId}>
          <FeedbackDisplay
            text={feedbackWrong.text}
            className={feedbackWrong.className}
            hint={feedbackWrong.hint}
            correct={feedbackWrong.correct}
            onNext={() => {}}
          />
        </Section>
      </PreviewGrid>
      <h2>Session Header & Timer</h2>
      <PreviewGrid>
        <Section title='SessionInfo' tabId={tabId}>
          <SessionInfo
            context={sessionEarlyRound.context}
            count={sessionEarlyRound.count}
          />
        </Section>
        <Section title='QuizSession (header)' tabId={tabId}>
          <QuizSession
            timeLeft='42s'
            context='Natural notes'
            count='5 of 12'
            isWarning={false}
          />
        </Section>
        <Section title='Countdown Bar (mid-round)' tabId={tabId}>
          <CountdownBar pct={timerMidRound.pct} />
        </Section>
        <Section title='Countdown Bar — Warning' tabId={tabId}>
          <CountdownBar pct={timerWarning.pct} warning />
        </Section>
        <Section title='Countdown Bar — Last Question' tabId={tabId}>
          <CountdownBar pct={50} lastQuestion />
        </Section>
      </PreviewGrid>
    </>
  );
}
