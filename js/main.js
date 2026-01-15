import { CONFIG } from './config.js';
import * as API from './api.js';
import * as UI from './ui.js';
import { init3DBackground } from './background.js';

let currentUser = localStorage.getItem('cz_user');
let pollInterval;
let activePostId = null; // ID поста, открытого в редакторе

const els = {
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    loginInput: document.getElementById('loginInput'),
    toast: document.getElementById('toast-container'),
    toastMsg: document.getElementById('toast-message'),

    // Views
    viewList: document.getElementById('view-list'),
    viewEditor: document.getElementById('view-editor'),

    // Dashboard Elements
    userNameDisplay: document.getElementById('userNameDisplay'),
    userAvatar: document.getElementById('userAvatar'),
    postsGrid: document.getElementById('postsGrid'),

    // Editor Elements
    editorSlides: document.getElementById('editor-slides-container'),
    editorCaption: document.getElementById('editor-caption'),
    editorStatus: document.getElementById('editor-status'),
    editorActions: document.getElementById('editor-actions'),
    editorPostId: document.getElementById('editor-post-id'),
    saveCaptionBtn: document.getElementById('save-caption-btn')
};

document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        initDashboard();
    } else {
        init3DBackground();
        setupLogin();
    }
});

// --- Login ---
function setupLogin() {
    els.loginInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.app.handleLoginAttempt();
    });
    setTimeout(() => els.loginInput.focus(), 500);
}

// --- Dashboard ---
function initDashboard() {
    // ЖЕСТКОЕ СКРЫТИЕ ЛОГИНА
    els.loginScreen.classList.add('fade-out');
    setTimeout(() => els.loginScreen.remove(), 600); // Удаляем из DOM

    els.dashboardScreen.classList.remove('hidden');
    els.userNameDisplay.innerText = currentUser;
    els.userAvatar.innerText = currentUser.charAt(0).toUpperCase();
    loadUserPosts();
}

async function loadUserPosts() {
    const grid = els.postsGrid;
    grid.innerHTML = '<div class="text-zinc-500 font-mono text-sm py-10 col-span-full text-center">SYNCING DATA...</div>';
    try {
        const posts = await API.getUserPosts(currentUser);
        grid.innerHTML = '';
        if (posts.length === 0) {
            grid.innerHTML = '<div class="text-zinc-500 font-mono text-sm py-10 col-span-full text-center">NO PROJECTS FOUND. CREATE NEW.</div>';
            return;
        }
        posts.forEach(post => grid.innerHTML += UI.createPostCard(post));
    } catch (e) {
        console.error(e);
        showToast("Error loading projects");
    }
}

