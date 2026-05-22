
import { Hymn, Level } from './types';

export const INITIAL_LEVELS: Level[] = [
  { 
    id: 'level-iniciante', 
    name: 'Nível Zero e Iniciante', 
    description: 'Hinos com acordes básicos e ritmos simples.', 
    color: 'bg-amber-500' 
  },
  { 
    id: 'level-intermediario', 
    name: 'Intermediário', 
    description: 'Introdução a pestanas, dedilhados e ritmos elaborados.', 
    color: 'bg-emerald-500' 
  },
  { 
    id: 'level-avancado', 
    name: 'Avançado', 
    description: 'Harmonias complexas, jazz chords e rearmonizações.', 
    color: 'bg-purple-600' 
  }
];

export const MOCK_HYMNS: Hymn[] = [
  {
    id: 'h-sabado-chegou',
    title: 'O Sábado Chegou',
    artist: 'Letra: Dario Pires de Araújo (1937-) - Música: William Batchelder Bradbury (1816-1868) - Êxodo 20:8-11',
    level_id: 'level-avancado',
    original_key: 'Db',
    content: `[Db] Lento e calmo         [F6/9] [Db/F] [Dbm7(11)] [Db]
foge o dia,
[Ab] Já [Db/Ab] a [Ab7] tarde [Db] se apagou;

          [F6/9] [Db/F] [Dbm7(11)] [Db]
Oh, que paz e que a_____le________gria,
[Ab] Pois [Db/Ab] o [Ab7] sábado [Db] chegou!

          [Gb] [Gb9(11#)] [Gb] [Db]
És bem-vindo, és bem-vindo,`,
    video_url_guitar: 'https://www.w3schools.com/html/mov_bbb.mp4',
    video_url_piano: 'https://www.w3schools.com/html/movie.mp4',
  },
  {
    id: 'h-jazz-test',
    title: 'Brilho Celeste (Harmonizado)',
    artist: 'Teste de Acordes Complexos',
    level_id: 'level-avancado',
    original_key: 'Db',
    content: `[Db] Brilho ce[F6/9]leste, [Db/F] brilho ce[Dbm7(11)]leste
[Db] Enche a mi[F6/9]nh'alma, [Db/F] glória do [Dbm7(11)]céu
[Db] Desde que [F6/9]Cristo, [Db/F] me fez dis[Dbm7(11)]cípulo
[Db] Tenho o ce[F6/9]leste [Db/F] brilho do [Db]céu.`,
    video_url_guitar: 'https://www.w3schools.com/html/mov_bbb.mp4',
    video_url_piano: 'https://www.w3schools.com/html/movie.mp4',
  },
  {
    id: 'h1',
    title: 'Porque Ele Vive',
    artist: 'Harpa Cristã',
    level_id: 'level-iniciante',
    original_key: 'G',
    video_url_guitar: 'https://www.w3schools.com/html/mov_bbb.mp4',
    video_url_piano: 'https://www.w3schools.com/html/movie.mp4',
    content: `[G] Deus enviou Seu [C] Filho a[G]mado
Para mor[D]rer em meu lu[G]gar
Na cruz so[G]freu por [C] meus pe[G]cados
Mas o túmulo va[D]zio está para pro[G]var.

[G] Porque Ele [C] vive, posso crer no ama[G]nhã
Porque Ele [D] vive, temor não [G] há
Mas eu bem [G] sei, eu [C] sei, que a minha [G] vida
Está nas [D] mãos do meu Jesus, que vivo es[G]tá.`
  },
  {
    id: 'h2',
    title: 'Grandioso És Tu',
    artist: 'Harpa Cristã',
    level_id: 'level-intermediario',
    original_key: 'C',
    video_url_guitar: 'https://www.w3schools.com/html/mov_bbb.mp4',
    video_url_piano: 'https://www.w3schools.com/html/movie.mp4',
    content: `[C] Senhor meu Deus, quando eu mara[F]vilhado
Fi[C]co a pen[G]sar nas obras de Tuas [C] mãos
O céu azul, de es[F]trelas pon[C]tilhado
O Teu po[G]der, mostrado na cria[C]ção.

Então mi[C]nh'alma [F] canta a Ti, Se[C]nhor
Grandi[G]oso és Tu! Grandi[C]oso és Tu!
Então mi[C]nh'alma [F] canta a Ti, Se[C]nhor
Grandi[G]oso és Tu! Grandi[C]oso és Tu!`
  }
];

export const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const TUNER_NOTES = [
  { note: 'E2', freq: 82.41 },
  { note: 'A2', freq: 110.00 },
  { note: 'D3', freq: 146.83 },
  { note: 'G3', freq: 196.00 },
  { note: 'B3', freq: 246.94 },
  { note: 'E4', freq: 329.63 }
];
