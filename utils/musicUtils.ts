
import { CHROMATIC_SCALE } from '../constants';

/**
 * Converte links do YouTube ou TikTok para o formato de embed
 */
export const getEmbedUrl = (url: string): { url: string; originalUrl: string; type: 'youtube' | 'tiktok' | 'facebook' | 'video' | 'none' } => {
  if (!url) return { url: '', originalUrl: '', type: 'none' };

  const lowUrl = url.toLowerCase();

  // 1. YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = url.match(ytRegex);
  if (ytMatch?.[1]) {
    // Usar youtube-nocookie.com aumenta a compatibilidade em sites publicados/produção
    return {
      url: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`,
      originalUrl: url,
      type: 'youtube'
    };
  }

  // 2. Facebook
  if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.watch') || lowUrl.includes('fb.gg')) {
    // Normalizar links de compartilhamento mobile ou curtos
    let cleanUrl = url.replace('m.facebook.com', 'www.facebook.com');
    if (cleanUrl.includes('share/v/')) {
      // Links de compartilhamento do app mobile podem precisar ser limpos
      cleanUrl = cleanUrl.split('?')[0]; 
    }
    
    // Codifica o URL para o plugin oficial do Facebook
    const fbUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=false&t=0&autoplay=true&mute=0&container_width=300`;
    return { url: fbUrl, originalUrl: url, type: 'facebook' };
  }

  // 3. TikTok
  if (lowUrl.includes('tiktok.com')) {
    // Tenta extrair o ID numérico do vídeo (15+ dígitos)
    const ttMatch = url.match(/\/(\d{15,})/);
    const id = ttMatch?.[1];
    
    if (id && /^\d+$/.test(id)) {
      // Usar a versão /embed/v2/ que é mais isolada e não carregar o feed "Discover"
      return {
        url: `https://www.tiktok.com/embed/v2/${id}?autoplay=1`,
        originalUrl: url,
        type: 'tiktok'
      };
    }

    // Se for um link curto (vm.tiktok.com) ou não encontramos o ID numérico,
    // retornamos o link original. O ReactPlayer tentará carregar, 
    // e o componente mostrará o botão "Abrir no TikTok".
    return {
      url: url,
      originalUrl: url,
      type: 'tiktok'
    };
  }

  // 3.1 Instagram (Adicionado para maior compatibilidade)
  if (lowUrl.includes('instagram.com')) {
    return {
      url: url,
      originalUrl: url,
      type: 'video' // Usamos 'video' para que o Player o renderize
    };
  }

  // 3.2 Vimeo (Adicionado para maior compatibilidade)
  if (lowUrl.includes('vimeo.com')) {
    return {
      url: url,
      originalUrl: url,
      type: 'youtube' // ReactPlayer trata Vimeo bem, usamos 'youtube' ou similar para layout horizontal
    };
  }

  // 3.3 Google Drive (Formatando para embed)
  if (lowUrl.includes('drive.google.com')) {
    let driveUrl = url;
    if (url.includes('/view')) {
      driveUrl = url.replace('/view', '/preview');
    } else if (url.includes('/file/d/')) {
      const parts = url.split('/file/d/');
      const id = parts[1].split('/')[0].split('?')[0];
      driveUrl = `https://drive.google.com/file/d/${id}/preview`;
    }
    return {
      url: driveUrl,
      originalUrl: url,
      type: 'video'
    };
  }

  // 4. Arquivos de Vídeo ou URLs desconhecidas (Catch-all)
  if (lowUrl.match(/\.(mp4|webm|ogg|mov)$/i) || lowUrl.startsWith('http')) {
    return { url, originalUrl: url, type: 'video' };
  }

  return { url: '', originalUrl: url, type: 'none' };
};

/**
 * Regex para identificar acordes de forma robusta.
 * Suporta bases A-G, sustenidos/bemóis, qualidades, extensões complexas (6/9, 7(b9), 9(11#), etc.),
 * parênteses, baixos alterados e símbolos especiais (°, ø, ∆).
 * Usa limites de palavra (\b) e lookaheads para compatibilidade com iPads antigos.
 */
const CHORD_REGEX = /\b[A-G][#b♯♭]?(?:m|M|maj|min|aug|dim|sus|add|alt|[\d\+\-\(\)#b♯♭°øº∆Δ\!])*(?:\/(?:[A-G][#b♯♭]?|[0-9]+)(?:m|M|maj|min|aug|dim|sus|add|alt|[\d\+\-\(\)#b♯♭°øº∆Δ\!])*)?(?![a-zA-Z])/g;

export const transposeNote = (note: string, semitones: number): string => {
  if (!note) return note;
  const flatMap: { [key: string]: string } = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'db': 'C#', 'eb': 'D#', 'gb': 'F#', 'ab': 'G#', 'bb': 'A#',
    'cb': 'B', 'fb': 'E',
    'C♯': 'C#', 'D♯': 'D#', 'F♯': 'F#', 'G♯': 'G#', 'A♯': 'A#',
    'D♭': 'C#', 'E♭': 'D#', 'G♭': 'F#', 'A♭': 'G#', 'B♭': 'A#',
    '♯': '#', '♭': 'b'
  };
  let normalizedNote = note;
  // Substitui símbolos unicode por padrão
  Object.keys(flatMap).forEach(key => {
    normalizedNote = normalizedNote.replace(new RegExp(key, 'g'), flatMap[key]);
  });
  normalizedNote = normalizedNote.toUpperCase();

  if (normalizedNote === 'E#') normalizedNote = 'F';
  if (normalizedNote === 'B#') normalizedNote = 'C';
  const index = CHROMATIC_SCALE.indexOf(normalizedNote);
  if (index === -1) return note;
  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;
  return CHROMATIC_SCALE[newIndex];
};

export const transposeChord = (chord: string, semitones: number): string => {
  if (semitones === 0 || !chord) return chord;

  // Validação rigorosa para evitar transpor palavras como "Fim" ou tags estruturais
  const singleChordRegex = /^[A-G][#b♯♭]?(?:m|M|maj|min|aug|dim|sus|add|alt|[\d\+\-\(\)#b♯♭°øº∆Δ\!])*(?:\/(?:[A-G][#b♯♭]?|[0-9]+)(?:m|M|maj|min|aug|dim|sus|add|alt|[\d\+\-\(\)#b♯♭°øº∆Δ\!])*)?$/;
  if (!singleChordRegex.test(chord)) return chord;

  if (chord.includes('/')) {
    const [main, bass] = chord.split('/');
    const transposedMain = transposeChord(main.trim(), semitones);
    // Transpõe o baixo se for uma nota válida, senão mantém (ex: parte de extensões como 6/9)
    const isNote = /^[A-G][#b]?$/i.test(bass.trim());
    const transposedBass = isNote ? transposeNote(bass.trim(), semitones) : bass.trim();
    return `${transposedMain}/${transposedBass}`;
  }
  const match = chord.match(/^([A-G][#b]?)(.*)/i);
  if (!match) return chord;
  const root = match[1];
  const suffix = match[2];
  const newRoot = transposeNote(root, semitones);
  return newRoot + suffix;
};

export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Se a linha for uma tag estrutural, não é uma linha de acordes
  const tagsToIgnore = ['[refrão]', '[coro]', '[fim do refrão]', '[fim]', '[ponte]', '[intro]', '[solo]'];
  if (tagsToIgnore.includes(trimmed.toLowerCase())) return false;

  // Remove padrões de acordes e símbolos musicais comuns
  const remaining = trimmed
    .replace(CHORD_REGEX, '')
    .replace(/[\[\]\s\|,\.\-\(\)#b♯♭\d\+]/g, '');
  
  // Se não sobrar nenhum caractere alfabético "não-musical", é uma linha de acordes.
  // Permitimos que sobrem alguns caracteres se a linha for predominantemente acordes (até 30% de ruído).
  return remaining.length === 0 || (remaining.length < trimmed.length * 0.3 && !/[a-z]{3,}/i.test(remaining));
};

export const transposeContent = (content: string, semitones: number): string => {
  if (semitones === 0) return content;
  const lines = content.split('\n');
  const tagsToIgnore = ['refrão', 'coro', 'fim do refrão', 'fim', 'ponte', 'intro', 'solo'];

  return lines.map(line => {
    if (line.includes('[') && line.includes(']')) {
      return line.replace(/\[(.*?)\]/g, (match, inner) => {
        const trimmedInner = inner.trim();
        if (tagsToIgnore.includes(trimmedInner.toLowerCase())) {
          return match;
        }
        return `[${transposeChord(trimmedInner, semitones)}]`;
      });
    }

    if (isChordLine(line)) {
      const matches = Array.from(line.matchAll(CHORD_REGEX));
      if (matches.length === 0) return line;

      let newLine = line;
      let runningDiff = 0;

      for (const match of matches) {
        const chord = match[0];
        const originalPos = match.index!;
        const currentPos = originalPos + runningDiff;
        
        const transposed = transposeChord(chord, semitones);
        const diff = transposed.length - chord.length;

        const before = newLine.substring(0, currentPos);
        const after = newLine.substring(currentPos + chord.length);
        
        let adjustedAfter = after;
        if (diff > 0) {
          // Chord got longer: remove spaces from the right to keep following chords in place
          let spacesToRemove = diff;
          while (spacesToRemove > 0 && adjustedAfter.startsWith(' ')) {
            adjustedAfter = adjustedAfter.substring(1);
            spacesToRemove--;
          }
        } else if (diff < 0) {
          // Chord got shorter: add spaces to the right to keep following chords in place
          adjustedAfter = ' '.repeat(Math.abs(diff)) + adjustedAfter;
        }

        const oldLength = newLine.length;
        newLine = before + transposed + adjustedAfter;
        runningDiff += (newLine.length - oldLength);
      }
      return newLine;
    }
    return line;
  }).join('\n');
};
