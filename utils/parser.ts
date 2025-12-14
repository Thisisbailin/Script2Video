
import { Episode, Shot, Scene } from "../types";

// Helper: Parse scenes from episode content
const parseScenes = (episodeContent: string): Scene[] => {
  const lines = episodeContent.split(/\r?\n/);
  const scenes: Scene[] = [];
  let currentScene: Scene | null = null;
  let buffer: string[] = [];

  // Regex for "1-1 Scene Name" or "1-1+SceneName"
  // Captures: 1: EpisodeNum, 2: SceneNum, 3: Title (rest of line)
  // [ \t+]+ matches spaces, tabs, or literal plus signs acting as separators
  const sceneHeaderRegex = /^\s*(\d+)-(\d+)(?:[ \t+]+)(.+)$/;

  lines.forEach(line => {
    const match = line.match(sceneHeaderRegex);
    if (match) {
      // If we have a current scene, save it
      if (currentScene) {
        currentScene.content = buffer.join('\n').trim();
        scenes.push(currentScene);
      }
      
      buffer = [];
      const sceneId = `${match[1]}-${match[2]}`; // e.g. 1-1
      const sceneTitle = match[3].trim();
      
      currentScene = {
        id: sceneId,
        title: sceneTitle,
        content: ''
      };
      buffer.push(line);
    } else {
      if (currentScene) {
        buffer.push(line);
      }
    }
  });

  if (currentScene) {
    currentScene.content = buffer.join('\n').trim();
    scenes.push(currentScene);
  }

  return scenes;
};

// PREPROCESSING: Fix malformed scripts where AI forgets to insert newlines
const normalizeScriptText = (text: string): string => {
    let cleanText = text;
    
    // 1. Force newline before and after "Episode Headers" (e.g. 第1集 or 第一集)
    // Matches "第" + (Chinese numbers or digits) + "集"
    // Using simple replacement to detach it from preceding/succeeding text
    cleanText = cleanText.replace(/([^\n])(第\s*[0-90-9零一二三四五六七八九十百千两]+\s*集)/g, '$1\n\n$2');
    cleanText = cleanText.replace(/(第\s*[0-90-9零一二三四五六七八九十百千两]+\s*集)([^\n])/g, '$1\n\n$2');

    // 2. Force newline before "Scene Headers" (e.g. 1-1 SceneName)
    // Avoids matching things inside text like "1-1 draw" unless it looks like a header
    // Regex: Look for pattern "Digits-Digits Space Text"
    // Note: This is aggressive, but necessary for the "1-1 ... content" on same line bug
    cleanText = cleanText.replace(/([^\n])(\d+-\d+\s+)/g, '$1\n$2');
    
    // 3. Optional: If a line starts with a scene header but is extremely long, split it?
    // It's safer to let the `parseScenes` logic handle content, but ensuring the header start is on a new line is key.

    return cleanText;
};

export const parseScriptToEpisodes = (rawText: string): Episode[] => {
  // Normalize Input First
  const normalizedText = normalizeScriptText(rawText);

  // Split by newline, handling potential Windows CRLF
  const lines = normalizedText.split(/\r?\n/);
  const episodes: Episode[] = [];
  let currentEpisode: Episode | null = null;
  let buffer: string[] = [];

  // Robust Regex to match "第X集" at the start of a line
  // Supports both Arabic (1) and Chinese (一) numerals
  const episodeStartRegex = /^\s*第\s*[0-90-9\d零一二三四五六七八九十百千两]+\s*集/;

  lines.forEach((line) => {
    // Check if line matches Episode Header AND isn't absurdly long (e.g. accidentally captured a whole paragraph)
    if (episodeStartRegex.test(line) && line.length < 50) {
      if (currentEpisode) {
        const fullContent = buffer.join('\n').trim();
        currentEpisode.content = fullContent;
        // Parse scenes within this episode
        currentEpisode.scenes = parseScenes(fullContent);
        episodes.push(currentEpisode);
      }

      buffer = [];
      const title = line.trim();
      currentEpisode = {
        id: episodes.length + 1,
        title: title,
        content: '',
        scenes: [],
        shots: [],
        status: 'pending'
      };
      buffer.push(line); 
    } else {
      if (currentEpisode) {
        buffer.push(line);
      }
    }
  });

  if (currentEpisode) {
    const fullContent = buffer.join('\n').trim();
    currentEpisode.content = fullContent;
    currentEpisode.scenes = parseScenes(fullContent);
    episodes.push(currentEpisode);
  }

  // Fallback: if no episode headers were found, treat entire script as a single episode
  if (episodes.length === 0 && normalizedText.trim().length > 0) {
    const fullContent = normalizedText.trim();
    episodes.push({
      id: 1,
      title: "第1集",
      content: fullContent,
      scenes: parseScenes(fullContent),
      shots: [],
      status: 'pending'
    });
  }

  return episodes;
};

