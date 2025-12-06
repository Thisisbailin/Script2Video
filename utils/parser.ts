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

export const parseScriptToEpisodes = (rawText: string): Episode[] => {
  // Split by newline, handling potential Windows CRLF
  const lines = rawText.split(/\r?\n/);
  const episodes: Episode[] = [];
  let currentEpisode: Episode | null = null;
  let buffer: string[] = [];

  // Robust Regex to match "第X集" at the start of a line
  const episodeStartRegex = /^\s*第\s*[0-90-9零一二三四五六七八九十百千两]+\s*集/;

  lines.forEach((line) => {
    if (episodeStartRegex.test(line)) {
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

  return episodes;
};

// Replaces exportToCSV with exportToExcel (HTML-based XLS)
export const exportToExcel = (episodes: Episode[]) => {
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
  link.setAttribute('download', 'shooting_script_sora.xls');
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