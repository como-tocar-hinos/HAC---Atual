
export interface Hymn {
  id: string;
  title: string;
  artist: string;
  level_id: string; 
  content: string;
  original_key: string;
  video_url?: string; // Legado
  video_url_guitar?: string; // Link para vídeo/áudio de Violão
  video_url_piano?: string; // Link para vídeo/áudio de Piano
}

export interface Level {
  id: string;
  name: string;
  description: string;
  color: string;
  hymnCount?: number; 
}

export type ViewState = 'home' | 'hymn-detail';
export type InstrumentModality = 'guitar' | 'piano';

export interface ChordMapping {
  [key: string]: string;
}