// --- EXPORT FUNCTIONS ---

// 1. CSV EXPORT (Robust, Best Compatibility)
export const exportToCSV = (episodes: Episode[]) => {
  const headers = ['Episode', 'Shot ID', 'Duration', 'Type', 'Movement', 'Description', 'Dialogue', 'Sora Prompt'];
  
  // Add Byte Order Mark (BOM) so Excel recognizes formatting as UTF-8 automatically
  let csvContent = '\ufeff' + headers.map(h => `"${h}"`).join(',') + '\n';

  episodes.forEach(ep => {
    ep.shots.forEach(shot => {
      const row = [
        ep.title,
        shot.id,
        shot.duration,
        shot.shotType,
        shot.movement,
        shot.description,
        shot.dialogue,
        shot.soraPrompt
      ];
      
      // Escape logic: 
      // 1. Convert to string
      // 2. Replace double quotes " with two double quotes ""
      // 3. Wrap entire field in double quotes
      const rowStr = row.map(field => {
        const safeField = (field || '').toString().replace(/"/g, '""');
        return `"${safeField}"`;
      }).join(',');
      
      csvContent += rowStr + '\n';
    });
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `script2video_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 2. XLS EXPORT (HTML Table method, preserves visual layout like text wrapping)
export const exportToXLS = (episodes: Episode[]) => {
  // We use an HTML table strategy to fake an Excel file.
  // This allows us to use CSS for bold headers, column widths, and text wrapping.
  // Excel opens this natively (though it might warn about extension mismatch, which is safe to ignore).
  
  let table = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  table { border-collapse: collapse; width: 100%; }
  th { 
      background-color: #4f46e5; 
      color: white; 
      font-weight: bold; 
      padding: 10px; 
      border: 1px solid #000; 
      text-align: left;
  }
  td { 
      padding: 8px; 
      border: 1px solid #ccc; 
      vertical-align: top; 
      white-space: pre-wrap; /* Critical for wrapping long text */
  }
  /* Column widths */
  .col-id { width: 80px; }
  .col-dur { width: 60px; }
  .col-type { width: 80px; }
  .col-move { width: 80px; }
  .col-desc { width: 350px; }
  .col-dial { width: 200px; }
  .col-sora { width: 450px; background-color: #f0fdf4; } /* Slight green tint for prompt */
</style>
</head>
<body>
<table>
  <tr>
    <th>Episode</th>
    <th class="col-id">Shot ID</th>
    <th class="col-dur">Duration</th>
    <th class="col-type">Type</th>
    <th class="col-move">Movement</th>
    <th class="col-desc">Description</th>
    <th class="col-dial">Dialogue</th>
    <th class="col-sora">Sora Prompt</th>
  </tr>`;

  episodes.forEach(ep => {
    ep.shots.forEach(shot => {
      table += `<tr>
        <td>${ep.title}</td>
        <td>${shot.id}</td>
        <td>${shot.duration}</td>
        <td>${shot.shotType}</td>
        <td>${shot.movement}</td>
        <td>${shot.description}</td>
        <td>${shot.dialogue}</td>
        <td>${shot.soraPrompt}</td>
      </tr>`;
    });
  });

  table += `</table></body></html>`;

  const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `shooting_script_formatted_${Date.now()}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper to parse CSV line respecting quotes
const parseCSVLine = (text: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

export const parseCSVToShots = (csvText: string): Map<string, Shot[]> => {
  const lines = csvText.split(/\r?\n/);
  const shotMap = new Map<string, Shot[]>();
  
  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  // Identify headers to ensure correct column mapping
  const headers = parseCSVLine(lines[0]);
  const epIdx = headers.indexOf('Episode');
  const idIdx = headers.indexOf('Shot ID');
  const durIdx = headers.indexOf('Duration');
  const typeIdx = headers.indexOf('Type');
  const moveIdx = headers.indexOf('Movement');
  const descIdx = headers.indexOf('Description');
  const dialIdx = headers.indexOf('Dialogue');
  const soraIdx = headers.indexOf('Sora Prompt');

  if (epIdx === -1 || idIdx === -1) {
    throw new Error("Invalid CSV Format: Missing 'Episode' or 'Shot ID' headers.");
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = parseCSVLine(line);
    if (cols.length < headers.length) continue; // Skip malformed lines

    const episodeTitle = cols[epIdx];
    const shot: Shot = {
      id: cols[idIdx],
      duration: cols[durIdx] || '',
      shotType: cols[typeIdx] || '',
      movement: cols[moveIdx] || '',
      description: cols[descIdx] || '',
      dialogue: cols[dialIdx] || '',
      soraPrompt: cols[soraIdx] || ''
    };

    if (!shotMap.has(episodeTitle)) {
      shotMap.set(episodeTitle, []);
    }
    shotMap.get(episodeTitle)?.push(shot);
  }

  return shotMap;
};
