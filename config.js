const CONFIG = {
    SUPABASE_URL: 'https://fogotgnjdpvsfexbcjza.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_V1h1AZYUq4JV3wjCgAOkDA_Rk-ihpET',
    N8N_WEBHOOK_URL_GENERATE: 'https://n8n.kamidummy.com/webhook/generate',
    N8N_WEBHOOK_URL_APPROVE: 'https://n8n.kamidummy.com/webhook/approve-post',
    N8N_WEBHOOK_URL_UPDATE: 'https://n8n.kamidummy.com/webhook/update-post'
};

const { createClient } = supabase;
const _supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const ui = {
    generateBtn: document.getElementById('generateBtn'),
    btnText: document.getElementById('btnText'),
    btnLoader: document.getElementById('btnLoader'),
    resultContainer: document.getElementById('resultContainer'),
    slidesGrid: document.getElementById('slidesGrid'),
    reviewContainer: document.getElementById('reviewContainer'),
    reviewGrid: document.getElementById('reviewGrid'),
};