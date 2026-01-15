// --- ГЕНЕРАЦИЯ КАРТОЧКИ ---
export function createPostCard(post) {
    // Форматируем дату создания
    const createdDate = new Date(post.created_at).toLocaleDateString();
    const safeId = post.id;

    // Форматируем дату запланированной публикации (если есть)
    let scheduleBadge = '';
    if (post.scheduled_time) {
        const schedDate = new Date(post.scheduled_time);
        const dateStr = schedDate.toLocaleDateString();
        const timeStr = schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        scheduleBadge = `<div class="mt-2 text-[10px] text-purple-400 font-mono"><i class="fa-regular fa-clock mr-1"></i> Scheduled: ${dateStr} at ${timeStr}</div>`;
    }

    // 1. ЗАГРУЗКА
    if (post.status === 'generating') {
        return `
        <div class="card h-full bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden relative cursor-wait p-5 flex flex-col justify-center items-center gap-4 animate-pulse">
            <div class="w-12 h-12 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin"></div>
            <div class="text-center">
                <div class="text-white font-bold tracking-widest text-sm mb-1">AI IS WORKING</div>
                <div class="text-zinc-500 text-xs font-mono">Generating structure...</div>
            </div>
        </div>`;
    }

    // 2. МОДЕРАЦИЯ
    if (post.status === 'review') {
        return `
        <div onclick="window.app.openEditor('${safeId}')" class="card flex flex-col h-full bg-[#1c1c20] border border-yellow-500/30 rounded-2xl overflow-hidden hover:border-yellow-500 transition cursor-pointer group relative">
            <div class="h-48 bg-yellow-900/10 flex flex-col items-center justify-center border-b border-yellow-500/10">
                <i class="fa-solid fa-file-pen text-4xl text-yellow-500/40 mb-2"></i>
                <span class="bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Action Required</span>
            </div>
            <div class="p-5 flex-grow flex flex-col">
                <h3 class="font-medium text-lg text-white mb-2 line-clamp-2">${post.topic}</h3>
                <p class="text-xs text-zinc-500 font-mono">Draft Ready</p>
                ${scheduleBadge}
                <div class="mt-auto pt-4"><button class="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 rounded text-xs transition">REVIEW</button></div>
            </div>
        </div>`;
    }

    // 3. ГОТОВО
    const slides = Array.isArray(post.carousel_content) ? post.carousel_content : [];
    const firstImg = slides[0]?.image_url;
    const imageUrl = firstImg ? `${firstImg}?t=${new Date(post.created_at).getTime()}` : "https://via.placeholder.com/800x600/000/333?text=NO+IMAGE";

    return `
        <div onclick="window.app.openEditor('${safeId}')" class="card flex flex-col h-full bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition cursor-pointer group">
            <div class="relative h-48 bg-black overflow-hidden">
                <img src="${imageUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500">
                <div class="absolute top-2 right-2"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">APPROVED</span></div>
            </div>
            <div class="p-5 flex-grow flex flex-col">
                <h3 class="font-medium text-lg text-white mb-2 line-clamp-2">${post.topic}</h3>
                <p class="text-xs text-zinc-500 font-mono">${createdDate} • ${slides.length} slides</p>
                ${scheduleBadge}
                <div class="mt-auto pt-4"><button class="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded text-xs font-bold transition">OPEN</button></div>
            </div>
        </div>`;
}

