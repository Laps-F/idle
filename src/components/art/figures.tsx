/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/art/figures.tsx
 * O que faz: guarda as xilogravuras do jogo, desenhadas em SVG. Cada figura é
 * uma mancha de tinta (a cor do texto, "currentColor") com cortes na cor do
 * papel (a variável CSS "--corte"), como em uma matriz de madeira entalhada.
 *
 * Todas usam a mesma prancha de 120 por 120. Para acrescentar uma figura,
 * crie o desenho e registre o id em FIGURES. O id é o mesmo do encantado ou
 * do inimigo em src/data.
 *
 * Mapa:
 *   1. Estilos de traço
 *   2. Encantados
 *   3. Visagens e chefes
 *   4. Registro das figuras
 */

import type { ReactNode } from 'react';

// =============================================================================
// =============================================================================
// E S T I L O S   D E   T R A Ç O

// Corte: o sulco que deixa o papel aparecer por dentro da mancha de tinta
const CUT = {
  fill: 'none',
  stroke: 'var(--corte)',
  strokeWidth: 2.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Área cortada inteira, como um olho
const CUT_FILL = { fill: 'var(--corte)' } as const;

// Traço de tinta solto, fora da mancha (vento, água, capim)
const INK_LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;


// =============================================================================
// =============================================================================
// E N C A N T A D O S

// Saci: gorro caído, uma perna só e o redemoinho aos pés
const SACI = (
  <>
    <path d="M36 32 Q52 2 82 22 L100 46 L80 38 Q60 26 36 32 Z" />
    <circle cx="60" cy="40" r="16" />
    <path d="M45 57 L75 57 L82 92 L38 92 Z" />
    <path d="M46 60 L24 74 L28 82 L50 71 Z" />
    <path d="M74 60 L98 50 L100 58 L77 71 Z" />
    <path d="M52 90 L68 90 L67 108 L80 112 L80 117 L50 117 Z" />
    <path d="M14 106 Q28 96 40 104" {...INK_LINE} />
    <path d="M86 104 Q98 96 108 106" {...INK_LINE} />
    <path d="M22 116 Q34 110 44 116" {...INK_LINE} />
    <circle cx="54" cy="39" r="2.6" {...CUT_FILL} />
    <circle cx="66" cy="39" r="2.6" {...CUT_FILL} />
    <path d="M53 47 Q60 53 67 47" {...CUT} />
    <path d="M48 24 Q62 14 78 24" {...CUT} />
    <path d="M50 66 L70 66 M48 76 L72 76" {...CUT} />
  </>
);

// Curupira: cabelo de fogo e os pés virados para trás
const CURUPIRA = (
  <>
    <path d="M36 44 L28 16 L42 30 L46 6 L56 26 L64 2 L72 26 L86 8 L84 44 Z" />
    <circle cx="60" cy="46" r="15" />
    <path d="M45 61 L75 61 L80 96 L40 96 Z" />
    <path d="M46 64 L22 56 L20 64 L46 76 Z" />
    <path d="M74 64 L98 74 L95 82 L74 76 Z" />
    <path d="M44 94 L55 94 L55 117 L28 117 L28 109 L44 109 Z" />
    <path d="M66 94 L77 94 L77 117 L58 117 L58 109 L66 109 Z" />
    <circle cx="54" cy="45" r="2.6" {...CUT_FILL} />
    <circle cx="66" cy="45" r="2.6" {...CUT_FILL} />
    <path d="M54 53 L66 53" {...CUT} />
    <path d="M44 34 L46 20 M58 34 L60 16 M72 34 L76 22" {...CUT} />
    <path d="M48 70 L72 70 M46 82 L74 82" {...CUT} />
  </>
);

// Iara: cabelo comprido, cauda de peixe e a água em volta
const IARA = (
  <>
    <path d="M40 30 Q36 6 60 6 Q86 6 82 34 Q92 58 82 80 L70 62 L72 40 Z" />
    <path d="M42 28 Q30 48 36 70 L50 54 Z" />
    <circle cx="60" cy="30" r="13" />
    <path d="M50 44 L70 44 L73 70 L47 70 Z" />
    <path d="M50 48 L32 62 L37 68 L53 57 Z" />
    <path d="M70 48 L90 60 L86 66 L68 57 Z" />
    <path d="M47 68 L73 68 C78 86 68 100 52 102 C43 103 37 100 33 95 L19 106 L20 82 L35 88 C39 92 46 92 50 88 C54 83 52 76 47 68 Z" />
    <path d="M8 114 Q18 106 28 114 T48 114 T68 114 T88 114 T112 114" {...INK_LINE} />
    <circle cx="55" cy="29" r="2.4" {...CUT_FILL} />
    <circle cx="65" cy="29" r="2.4" {...CUT_FILL} />
    <path d="M55 36 Q60 40 65 36" {...CUT} />
    <path d="M56 78 Q62 82 68 78 M54 88 Q60 92 66 87 M44 96 Q49 99 54 96" {...CUT} />
    <path d="M74 20 Q80 34 78 50 M46 14 Q54 10 64 12" {...CUT} />
  </>
);

// Caipora: montada no porco-do-mato, de lança na mão
const CAIPORA = (
  <>
    <ellipse cx="56" cy="84" rx="36" ry="17" />
    <path d="M84 72 L112 82 L110 92 L86 97 Z" />
    <path d="M26 74 L30 60 L38 72 L44 58 L52 70 L58 56 L66 70 L72 60 L80 74 Z" />
    <path d="M30 94 L39 94 L38 116 L30 116 Z" />
    <path d="M47 96 L56 96 L55 116 L47 116 Z" />
    <path d="M65 96 L74 96 L73 116 L65 116 Z" />
    <path d="M80 92 L89 92 L88 116 L80 116 Z" />
    <path d="M22 80 Q12 76 12 66" {...INK_LINE} />
    <path d="M42 34 L36 20 L46 26 L50 12 L57 24 L66 14 L66 34 Z" />
    <circle cx="54" cy="36" r="10" />
    <path d="M46 46 L62 46 L66 70 L42 70 Z" />
    <path d="M60 50 L78 56 L76 62 L60 58 Z" />
    <path d="M74 14 L82 76" {...INK_LINE} />
    <path d="M70 16 L74 2 L80 15 Z" />
    <circle cx="100" cy="82" r="2.6" {...CUT_FILL} />
    <path d="M100 91 L106 86" {...CUT} />
    <circle cx="51" cy="35" r="2" {...CUT_FILL} />
    <circle cx="58" cy="35" r="2" {...CUT_FILL} />
    <path d="M34 82 Q44 76 54 82 M58 88 Q68 82 78 88" {...CUT} />
  </>
);

// Boitatá: cobra de fogo, corpo em curvas e olhos acesos
const BOITATA = (
  <>
    <path
      d="M16 100 C28 70 50 112 62 86 C72 64 46 54 60 36 C68 26 84 28 92 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="17"
      strokeLinecap="round"
    />
    <ellipse cx="97" cy="44" rx="15" ry="11" transform="rotate(28 97 44)" />
    <path d="M26 78 L30 60 L38 76 Z" />
    <path d="M50 86 L60 68 L64 88 Z" />
    <path d="M70 62 L84 54 L74 72 Z" />
    <path d="M50 44 L42 28 L58 34 Z" />
    <path d="M72 24 L78 6 L86 24 Z" />
    <path d="M94 30 L106 14 L108 34 Z" />
    <path d="M108 52 L118 58 M108 52 L116 46" {...INK_LINE} />
    <circle cx="93" cy="40" r="3.4" {...CUT_FILL} />
    <circle cx="103" cy="45" r="3.4" {...CUT_FILL} />
    <path d="M22 92 L30 96 M36 86 L42 94 M54 92 L60 84 M62 70 L54 66 M58 46 L66 50" {...CUT} />
  </>
);


// =============================================================================
// =============================================================================
// V I S A G E N S   E   C H E F E S

// Visagem da Neblina: um lençol de névoa com olhos vazios
const VISAGEM_DA_NEBLINA = (
  <>
    <path d="M60 10 C84 10 95 34 92 58 C91 76 98 92 106 104 C94 100 86 104 80 112 C74 102 66 102 60 112 C54 102 46 102 40 112 C34 104 26 100 14 104 C22 92 29 76 28 58 C25 34 36 10 60 10 Z" />
    <path d="M2 56 L18 56 M4 70 L16 70 M102 48 L118 48 M104 62 L116 62" {...INK_LINE} />
    <ellipse cx="49" cy="46" rx="5.5" ry="9" {...CUT_FILL} />
    <ellipse cx="71" cy="46" rx="5.5" ry="9" {...CUT_FILL} />
    <ellipse cx="60" cy="70" rx="6" ry="9" {...CUT_FILL} />
    <path d="M40 84 Q44 94 40 100 M80 84 Q76 94 80 100 M60 90 L60 100" {...CUT} />
  </>
);

// Vulto da Capoeira: sombra encurvada, de braços compridos, no meio do mato
const VULTO_DA_CAPOEIRA = (
  <>
    <path d="M58 12 C74 12 86 26 85 44 C98 54 102 74 100 114 L20 114 C18 82 25 58 38 46 C37 26 44 12 58 12 Z" />
    <path d="M36 60 L10 98 L14 106 L18 98 L20 108 L24 98 L44 76 Z" />
    <path d="M86 60 L110 96 L107 106 L103 97 L100 108 L96 98 L80 74 Z" />
    <path d="M2 114 L6 100 L10 114 Z M110 114 L114 98 L118 114 Z" />
    <path d="M46 36 L58 42" {...CUT} strokeWidth={4.5} />
    <path d="M66 42 L78 36" {...CUT} strokeWidth={4.5} />
    <path d="M50 54 Q61 60 72 54" {...CUT} />
    <path d="M44 72 Q40 90 42 108 M60 68 L60 108 M76 72 Q80 90 78 108" {...CUT} />
  </>
);

// Assombro do Brejo: um monte de lama que sobe da água, entre as taboas
const ASSOMBRO_DO_BREJO = (
  <>
    <path d="M14 106 C14 72 32 40 58 40 C88 40 106 72 106 106 Z" />
    <circle cx="42" cy="46" r="9" />
    <circle cx="74" cy="42" r="11" />
    <path d="M10 106 L8 56" {...INK_LINE} />
    <ellipse cx="8" cy="50" rx="3.5" ry="10" />
    <path d="M112 106 L114 62" {...INK_LINE} />
    <ellipse cx="114" cy="54" rx="3.5" ry="10" />
    <path d="M2 112 L118 112" {...INK_LINE} />
    <circle cx="46" cy="68" r="8" {...CUT_FILL} />
    <circle cx="74" cy="68" r="8" {...CUT_FILL} />
    <circle cx="47" cy="70" r="3.4" />
    <circle cx="73" cy="70" r="3.4" />
    <path d="M42 88 Q51 80 60 88 T78 88" {...CUT} />
    <path d="M26 98 Q34 94 42 98 M78 98 Q86 94 94 98" {...CUT} />
  </>
);

// Corpo-Seco: o morto que a terra não quis, só osso e couro
const CORPO_SECO = (
  <>
    <circle cx="60" cy="24" r="17" />
    <path d="M49 34 L71 34 L68 48 L52 48 Z" />
    <path d="M56 48 L64 48 L64 56 L56 56 Z" />
    <path d="M38 54 L82 54 L75 94 L45 94 Z" />
    <path d="M40 56 L18 40 L12 14 L19 13 L24 34 L46 50 Z" />
    <path d="M12 14 L6 6 M15 13 L14 3 M19 13 L22 4" {...INK_LINE} strokeWidth={2.6} />
    <path d="M80 56 L103 74 L106 100 L99 101 L96 79 L75 63 Z" />
    <path d="M100 100 L96 110 M103 100 L104 111 M106 100 L112 108" {...INK_LINE} strokeWidth={2.6} />
    <path d="M47 92 L56 92 L54 116 L46 116 Z" />
    <path d="M64 92 L73 92 L74 116 L66 116 Z" />
    <circle cx="53" cy="23" r="5" {...CUT_FILL} />
    <circle cx="67" cy="23" r="5" {...CUT_FILL} />
    <path d="M60 28 L57 34 L63 34 Z" {...CUT_FILL} />
    <path d="M54 41 L66 41 M57 38 L57 45 M60 38 L60 45 M63 38 L63 45" {...CUT} strokeWidth={1.8} />
    <path d="M45 62 L75 62 M46 70 L74 70 M47 78 L73 78 M49 86 L71 86 M60 56 L60 92" {...CUT} />
  </>
);

// Figura genérica, para um id que ainda não tem desenho
const UNKNOWN = (
  <>
    <path d="M60 12 C86 12 100 34 100 60 C100 88 84 110 60 110 C36 110 20 88 20 60 C20 34 34 12 60 12 Z" />
    <path d="M46 46 Q46 30 60 30 Q76 30 76 46 Q76 56 62 62 L62 72" {...CUT} strokeWidth={6} />
    <circle cx="62" cy="88" r="4.5" {...CUT_FILL} />
  </>
);


// =============================================================================
// =============================================================================
// R E G I S T R O   D A S   F I G U R A S

const FIGURES: Record<string, ReactNode> = {
  saci: SACI,
  curupira: CURUPIRA,
  iara: IARA,
  caipora: CAIPORA,
  boitata: BOITATA,
  'visagem-da-neblina': VISAGEM_DA_NEBLINA,
  'vulto-da-capoeira': VULTO_DA_CAPOEIRA,
  'assombro-do-brejo': ASSOMBRO_DO_BREJO,
  'corpo-seco': CORPO_SECO,
};

// Desenho de um encantado ou inimigo. Id sem desenho recebe a figura genérica.
export function getFigureArt(figureId: string): ReactNode {
  return FIGURES[figureId] ?? UNKNOWN;
}
