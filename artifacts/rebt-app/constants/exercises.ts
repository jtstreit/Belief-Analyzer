/**
 * Evidence-based exercise catalog for REBT and Beckian CBT.
 * Each exercise has a modality tag, category, target processes,
 * transdiagnostic issues, and guided steps with typed inputs.
 */

export type StepType = 'text' | 'multiline' | 'rating' | 'suds' | 'mood' | 'choice' | 'info';

export interface ExerciseStep {
  id: string;
  title: string;
  instruction: string;
  type: StepType;
  placeholder?: string;
  options?: string[];          // for choice
  min?: number; max?: number;  // for rating/suds/mood
  caution?: string;
}

export type ExerciseModality = 'rebt' | 'cbt' | 'both';
export type ExerciseCategory =
  | 'cognitive_restructuring'
  | 'behavioral'
  | 'imagery'
  | 'psychoeducation';

export const ISSUES = [
  'anxiety', 'social_anxiety', 'low_mood', 'anger',
  'guilt_shame', 'procrastination', 'perfectionism', 'general',
] as const;
export type Issue = typeof ISSUES[number];

export interface Exercise {
  id: string;
  title: string;
  subtitle: string;
  modality: ExerciseModality;
  category: ExerciseCategory;
  targetProcesses: string[];
  issues: Issue[];
  evidenceBase: string;
  rationale: string;
  estimatedMinutes: number;
  steps: ExerciseStep[];
  caution?: string;
  icon: string;
  /** Compact, focus-first exercise that skips the generic mood gate. */
  quick?: boolean;
}

// ─────────────────────────────────────────────
// REBT Exercises
// ─────────────────────────────────────────────

