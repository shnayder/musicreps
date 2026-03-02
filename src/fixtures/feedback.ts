// Leaf fixtures for FeedbackDisplay component states.

export const feedbackCorrect = {
  text: 'Correct!',
  className: 'feedback correct',
  correct: true as const,
  displayAnswer: 'D#',
  time: '0.82s',
  hint: 'Space for next',
};

export const feedbackWrong = {
  text: 'Incorrect \u2014 D#',
  className: 'feedback incorrect',
  correct: false as const,
  displayAnswer: 'D#',
  hint: 'Space for next',
};
