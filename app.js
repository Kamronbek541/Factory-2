document.addEventListener('DOMContentLoaded', fetchPostsForReview);

async function startFactory() {
    const topic = document.getElementById('topicInput').value;
    const slides = document.getElementById('slidesInput').value;
    const mode = document.getElementById('modeInput').value;

    if (!topic || slides < 1 || slides > 10) return alert('Проверьте данные');

    setLoadingState(true);
    ui.resultContainer.classList.add('hidden');
    ui.slidesGrid.innerHTML = '';
    
    try {
        await fetch(CONFIG.N8N_WEBHOOK_URL_GENERATE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, slides: parseInt(slides), mode })
        });

        const newPost = await findPostByTopic(topic);
        if (newPost) {
             if (mode === 'auto') {
                pollDatabase(newPost.id);
            } else {
                fetchPostsForReview();
                setLoadingState(false);
            }
        } else {
            alert('Не удалось создать пост');
            setLoadingState(false);
        }
    } catch (error) {
        alert('Ошибка: ' + error.message);
        setLoadingState(false);
    }
}

async function approvePost(postId) {
    const btn = document.querySelector(`button[data-approve-id="${postId}"]`);
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>'; }

    try {
        await fetch(CONFIG.N8N_WEBHOOK_URL_APPROVE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId })
        });
        pollDatabase(postId);
    } catch (e) {
        alert('Ошибка одобрения');
        if(btn) { btn.disabled = false; btn.innerHTML = '✅ Одобрить и генерировать'; }
    }
}

async function updatePost(postId, slideIndex, action) {
    const btnId = `btn-${action}-${postId}-${slideIndex}`;
    const btn = document.getElementById(btnId);
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    const payload = { postId, slideIndex: parseInt(slideIndex), action };
    
    if (action === 'update_text') {
        payload.newText = document.getElementById(`text-${postId}-${slideIndex}`).value;
    }

    try {
        await fetch(CONFIG.N8N_WEBHOOK_URL_UPDATE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await new Promise(r => setTimeout(r, 4000));
        await fetchPostsForReview();
    } catch(e) {
        alert('Ошибка');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function regenerateImage(slideIndex) {
    const postId = ui.slidesGrid.dataset.currentPostId;
    const btn = document.getElementById(`regen-btn-${slideIndex}`);
    const img = document.getElementById(`img-${slideIndex}`);
    
    if(!postId) return alert("Ошибка: ID поста потерян");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Рисуем...';
    img.style.opacity = "0.5"; 

    try {
        await fetch(CONFIG.N8N_WEBHOOK_URL_UPDATE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                postId: postId, 
                slideIndex: parseInt(slideIndex), 
                action: 'regenerate_final_image'
            })
        });

        await new Promise(r => setTimeout(r, 15000));
        
        const currentSrc = img.src.split('?')[0]; 
        const newSrc = `${currentSrc}?t=${new Date().getTime()}`;

        const tempImg = new Image();
        
        tempImg.onload = function() {
            img.src = newSrc;
            finishRegen();
        };

        tempImg.onerror = function() {
            setTimeout(() => {
                const retrySrc = `${currentSrc}?t=${new Date().getTime() + 1}`;
                img.src = retrySrc;
                finishRegen();
            }, 3000);
        };

        tempImg.src = newSrc;

    } catch (e) {
        alert('Ошибка регенерации: ' + e.message);
        finishRegen();
    }

    function finishRegen() {
        img.style.opacity = "1";
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Пересоздать фото';
    }
}

