// ============================================================
//  api/prompts.js
//  Builds the system + user prompts for each test type.
//  Moved server-side so the frontend never touches AI logic.
// ============================================================

function buildSystemPrompt(type) {
  const base = `You are an expert exam question creator for a study app called testyAI.
You must respond with ONLY a valid JSON object in the exact schema provided.
No markdown, no explanation, no code fences — raw JSON only.
The root key must be "questions" containing an array.

CRITICAL INSTRUCTIONS FOR SUBJECT & TOPICS:
1. Academic Subject Identification & Multiple Documents:
   - If the study material contains multiple documents (marked with "=== DOCUMENT: ... ===") or covers multiple distinct subjects (e.g., English Grammar and Machine Learning), you MUST differentiate the subject for EACH question individually.
   - Distribute the questions fairly across all provided documents and subjects.
2. For each question, provide:
   - "subject": The overarching academic subject name (concise, 1-3 words, e.g., "English", "Machine Learning", "Mathematics", "Physics"). Never use vague words like "General", "Notes", or "Miscellaneous".
   - "topic": A specific, standard subtopic within that subject (e.g., "Prepositions", "Dimensionality Reduction", "Calculus").
3. Group questions into 2-4 consistent, cohesive subtopics per subject so student mastery can be tracked accurately. Do not create an isolated unique topic for every question.`;

  const rules = {
    flashcard: `Each flashcard must have:
- "front": a concise question or term (1-2 sentences max)
- "back": a clear, accurate answer (1-3 sentences)
- "subject": overarching academic subject
- "topic": specific topic within that subject`,

    mcq: `Each MCQ must have:
- "question": a clear, unambiguous exam question
- "options": exactly 4 strings, formatted as "A. ...", "B. ...", "C. ...", "D. ..."
- "answer": exactly one of "A", "B", "C", or "D" (the correct option)
- "explanation": a brief explanation of why the answer is correct
- "subject": overarching academic subject
- "topic": specific topic within that subject
Rules: Only ONE answer is correct. Do not reuse similar answer choices.`,

    long: `Each long-answer question must have:
- "question": a clean exam-style question (no marks in brackets, no asterisks)
- "answer": a structured model answer with numbered points (no markdown, plain text)
- "keyPoints": array of 3-5 short hint strings (not full sentences)
- "subject": overarching academic subject
- "topic": specific topic within that subject
Rules: No marks notation, no "Key points to cover", no stars (*).`
  };

  return `${base}\n\n${rules[type]}`;
}

function buildUserPrompt(type, count, difficulty, notes) {
  const typeLabel = {
    flashcard: 'flashcards',
    mcq: 'multiple choice questions (MCQs)',
    long: 'long-answer exam questions'
  }[type];

  return `Generate exactly ${count} ${typeLabel} at ${difficulty} difficulty level.

Study notes to use as source material:
---
${notes.slice(0, 12000)}
---

Return a JSON object with key "questions" containing exactly ${count} items.`;
}

module.exports = { buildSystemPrompt, buildUserPrompt };
