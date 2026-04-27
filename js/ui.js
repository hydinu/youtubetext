// ══════════════════════════════════════════════════
// ui.js — Render functions (loading, cards, states)
// Depends on: utils.js
// ══════════════════════════════════════════════════

/** Render skeleton loading cards */
function renderLoading() {
  const container = document.getElementById('results-container');
  const skeletons = Array.from({ length: 6 }, (_, i) => `
    <div class="rounded-2xl overflow-hidden border border-white/5 bg-surface-800 animate-fade-in stagger-${i + 1}">
      <div class="skeleton w-full aspect-video"></div>
      <div class="p-5 space-y-3">
        <div class="skeleton h-5 w-4/5 rounded"></div>
        <div class="skeleton h-4 w-3/5 rounded"></div>
        <div class="flex gap-3 mt-4">
          <div class="skeleton h-10 flex-1 rounded-xl"></div>
          <div class="skeleton h-10 flex-1 rounded-xl"></div>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="mt-8 mb-4 flex items-center gap-3">
      <div class="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse-slow"></div>
      <p class="text-sm text-slate-400">Searching YouTube for the best educational content…</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      ${skeletons}
    </div>`;
}

/** Render the "no results" empty state */
function renderEmpty() {
  const container = document.getElementById('results-container');
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 animate-fade-in-up text-center">
      <div class="w-24 h-24 rounded-full bg-surface-800 border border-white/5 flex items-center justify-center mb-6">
        <svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.773 4.773zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-2">No results found</h3>
      <p class="text-slate-500 max-w-sm">We couldn't find educational videos for that topic. Try a different search term!</p>
    </div>`;
}

/** Render an error state */
function renderError(message) {
  const container = document.getElementById('results-container');
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24 animate-fade-in-up text-center">
      <div class="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <svg class="w-12 h-12 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
      </div>
      <h3 class="text-xl font-bold text-white mb-2">Something went wrong</h3>
      <p class="text-slate-500 max-w-sm">${message}</p>
    </div>`;
}

/** Render video result cards */
function renderResults(data) {
  const container = document.getElementById('results-container');

  if (!data.videos || data.videos.length === 0) {
    renderEmpty();
    return;
  }

  // Cache videos globally for modal access
  cachedVideos = data.videos;

  const cards = data.videos.map((v, i) => {
    const safeTitle = v.title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    return `
    <div class="card-glow rounded-2xl overflow-hidden border border-white/5 bg-surface-800 flex flex-col opacity-0 animate-fade-in-up stagger-${Math.min(i + 1, 5)}">
      <!-- Thumbnail -->
      <a href="${v.link}" target="_blank" rel="noopener noreferrer" class="relative block group">
        <img src="${v.thumbnail}" alt="${safeTitle}" class="w-full aspect-video object-cover bg-surface-700" loading="lazy" />
        <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div class="w-14 h-14 rounded-full bg-brand-600/90 flex items-center justify-center shadow-xl">
            <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-xs font-semibold">${v.duration}</span>
      </a>

      <!-- Card Body -->
      <div class="flex flex-col flex-1 p-5">
        <h3 class="text-sm font-bold text-white leading-snug line-clamp-2 mb-2">${v.title}</h3>
        <p class="text-xs text-brand-400 font-medium mb-1">${v.channel}</p>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <span>${formatDate(v.published_at)}</span>
          <span class="w-1 h-1 rounded-full bg-slate-600"></span>
          <span>${formatViews(v.view_count)} views</span>
        </div>

        <!-- Buttons -->
        <div class="mt-auto space-y-2">
          <div class="flex gap-2">
            <a href="${v.link}" target="_blank" rel="noopener noreferrer"
               class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs sm:text-sm font-semibold transition-colors"
               id="watch-btn-${v.video_id}">
              <svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 00-2.1-2.15C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.55A3 3 0 00.5 6.2 31.9 31.9 0 000 12a31.9 31.9 0 00.5 5.8 3 3 0 002.1 2.15c1.9.55 9.4.55 9.4.55s7.5 0 9.4-.55a3 3 0 002.1-2.15A31.9 31.9 0 0024 12a31.9 31.9 0 00-.5-5.8z"/><path fill="#fff" d="M9.75 15.02l6.25-3.52-6.25-3.52v7.04z"/></svg>
              Watch
            </a>
            <button
              onclick="openModalByIndex(${i})"
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-600/20 hover:bg-brand-600/40 text-brand-300 hover:text-brand-200 text-xs sm:text-sm font-semibold transition-colors"
              id="ai-btn-${v.video_id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>
              AI Content
            </button>
          </div>
          <button
            onclick="generateNotesByIndex(${i})"
            class="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/10 hover:border-emerald-500/25 text-emerald-300 hover:text-emerald-200 text-xs sm:text-sm font-semibold transition-all"
            id="notes-btn-${v.video_id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            📝 Generate AI Study Notes
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="mt-8 mb-5 flex items-center gap-3 animate-fade-in">
      <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
      <p class="text-sm text-slate-400">Found <span class="text-white font-semibold">${data.videos.length}</span> educational videos for "<span class="text-brand-300 font-semibold">${data.topic}</span>"</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      ${cards}
    </div>`;
}
