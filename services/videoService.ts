
import { VideoServiceConfig, VideoParams } from "../types";

// Standard OpenAI/Sora 2 response structures
interface VideoGenerationResponse {
  id: string;
  object: string; // "video"
  model: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed'; 
  progress?: number;
  created_at?: number;
  data?: {
    url?: string;
    video_url?: string;
  }[];
  video_url?: string; // Fallback for some proxies
  error?: {
    message: string;
  };
}

interface ModelListResponse {
  data: {
    id: string;
    object: string;
  }[];
}

// Return type for our service functions
interface ServiceResult {
    id: string;
    url: string;
}

export const fetchModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
  if (!baseUrl || !apiKey) return [];

  let apiBase = baseUrl.trim().replace(/\/+$/, '');
  
  // Submit-only endpoints cannot fetch models
  if (apiBase.match(/(submit|generations|videos)$/)) {
      throw new Error("Cannot fetch models from a submission endpoint. Please use the root API URL.");
  }
  
  if (!apiBase.endsWith('/v1')) {
      apiBase = `${apiBase}/v1`;
  }

  try {
    console.log("--- [Phase 5] Fetch Models ---");
    console.log("URL:", `${apiBase}/models`);
    
    const response = await fetch(`${apiBase}/models`, {
      method: 'GET',
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
       const err = await response.text();
       console.error("Fetch Models Failed:", err);
       throw new Error(`Failed to fetch models: ${response.status} ${err}`);
    }

    const data: ModelListResponse = await response.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(m => m.id);
    }
    return [];
  } catch (e) {
    console.error("Error fetching models", e);
    throw e; // Re-throw to UI
  }
};

// Helper: Polling function
const pollVideoStatus = async (
    apiBase: string, 
    videoId: string, 
    apiKey: string
): Promise<ServiceResult> => {
    const MAX_RETRIES = 120; // 6 mins max
    const INTERVAL = 3000;  // 3 seconds
    
    let pollUrl = '';
    let isWuyin = false;

    // Detect Wuyinkeji / Sora2 Adapter pattern
    if (apiBase.includes('wuyinkeji.com') || apiBase.includes('/sora2')) {
        isWuyin = true;
        // Transform .../api/sora2/submit -> .../api/sora2/detail
        const rootBase = apiBase.replace(/\/submit\/?$/, ''); 
        
        // Construct Detail URL: https://api.wuyinkeji.com/api/sora2/detail?id={id}&key={key}
        pollUrl = `${rootBase}/detail?id=${videoId}&key=${apiKey}`;
    } else {
        // Standard OpenAI Video Polling: /v1/videos/{id}
        pollUrl = `${apiBase}/videos/${videoId}`;
    }

    console.log("--- [Phase 5] Polling Strategy ---");
    console.log("Poll URL:", pollUrl);

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const headers: any = { "Content-Type": "application/json" };
            
            // Only add Bearer token if key is NOT in the query string
            if (!pollUrl.includes('key=')) {
                headers["Authorization"] = `Bearer ${apiKey}`;
            }

            const response = await fetch(pollUrl, {
                method: "GET",
                headers: headers
            });

            if (!response.ok) {
                // 404 might mean "not ready" in some systems, but for Wuyin it usually means wrong URL
                if (response.status === 404) {
                    console.log(`Polling ${i}: 404 (Processing or Not Found)`);
                } else {
                     console.warn(`Polling Error ${response.status}`);
                }
            } else {
                const data = await response.json();
                console.log(`Polling ${i} Response:`, data);
                
                // --- STRATEGY 1: Wuyinkeji Specific Response ---
                if (isWuyin && data.code === 200 && data.data) {
                    const d = data.data;
                    // Check for completion
                    // status 1 seems to be success based on user log, provided url is present
                    if (d.remote_url || d.video_url || d.url) {
                        const finalUrl = d.remote_url || d.video_url || d.url;
                        if (finalUrl && finalUrl.startsWith('http')) {
                            return { id: videoId, url: finalUrl };
                        }
                    }
                    if (d.fail_reason) {
                        throw new Error(d.fail_reason);
                    }
                    // Status 2/3/4 might be failing, but if no URL and no fail reason, assume processing
                }

                // --- STRATEGY 2: Standard OpenAI/Sora Response ---
                const status = data.status || data.data?.status;
                
                if (status === 'succeeded' || status === 'success' || (data.code === 200 && data.data?.video_url)) {
                    const url = data.data?.video_url || data.data?.url || data.video_url || '';
                    if (url) return { id: videoId, url };
                }
                
                if (status === 'failed') {
                    throw new Error(data.error?.message || data.msg || "Video generation failed.");
                }
            }
        } catch (e) {
            console.warn(`Polling attempt ${i} failed`, e);
            // If it's a hard network error (like Failed to fetch due to CORS on 404), we still retry a few times
            // But if it persists, it will eventually timeout.
        }
        
        await new Promise(resolve => setTimeout(resolve, INTERVAL));
    }
    
    throw new Error("Video generation timed out.");
};