// --- РЕНДЕР РЕДАКТОРА ---
export function renderEditorContent(post) {
    const container = document.getElementById('editor-slides-container');
    const statusLabel = document.getElementById('editor-status');
    const captionArea = document.getElementById('editor-caption');
    const actionsArea = document.getElementById('editor-actions');

    statusLabel.innerText = post.status;
    statusLabel.className = `text-[10px] font-bold uppercase px-3 py-1 rounded bg-zinc-800 ${getStatusColor(post.status)}`;

    if (captionArea && (document.activeElement !== captionArea || captionArea.value === '')) {
        captionArea.value = post.caption || '';
    }

    // AI Box для Caption
    if (captionArea && !document.getElementById('ai-caption-box')) {
        const aiBoxHtml = `
            <div id="ai-caption-box" class="mt-4 pt-4 border-t border-zinc-800">
                <label class="block text-[10px] text-purple-400 mb-2 uppercase font-bold tracking-wider"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> AI Magic Rewrite</label>
                <div class="flex gap-2">
                    <input type="text" id="ai-caption-input" class="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-purple-500 outline-none transition" placeholder="e.g. 'Add emojis', 'Make it shorter'">
                    <button onclick="window.app.refineCaption()" id="btn-refine-caption" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-xs transition shadow-lg"><i class="fa-solid fa-bolt"></i></button>
                </div>
            </div>
        `;
        const saveBtn = document.getElementById('save-caption-btn');
        if (saveBtn) saveBtn.parentElement.insertAdjacentHTML('afterend', aiBoxHtml);
    }

    // Кнопки действий
    if (post.status === 'review') {
        actionsArea.innerHTML = `<button onclick="window.app.handleApprove('${post.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 shadow-lg"><i class="fa-solid fa-rocket"></i> APPROVE & GENERATE</button>`;
    } else if (post.status === 'generating') {
        actionsArea.innerHTML = `<span class="text-xs text-zinc-500 animate-pulse flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin"></i> PROCESSING...</span>`;
    } else {
        actionsArea.innerHTML = `<span class="text-xs text-emerald-500 font-bold flex items-center gap-2"><i class="fa-solid fa-check"></i> READY</span>`;
    }

    container.innerHTML = '';
    const slides = Array.isArray(post.carousel_content) ? post.carousel_content : [];

    if (slides.length === 0 && post.status !== 'generating') {
        container.innerHTML = '<div class="text-center text-zinc-600 py-20 font-mono text-xs">NO SLIDE DATA AVAILABLE</div>';
        return;
    }

    slides.sort((a, b) => a.index - b.index).forEach(slide => {
        const hasImage = !!slide.image_url;
        const imgSrc = hasImage ? `${slide.image_url}?t=${Date.now()}` : null;

        const imageBlock = hasImage
            ? `<div class="relative group">
                 <img id="img-${slide.index}" src="${imgSrc}" class="w-full rounded-lg shadow-lg mb-4 border border-zinc-800 bg-black">
                 <!-- Кнопка регенерации переехала в хедер слайда -->
               </div>`
            : `<div class="w-full h-64 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center text-zinc-600 mb-4 text-xs font-mono">IMAGE PENDING</div>`;

        // Кнопка регенерации (Теперь берет промпт из инпута!)
        const regenBtn = hasImage ? `
            <button id="regen-btn-${slide.index}" onclick="window.app.handleRegenerateImage('${post.id}', ${slide.index})" class="text-zinc-500 hover:text-white transition" title="Regenerate with Current Prompt">
                <i class="fa-solid fa-rotate"></i>
            </button>
        ` : '';

        const html = `
            <div class="glass p-6 rounded-2xl border border-zinc-800/50 mb-6 transition hover:border-zinc-700 bg-[#0c0c0e]">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xs font-bold text-emerald-500 tracking-widest">SLIDE 0${slide.index}</span>
                    ${regenBtn} <!-- Кнопка теперь тут -->
                </div>
                
                ${imageBlock}
                
                <!-- УБРАЛИ TEXT OVERLAY -->
                
                <div class="space-y-4">
                    <div class="relative group/input">
                        <div class="flex justify-between mb-1">
                            <label class="block text-[10px] text-zinc-500 uppercase font-bold">Image Prompt</label>
                            <!-- Можно сохранить промпт отдельно, но регенерация теперь сама его сохранит -->
                            <button onclick="window.app.updatePrompt('${post.id}', ${slide.index})" class="text-[10px] text-blue-500 hover:text-white transition opacity-0 group-hover/input:opacity-100">SAVE TEXT</button>
                        </div>
                        <textarea id="prompt-${slide.index}" class="w-full bg-black/40 border border-zinc-800 rounded-lg p-3 text-[11px] text-gray-400 h-24 resize-none focus:border-purple-500 focus:outline-none transition leading-relaxed placeholder-zinc-700">${slide.image_prompt || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function getStatusColor(status) {
    if (status === 'approved') return 'text-green-400 border-green-900/30';
    if (status === 'review') return 'text-yellow-400 border-yellow-900/30';
    return 'text-blue-400 border-blue-900/30';
}

export function toggleLoader(btn, isLoading) {
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> PROCESSING...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalText || 'START';
        btn.disabled = false;
    }
}