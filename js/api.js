import { supabase } from './supabaseClient.js';
import { CONFIG } from './config.js';

// --- N8N ЗАПРОСЫ ---
export async function sendToN8n(webhookUrl, payload) {
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (error) {
        console.error("N8N Error:", error);
        throw new Error(`Ошибка соединения с заводом: ${error.message}`);
    }
}

// --- SUPABASE ЗАПРОСЫ ---
export async function getUserPosts(username) {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function findPostByTopic(topic, username) {
    // Ищем пост, созданный за последнюю минуту этим юзером
    for (let i = 0; i < 10; i++) {
        const { data } = await supabase
            .from('posts')
            .select('id')
            .eq('username', username)
            .eq('topic', topic)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) return data;
        await new Promise(r => setTimeout(r, 2000));
    }
    return null;
}

export async function checkPostStatus(postId) {
    const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
    return data;
}