// --- EXPOSED API ---
window.app = {
    handleLoginAttempt() {
        const username = els.loginInput.value.trim();
        if (!username) return showToast("Enter Login");

        currentUser = username;
        localStorage.setItem('cz_user', username);
        initDashboard();
    },

    logout() {
        localStorage.removeItem('cz_user');
        location.reload();
    },

    switchTab(tabName) {
        document.getElementById('tab-posts').classList.add('hidden');
        document.getElementById('tab-create').classList.add('hidden');
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        if (tabName === 'posts') {
            loadUserPosts();
            startDashboardPolling(); // Start auto-refresh
        } else {
            stopDashboardPolling(); // Stop if leaving tab
        }
    },

    // ... (rest of window.app)


    // === EDITOR LOGIC ===

    async openEditor(postId) {
        // 1. Переключаем View
        els.viewList.classList.add('hidden');
        els.viewEditor.classList.remove('hidden');

        activePostId = postId;
        els.editorPostId.innerText = postId;
        els.editorSlides.innerHTML = '<div class="text-center text-zinc-500 py-20">Loading project data...</div>';

        try {
            const post = await API.checkPostStatus(postId);
            UI.renderEditorContent(post); // Вызываем новый рендер из UI.js

            // Если пост активен, запускаем поллинг внутри редактора
            if (post.status === 'generating' || post.status === 'review') {
                startPolling(postId);
            }
        } catch (e) {
            showToast("Failed to load project");
            window.app.backToDashboard();
        }
    },

    backToDashboard() {
        clearInterval(pollInterval); // Останавливаем слежку
        activePostId = null;

        els.viewEditor.classList.add('hidden');
        els.viewList.classList.remove('hidden');
        loadUserPosts(); // Обновляем список
    },

    // === ACTIONS ===

    async handleStartFactory() {
        const topic = document.getElementById('topicInput').value;
        const slides = document.getElementById('slidesInput').value;
        const mode = document.getElementById('modeInput').value;
        // НОВОЕ: Получаем дату
        const scheduleTime = document.getElementById('scheduleInput').value;
        const btn = document.getElementById('generateBtn');

        if (!topic) { showToast("INPUT ERROR: Topic missing"); return; }

        UI.toggleLoader(btn, true);

        // Превращаем дату в ISO (если она выбрана)
        const isoDate = scheduleTime ? new Date(scheduleTime).toISOString() : null;

        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.GENERATE, {
                topic,
                slides: parseInt(slides),
                mode,
                username: currentUser,
                scheduledTime: isoDate // Отправляем в n8n
            });

            // Ждем появления поста...
            const newPost = await API.findPostByTopic(topic, currentUser);
            if (newPost) {
                if (mode === 'auto') {
                    startPolling(newPost.id);
                    showToast("System: AUTO SEQUENCE STARTED");
                    window.app.switchTab('posts');
                } else {
                    showToast("System: MANUAL REVIEW REQUIRED");
                    window.app.switchTab('posts');
                    UI.toggleLoader(btn, false);
                }
            } else {
                throw new Error("Timeout: Post creation failed");
            }
        } catch (error) {
            showToast(error.message);
            UI.toggleLoader(btn, false);
        }
    },

    async handleApprove(postId) {
        if (!confirm('Start Generation?')) return;
        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.APPROVE, { postId });
            showToast("Production Started");
            startPolling(postId);
        } catch (e) { showToast(e.message); }
    },

    async saveCaption() {
        if (!activePostId) return;
        const btn = els.saveCaptionBtn;
        btn.innerText = 'SAVING...';
        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.UPDATE, {
                postId: activePostId,
                action: 'update_caption',
                newCaption: els.editorCaption.value
            });
            btn.innerText = 'SAVED';
            setTimeout(() => btn.innerText = 'Save Caption', 2000);
        } catch (e) { showToast("Save failed"); }
    },

    async refineCaption() {
        if (!activePostId) return;

        const instruction = document.getElementById('ai-caption-input').value;
        const currentCaption = document.getElementById('editor-caption').value;
        const btn = document.getElementById('btn-refine-caption');

        if (!instruction) return showToast("Enter instructions");

        btn.innerHTML = '<i class="fa-solid fa-spin fa-circle-notch"></i>';
        btn.disabled = true;

        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.UPDATE, {
                postId: activePostId,
                action: 'refine_caption', // Новый Action для n8n
                currentCaption: currentCaption,
                instruction: instruction
            });

            // Ждем чуть дольше, так как это AI генерация
            await new Promise(r => setTimeout(r, 4000));

            // Обновляем данные (n8n сам обновит базу, мы просто подтянем)
            const post = await API.checkPostStatus(activePostId);
            if (post) {
                document.getElementById('editor-caption').value = post.caption;
                document.getElementById('ai-caption-input').value = ''; // Очищаем поле
                showToast("Caption Refined!");
            }
        } catch (e) {
            showToast("Refine failed");
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
            btn.disabled = false;
        }
    },

    async updatePrompt(postId, slideIndex) {
        const input = document.getElementById(`prompt-${slideIndex}`);
        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.UPDATE, {
                postId, slideIndex, action: 'update_image_prompt', newPrompt: input.value
            });
            showToast("Prompt Updated");
        } catch (e) { showToast("Error updating prompt"); }
    },

    // --- НОВАЯ ФУНКЦИЯ РЕГЕНЕРАЦИИ (С КАСТОМНЫМ ПРОМПТОМ) ---
    async handleRegenerateImage(postId, slideIndex) {
        const btn = document.getElementById(`regen-btn-${slideIndex}`);
        const img = document.getElementById(`img-${slideIndex}`);

        // БЕРЕМ ТЕКСТ ИЗ ПОЛЯ ВВОДА!
        const customPrompt = document.getElementById(`prompt-${slideIndex}`).value;

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spin fa-circle-notch"></i>'; }
        if (img) img.style.opacity = "0.5";

        try {
            await API.sendToN8n(CONFIG.WEBHOOKS.UPDATE, {
                postId,
                slideIndex: parseInt(slideIndex),
                action: 'regenerate_final_image',
                customPrompt: customPrompt // Отправляем то, что ввел юзер
            });

            // Ждем Kie.ai
            await new Promise(r => setTimeout(r, CONFIG.TIMEOUTS.REGEN_DELAY));

            if (img) {
                const currentSrc = img.src.split('?')[0];
                img.src = `${currentSrc}?t=${new Date().getTime()}`;
                img.style.opacity = "1";
            }
            showToast("Asset Regenerated with new prompt");

        } catch (e) {
            showToast("Regeneration Failed");
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i>'; }
        }
    }
};