const rebtAbcde: Exercise = {
  id: 'rebt-abcde',
  title: 'ABCDE Worksheet',
  subtitle: 'Ellis\'s core disputation framework',
  modality: 'rebt',
  category: 'cognitive_restructuring',
  targetProcesses: ['demandingness', 'awfulizing', 'low_frustration_tolerance', 'global_rating'],
  issues: ['anxiety', 'anger', 'guilt_shame', 'low_mood', 'general'],
  evidenceBase: 'Ellis, A. (1994). Reason and Emotion in Psychotherapy.',
  rationale: 'The ABCDE model locates distress in irrational beliefs (B), not the activating event (A). By disputing (D) and replacing beliefs with an effective new philosophy (E), you change how events affect you.',
  estimatedMinutes: 15,
  icon: 'activity',
  steps: [
    {
      id: 'A',
      title: 'A — Activating Event',
      instruction: 'Describe the situation that triggered your distress as objectively as possible — just the facts, no interpretations.',
      type: 'multiline',
      placeholder: 'e.g., My manager criticised my report in front of the team.',
    },
    {
      id: 'C',
      title: 'C — Consequences (emotions & behaviours)',
      instruction: 'What emotions did you feel? What did you do (or want to do)? Rate the intensity of your main emotion (0 = none, 10 = extreme).',
      type: 'multiline',
      placeholder: 'e.g., Intense shame (8/10). I withdrew and avoided the team for the rest of the day.',
    },
    {
      id: 'B',
      title: 'B — Irrational Belief',
      instruction: 'What were you telling yourself about the event? Look for rigid musts/shoulds, catastrophising, "I can\'t stand it", or global self-ratings. Write the belief as literally as possible.',
      type: 'multiline',
      placeholder: 'e.g., "I must never make mistakes. I did, so I am a total failure and worthless."',
    },
    {
      id: 'beliefType',
      title: 'Belief type',
      instruction: 'Which irrational-belief process best describes the belief above?',
      type: 'choice',
      options: [
        'Demandingness (rigid must/should)',
        'Awfulizing (worst thing ever)',
        'Low Frustration Tolerance (I can\'t stand it)',
        'Global Rating / Self-Downing',
        'Multiple combined',
      ],
    },
    {
      id: 'D_empirical',
      title: 'D — Empirical Disputation',
      instruction: 'Is there factual evidence that this belief is true? Where is the evidence that you MUST perform perfectly, or that one mistake makes you a total failure?',
      type: 'multiline',
      placeholder: 'e.g., There is no law of the universe requiring me to be perfect. Many skilled people make mistakes and are not failures.',
    },
    {
      id: 'D_logical',
      title: 'D — Logical Disputation',
      instruction: 'Does the belief follow logically? Does it make sense that a single event defines your entire worth as a person?',
      type: 'multiline',
      placeholder: 'e.g., Even if I made a mistake, that is one behaviour — it cannot logically determine my whole worth.',
    },
    {
      id: 'D_pragmatic',
      title: 'D — Pragmatic Disputation',
      instruction: 'Is this belief helping you? What are the costs of holding it versus a more flexible alternative?',
      type: 'multiline',
      placeholder: 'e.g., This belief makes me anxious, avoidant, and less likely to try again — it is harming me.',
    },
    {
      id: 'E',
      title: 'E — Effective New Philosophy',
      instruction: 'Write a rational, flexible alternative. It should be true, logical, and helpful. Aim for unconditional acceptance — of yourself, others, or life — not a mere positive spin.',
      type: 'multiline',
      placeholder: 'e.g., I would prefer not to make mistakes, but I am a fallible human being. Mistakes do not define my worth. I can accept myself and improve.',
    },
    {
      id: 'moodAfterRating',
      title: 'Re-rate your emotion',
      instruction: 'How intense is the emotion now (0–10)?',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const rebtShameAttacking: Exercise = {
  id: 'rebt-shame-attacking',
  title: 'Shame-Attacking Exercise',
  subtitle: 'Build discomfort tolerance & dispute approval-seeking',
  modality: 'rebt',
  category: 'behavioral',
  targetProcesses: ['low_frustration_tolerance', 'global_rating', 'need_for_approval'],
  issues: ['social_anxiety', 'guilt_shame', 'anxiety'],
  evidenceBase: 'Ellis, A. & MacLaren, C. (1998). Rational Emotive Behavior Therapy: A Therapist\'s Guide.',
  rationale: 'By deliberately doing something mildly embarrassing in public and tolerating the discomfort without negative self-rating, you prove to yourself that you can cope and that others\' disapproval is not catastrophic.',
  estimatedMinutes: 20,
  caution: 'Choose tasks that are harmless to others and legal. Avoid anything offensive, dangerous, or likely to threaten your job or safety. If trauma, psychosis, or severe social anxiety is active, use this only with a trained clinician.',
  icon: 'shield',
  steps: [
    {
      id: 'intro',
      title: 'What is a shame-attacking exercise?',
      instruction: 'You will plan a mildly embarrassing public act — something that feels awkward but is harmless — then carry it out and reflect. The goal is NOT to be reckless, but to practise feeling self-conscious without self-downing.',
      type: 'info',
    },
    {
      id: 'targetBelief',
      title: 'Identify the approval-seeking belief',
      instruction: 'What irrational belief about others\' opinions or your own dignity are you targeting? (e.g., "I must always appear confident or people will think I\'m an idiot and that would be terrible.")',
      type: 'multiline',
      placeholder: 'Write the belief you want to weaken...',
    },
    {
      id: 'task',
      title: 'Design your shame-attacking task',
      instruction: 'Choose a mildly embarrassing act you can do in public this week. It should feel uncomfortable but be harmless (e.g., ask for directions to a place you can see; loudly announce the time on a bus; wear mismatched socks and mention it). Write it here.',
      type: 'multiline',
      placeholder: 'My task: ...',
    },
    {
      id: 'predictedSUDS',
      title: 'Predicted discomfort (SUDS 0–100)',
      instruction: 'How uncomfortable do you expect to feel during the task? (0 = no discomfort, 100 = unbearable)',
      type: 'suds',
      min: 0, max: 100,
    },
    {
      id: 'completed',
      title: 'Did you complete the task?',
      instruction: 'After doing the task, return here. Describe briefly what happened.',
      type: 'multiline',
      placeholder: 'What did you do? How did people react?',
    },
    {
      id: 'actualSUDS',
      title: 'Actual discomfort experienced (SUDS 0–100)',
      instruction: 'How uncomfortable did you actually feel at the peak?',
      type: 'suds',
      min: 0, max: 100,
    },
    {
      id: 'tolerated',
      title: 'Did you tolerate it?',
      instruction: 'Reflect: you survived the discomfort. What does this prove about your ability to tolerate embarrassment and others\' disapproval?',
      type: 'multiline',
      placeholder: 'e.g., I coped. Nothing catastrophic happened. I still have value even if someone thought I was odd.',
    },
    {
      id: 'rationalConclusion',
      title: 'Rational conclusion',
      instruction: 'Rewrite your original belief in a more rational, flexible form based on this experience.',
      type: 'multiline',
      placeholder: 'e.g., I prefer approval but I don\'t need it. I can stand feeling embarrassed — it\'s uncomfortable, not catastrophic.',
    },
  ],
};

const rebtRationalImagery: Exercise = {
  id: 'rebt-rational-imagery',
  title: 'Rational-Emotive Imagery',
  subtitle: 'Change unhealthy emotions through vivid imagination',
  modality: 'rebt',
  category: 'imagery',
  targetProcesses: ['awfulizing', 'low_frustration_tolerance', 'global_rating'],
  issues: ['anxiety', 'anger', 'guilt_shame', 'low_mood'],
  evidenceBase: 'Maultsby, M.C. & Ellis, A. (1974). Technique of rational emotive imagery.',
  rationale: 'By vividly imagining a feared situation and practising shifting from an unhealthy emotion (panic, rage, depression) to a healthy but still negative one (concern, annoyance, sadness), you develop emotional flexibility and tolerance.',
  caution: 'Skip or stop if intense imagery feels overwhelming, triggers trauma, or causes dissociation. This practice is optional. Seek immediate support if self-harm thoughts are strong.',
  estimatedMinutes: 10,
  icon: 'eye',
  steps: [
    {
      id: 'situation',
      title: 'Choose a situation',
      instruction: 'Describe a situation you fear or find distressing — something you tend to avoid or that triggers strong unhealthy emotions.',
      type: 'multiline',
      placeholder: 'e.g., Being rejected after a job interview I worked hard for.',
    },
    {
      id: 'unhealthyEmotion',
      title: 'Identify the unhealthy emotion',
      instruction: 'What intense emotion shows up when you imagine this situation (for example panic, rage, deep sadness, or shame)? Use words that fit without forcing self-hatred language.',
      type: 'multiline',
      placeholder: 'e.g., Deep depression and self-hatred (9/10).',
    },
    {
      id: 'imageryPractice',
      title: 'Imagery practice',
      instruction: 'Close your eyes. Vividly imagine the situation in as much detail as possible. Allow yourself to feel the unhealthy emotion fully for 1–2 minutes. Then, WITHOUT changing the situation, work to change the emotion to a healthy negative — concern instead of panic, sadness instead of depression, annoyance instead of rage. Take your time. When you have done this, open your eyes and describe what you experienced.',
      type: 'multiline',
      placeholder: 'Describe the imagery experience and the shift you made...',
    },
    {
      id: 'beliefShift',
      title: 'What belief did you change?',
      instruction: 'What irrational belief were you holding during the unhealthy emotion? What rational belief replaced it and produced the healthier emotion?',
      type: 'multiline',
      placeholder: 'e.g., Changed "I must not be rejected — it proves I am worthless" to "I strongly prefer success but rejection doesn\'t define me."',
    },
    {
      id: 'postMood',
      title: 'Emotion intensity now (0–10)',
      instruction: 'How intense is the healthy negative emotion after the imagery practice?',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const rebtRationalCards: Exercise = {
  id: 'rebt-rational-cards',
  title: 'Rational Coping Cards',
  subtitle: 'Create portable forceful rational reminders',
  modality: 'rebt',
  category: 'cognitive_restructuring',
  targetProcesses: ['demandingness', 'awfulizing', 'low_frustration_tolerance', 'global_rating'],
  issues: ['anxiety', 'anger', 'procrastination', 'general'],
  evidenceBase: 'Ellis, A. (1988). How to Stubbornly Refuse to Make Yourself Miserable About Anything.',
  rationale: 'Rational coping cards provide quick access to disputation arguments when distress strikes. Regular forceful repetition helps internalise the rational philosophy.',
  estimatedMinutes: 8,
  icon: 'book-open',
  steps: [
    {
      id: 'situation',
      title: 'Triggering situation',
      instruction: 'What recurring situation or thought triggers your irrational beliefs?',
      type: 'text',
      placeholder: 'e.g., When my work is criticised',
    },
    {
      id: 'irrationalBelief',
      title: 'The irrational belief (front of card)',
      instruction: 'Write the irrational belief exactly as it sounds in your head.',
      type: 'multiline',
      placeholder: 'e.g., "This criticism proves I am incompetent and worthless."',
    },
    {
      id: 'rationalResponse',
      title: 'The rational response (back of card)',
      instruction: 'Write a forceful, vivid, rational counter. Make it specific, true, and something you can say with conviction — not just a mild positive thought.',
      type: 'multiline',
      placeholder: 'e.g., "Criticism is about this piece of work, not my entire worth. I am a fallible human who can improve. My worth is not tied to any single outcome."',
    },
    {
      id: 'frequency',
      title: 'Practice plan',
      instruction: 'How often will you read and forcefully repeat this coping statement? (Research suggests at least twice daily for several weeks.)',
      type: 'choice',
      options: [
        'Once a day',
        'Twice a day',
        'Every time the trigger occurs',
        'Morning and before bed',
      ],
    },
  ],
};

// ─────────────────────────────────────────────
// CBT Exercises
// ─────────────────────────────────────────────

const cbtThoughtRecord7: Exercise = {
  id: 'cbt-thought-record-7col',
  title: '7-Column Thought Record',
  subtitle: 'Greenberger & Padesky\'s Mind Over Mood method',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['automatic_thoughts', 'cognitive_distortions', 'hot_thought'],
  issues: ['anxiety', 'low_mood', 'anger', 'guilt_shame', 'social_anxiety'],
  evidenceBase: 'Greenberger, D. & Padesky, C. (2015). Mind Over Mood, 2nd ed.',
  rationale: 'By systematically examining the evidence for and against the "hot thought" (the most emotionally charged automatic thought), you arrive at a more balanced perspective and lower distress.',
  estimatedMinutes: 20,
  icon: 'columns',
  steps: [
    {
      id: 'situation',
      title: '1. Situation',
      instruction: 'Describe the situation: Who? What? When? Where? Stick to observable facts.',
      type: 'multiline',
      placeholder: 'e.g., Waiting for a friend\'s text reply for 3 hours on Tuesday evening.',
    },
    {
      id: 'moods',
      title: '2. Moods (emotions)',
      instruction: 'List the emotions you felt (e.g., anxious, sad, angry). Rate each from 0–100%.',
      type: 'multiline',
      placeholder: 'e.g., Anxious 80%, hurt 60%, angry 30%.',
    },
    {
      id: 'automaticThoughts',
      title: '3. Automatic thoughts (images)',
      instruction: 'What went through your mind? List all automatic thoughts or images. Circle or mark the HOT thought — the one most linked to your strongest emotion.',
      type: 'multiline',
      placeholder: 'e.g., "They\'re ignoring me." / "I must have said something wrong." / "They don\'t want to be friends anymore." [HOT]',
    },
    {
      id: 'evidenceFor',
      title: '4. Evidence supporting the hot thought',
      instruction: 'List factual evidence that supports the hot thought. Be rigorous — feelings are not evidence.',
      type: 'multiline',
      placeholder: 'e.g., They haven\'t replied in 3 hours. They were responsive yesterday.',
    },
    {
      id: 'evidenceAgainst',
      title: '5. Evidence against the hot thought',
      instruction: 'List evidence that does NOT support the hot thought, or that points to an alternative explanation.',
      type: 'multiline',
      placeholder: 'e.g., They mentioned being busy today. They\'ve always replied eventually. We had a good conversation recently.',
    },
    {
      id: 'alternativeThought',
      title: '6. Alternative / balanced thought',
      instruction: 'Write a balanced thought that takes ALL the evidence into account. How much do you believe it (0–100%)?',
      type: 'multiline',
      placeholder: 'e.g., "It\'s possible they\'re just busy. I don\'t have evidence they\'re ignoring me." Belief: 70%.',
    },
    {
      id: 'moodNow',
      title: '7. Re-rate moods',
      instruction: 'Re-rate the emotions from step 2 (0–100%). What emotion do you feel now, and how intense is it?',
      type: 'multiline',
      placeholder: 'e.g., Anxious 40%, hurt 30%, angry 10%. Calmer overall.',
    },
  ],
};

const cbtTripleColumn: Exercise = {
  id: 'cbt-triple-column',
  title: 'Triple Column Technique',
  subtitle: 'Burns\' quick cognitive distortion identifier',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['automatic_thoughts', 'cognitive_distortions'],
  issues: ['low_mood', 'anxiety', 'anger', 'procrastination', 'general'],
  evidenceBase: 'Burns, D.D. (1989). The Feeling Good Handbook.',
  rationale: 'Identifying the cognitive distortion in an automatic thought makes it easier to generate a rational response — you can target the specific logical error.',
  estimatedMinutes: 10,
  icon: 'list',
  steps: [
    {
      id: 'automaticThought',
      title: 'Automatic thought',
      instruction: 'Write the automatic thought that is causing distress — exactly as it sounded.',
      type: 'multiline',
      placeholder: 'e.g., "I always mess things up. I\'m a complete failure."',
    },
    {
      id: 'distortion',
      title: 'Cognitive distortion',
      instruction: 'Which of Burns\' cognitive distortions best fits this thought?',
      type: 'choice',
      options: [
        'All-or-nothing thinking',
        'Overgeneralisation',
        'Mental filter',
        'Discounting the positive',
        'Mind reading',
        'Fortune telling',
        'Magnification / catastrophising',
        'Minimisation',
        'Emotional reasoning',
        'Should statements',
        'Labelling',
        'Personalisation / blame',
      ],
    },
    {
      id: 'rationalResponse',
      title: 'Rational response',
      instruction: 'Write a rational, compassionate response to the automatic thought that corrects the distortion.',
      type: 'multiline',
      placeholder: 'e.g., "I sometimes make mistakes — that\'s true of everyone. Calling myself a complete failure is a label that ignores many things I do well."',
    },
    {
      id: 'beliefBefore',
      title: 'Belief in automatic thought — before (0–100%)',
      instruction: 'How much did you believe the automatic thought?',
      type: 'rating',
      min: 0, max: 100,
    },
    {
      id: 'beliefAfter',
      title: 'Belief in automatic thought — after (0–100%)',
      instruction: 'How much do you believe it now?',
      type: 'rating',
      min: 0, max: 100,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Quick focus-first CBT / TEAM-CBT methods
// ─────────────────────────────────────────────────────────────────────────────

const cbtQuickExamineEvidence: Exercise = {
  id: 'cbt-quick-examine-evidence',
  title: 'Examine the Evidence',
  subtitle: 'Separate observable facts from conclusions',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'cognitive_flexibility'],
  issues: ['anxiety', 'social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'general'],
  evidenceBase: 'Beckian CBT and Burns thought-change methods.',
  rationale: 'A thought can feel convincing while mixing facts, interpretations, and predictions. Sorting the evidence into those categories supports a conclusion that can be checked rather than merely believed.',
  estimatedMinutes: 6,
  icon: 'search',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Thought or belief to examine',
      instruction: 'Use the exact words of the thought or belief you want to test.',
      type: 'multiline',
      placeholder: 'e.g., "They ignored my message because they are upset with me."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate how strongly you believe it before examining the evidence.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'factsFor',
      title: 'Observable facts that support it',
      instruction: 'List only facts another person could verify. Leave out feelings, labels, and guesses about motives.',
      type: 'multiline',
      placeholder: 'e.g., I sent the message yesterday and have not received a reply.',
    },
    {
      id: 'factsAgainst',
      title: 'Facts that do not fit it',
      instruction: 'List facts that point away from the thought or support another explanation.',
      type: 'multiline',
      placeholder: 'e.g., They said this week would be busy, and delayed replies have happened before without conflict.',
    },
    {
      id: 'testableConclusion',
      title: 'A fair, testable conclusion',
      instruction: 'Write a conclusion that includes all the evidence and distinguishes what you know from what you could check.',
      type: 'multiline',
      placeholder: 'e.g., I know they have not replied; I do not yet know why. I can wait until tomorrow or ask directly.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original thought again after reviewing the facts.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickDistortions: Exercise = {
  id: 'cbt-quick-distortions',
  title: 'Identify and Explain the Distortions',
  subtitle: 'Name the thinking error and show how it works here',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['automatic_thoughts', 'cognitive_distortions'],
  issues: ['anxiety', 'social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns cognitive-distortion identification methods.',
  rationale: 'Naming a distortion is most useful when you can explain its exact operation. The aim is not to label yourself; it is to identify what the thought adds, omits, predicts, or exaggerates.',
  estimatedMinutes: 6,
  icon: 'alert-circle',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Thought to inspect',
      instruction: 'Write the thought exactly as it appeared in your mind.',
      type: 'multiline',
      placeholder: 'e.g., "I made one mistake, so I am a complete failure."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate the thought before examining its logic.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'primaryDistortion',
      title: 'Main distortion',
      instruction: 'Choose the distortion doing the most work. You can mention additional ones in the next step.',
      type: 'choice',
      options: [
        'All-or-nothing thinking',
        'Overgeneralisation',
        'Mental filter',
        'Discounting the positive',
        'Mind reading',
        'Fortune telling',
        'Magnification / catastrophising',
        'Minimisation',
        'Emotional reasoning',
        'Should statements',
        'Labelling',
        'Personalisation / blame',
      ],
    },
    {
      id: 'distortionExplanation',
      title: 'How does it operate in this thought?',
      instruction: 'Explain specifically what the thought exaggerates, assumes, leaves out, or turns into a global label. Include any additional distortions you notice.',
      type: 'multiline',
      placeholder: 'e.g., It turns one behavior into a total identity judgment and ignores evidence of things I have done competently.',
    },
    {
      id: 'correctedThought',
      title: 'Correct the distortion',
      instruction: 'Rewrite the thought so it keeps any valid concern without the distorted leap.',
      type: 'multiline',
      placeholder: 'e.g., I made a mistake on this task. That is disappointing, but it does not define my overall ability or worth.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original thought again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickBeSpecific: Exercise = {
  id: 'cbt-quick-be-specific',
  title: 'Be Specific',
  subtitle: 'Replace a sweeping claim with concrete details',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['overgeneralization', 'labeling', 'mental_filter', 'automatic_thoughts'],
  issues: ['social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns specificity method for overgeneralisation and labels.',
  rationale: 'Words such as always, everyone, ruined, and failure compress many different events into one verdict. Specific language makes the real problem smaller, clearer, and more workable.',
  estimatedMinutes: 4,
  icon: 'crosshair',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Sweeping thought or belief',
      instruction: 'Write the broad claim exactly as it sounds.',
      type: 'multiline',
      placeholder: 'e.g., "I always ruin every relationship."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate the broad statement before making it specific.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'concreteDetails',
      title: 'Who, what, when, and where?',
      instruction: 'Replace global words with concrete people, events, behaviors, dates, and context. Note important exceptions.',
      type: 'multiline',
      placeholder: 'e.g., In the last disagreement, I interrupted twice and then ended the call. Two other recent conversations went well.',
    },
    {
      id: 'specificStatement',
      title: 'Write the specific version',
      instruction: 'State the limited, observable problem without a global conclusion about you, others, or the future.',
      type: 'multiline',
      placeholder: 'e.g., I handled one disagreement poorly by interrupting and ending the call; I can apologize and practice staying in the conversation.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original sweeping thought again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickShadesOfGray: Exercise = {
  id: 'cbt-quick-shades-of-gray',
  title: 'Thinking in Shades of Gray',
  subtitle: 'Move a binary judgment onto a realistic continuum',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['all_or_nothing', 'global_rating', 'magnification', 'perfectionism'],
  issues: ['anxiety', 'social_anxiety', 'low_mood', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns continuum method for all-or-nothing thinking.',
  rationale: 'Most performance and personal qualities fall on a continuum, not into perfect-or-worthless categories. Building realistic anchors makes the judgment measurable and less absolute.',
  estimatedMinutes: 5,
  icon: 'sliders',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Binary or global judgment',
      instruction: 'Write the all-or-nothing thought you want to put on a continuum.',
      type: 'multiline',
      placeholder: 'e.g., "If this is not excellent, it is a total failure."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate the original judgment.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'continuumDefinition',
      title: 'Define both ends of the continuum',
      instruction: 'Describe what 0 and 10 would mean using observable criteria rather than labels.',
      type: 'multiline',
      placeholder: 'e.g., 0 = unusable and no goal met. 10 = every requirement met with no meaningful improvement possible.',
    },
    {
      id: 'continuumRating',
      title: 'Where does this actually fall? (0–10)',
      instruction: 'Place this specific event on the continuum, where 0 is the low anchor and 10 is the high anchor.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'grayStatement',
      title: 'Write a shades-of-gray statement',
      instruction: 'Use the rating and concrete strengths or limitations to write a more precise statement.',
      type: 'multiline',
      placeholder: 'e.g., This was about a 6/10: it met the main goal, had two weak sections, and can be improved.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original binary judgment again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickDefineTerms: Exercise = {
  id: 'cbt-quick-define-terms',
  title: 'Define Terms',
  subtitle: 'Test whether a painful label has a coherent meaning',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['labeling', 'global_rating', 'overgeneralization', 'self_criticism'],
  issues: ['social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns semantic method for global labels.',
  rationale: 'Labels often feel factual while remaining vague or impossible to apply consistently. Defining the term operationally reveals whether it describes a behavior or unfairly condemns a whole person.',
  estimatedMinutes: 5,
  icon: 'type',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Label or judgment to define',
      instruction: 'Write the thought containing the painful label.',
      type: 'multiline',
      placeholder: 'e.g., "I am a failure."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate the label before defining it.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'operationalDefinition',
      title: 'Define the key term',
      instruction: 'What observable facts would make the label true? Make the definition precise enough that two people could apply it consistently.',
      type: 'multiline',
      placeholder: 'e.g., Does failure mean one goal was missed, every goal is always missed, or a person has no value?',
    },
    {
      id: 'consistencyTest',
      title: 'Apply the definition consistently',
      instruction: 'Would you use this definition for every other person in the same situation? What examples fit, and what counterexamples do not?',
      type: 'multiline',
      placeholder: 'e.g., I would say a respected colleague had one unsuccessful result, not that the colleague was a failure as a person.',
    },
    {
      id: 'behaviorStatement',
      title: 'Replace the label with a description',
      instruction: 'Describe the specific behavior or outcome while leaving global human worth out of it.',
      type: 'multiline',
      placeholder: 'e.g., I did not meet this deadline. I can examine why and change the next plan.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the label now? (0–10)',
      instruction: 'Rate the original label again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickDoubleStandard: Exercise = {
  id: 'cbt-quick-double-standard',
  title: 'Double-Standard Technique',
  subtitle: 'Offer yourself the same fairness you would offer a friend',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['self_criticism', 'global_rating', 'should_statements', 'guilt_shame'],
  issues: ['anxiety', 'social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns double-standard method for harsh self-criticism.',
  rationale: 'Many people use a harsher rule for themselves than for someone they respect. Applying one fair standard can preserve accountability without humiliation or global self-judgment.',
  estimatedMinutes: 4,
  icon: 'users',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Harsh thought or belief',
      instruction: 'Write what you are saying to yourself.',
      type: 'multiline',
      placeholder: 'e.g., "I should have known better. I am pathetic for struggling with this."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate the harsh thought before changing perspectives.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'friendScenario',
      title: 'Put a respected friend in the same situation',
      instruction: 'Imagine someone you respect did exactly what you did, with the same context and consequences.',
      type: 'multiline',
      placeholder: 'Who is the person, and what happened to them?',
    },
    {
      id: 'friendResponse',
      title: 'What would you honestly say to them?',
      instruction: 'Respond with fairness and accuracy—not empty reassurance. Include responsibility where it belongs.',
      type: 'multiline',
      placeholder: 'e.g., You missed something important, but that does not make you pathetic. Let us understand what happened and repair what we can.',
    },
    {
      id: 'sameStandardResponse',
      title: 'Apply the same standard to yourself',
      instruction: 'Rewrite the response using the same facts, tone, and expectations.',
      type: 'multiline',
      placeholder: 'e.g., I missed something important. I can take responsibility and learn without attacking my entire worth.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original harsh thought again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtQuickCostBenefit: Exercise = {
  id: 'cbt-quick-cost-benefit',
  title: 'Cost-Benefit Analysis',
  subtitle: 'Understand what a belief does for you and what it costs',
  modality: 'both',
  category: 'cognitive_restructuring',
  targetProcesses: ['intermediate_beliefs', 'demandingness', 'avoidance', 'resistance'],
  issues: ['anxiety', 'social_anxiety', 'low_mood', 'anger', 'guilt_shame', 'procrastination', 'perfectionism', 'general'],
  evidenceBase: 'Burns cost-benefit method and collaborative CBT.',
  rationale: 'A painful rule can persist because it offers a real short-term payoff, such as protection, motivation, or certainty. Naming both benefits and costs supports an informed change rather than forcing the belief away.',
  estimatedMinutes: 8,
  icon: 'list',
  quick: true,
  steps: [
    {
      id: 'target',
      title: 'Thought, rule, or belief',
      instruction: 'Write the belief whose advantages and disadvantages you want to understand.',
      type: 'multiline',
      placeholder: 'e.g., "I must avoid mistakes or people will lose respect for me."',
    },
    {
      id: 'beliefBefore',
      title: 'How convincing is it right now? (0–10)',
      instruction: 'Rate how strongly you believe it before reviewing its effects.',
      type: 'rating',
      min: 0, max: 10,
    },
    {
      id: 'shortTermBenefits',
      title: 'Short-term benefits',
      instruction: 'How does holding this belief protect, motivate, prepare, or reassure you right now?',
      type: 'multiline',
      placeholder: 'e.g., It pushes me to check my work and briefly makes uncertainty feel controllable.',
    },
    {
      id: 'longTermBenefits',
      title: 'Longer-term benefits',
      instruction: 'Are there durable advantages, values, or useful standards embedded in the belief?',
      type: 'multiline',
      placeholder: 'e.g., I value reliability and careful work.',
    },
    {
      id: 'shortTermCosts',
      title: 'Short-term costs',
      instruction: 'What distress, avoidance, conflict, delay, or lost energy does the belief create now?',
      type: 'multiline',
      placeholder: 'e.g., I spend hours checking small details and delay asking for feedback.',
    },
    {
      id: 'longTermCosts',
      title: 'Longer-term costs',
      instruction: 'If you keep this exact rule, what may it cost your goals, relationships, health, or flexibility over time?',
      type: 'multiline',
      placeholder: 'e.g., It can lead to burnout and make new challenges feel too risky.',
    },
    {
      id: 'modifiedBelief',
      title: 'Keep the value; modify the rule',
      instruction: 'Write a flexible belief that preserves what is useful without requiring the same cost.',
      type: 'multiline',
      placeholder: 'e.g., I want to work carefully, and mistakes are inevitable. I can use reasonable checks, seek feedback, and correct problems.',
    },
    {
      id: 'beliefAfter',
      title: 'How convincing is the original now? (0–10)',
      instruction: 'Rate the original belief again.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

const cbtDownwardArrow: Exercise = {
  id: 'cbt-downward-arrow',
  title: 'Downward Arrow',
  subtitle: 'Uncover intermediate and core beliefs',
  modality: 'cbt',
  category: 'cognitive_restructuring',
  targetProcesses: ['intermediate_beliefs', 'core_beliefs'],
  issues: ['low_mood', 'anxiety', 'social_anxiety', 'perfectionism'],
  evidenceBase: 'Burns, D.D. (1980). Feeling Good. Freeman, A. & DeWolf, R. (1989).',
  rationale: 'Surface automatic thoughts rest on deeper intermediate and core beliefs. The downward arrow repeatedly asks "What would that mean about me?" to reach the schema driving distress.',
  caution: 'You do not need to complete every arrow step. Stop if this exercise intensifies hopelessness or self-harm thoughts, and use crisis resources or professional support.',
  estimatedMinutes: 12,
  icon: 'arrow-down',
  steps: [
    {
      id: 'surface',
      title: 'Surface automatic thought',
      instruction: 'Start with the automatic thought you noticed. Assume for now it is true. Write it here.',
      type: 'multiline',
      placeholder: 'e.g., "I made a mistake in my presentation."',
    },
    {
      id: 'arrow1',
      title: '↓ If that were true, what would it mean?',
      instruction: 'Ask yourself: "If that were true, what would that mean — about me, my life, or my future?" Write whatever comes to mind.',
      type: 'multiline',
      placeholder: 'e.g., "People will think I\'m incompetent."',
    },
    {
      id: 'arrow2',
      title: '↓ And if that were true, what would it mean?',
      instruction: 'Keep following the chain downward.',
      type: 'multiline',
      placeholder: 'e.g., "I am incompetent."',
    },
    {
      id: 'arrow3',
      title: '↓ And if that were true, what would it mean?',
      instruction: 'Keep going. You may be nearing a core belief.',
      type: 'multiline',
      placeholder: 'e.g., "I am fundamentally worthless / not good enough."',
    },
    {
      id: 'coreBeliefLabel',
      title: 'Core belief theme',
      instruction: 'What theme does the core belief fall into?',
      type: 'choice',
      options: ['Helplessness ("I am powerless")', 'Unlovability ("I am unlovable")', 'Worthlessness ("I am worthless / defective")', 'Other'],
    },
    {
      id: 'evidence',
      title: 'Examine the core belief',
      instruction: 'Now examine this core belief. What evidence supports it? What evidence contradicts it? What would you say to a close friend who held this belief?',
      type: 'multiline',
      placeholder: 'e.g., Evidence against: many people value me; I have succeeded before; one mistake doesn\'t define me.',
    },
    {
      id: 'alternative',
      title: 'Alternative core belief',
      instruction: 'Write a more nuanced, believable alternative to the core belief.',
      type: 'multiline',
      placeholder: 'e.g., "I am a capable person who sometimes makes mistakes — like all humans."',
    },
  ],
};

const cbtBehavioralExperiment: Exercise = {
  id: 'cbt-behavioral-experiment',
  title: 'Behavioral Experiment',
  subtitle: 'Test your beliefs against real-world evidence',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['automatic_thoughts', 'intermediate_beliefs', 'safety_behaviours'],
  issues: ['anxiety', 'social_anxiety', 'procrastination', 'perfectionism'],
  evidenceBase: 'Bennett-Levy, J. et al. (2004). Oxford Guide to Behavioural Experiments in Cognitive Therapy.',
  rationale: 'Beliefs are tested as hypotheses. A carefully designed experiment — with clear predictions and genuine observation — provides experiential evidence that updates beliefs more powerfully than verbal disputation alone.',
  estimatedMinutes: 25,
  icon: 'zap',
  steps: [
    {
      id: 'belief',
      title: 'The belief to test',
      instruction: 'Write the belief or prediction you want to test. Make it as specific as possible.',
      type: 'multiline',
      placeholder: 'e.g., "If I speak up in a meeting, everyone will think I\'m stupid."',
    },
    {
      id: 'beliefRating',
      title: 'Belief strength before (0–100%)',
      instruction: 'How strongly do you believe this right now?',
      type: 'rating',
      min: 0, max: 100,
    },
    {
      id: 'experiment',
      title: 'Design the experiment',
      instruction: 'What specific thing will you do to test this belief? Be precise about what, when, where, and what you will observe.',
      type: 'multiline',
      placeholder: 'e.g., At Tuesday\'s team meeting I will make one comment on the project proposal and observe how people respond.',
    },
    {
      id: 'prediction',
      title: 'Specific prediction',
      instruction: 'What exactly do you predict will happen? (This is what the experiment will test.)',
      type: 'multiline',
      placeholder: 'e.g., At least two people will visibly react negatively, or my manager will dismiss my comment.',
    },
    {
      id: 'safetyBehaviours',
      title: 'Safety behaviours to drop',
      instruction: 'List any safety behaviours you usually use (e.g., over-preparing, speaking very quietly, keeping it vague). Write them here so you can consciously reduce them during the experiment.',
      type: 'multiline',
      placeholder: 'e.g., Usually rehearse comment 10 times; will only read it once and then speak.',
    },
    {
      id: 'outcome',
      title: 'What actually happened?',
      instruction: 'After the experiment: describe exactly what happened. Be specific and observable.',
      type: 'multiline',
      placeholder: 'e.g., I made a comment about the timeline. Two people nodded; one asked a follow-up question. Nobody looked dismissive.',
    },
    {
      id: 'conclusion',
      title: 'What does this mean for the belief?',
      instruction: 'What did the evidence show? How should you update the belief?',
      type: 'multiline',
      placeholder: 'e.g., My prediction did not come true. People engaged constructively. I can update to: "Speaking up is usually fine and sometimes helpful."',
    },
    {
      id: 'beliefAfter',
      title: 'Belief strength after (0–100%)',
      instruction: 'How strongly do you believe the original belief now?',
      type: 'rating',
      min: 0, max: 100,
    },
  ],
};

// ─────────────────────────────────────────────
// Behavioral / Transdiagnostic Exercises
// ─────────────────────────────────────────────

const behavioralActivation: Exercise = {
  id: 'beh-activation',
  title: 'Behavioral Activation',
  subtitle: 'Values-based activity scheduling for low mood',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['avoidance', 'withdrawal', 'anhedonia'],
  issues: ['low_mood', 'procrastination', 'general'],
  evidenceBase: 'Martell, C., Addis, M., & Jacobson, N. (2001). Depression in Context: Strategies for Guided Action.',
  rationale: 'Withdrawal from meaningful activities deepens and maintains low mood. Scheduling valued activities — including both mastery (achievement) and pleasure tasks — breaks the cycle by reconnecting you with life.',
  caution: 'Start with very small steps. If mood is severely low, you have self-harm thoughts, or increased activity feels unusually driven or unsafe, contact a clinician or crisis service instead of pushing a full schedule.',
  estimatedMinutes: 15,
  icon: 'calendar',
  steps: [
    {
      id: 'values',
      title: 'Life values',
      instruction: 'List 3–5 areas of life that matter to you when you are at your best (e.g., relationships, creativity, fitness, learning, work, nature).',
      type: 'multiline',
      placeholder: 'e.g., Family, music, physical health, learning.',
    },
    {
      id: 'avoidedActivities',
      title: 'Avoided activities',
      instruction: 'What activities connected to those values have you been avoiding or reducing because of low mood?',
      type: 'multiline',
      placeholder: 'e.g., Playing guitar, calling my sister, going for morning walks.',
    },
    {
      id: 'masteryActivities',
      title: 'Mastery activities (achievable)',
      instruction: 'Choose 2–3 small, achievable activities that give a sense of accomplishment (not necessarily pleasure). Schedule them this week.',
      type: 'multiline',
      placeholder: 'e.g., Monday: clean desk (10 min). Wednesday: reply to one email. Friday: 15-min walk.',
    },
    {
      id: 'pleasureActivities',
      title: 'Pleasure activities',
      instruction: 'Choose 1–2 activities that you used to enjoy (even if they seem unappealing right now). Schedule them.',
      type: 'multiline',
      placeholder: 'e.g., Saturday afternoon: listen to one album I used to love.',
    },
    {
      id: 'moodBefore',
      title: 'Mood before activities (0–10)',
      instruction: 'Rate your mood right now before doing any of these activities.',
      type: 'mood',
      min: 0, max: 10,
    },
    {
      id: 'activityLog',
      title: 'Activity log',
      instruction: 'After completing the scheduled activities, describe what you did and how you felt during and after each one.',
      type: 'multiline',
      placeholder: 'e.g., Monday walk: mood was 3/10 before, 5/10 after. Surprised it helped a little.',
    },
    {
      id: 'moodAfter',
      title: 'Mood after activities (0–10)',
      instruction: 'Rate your overall mood now, after completing the activities.',
      type: 'mood',
      min: 0, max: 10,
    },
    {
      id: 'learning',
      title: 'What did you learn?',
      instruction: 'What does this week\'s experiment teach you about the relationship between action and mood?',
      type: 'multiline',
      placeholder: 'e.g., Even when I didn\'t feel like doing anything, doing the walk slightly lifted my mood — motivation follows action.',
    },
  ],
};

const exposureHierarchy: Exercise = {
  id: 'beh-exposure-hierarchy',
  title: 'Fear Hierarchy Builder',
  subtitle: 'Create a graded exposure ladder for anxiety',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['avoidance', 'safety_behaviours', 'fear'],
  issues: ['anxiety', 'social_anxiety'],
  evidenceBase: 'Craske, M.G. & Barlow, D.H. (2008). Panic Disorder and Agoraphobia. In Barlow, D.H. (Ed.), Clinical Handbook of Psychological Disorders.',
  rationale: 'Graded exposure involves approaching feared situations in a stepwise way, from least to most feared, while remaining long enough for habituation (or inhibitory learning) to occur. You do NOT need to feel completely comfortable — tolerance, not comfort, is the goal.',
  estimatedMinutes: 15,
  caution: 'If you have OCD, work with a therapist trained in ERP before attempting exposure. Do not use distraction or reassurance-seeking during exposure — this prevents learning.',
  icon: 'trending-up',
  steps: [
    {
      id: 'fearTarget',
      title: 'What are you afraid of?',
      instruction: 'Describe the situation, object, or experience you avoid because of fear or anxiety.',
      type: 'multiline',
      placeholder: 'e.g., Speaking in groups; being far from an exit; driving on motorways.',
    },
    {
      id: 'worstFear',
      title: 'The catastrophic prediction',
      instruction: 'What is the worst thing you fear would happen if you fully faced this situation?',
      type: 'multiline',
      placeholder: 'e.g., "I will have a panic attack and completely humiliate myself."',
    },
    {
      id: 'step1',
      title: 'Step 1 — Easiest (SUDS 20–30)',
      instruction: 'Describe the least frightening exposure step. Rate predicted SUDS (0–100).',
      type: 'multiline',
      placeholder: 'e.g., Say hello to a cashier. SUDS: 25.',
    },
    {
      id: 'step2',
      title: 'Step 2 (SUDS ~40)',
      instruction: 'Slightly harder step.',
      type: 'multiline',
      placeholder: 'e.g., Ask a shop assistant for help finding something. SUDS: 40.',
    },
    {
      id: 'step3',
      title: 'Step 3 (SUDS ~50)',
      instruction: '',
      type: 'multiline',
      placeholder: 'e.g., Make a brief comment in a small meeting. SUDS: 50.',
    },
    {
      id: 'step4',
      title: 'Step 4 (SUDS ~60)',
      instruction: '',
      type: 'multiline',
      placeholder: '',
    },
    {
      id: 'step5',
      title: 'Step 5 — Hardest (SUDS ~80+)',
      instruction: 'Describe the most challenging step — the ultimate exposure goal.',
      type: 'multiline',
      placeholder: 'e.g., Give a 5-minute presentation to 15 colleagues. SUDS: 85.',
    },
    {
      id: 'safetyBehaviours',
      title: 'Safety behaviours to drop',
      instruction: 'List any safety behaviours you use during exposure that reduce learning (e.g., looking at phone, keeping arms crossed, over-preparing, seeking reassurance).',
      type: 'multiline',
      placeholder: 'e.g., Looking at the floor; rehearsing everything I\'ll say beforehand.',
    },
  ],
};

const exposureSession: Exercise = {
  id: 'beh-exposure-session',
  title: 'Graded Exposure Session',
  subtitle: 'Track a single exposure practice',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['avoidance', 'fear'],
  issues: ['anxiety', 'social_anxiety'],
  evidenceBase: 'Craske, M.G. (2015). Optimizing Inhibitory Learning During Exposure Therapy. Behaviour Research and Therapy.',
  rationale: 'Graded exposure means approaching feared situations step by step, long enough to test a prediction and learn that anxiety can be tolerated. Learning can occur even when anxiety does not fully drop during practice.',
  estimatedMinutes: 30,
  caution: 'Stop immediately if you are in real danger, become dissociated, or feel unsafe. Exposure is optional self-help practice, not a requirement. For OCD, trauma-related symptoms, or panic with medical concerns, work with a trained clinician first. Reduce safety behaviours when appropriate, but never force yourself to stay.',
  icon: 'clock',
  steps: [
    {
      id: 'exposureStep',
      title: 'Which hierarchy step are you practising?',
      instruction: 'Describe the specific exposure you are about to do.',
      type: 'multiline',
      placeholder: 'e.g., Step 3: make a comment in the team stand-up meeting.',
    },
    {
      id: 'predictedSUDS',
      title: 'Predicted peak SUDS (0–100)',
      instruction: 'How high do you expect your distress to go?',
      type: 'suds',
      min: 0, max: 100,
    },
    {
      id: 'prediction',
      title: 'What do you predict will happen?',
      instruction: 'Write your feared outcome (what you think will happen).',
      type: 'multiline',
      placeholder: 'e.g., I will go blank, stutter, and everyone will stare at me awkwardly.',
    },
    {
      id: 'peakSUDS',
      title: 'Peak SUDS during exposure',
      instruction: 'After the exposure: what was the highest SUDS you felt?',
      type: 'suds',
      min: 0, max: 100,
    },
    {
      id: 'endSUDS',
      title: 'SUDS at end of exposure',
      instruction: 'What was your SUDS when you finished?',
      type: 'suds',
      min: 0, max: 100,
    },
    {
      id: 'whatHappened',
      title: 'What actually happened?',
      instruction: 'Describe what occurred. Did your feared prediction come true?',
      type: 'multiline',
      placeholder: 'e.g., I made my comment. There was a brief pause, then my manager nodded and moved on. No one stared.',
    },
    {
      id: 'learning',
      title: 'What did you learn?',
      instruction: 'What does this exposure teach you? How does it update your feared prediction?',
      type: 'multiline',
      placeholder: 'e.g., I tolerated high anxiety and it came down. The catastrophe did not happen. I can do this again.',
    },
  ],
};

const problemSolving: Exercise = {
  id: 'beh-problem-solving',
  title: 'Problem Solving',
  subtitle: 'Structured approach to real-world difficulties',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['avoidance', 'rumination'],
  issues: ['anxiety', 'procrastination', 'general', 'low_mood'],
  evidenceBase: 'D\'Zurilla, T.J. & Nezu, A.M. (2007). Problem-Solving Therapy: A Positive Approach to Clinical Intervention.',
  rationale: 'Rumination recycles problems without resolving them. Structured problem solving moves from vague worry to concrete action, reducing distress and building self-efficacy.',
  estimatedMinutes: 15,
  icon: 'tool',
  steps: [
    {
      id: 'problem',
      title: 'Define the problem',
      instruction: 'Describe the problem in specific, concrete terms. Avoid vague language ("everything is falling apart"). What exactly is the situation?',
      type: 'multiline',
      placeholder: 'e.g., I have three assignments due next week and have not started any of them.',
    },
    {
      id: 'goal',
      title: 'Define the goal',
      instruction: 'What would a good outcome look like? Be specific and realistic.',
      type: 'multiline',
      placeholder: 'e.g., Complete at least two assignments to a "good enough" standard by Friday.',
    },
    {
      id: 'brainstorm',
      title: 'Brainstorm solutions',
      instruction: 'List as many solutions as you can — include silly ones. Don\'t evaluate yet, just generate.',
      type: 'multiline',
      placeholder: 'e.g., 1) Start with the easiest. 2) Ask for an extension. 3) Work 2h each morning. 4) Hire a tutor. 5) Drop one assignment. ...',
    },
    {
      id: 'evaluate',
      title: 'Evaluate and choose',
      instruction: 'Review your list. Which solution is most feasible and likely to achieve the goal? Why?',
      type: 'multiline',
      placeholder: 'e.g., Option 3 — working 2h each morning — is realistic and achievable without extra help.',
    },
    {
      id: 'action',
      title: 'Action plan',
      instruction: 'Break the chosen solution into specific steps. Who, what, when, where.',
      type: 'multiline',
      placeholder: 'e.g., Mon: 8–10am, assignment 1 intro. Tue: 8–10am, assignment 1 body. Wed: assignment 2 draft...',
    },
    {
      id: 'review',
      title: 'Review',
      instruction: 'After implementing the plan: what happened? What would you do differently next time?',
      type: 'multiline',
      placeholder: 'e.g., Completed assignments 1 and 2. Assignment 3 needed extension — I asked for one and it was granted.',
    },
  ],
};

const worryPostponement: Exercise = {
  id: 'beh-worry-postponement',
  title: 'Worry Postponement',
  subtitle: 'Stimulus-control for rumination and worry',
  modality: 'both',
  category: 'behavioral',
  targetProcesses: ['rumination', 'worry'],
  issues: ['anxiety', 'procrastination', 'general'],
  evidenceBase: 'Borkovec, T.D., Wilkinson, L., Folensbee, R., & Lerman, C. (1983). Stimulus control applications to the treatment of worry. Behaviour Research and Therapy.',
  rationale: 'By confining worry to a specific daily "worry window," you gain control over when you engage with anxious thoughts, preventing them from contaminating the rest of your day.',
  estimatedMinutes: 8,
  icon: 'clock',
  steps: [
    {
      id: 'worryWindow',
      title: 'Set your worry window',
      instruction: 'Choose a specific 15–30 minute slot each day for worry — same time, same place. NOT close to bedtime. Write it here.',
      type: 'text',
      placeholder: 'e.g., 5:00–5:20pm, at my desk.',
    },
    {
      id: 'instructions',
      title: 'How worry postponement works',
      instruction: 'When a worry arises outside your worry window:\n1. Notice the thought.\n2. Write it briefly on a notepad (or here).\n3. Remind yourself: "I will deal with this at 5pm."\n4. Return to what you were doing.\n\nDuring the worry window: worry deliberately. After the window: stop, even if worries remain.',
      type: 'info',
    },
    {
      id: 'worriesLogged',
      title: 'Worries postponed today',
      instruction: 'List the worries you postponed today (brief notes only).',
      type: 'multiline',
      placeholder: 'e.g., "What if I fail the interview?" / "Money situation."',
    },
    {
      id: 'windowReview',
      title: 'Worry window review',
      instruction: 'After your worry window: which worries still feel important? Which resolved themselves? What action (if any) is needed?',
      type: 'multiline',
      placeholder: 'e.g., Interview worry: I can prepare one practice answer tonight — that\'s all I can do. Money: already handled.',
    },
    {
      id: 'effectRating',
      title: 'How well did postponement work today? (0–10)',
      instruction: '0 = didn\'t work at all, 10 = worked perfectly.',
      type: 'rating',
      min: 0, max: 10,
    },
  ],
};

// ─────────────────────────────────────────────
// Full catalog
// ─────────────────────────────────────────────

export const EXERCISE_CATALOG: Exercise[] = [
  // REBT
  rebtAbcde,
  rebtShameAttacking,
  rebtRationalImagery,
  rebtRationalCards,
  // CBT
  cbtThoughtRecord7,
  cbtTripleColumn,
  cbtQuickExamineEvidence,
  cbtQuickDistortions,
  cbtQuickBeSpecific,
  cbtQuickShadesOfGray,
  cbtQuickDefineTerms,
  cbtQuickDoubleStandard,
  cbtQuickCostBenefit,
  cbtDownwardArrow,
  cbtBehavioralExperiment,
  // Behavioral / both
  behavioralActivation,
  exposureHierarchy,
  exposureSession,
  problemSolving,
  worryPostponement,
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISE_CATALOG.find((e) => e.id === id);
}

export function getExercisesForModality(modality: 'rebt' | 'cbt'): Exercise[] {
  return EXERCISE_CATALOG.filter(
    (e) => e.modality === modality || e.modality === 'both'
  );
}

export function getExercisesByIssue(issue: Issue): Exercise[] {
  return EXERCISE_CATALOG.filter((e) => e.issues.includes(issue));
}

export const ISSUE_LABELS: Record<Issue, string> = {
  anxiety: 'Anxiety',
  social_anxiety: 'Social Anxiety',
  low_mood: 'Low Mood',
  anger: 'Anger',
  guilt_shame: 'Guilt / Shame',
  procrastination: 'Procrastination',
  perfectionism: 'Perfectionism',
  general: 'General',
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  cognitive_restructuring: 'Cognitive',
  behavioral: 'Behavioural',
  imagery: 'Imagery',
  psychoeducation: 'Psychoeducation',
};
