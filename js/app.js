// ══════════════════════════════════════════════════
// app.js — Main entry point & event listeners
// Depends on: config.js, utils.js, ai-content.js,
//             api.js, ui.js, modal.js
// ══════════════════════════════════════════════════

// Global state for cached video data (used by modal)
let cachedVideos = [];


// ── SEARCH LOGIC ─────────────────────────────────

/** Run a YouTube search for the given topic */
async function searchTopic(topic) {
  if (!topic.trim()) return;

  const searchBtn = document.getElementById('search-btn');
  renderLoading();
  searchBtn.disabled = true;

  try {
    const data = await fetchYouTubeVideos(topic.trim());
    renderResults(data);
  } catch (err) {
    console.error('Search error:', err);
    renderError(`YouTube API Error: ${err.message}. Please check your API key or try again later.`);
  } finally {
    searchBtn.disabled = false;
  }
}

/** Quick search from suggestion buttons */
function quickSearch(topic) {
  const searchInput = document.getElementById('search-input');
  searchInput.value = topic;
  searchTopic(topic);
}


// ── EVENT LISTENERS (run after DOM is ready) ─────

document.addEventListener('DOMContentLoaded', () => {

  // Search form submission
  const searchForm = document.getElementById('search-form');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const searchInput = document.getElementById('search-input');
    searchTopic(searchInput.value);
  });

  // ── AI Content Modal ──────────────────────────
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-close-btn-footer').addEventListener('click', closeModal);

  const modalOverlay = document.getElementById('modal-overlay');
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // ── Study Notes Modal ────────────────────────
  document.getElementById('notes-modal-close-btn').addEventListener('click', closeNotesModal);
  document.getElementById('notes-modal-close-footer').addEventListener('click', closeNotesModal);

  const notesOverlay = document.getElementById('notes-modal-overlay');
  notesOverlay.addEventListener('click', (e) => {
    if (e.target === notesOverlay) closeNotesModal();
  });

  // PDF download button
  document.getElementById('notes-pdf-btn').addEventListener('click', downloadNotesAsPDF);

  // Close any open modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modalOverlay.classList.contains('hidden')) closeModal();
      if (!notesOverlay.classList.contains('hidden')) closeNotesModal();
    }
  });

  // Modal tab switching
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  // Copy to Notes button
  document.getElementById('copy-notes-btn').addEventListener('click', async () => {
    const text = buildNotesText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Notes copied to clipboard!');
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('📋 Notes copied to clipboard!');
    }
  });

});
