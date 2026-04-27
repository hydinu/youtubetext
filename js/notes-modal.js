// ══════════════════════════════════════════════════
// notes-modal.js — AI Study Notes modal logic
// Depends on: config.js, utils.js
// ══════════════════════════════════════════════════

let currentNotesData = null;   // Stores the notes for PDF export
let notesGenerating  = false;  // Prevents double-clicks

/**
 * Request AI study notes for a video from the backend.
 * @param {string} videoUrl  - Full YouTube URL
 * @param {string} videoTitle - Title for the modal header
 */
async function generateStudyNotes(videoUrl, videoTitle) {
  if (notesGenerating) return;
  notesGenerating = true;

  // Show the notes modal in loading state
  openNotesModal(videoTitle, null, true);

  try {
    const res = await fetch(`${BACKEND_URL}/api/generate-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    currentNotesData = data;

    // Re-render modal with actual content
    openNotesModal(data.video_title || videoTitle, data.notes, false);

  } catch (err) {
    console.error('Notes generation error:', err);
    showNotesError(err.message);
  } finally {
    notesGenerating = false;
  }
}

/** Open notes modal by video index (called from card button) */
function generateNotesByIndex(index) {
  const video = cachedVideos[index];
  if (!video) return;
  generateStudyNotes(video.link, video.title);
}

/**
 * Open / update the notes modal.
 * @param {string}  title    - Video title
 * @param {Array}   notes    - Array of note sections (null if loading)
 * @param {boolean} loading  - Show skeleton loader
 */
function openNotesModal(title, notes, loading) {
  const overlay = document.getElementById('notes-modal-overlay');
  const content = document.getElementById('notes-modal-content');
  const titleEl = document.getElementById('notes-modal-title');
  const bodyEl  = document.getElementById('notes-modal-body');
  const pdfBtn  = document.getElementById('notes-pdf-btn');

  titleEl.textContent = title;

  if (loading) {
    pdfBtn.classList.add('hidden');
    bodyEl.innerHTML = renderNotesLoading();
  } else if (notes && notes.length > 0) {
    pdfBtn.classList.remove('hidden');
    bodyEl.innerHTML = renderNotesSections(notes);
  } else {
    pdfBtn.classList.add('hidden');
    bodyEl.innerHTML = `<p class="text-slate-500 text-center py-8">No notes could be generated for this video.</p>`;
  }

  // Show modal
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    content.classList.remove('opacity-0', 'translate-y-10');
    content.classList.add('opacity-100', 'translate-y-0');
  });
}

/** Show an error inside the notes modal */
function showNotesError(message) {
  const bodyEl = document.getElementById('notes-modal-body');
  const pdfBtn = document.getElementById('notes-pdf-btn');
  pdfBtn.classList.add('hidden');

  bodyEl.innerHTML = `
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <div class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      </div>
      <h3 class="text-base font-bold text-white mb-2">Failed to generate notes</h3>
      <p class="text-sm text-slate-500 max-w-sm">${message}</p>
    </div>`;
}

/** Close the notes modal */
function closeNotesModal() {
  const overlay = document.getElementById('notes-modal-overlay');
  const content = document.getElementById('notes-modal-content');

  content.classList.remove('opacity-100', 'translate-y-0');
  content.classList.add('opacity-0', 'translate-y-10');
  setTimeout(() => {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }, 300);
}

/** Render skeleton loading state for notes */
function renderNotesLoading() {
  const skeletons = Array.from({ length: 4 }, (_, i) => `
    <div class="notes-skeleton-section animate-fade-in" style="animation-delay: ${i * 0.1}s">
      <div class="flex items-center gap-3 mb-3">
        <div class="skeleton w-16 h-6 rounded-lg"></div>
        <div class="skeleton w-40 h-5 rounded"></div>
      </div>
      <div class="space-y-2 pl-6">
        <div class="skeleton w-full h-4 rounded"></div>
        <div class="skeleton w-4/5 h-4 rounded"></div>
        <div class="skeleton w-3/5 h-4 rounded"></div>
      </div>
    </div>
  `).join('');

  return `
    <div class="flex items-center gap-3 mb-6">
      <div class="w-3 h-3 rounded-full bg-brand-500 animate-pulse-slow"></div>
      <p class="text-sm text-slate-400">Fetching transcript & generating AI study notes…</p>
    </div>
    <div class="space-y-6">${skeletons}</div>`;
}

/** Render the notes sections as beautiful timestamped cards */
function renderNotesSections(notes) {
  const sections = notes.map((note, i) => {
    // Convert bullet points: lines starting with • or - get styled
    const contentHtml = note.content
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const text = trimmed.replace(/^[•\-\*]\s*/, '');
          return `<li class="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
            <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span>
            <span>${text}</span>
          </li>`;
        }
        if (trimmed.length === 0) return '';
        return `<li class="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0"></span>
          <span>${trimmed}</span>
        </li>`;
      })
      .filter(Boolean)
      .join('');

    return `
    <div class="notes-section animate-fade-in-up" style="animation-delay: ${i * 0.06}s">
      <div class="flex items-center gap-3 mb-3">
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-300 text-xs font-mono font-bold">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${note.timestamp}
        </span>
        <h4 class="text-sm font-bold text-white">${note.section_title}</h4>
      </div>
      <ul class="space-y-1.5 pl-1">${contentHtml}</ul>
    </div>`;
  }).join('');

  return `
    <div class="flex items-center gap-3 mb-5">
      <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
      <p class="text-sm text-slate-400">Generated <span class="text-white font-semibold">${notes.length}</span> sections of study notes</p>
    </div>
    <div class="space-y-5 divide-y divide-white/5 [&>*+*]:pt-5">${sections}</div>`;
}
