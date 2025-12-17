import { createClient } from '@supabase/supabase-js';

export const onRequestPost = async ({ request, env }) => {
  try {
    const { path, bucket = 'assets', expiresIn = 3600 } = await request.json();
    if (!path) {
      return new Response('path required', { status: 400 });
    }
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRole = env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRole) {
      return new Response('Supabase env missing', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      return new Response(error.message, { status: 400 });
    }

    return Response.json({
      signedUrl: data.signedUrl,
      expiresIn,
    });
  } catch (e: any) {
    return new Response(e?.message || 'Unexpected error', { status: 500 });
  }
};
