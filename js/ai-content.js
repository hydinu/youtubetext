// ══════════════════════════════════════════════════
// ai-content.js — Generates study content from
// video title & description. In production, replace
// this with a call to an LLM API (Grok, GPT, etc.)
// ══════════════════════════════════════════════════

/**
 * Generate AI-style study content from video metadata.
 * @param {string} title       - Video title
 * @param {string} description - Video description
 * @param {string} topic       - User's search query
 * @returns {Object} ai_content object with summary, key_concepts, explanation, quiz
 */
function generateAIContent(title, description, topic) {
  // Clean up the description
  const cleanDesc = description
    .replace(/https?:\/\/\S+/g, '')   // Remove URLs
    .replace(/[\n\r]+/g, ' ')         // Collapse newlines
    .replace(/\s{2,}/g, ' ')          // Collapse extra spaces
    .trim();

  // Extract key phrases by word frequency
  const allText = (title + ' ' + cleanDesc).toLowerCase();
  const words = allText.split(/\W+/).filter(w => w.length > 3);

  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(e => e[0]);

  // Filter out common stop-words
  const stops = new Set([
    'this','that','with','from','have','will','your','what','about','been',
    'they','their','more','when','also','than','them','some','into','each',
    'make','like','just','over','only','such','very','most','even','does',
    'through','after','these','would','could','other','which','those','then',
    'first','where','before','should','still','being'
  ]);
  const keywords = topWords.filter(w => !stops.has(w));

  // Build key concepts (capitalize nicely)
  const keyConcepts = keywords.slice(0, 7).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  );

  // Build summary from description
  const summaryBase = cleanDesc.length > 30
    ? cleanDesc.substring(0, 350).replace(/\s\S*$/, '') + '...'
    : `This video covers ${topic} in an educational and student-friendly format. Watch to learn the core concepts, explanations, and practical examples related to this topic.`;

  const summary = `📚 "${title}" — ${summaryBase}`;

  // Build student-friendly explanation
  const explanation = cleanDesc.length > 50
    ? `This video is about ${topic}. Here's what you'll learn:\n\n${cleanDesc.substring(0, 600).replace(/\s\S*$/, '')}...\n\nThe video breaks down complex ideas into simpler parts, making it great for students who are just starting to learn about ${topic}. Pay attention to the examples and try to relate them to what you already know!`
    : `This video teaches you about ${topic} in a clear, easy-to-follow way. It covers the fundamental concepts and builds up to more advanced ideas step by step. Great for students who want a solid foundation in ${topic}. Take notes while watching and pause at key moments to test your understanding!`;

  // Generate quiz questions
  const quizQuestions = [
    `What are the main concepts covered in "${title}"?`,
    `Explain the most important idea from this video about ${topic} in your own words.`,
    `How does ${topic} apply to real-world scenarios? Give an example.`,
    `What are the key terms or vocabulary related to ${topic} mentioned in this video?`,
    `If you had to teach ${topic} to a friend, what would you emphasize based on this video?`
  ];

  return {
    summary,
    key_concepts: keyConcepts.length > 0 ? keyConcepts : [topic, 'Fundamentals', 'Examples', 'Practice', 'Review'],
    explanation_for_students: explanation,
    quiz_questions: quizQuestions,
  };
}