let dashboardPollInterval;

function startDashboardPolling() {
    stopDashboardPolling(); // Clear existing
    // Poll every 10 seconds to check for new statuses (review/generated)
    dashboardPollInterval = setInterval(async () => {
        // We do a "silent" load - we don't show the loading spinner, just update cards
        // But to keep it simple, we can just call loadUserPosts() if the spinner logic is handled gracefully
        // Or better: fetch and diff. For now, let's just refresh the grid silently.

        // IMPORTANT: Only refresh if we are NOT dragging/interacting (hard to detect, so we just refresh)
        // To avoid flickering, we probably want a smarter update, but for now re-rendering createPostCard is fast.
        if (!document.hidden) {
            const posts = await API.getUserPosts(currentUser);
            if (posts && posts.length > 0) {
                // Simple re-render. Ideally we'd compare IDs/Status but this is "good enough" for v2
                // We preserve scroll position effectively because we replace innerHTML
                const grid = els.postsGrid;
                // Don't nuke if empty to avoid flash
                let newHtml = '';
                posts.forEach(post => newHtml += UI.createPostCard(post));
                if (grid.innerHTML !== newHtml) {
                    grid.innerHTML = newHtml;
                    console.log('Dashboard auto-refreshed');
                }
            }
        }
    }, 10000); // 10 seconds
}

function stopDashboardPolling() {
    if (dashboardPollInterval) clearInterval(dashboardPollInterval);
}

function startPolling(postId) {
    clearInterval(pollInterval);
    let attempts = 0;

    pollInterval = setInterval(async () => {
        attempts++;
        const post = await API.checkPostStatus(postId);

        // Если мы всё еще в редакторе этого поста — обновляем UI
        if (activePostId === postId) {
            UI.renderEditorContent(post);
        }

        if (post && post.status !== 'generating' && post.status !== 'review') {
            clearInterval(pollInterval);
            showToast("Status Updated: " + post.status);
            // Also refresh dashboard list if we happen to switch back
            startDashboardPolling();
        }
        if (attempts >= CONFIG.TIMEOUTS.MAX_ATTEMPTS) clearInterval(pollInterval);
    }, CONFIG.TIMEOUTS.POLLING_INTERVAL);
}

function showToast(msg) {
    els.toastMsg.innerText = msg;
    els.toast.classList.add('toast-visible');
    setTimeout(() => els.toast.classList.remove('toast-visible'), 3000);
}