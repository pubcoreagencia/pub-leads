const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function hasSupabaseConfig() {
  return Boolean(isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey);
}

export function getSupabaseConfig() {
  if (!supabaseUrl || !isValidSupabaseUrl(supabaseUrl) || !supabaseAnonKey) {
    throw new Error(
      "Missing or invalid Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}
