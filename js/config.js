export const CONFIG = {
    SUPABASE_URL: 'https://fogotgnjdpvsfexbcjza.supabase.co',
    SUPABASE_KEY: 'sb_publishable_V1h1AZYUq4JV3wjCgAOkDA_Rk-ihpET', // Твой Public Key
    
    WEBHOOKS: {
        GENERATE: 'https://n8n.kamidummy.com/webhook/generate',
        APPROVE: 'https://n8n.kamidummy.com/webhook/approve-post',
        UPDATE: 'https://n8n.kamidummy.com/webhook/update-post'
    },

    TIMEOUTS: {
        POLLING_INTERVAL: 2000, // 2 секунды
        MAX_ATTEMPTS: 180,      // 6 минут ожидания
        REGEN_DELAY: 15000      // 15 секунд на регенерацию фото
    }
};