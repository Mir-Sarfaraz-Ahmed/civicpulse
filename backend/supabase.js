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

const BUCKET_NAME = 'civicpulse-uploads';

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
 * @returns {Promise<{id: string, email: string, role: string, name: string}|null>}
 */
async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      // Fallback: parse JWT payload directly if network call fails or token expired
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload.sub && payload.email) {
            return {
              id: payload.sub,
              email: payload.email,
              role: payload.user_metadata?.role || payload.role || (payload.email.includes('admin') ? 'admin' : (payload.email.includes('crew') ? 'crew' : 'civilian')),
              name: payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name || payload.email.split('@')[0],
              avatar: payload.user_metadata?.avatar_url || payload.user_metadata?.picture || null
            };
          }
        }
      } catch (e) {}
      return null;
    }

    // Attempt to fetch custom role from public.profiles
    let role = user.user_metadata?.role;
    let name = user.user_metadata?.full_name || user.user_metadata?.name;
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    if (!role) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name, avatar_url')
          .eq('id', user.id)
          .single();
        if (profile) {
          role = profile.role;
          name = name || profile.name;
        }
      } catch (e) {}
    }

    if (!role) {
      if (user.email === 'admin@gmail.com' || (user.email && user.email.includes('admin'))) role = 'admin';
      else if (user.email === 'crew@gmail.com' || (user.email && user.email.includes('crew'))) role = 'crew';
      else role = 'civilian';
    }

    return {
      id: user.id,
      email: user.email,
      role: role,
      name: name || user.email.split('@')[0],
      avatar: avatar
    };
  } catch (err) {
    console.warn('[Supabase Auth Validation Exception]', err.message);
    return null;
  }
}

/**
 * Uploads a file buffer to Supabase Storage ('civicpulse-uploads' bucket)
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @param {string} mimeType 
 * @param {string} folderPrefix 
 * @returns {Promise<string>} Public URL of uploaded asset
 */
async function uploadToStorage(buffer, originalName, mimeType = 'image/jpeg', folderPrefix = 'reports') {
  const ext = originalName ? originalName.split('.').pop() : 'jpg';
  const filePath = `${folderPrefix}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

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
