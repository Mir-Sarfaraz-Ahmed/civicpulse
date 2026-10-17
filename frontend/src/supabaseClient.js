import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wpqybcukijxmfpzzdykt.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6CSwnMkA3zMG8OQK5T42rw_vIrFgLuG';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Storage Bucket Name for Photos (matches Supabase dashboard bucket)
export const BUCKET_NAME = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'civicpusleai';

/**
 * Uploads an image file to Supabase Storage and returns its public URL
 * @param {File|Blob} file 
 * @param {string} folderPrefix 
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export async function uploadToSupabaseStorage(file, folderPrefix = 'reports', userId = 'general') {
  if (!file) throw new Error('No file provided for upload.');

  const ext = file.name ? file.name.split('.').pop() : 'jpg';
  const safeUserId = (userId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${folderPrefix}/${safeUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('[Supabase Storage Upload Error]', error);
    throw error;
  }

  // Get public URL
  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}