export const generateVideo = async (
  prompt: string,
  config: VideoServiceConfig,
  params?: VideoParams
): Promise<ServiceResult> => {
  const { baseUrl, apiKey } = config;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing Video API Configuration.");
  }

  // --- LOGGING ---
  console.log("--- [Phase 5] Generate Video Request ---");
  console.log("Prompt:", prompt);
  console.log("Base URL (Config):", baseUrl);
  
  // Construct Endpoint & Key
  let endpoint = baseUrl.trim();
  
  const urlObj = new URL(endpoint);
  
  // Clean up params for Wuyinkeji specific requirements
  // 1. Force add key to query params if not present
  if (!urlObj.searchParams.has('key')) {
      urlObj.searchParams.append('key', apiKey);
  }
  
  console.log("Request URL:", urlObj.toString());

  // 2. Map Body Params (Form Data / URL Encoded)
  const formBody = new URLSearchParams();
  formBody.append('prompt', prompt);
  formBody.append('aspectRatio', params?.aspectRatio || '16:9');
  
  const durationInt = params?.duration ? parseInt(params.duration.replace('s', ''), 10) : 10;
  formBody.append('duration', durationInt.toString());
  
  const sizeVal = params?.quality === 'high' ? 'large' : 'small';
  formBody.append('size', sizeVal);

  console.log("Form Body:", formBody.toString());

  try {
      // 3. Send Request
      const response = await fetch(urlObj.toString(), {
          method: "POST",
          headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset:utf-8;"
          },
          body: formBody
      });

      console.log("Response Status:", response.status);
      const text = await response.text();
      console.log("Response Raw Body:", text);

      if (!response.ok) {
          throw new Error(`API Error ${response.status}: ${text}`);
      }

      let data;
      try {
          data = JSON.parse(text);
      } catch (e) {
          throw new Error("Failed to parse API response as JSON.");
      }

      // Check for provider specific error codes
      // Wuyinkeji: { code: 200, msg: "成功", data: { id: "..." } }
      if (data.code !== undefined && data.code !== 200) {
          throw new Error(`Provider Error (${data.code}): ${data.msg}`);
      }
      
      // Fallback for standard OpenAI error format
      if (data.error) {
          throw new Error(data.error.message);
      }

      const videoId = data.data?.id || data.id;
      if (!videoId) {
          throw new Error("No Video ID returned from API.");
      }

      console.log("Video ID obtained:", videoId);

      // 4. Poll for Result
      // Pass the base URL without query params for polling logic to handle
      // We strip the query params here because pollVideoStatus handles adding key/id itself
      return await pollVideoStatus(endpoint.split('?')[0], videoId, apiKey);

  } catch (error: any) {
      console.error("Video Generation Failed:", error);
      throw error;
  }
};

export const remixVideo = async (
    originalVideoId: string,
    prompt: string,
    config: VideoServiceConfig
): Promise<ServiceResult> => {
    // Basic implementation for remix - assumes standard OpenAI for now as provider specifics vary wildly for Remix
    if (config.baseUrl.includes('submit')) {
        throw new Error("Remix not supported via 'submit' endpoint configuration yet.");
    }
    throw new Error("Remix functionality requires standard OpenAI compatible endpoint.");
};
