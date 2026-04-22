// Leaf fixtures for FeedbackDisplay component states.

export const feedbackCorrect = {
  text: 'Correct \u2014 D#',
  className: 'feedback correct',
  correct: true as const,
  displayAnswer: 'D#',
  hint: 'Space for next',
};

export const feedbackWrong = {
  text: 'Incorrect \u2014 D#',
  className: 'feedback incorrect',
  correct: false as const,
  displayAnswer: 'D#',
  hint: 'Space for next',
};
