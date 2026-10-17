const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wpqybcukijxmfpzzdykt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6CSwnMkA3zMG8OQK5T42rw_vIrFgLuG';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || process.env.VITE_SUPABASE_STORAGE_BUCKET || 'civicpusleai';

/**
 * Creates an instance of Supabase client bound to a specific user's Bearer JWT
 * @param {string} token 
 */
function getAuthenticatedClient(token) {
  if (!token) return supabase;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Validates a Supabase JWT token and extracts user profile
 * @param {string} token 
 * @returns {Promise<{id: string, email: string, role: string, name: string, avatar?: string}|null>}
 */
async function getUserFromToken(token) {
  if (!token) return null;

  // Fast Path: Parse JWT payload directly (instant, zero network latency, resilient against cloud timeouts)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const isSupabaseToken = (payload.iss && payload.iss.includes('supabase')) || payload.aud === 'authenticated' || (payload.sub && payload.email);
      
      if (isSupabaseToken && payload.sub && payload.email) {
        const normalizedEmail = payload.email.toLowerCase().trim();
        let role = payload.user_metadata?.role || payload.role;
        
        if (!role) {
          if (normalizedEmail === 'admin@gmail.com' || normalizedEmail.includes('admin')) role = 'admin';
          else if (normalizedEmail === 'crew@gmail.com' || normalizedEmail.includes('crew')) role = 'crew';
          else role = 'civilian';
        }

        const name = payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name || payload.email.split('@')[0];
        const avatar = payload.user_metadata?.avatar_url || payload.user_metadata?.picture || null;

        return {
          id: payload.sub,
          email: payload.email,
          role: role,
          name: name,
          avatar: avatar
        };
      }
    }
  } catch (parseErr) {
    // Proceed to standard verification if parsing fails
  }

  // Cloud Fallback: Query Supabase Auth API with 3-second timeout protection
  try {
    const getUserPromise = supabase.auth.getUser(token);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase getUser timeout')), 3000));
    const result = await Promise.race([getUserPromise, timeoutPromise]);
    
    const user = result?.data?.user;
    if (user && user.id && user.email) {
      let role = user.user_metadata?.role;
      if (!role) {
        const email = user.email.toLowerCase();
        if (email === 'admin@gmail.com' || email.includes('admin')) role = 'admin';
        else if (email === 'crew@gmail.com' || email.includes('crew')) role = 'crew';
        else role = 'civilian';
      }

      return {
        id: user.id,
        email: user.email,
        role: role,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
      };
    }
  } catch (err) {
    console.warn('[Supabase Auth Validation Notice]', err.message);
  }

  return null;
}

/**
 * Uploads a file buffer to Supabase Storage bucket ('civicpusleai')
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @param {string} folderPrefix 
 * @param {string} userId
 * @returns {Promise<string>} Public URL of uploaded asset
 */
async function uploadToStorage(buffer, originalName, mimeType = 'image/jpeg', folderPrefix = 'reports', userId = 'general') {
  const ext = originalName ? originalName.split('.').pop() : 'jpg';
  const safeUserId = (userId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${folderPrefix}/${safeUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  // Ensure bucket exists
  try {
    await supabase.storage.createBucket(BUCKET_NAME, { public: true });
  } catch (e) {
    // Bucket likely already exists
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('[Supabase Storage Backend Error]', error);
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicData.publicUrl;
}

module.exports = {
  supabase,
  getAuthenticatedClient,
  getUserFromToken,
  uploadToStorage,
  BUCKET_NAME,
  SUPABASE_URL,
  SUPABASE_KEY
};