async function fetchPostsForReview() {
    const { data, error } = await _supabase.from('posts').select('*').eq('status', 'review').order('created_at', { ascending: false });
    if (error) return;

    ui.reviewGrid.innerHTML = '';
    ui.reviewContainer.classList.toggle('hidden', data.length === 0);

    data.forEach(post => {
        let slidesHtml = (post.carousel_content || []).sort((a,b) => a.index - b.index).map(slide => `
            <div class="glass p-4 rounded-lg border border-slate-700">
                <label class="text-xs font-bold text-emerald-400">СЛАЙД #${slide.index}</label>
                <textarea id="text-${post.id}-${slide.index}" class="w-full bg-slate-900 border border-slate-600 rounded-md p-2 text-sm h-24 focus:outline-none transition mb-2">${slide.text}</textarea>
                <div class="bg-slate-800 p-2 rounded text-xs text-slate-400 mb-3 border border-slate-700"><span class="font-bold text-slate-300">Промпт:</span> ${slide.image_prompt}</div>
                <div class="flex gap-2">
                    <button id="btn-update_text-${post.id}-${slide.index}" onclick="updatePost('${post.id}', ${slide.index}, 'update_text')" class="flex-1 text-xs bg-cyan-700 hover:bg-cyan-600 px-3 py-2 rounded transition font-medium">💾 Текст</button>
                    <button id="btn-regenerate_image_prompt-${post.id}-${slide.index}" onclick="updatePost('${post.id}', ${slide.index}, 'regenerate_image_prompt')" class="flex-1 text-xs bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded transition font-medium">✨ AI Промпт</button>
                </div>
            </div>
        `).join('');

        ui.reviewGrid.innerHTML += `
            <div class="glass p-6 rounded-xl border border-slate-600/50">
                <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                    <div><h3 class="font-bold text-xl text-white">${post.topic}</h3><p class="text-xs text-slate-400 mt-1">${post.generation_settings.slides} слайдов</p></div>
                    <button onclick="approvePost('${post.id}')" data-approve-id="${post.id}" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition active:scale-95">✅ Одобрить и генерировать</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${slidesHtml}</div>
            </div>
        `;
    });
}

async function findPostByTopic(topic) {
    for (let i = 0; i < 20; i++) { 
        const { data } = await _supabase
            .from('posts')
            .select('id')
            .eq('topic', topic)
            .gte('created_at', new Date(Date.now() - 60000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (data) return data;
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return null;
}

let pollInterval;
async function pollDatabase(postId) {
    clearInterval(pollInterval);
    let attempts = 0;
    
    ui.slidesGrid.dataset.currentPostId = postId;

    pollInterval = setInterval(async () => {
        attempts++;
        const { data } = await _supabase.from('posts').select('status, carousel_content').eq('id', postId).single();
        
        if (data && data.status === 'approved') {
            clearInterval(pollInterval);
            renderResults(data.carousel_content);
            setLoadingState(false);
            ui.reviewContainer.classList.add('hidden');
        }
        if (attempts >= 180) { clearInterval(pollInterval); alert('Таймаут!'); setLoadingState(false); }
    }, 2000); 
}

function renderResults(slides) {
    if (typeof slides === 'string') slides = JSON.parse(slides);
    if (!Array.isArray(slides)) return;
    
    ui.slidesGrid.innerHTML = '';
    slides.sort((a, b) => a.index - b.index).forEach(slide => {
        const imageUrl = slide.image_url || `https://via.placeholder.com/1024x1024/1e293b/94a3b8?text=Generating...`;
        const uniqueUrl = `${imageUrl}?t=${new Date().getTime()}`;

        ui.slidesGrid.innerHTML += `
            <div class="glass rounded-xl overflow-hidden flex flex-col h-full border border-slate-700">
                <div class="relative group h-64 bg-slate-800">
                    <img id="img-${slide.index}" src="${uniqueUrl}" class="w-full h-full object-cover transition duration-500" alt="Slide Image">
                </div>
                <div class="p-4 flex-grow flex flex-col justify-between">
                    <div>
                        <div class="text-xs font-bold text-emerald-400 mb-1">СЛАЙД #${slide.index}</div>
                        <p class="text-sm text-slate-300 mb-4">${slide.text}</p>
                    </div>
                    <button id="regen-btn-${slide.index}" onclick="regenerateImage(${slide.index})" class="w-full bg-slate-700 hover:bg-slate-600 text-xs text-white font-bold py-2 rounded transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-rotate"></i> Пересоздать фото
                    </button>
                </div>
            </div>
        `;
    });

    ui.resultContainer.classList.remove('hidden');
    ui.resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function setLoadingState(isLoading) {
    ui.generateBtn.disabled = isLoading;
    ui.btnText.classList.toggle('hidden', isLoading);
    ui.btnLoader.classList.toggle('hidden', !isLoading);
    document.querySelectorAll('#reviewGrid button').forEach(btn => btn.disabled = isLoading);
}