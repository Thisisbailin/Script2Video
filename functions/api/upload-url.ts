import { createClient } from '@supabase/supabase-js';

export const onRequestPost = async ({ request, env }) => {
  try {
    const { fileName, bucket = 'assets', contentType } = await request.json();
    if (!fileName) {
      return new Response('fileName required', { status: 400 });
    }
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRole = env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceRole) {
      return new Response('Supabase env missing', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(fileName, { upsert: true, contentType });

    if (error) {
      return new Response(error.message, { status: 400 });
    }

    let publicUrl: string | undefined;
    // Only try public URL if bucket is public (e.g., public-assets)
    const publicResult = supabase.storage.from(bucket).getPublicUrl(data.path);
    if (publicResult?.data?.publicUrl) {
      publicUrl = publicResult.data.publicUrl;
    }

    return Response.json({
      signedUrl: data.signedUrl,
      path: data.path,
      bucket,
      publicUrl,
    });
  } catch (e: any) {
    return new Response(e?.message || 'Unexpected error', { status: 500 });
  }
};
