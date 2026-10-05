// Every string on screen, in eight languages. Stored data is language-neutral; this is display only.
// Languages: those of the 10 countries with the largest share of Claude.ai use (Anthropic Economic Index, February 2026), plus Turkish.

export type Lang = 'en' | 'tr' | 'fr' | 'de' | 'ja' | 'ko' | 'pt-BR' | 'es'

export const LANGS: readonly Lang[] = ['en', 'tr', 'fr', 'de', 'ja', 'ko', 'pt-BR', 'es']

// numSep: between a number and its unit, partSep: between two parts ("2s 10dk", "2 Std. 10 Min.", "2時間10分").
export type Units = { m: string; h: string; d: string; numSep: string; partSep: string }

export type Strings = {
  units: Units
  win5h: string
  win7d: string
  ctx: string
  cache: string
  panel: string
  paneTitle: string
  waitingBand: string
  waitingPane: string
  cold: string
  lastTurns: string
  noTurns: string
  lastTurnsHint: string
  turnsTotal: (tokens: string, cost: string, five: string) => string
  colTurn: string
  colSplit: string
  colTokens: string
  colCost: string
  hintIn: string
  hintOut: string
  hintCacheWrite: string
  hintCacheRead: string
  barHint: string
  fiveReset: string
  legendIn: string
  legendOut: string
  legendCacheWrite: string
  legendCacheRead: string
  filledBy: string
  noEntries: string
  byProject: string
  byModel: string
  summary: (view: '5h' | '7d', turns: number, tokens: string, cost: string) => string
  turns: (n: number) => string
  localOnly: string
  resets: string
  inTime: (duration: string, clock: string) => string
  atClock: (hhmm: string) => string
  ttl: (text: string) => string
  ttl5m: string
  ttl1h: string
  unknown: string
  desktopOnlyPane: string
  nudge: (pct: number) => string
  cmdDescription: string
  turnedOn: string
  turnedOff: string
  paneOpened: string
  paneClosed: string
  ttlSet: (text: string) => string
  ttlUnknown: (arg: string) => string
  argUnknown: (arg: string) => string
  barAlt: (n: number, inp: string, out: string, write: string, readTokens: string) => string
  elapsedAlt: (label: string) => string
  usedAlt: (label: string) => string
  paceAtReset: (pct: number) => string
  paceFull: (clock: string, early: string) => string
  noCost: string
  effort: (level: string) => string
}

const USAGE = '[on | off | ttl 5m | ttl 1h]'

const en: Strings = {
  units: { m: 'm', h: 'h', d: 'd', numSep: '', partSep: ' ' },
  win5h: '5h',
  win7d: '7d',
  ctx: 'ctx',
  cache: 'cache',
  panel: 'Panel',
  paneTitle: 'Usage',
  waitingBand: 'waiting for the first reply',
  waitingPane: 'Waiting for the first reply',
  cold: 'cold',
  lastTurns: 'Last 5 turns',
  noTurns: 'No finished turns yet',
  lastTurnsHint: 'Each message you send is one turn. The bar shows the tokens it processed.',
  turnsTotal: (tokens, cost, five) => `Total ${tokens} · ${cost} · ${five}`,
  colTurn: 'Turn',
  colSplit: 'Token split',
  colTokens: 'Tokens',
  colCost: 'Cost',
  hintIn: 'new message and files',
  hintOut: "Claude's writing (priciest)",
  hintCacheWrite: 'storing new context',
  hintCacheRead: 're-reading the conversation (cheap)',
  barHint: 'Hover a bar segment to see its name and size.',
  fiveReset: 'reset',
  legendIn: 'in',
  legendOut: 'out',
  legendCacheWrite: 'cache write',
  legendCacheRead: 'cache read',
  filledBy: 'What filled the window',
  noEntries: 'Nothing recorded in this window',
  byProject: 'By project',
  byModel: 'By model',
  summary: (view, turns, tokens, cost) =>
    `${view === '5h' ? 'Last 5 hours' : 'Last 7 days'}: ${turns === 1 ? '1 turn' : `${turns} turns`} · ${tokens} tokens · ${cost}`,
  turns: n => (n === 1 ? '1 turn' : `${n} turns`),
  localOnly: 'Only Claude Code sessions on this computer, recorded since install.',
  resets: 'Resets',
  inTime: (duration, clock) => `in ${duration} · ${clock}`,
  atClock: hhmm => `at ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 minutes',
  ttl1h: '1 hour',
  unknown: 'unknown',
  desktopOnlyPane: 'The wavy-usage pane draws on desktop only',
  nudge: pct => `context ${pct}% · /clear if the next thing is a new task, /compact to keep going`,
  cmdDescription: 'Usage rings: no argument toggles the pane; on/off; ttl 5m/1h sets the cache lifetime (wavy-usage)',
  turnedOn: 'wavy-usage on',
  turnedOff: 'wavy-usage off. Turn it back on with /wavy-usage on',
  paneOpened: 'Pane opened',
  paneClosed: 'Pane closed',
  ttlSet: text => `cache TTL: ${text}`,
  ttlUnknown: arg => `wavy-usage: "${arg}" not recognized. Usage: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: "${arg}" not recognized. Usage: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) => `Turn ${n}: ${inp} in, ${out} out, ${write} cache write, ${readTokens} cache read`,
  elapsedAlt: label => `Elapsed part of the ${label} window`,
  usedAlt: label => `Used part of the ${label} limit`,
  paceAtReset: pct => `at this pace: ${pct}% at reset`,
  paceFull: (clock, early) => `at this pace: full by ${clock}, ${early} before reset`,
  noCost: 'no cost',
  effort: l => `Effort: ${l}`,
}

const tr: Strings = {
  units: { m: 'dk', h: 's', d: 'g', numSep: '', partSep: ' ' },
  win5h: '5s',
  win7d: '7g',
  ctx: 'ctx',
  cache: 'cache',
  panel: 'Panel',
  paneTitle: 'Kullanım',
  waitingBand: 'ilk yanıt bekleniyor',
  waitingPane: 'İlk yanıt bekleniyor',
  cold: 'soğuk',
  lastTurns: 'Son 5 tur',
  noTurns: 'Henüz tamamlanan tur yok',
  lastTurnsHint: "Her mesaj bir tur. Çubuk o turda işlenen token'ları gösterir.",
  turnsTotal: (tokens, cost, five) => `Toplam ${tokens} · ${cost} · ${five}`,
  colTurn: 'Tur',
  colSplit: 'Token dağılımı',
  colTokens: 'Token',
  colCost: 'Maliyet',
  hintIn: 'yeni mesaj ve dosyalar',
  hintOut: "Claude'un yazdıkları (en pahalı)",
  hintCacheWrite: 'yeni içeriği saklama',
  hintCacheRead: 'sohbeti yeniden okuma (ucuz)',
  barHint: 'Adını ve miktarını görmek için çubuk parçalarının üzerine gelin.',
  fiveReset: 'sıfırlandı',
  legendIn: 'girdi',
  legendOut: 'çıktı',
  legendCacheWrite: 'cache yazma',
  legendCacheRead: 'cache okuma',
  filledBy: 'Pencereyi dolduranlar',
  noEntries: 'Bu pencerede kayıt yok',
  byProject: 'Projeye göre',
  byModel: 'Modele göre',
  summary: (view, turns, tokens, cost) => `Son ${view === '5h' ? '5 saatte' : '7 günde'} ${turns} tur · ${tokens} token · ${cost}`,
  turns: n => `${n} tur`,
  localOnly: 'Yalnızca bu bilgisayardaki Claude Code oturumları; kayıt kurulumdan itibaren.',
  resets: 'Sıfırlamalar',
  inTime: (duration, clock) => `${duration} sonra · ${clock}`,
  atClock: hhmm => `saat ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 dakika',
  ttl1h: '1 saat',
  unknown: 'bilinmiyor',
  desktopOnlyPane: "wavy-usage paneli yalnızca desktop'ta çizilir",
  nudge: pct => `context %${pct} · yeni iş ise /clear, devam için /compact`,
  cmdDescription: 'Kullanım halkaları: argümansız paneli açar/kapatır, on/off modu, ttl 5m/1h cache süresini ayarlar (wavy-usage)',
  turnedOn: 'wavy-usage açık',
  turnedOff: 'wavy-usage kapalı. Açmak için /wavy-usage on',
  paneOpened: 'Panel açıldı',
  paneClosed: 'Panel kapandı',
  ttlSet: text => `cache TTL: ${text}`,
  ttlUnknown: arg => `wavy-usage: "${arg}" tanınmadı. Kullanım: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: "${arg}" tanınmadı. Kullanım: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) => `Tur ${n}: ${inp} in, ${out} out, ${write} cache yazma, ${readTokens} cache okuma`,
  elapsedAlt: label => `${label} penceresinin geçen kısmı`,
  usedAlt: label => `${label} limitinin kullanılan kısmı`,
  paceAtReset: pct => `bu hızla sıfırlanmada %${pct}`,
  paceFull: (clock, early) => `bu hızla ${clock} civarı dolar, sıfırlanmadan ${early} önce`,
  noCost: 'maliyet yok',
  effort: l => `Efor: ${l}`,
}

const fr: Strings = {
  units: { m: 'min', h: 'h', d: 'j', numSep: '', partSep: ' ' },
  win5h: '5h',
  win7d: '7j',
  ctx: 'ctx',
  cache: 'cache',
  panel: 'Panneau',
  paneTitle: 'Utilisation',
  waitingBand: 'en attente de la première réponse',
  waitingPane: 'En attente de la première réponse',
  cold: 'froid',
  lastTurns: '5 derniers tours',
  noTurns: 'Aucun tour terminé pour le moment',
  lastTurnsHint: 'Chaque message envoyé est un tour. La barre montre les tokens traités.',
  turnsTotal: (tokens, cost, five) => `Total ${tokens} · ${cost} · ${five}`,
  colTurn: 'Tour',
  colSplit: 'Répartition des tokens',
  colTokens: 'Tokens',
  colCost: 'Coût',
  hintIn: 'nouveau message et fichiers',
  hintOut: 'texte écrit par Claude (le plus cher)',
  hintCacheWrite: 'stockage du nouveau contexte',
  hintCacheRead: 'relecture de la conversation (bon marché)',
  barHint: 'Survolez un segment pour voir son nom et sa taille.',
  fiveReset: 'réinitialisé',
  legendIn: 'entrée',
  legendOut: 'sortie',
  legendCacheWrite: 'écriture cache',
  legendCacheRead: 'lecture cache',
  filledBy: 'Ce qui remplit la fenêtre',
  noEntries: 'Aucun enregistrement dans cette fenêtre',
  byProject: 'Par projet',
  byModel: 'Par modèle',
  summary: (view, turns, tokens, cost) =>
    `${view === '5h' ? '5 dernières heures' : '7 derniers jours'} : ${turns === 1 ? '1 tour' : `${turns} tours`} · ${tokens} tokens · ${cost}`,
  turns: n => (n === 1 ? '1 tour' : `${n} tours`),
  localOnly: "Uniquement les sessions Claude Code de cet ordinateur, enregistrées depuis l'installation.",
  resets: 'Réinitialisations',
  inTime: (duration, clock) => `dans ${duration} · ${clock}`,
  atClock: hhmm => `à ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 minutes',
  ttl1h: '1 heure',
  unknown: 'inconnu',
  desktopOnlyPane: "Le panneau wavy-usage ne s'affiche que sur desktop",
  nudge: pct => `contexte ${pct} % · /clear pour une nouvelle tâche, /compact pour continuer`,
  cmdDescription: "Anneaux d'utilisation : sans argument, ouvre/ferme le panneau ; on/off ; ttl 5m/1h règle la durée du cache (wavy-usage)",
  turnedOn: 'wavy-usage activé',
  turnedOff: 'wavy-usage désactivé. Réactivez-le avec /wavy-usage on',
  paneOpened: 'Panneau ouvert',
  paneClosed: 'Panneau fermé',
  ttlSet: text => `TTL du cache : ${text}`,
  ttlUnknown: arg => `wavy-usage : « ${arg} » non reconnu. Utilisation : /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage : « ${arg} » non reconnu. Utilisation : /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) =>
    `Tour ${n} : ${inp} en entrée, ${out} en sortie, ${write} écrits en cache, ${readTokens} lus en cache`,
  elapsedAlt: label => `Partie écoulée de la fenêtre ${label}`,
  usedAlt: label => `Partie utilisée de la limite ${label}`,
  paceAtReset: pct => `à ce rythme : ${pct} % à la réinitialisation`,
  paceFull: (clock, early) => `à ce rythme : pleine vers ${clock}, ${early} avant la réinitialisation`,
  noCost: 'aucun coût',
  effort: l => `Effort : ${l}`,
}

const de: Strings = {
  units: { m: 'Min.', h: 'Std.', d: 'T.', numSep: ' ', partSep: ' ' },
  win5h: '5h',
  win7d: '7T',
  ctx: 'ctx',
  cache: 'Cache',
  panel: 'Panel',
  paneTitle: 'Nutzung',
  waitingBand: 'warte auf die erste Antwort',
  waitingPane: 'Warte auf die erste Antwort',
  cold: 'kalt',
  lastTurns: 'Letzte 5 Runden',
  noTurns: 'Noch keine abgeschlossene Runde',
  lastTurnsHint: 'Jede gesendete Nachricht ist eine Runde. Der Balken zeigt die verarbeiteten Tokens.',
  turnsTotal: (tokens, cost, five) => `Gesamt ${tokens} · ${cost} · ${five}`,
  colTurn: 'Runde',
  colSplit: 'Token-Aufteilung',
  colTokens: 'Tokens',
  colCost: 'Kosten',
  hintIn: 'neue Nachricht und Dateien',
  hintOut: 'von Claude geschrieben (am teuersten)',
  hintCacheWrite: 'neuen Kontext speichern',
  hintCacheRead: 'Unterhaltung erneut lesen (günstig)',
  barHint: 'Fahre über ein Segment, um Name und Menge zu sehen.',
  fiveReset: 'zurückgesetzt',
  legendIn: 'Eingabe',
  legendOut: 'Ausgabe',
  legendCacheWrite: 'Cache-Schreiben',
  legendCacheRead: 'Cache-Lesen',
  filledBy: 'Was das Fenster füllt',
  noEntries: 'Keine Einträge in diesem Fenster',
  byProject: 'Nach Projekt',
  byModel: 'Nach Modell',
  summary: (view, turns, tokens, cost) =>
    `${view === '5h' ? 'Letzte 5 Stunden' : 'Letzte 7 Tage'}: ${turns === 1 ? '1 Runde' : `${turns} Runden`} · ${tokens} Tokens · ${cost}`,
  turns: n => (n === 1 ? '1 Runde' : `${n} Runden`),
  localOnly: 'Nur Claude-Code-Sitzungen auf diesem Computer, erfasst seit der Installation.',
  resets: 'Zurücksetzungen',
  inTime: (duration, clock) => `in ${duration} · ${clock}`,
  atClock: hhmm => `um ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 Minuten',
  ttl1h: '1 Stunde',
  unknown: 'unbekannt',
  desktopOnlyPane: 'Das wavy-usage-Panel wird nur auf dem Desktop gezeichnet',
  nudge: pct => `Kontext ${pct} % · /clear bei einer neuen Aufgabe, /compact zum Weitermachen`,
  cmdDescription: 'Nutzungsringe: ohne Argument Panel ein/aus; on/off; ttl 5m/1h setzt die Cache-Dauer (wavy-usage)',
  turnedOn: 'wavy-usage an',
  turnedOff: 'wavy-usage aus. Mit /wavy-usage on wieder einschalten',
  paneOpened: 'Panel geöffnet',
  paneClosed: 'Panel geschlossen',
  ttlSet: text => `Cache-TTL: ${text}`,
  ttlUnknown: arg => `wavy-usage: „${arg}“ nicht erkannt. Verwendung: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: „${arg}“ nicht erkannt. Verwendung: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) =>
    `Runde ${n}: ${inp} Eingabe, ${out} Ausgabe, ${write} Cache-Schreiben, ${readTokens} Cache-Lesen`,
  elapsedAlt: label => `Verstrichener Teil des ${label}-Fensters`,
  usedAlt: label => `Genutzter Teil des ${label}-Limits`,
  paceAtReset: pct => `bei diesem Tempo: ${pct} % beim Zurücksetzen`,
  paceFull: (clock, early) => `bei diesem Tempo: voll gegen ${clock}, ${early} vor dem Zurücksetzen`,
  noCost: 'keine Kosten',
  effort: l => `Aufwand: ${l}`,
}

const ja: Strings = {
  units: { m: '分', h: '時間', d: '日', numSep: '', partSep: '' },
  win5h: '5時間',
  win7d: '7日',
  ctx: 'ctx',
  cache: 'キャッシュ',
  panel: 'パネル',
  paneTitle: '使用状況',
  waitingBand: '最初の応答を待っています',
  waitingPane: '最初の応答を待っています',
  cold: '期限切れ',
  lastTurns: '直近5ターン',
  noTurns: '完了したターンはまだありません',
  lastTurnsHint: '送信したメッセージ1件が1ターンです。バーはそのターンで処理したトークンを示します。',
  turnsTotal: (tokens, cost, five) => `合計 ${tokens} · ${cost} · ${five}`,
  colTurn: 'ターン',
  colSplit: 'トークン内訳',
  colTokens: 'トークン',
  colCost: 'コスト',
  hintIn: '新しいメッセージとファイル',
  hintOut: 'Claudeの出力（最も高価）',
  hintCacheWrite: '新しいコンテキストの保存',
  hintCacheRead: '会話の再読み込み（安価）',
  barHint: 'バーの区間にカーソルを合わせると名前と量が表示されます。',
  fiveReset: 'リセット',
  legendIn: '入力',
  legendOut: '出力',
  legendCacheWrite: 'キャッシュ書込',
  legendCacheRead: 'キャッシュ読込',
  filledBy: 'ウィンドウの内訳',
  noEntries: 'このウィンドウの記録はありません',
  byProject: 'プロジェクト別',
  byModel: 'モデル別',
  summary: (view, turns, tokens, cost) => `${view === '5h' ? '直近5時間' : '直近7日'}: ${turns}ターン · ${tokens}トークン · ${cost}`,
  turns: n => `${n}ターン`,
  localOnly: 'このコンピューター上の Claude Code セッションのみ。インストール以降の記録です。',
  resets: 'リセット',
  inTime: (duration, clock) => `${duration}後 · ${clock}`,
  atClock: hhmm => hhmm,
  ttl: text => `TTL ${text}`,
  ttl5m: '5分',
  ttl1h: '1時間',
  unknown: '不明',
  desktopOnlyPane: 'wavy-usage パネルはデスクトップでのみ表示されます',
  nudge: pct => `コンテキスト ${pct}% · 新しい作業なら /clear、続けるなら /compact`,
  cmdDescription: '使用状況リング: 引数なしでパネルを開閉、on/off、ttl 5m/1h でキャッシュ期間を設定 (wavy-usage)',
  turnedOn: 'wavy-usage オン',
  turnedOff: 'wavy-usage オフ。/wavy-usage on で再開します',
  paneOpened: 'パネルを開きました',
  paneClosed: 'パネルを閉じました',
  ttlSet: text => `キャッシュ TTL: ${text}`,
  ttlUnknown: arg => `wavy-usage: 「${arg}」は認識できません。使い方: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: 「${arg}」は認識できません。使い方: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) => `ターン${n}: 入力 ${inp}、出力 ${out}、キャッシュ書込 ${write}、キャッシュ読込 ${readTokens}`,
  elapsedAlt: label => `${label}ウィンドウの経過分`,
  usedAlt: label => `${label}上限の使用分`,
  paceAtReset: pct => `このペースだとリセット時 ${pct}%`,
  paceFull: (clock, early) => `このペースだと ${clock} ごろ上限、リセットの ${early} 前`,
  noCost: 'コストなし',
  effort: l => `エフォート: ${l}`,
}

const ko: Strings = {
  units: { m: '분', h: '시간', d: '일', numSep: '', partSep: ' ' },
  win5h: '5시간',
  win7d: '7일',
  ctx: 'ctx',
  cache: '캐시',
  panel: '패널',
  paneTitle: '사용량',
  waitingBand: '첫 응답을 기다리는 중',
  waitingPane: '첫 응답을 기다리는 중',
  cold: '만료됨',
  lastTurns: '최근 5턴',
  noTurns: '아직 완료된 턴이 없습니다',
  lastTurnsHint: '보낸 메시지 하나가 한 턴입니다. 막대는 그 턴에서 처리한 토큰을 보여줍니다.',
  turnsTotal: (tokens, cost, five) => `합계 ${tokens} · ${cost} · ${five}`,
  colTurn: '턴',
  colSplit: '토큰 구성',
  colTokens: '토큰',
  colCost: '비용',
  hintIn: '새 메시지와 파일',
  hintOut: 'Claude가 쓴 내용 (가장 비쌈)',
  hintCacheWrite: '새 컨텍스트 저장',
  hintCacheRead: '대화 다시 읽기 (저렴)',
  barHint: '막대 구간에 마우스를 올리면 이름과 양이 보입니다.',
  fiveReset: '초기화됨',
  legendIn: '입력',
  legendOut: '출력',
  legendCacheWrite: '캐시 쓰기',
  legendCacheRead: '캐시 읽기',
  filledBy: '윈도우를 채운 항목',
  noEntries: '이 윈도우에는 기록이 없습니다',
  byProject: '프로젝트별',
  byModel: '모델별',
  summary: (view, turns, tokens, cost) => `${view === '5h' ? '최근 5시간' : '최근 7일'}: ${turns}턴 · 토큰 ${tokens} · ${cost}`,
  turns: n => `${n}턴`,
  localOnly: '이 컴퓨터의 Claude Code 세션만 포함하며, 설치 이후부터 기록됩니다.',
  resets: '초기화',
  inTime: (duration, clock) => `${duration} 후 · ${clock}`,
  atClock: hhmm => hhmm,
  ttl: text => `TTL ${text}`,
  ttl5m: '5분',
  ttl1h: '1시간',
  unknown: '알 수 없음',
  desktopOnlyPane: 'wavy-usage 패널은 데스크톱에서만 표시됩니다',
  nudge: pct => `컨텍스트 ${pct}% · 새 작업이면 /clear, 계속하려면 /compact`,
  cmdDescription: '사용량 링: 인수 없이 패널 열기/닫기, on/off, ttl 5m/1h로 캐시 유지 시간 설정 (wavy-usage)',
  turnedOn: 'wavy-usage 켜짐',
  turnedOff: 'wavy-usage 꺼짐. /wavy-usage on 으로 다시 켭니다',
  paneOpened: '패널을 열었습니다',
  paneClosed: '패널을 닫았습니다',
  ttlSet: text => `캐시 TTL: ${text}`,
  ttlUnknown: arg => `wavy-usage: "${arg}"을(를) 인식할 수 없습니다. 사용법: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: "${arg}"을(를) 인식할 수 없습니다. 사용법: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) => `턴 ${n}: 입력 ${inp}, 출력 ${out}, 캐시 쓰기 ${write}, 캐시 읽기 ${readTokens}`,
  elapsedAlt: label => `${label} 윈도우의 경과 부분`,
  usedAlt: label => `${label} 한도의 사용 부분`,
  paceAtReset: pct => `이 속도면 초기화 시점에 ${pct}%`,
  paceFull: (clock, early) => `이 속도면 ${clock}쯤 한도 도달, 초기화 ${early} 전`,
  noCost: '비용 없음',
  effort: l => `노력 수준: ${l}`,
}

const ptBR: Strings = {
  units: { m: 'min', h: 'h', d: 'd', numSep: '', partSep: ' ' },
  win5h: '5h',
  win7d: '7d',
  ctx: 'ctx',
  cache: 'cache',
  panel: 'Painel',
  paneTitle: 'Uso',
  waitingBand: 'aguardando a primeira resposta',
  waitingPane: 'Aguardando a primeira resposta',
  cold: 'frio',
  lastTurns: 'Últimos 5 turnos',
  noTurns: 'Nenhum turno concluído ainda',
  lastTurnsHint: 'Cada mensagem enviada é um turno. A barra mostra os tokens processados.',
  turnsTotal: (tokens, cost, five) => `Total ${tokens} · ${cost} · ${five}`,
  colTurn: 'Turno',
  colSplit: 'Divisão de tokens',
  colTokens: 'Tokens',
  colCost: 'Custo',
  hintIn: 'nova mensagem e arquivos',
  hintOut: 'texto escrito pelo Claude (o mais caro)',
  hintCacheWrite: 'armazenar novo contexto',
  hintCacheRead: 'reler a conversa (barato)',
  barHint: 'Passe o mouse sobre um segmento para ver nome e quantidade.',
  fiveReset: 'reiniciado',
  legendIn: 'entrada',
  legendOut: 'saída',
  legendCacheWrite: 'escrita em cache',
  legendCacheRead: 'leitura de cache',
  filledBy: 'O que encheu a janela',
  noEntries: 'Nenhum registro nesta janela',
  byProject: 'Por projeto',
  byModel: 'Por modelo',
  summary: (view, turns, tokens, cost) =>
    `${view === '5h' ? 'Últimas 5 horas' : 'Últimos 7 dias'}: ${turns === 1 ? '1 turno' : `${turns} turnos`} · ${tokens} tokens · ${cost}`,
  turns: n => (n === 1 ? '1 turno' : `${n} turnos`),
  localOnly: 'Apenas sessões do Claude Code neste computador, registradas desde a instalação.',
  resets: 'Redefinições',
  inTime: (duration, clock) => `em ${duration} · ${clock}`,
  atClock: hhmm => `às ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 minutos',
  ttl1h: '1 hora',
  unknown: 'desconhecido',
  desktopOnlyPane: 'O painel do wavy-usage só é desenhado no desktop',
  nudge: pct => `contexto ${pct}% · /clear se for uma nova tarefa, /compact para continuar`,
  cmdDescription: 'Anéis de uso: sem argumento abre/fecha o painel; on/off; ttl 5m/1h define a duração do cache (wavy-usage)',
  turnedOn: 'wavy-usage ligado',
  turnedOff: 'wavy-usage desligado. Ligue de novo com /wavy-usage on',
  paneOpened: 'Painel aberto',
  paneClosed: 'Painel fechado',
  ttlSet: text => `TTL do cache: ${text}`,
  ttlUnknown: arg => `wavy-usage: "${arg}" não reconhecido. Uso: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: "${arg}" não reconhecido. Uso: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) =>
    `Turno ${n}: ${inp} de entrada, ${out} de saída, ${write} escritos em cache, ${readTokens} lidos do cache`,
  elapsedAlt: label => `Parte decorrida da janela de ${label}`,
  usedAlt: label => `Parte usada do limite de ${label}`,
  paceAtReset: pct => `neste ritmo: ${pct}% na redefinição`,
  paceFull: (clock, early) => `neste ritmo: cheio por volta de ${clock}, ${early} antes da redefinição`,
  noCost: 'sem custo',
  effort: l => `Esforço: ${l}`,
}

const es: Strings = {
  units: { m: 'min', h: 'h', d: 'd', numSep: '', partSep: ' ' },
  win5h: '5h',
  win7d: '7d',
  ctx: 'ctx',
  cache: 'caché',
  panel: 'Panel',
  paneTitle: 'Uso',
  waitingBand: 'esperando la primera respuesta',
  waitingPane: 'Esperando la primera respuesta',
  cold: 'frío',
  lastTurns: 'Últimos 5 turnos',
  noTurns: 'Aún no hay turnos terminados',
  lastTurnsHint: 'Cada mensaje enviado es un turno. La barra muestra los tokens procesados.',
  turnsTotal: (tokens, cost, five) => `Total ${tokens} · ${cost} · ${five}`,
  colTurn: 'Turno',
  colSplit: 'Reparto de tokens',
  colTokens: 'Tokens',
  colCost: 'Costo',
  hintIn: 'nuevo mensaje y archivos',
  hintOut: 'texto escrito por Claude (lo más caro)',
  hintCacheWrite: 'guardar contexto nuevo',
  hintCacheRead: 'releer la conversación (barato)',
  barHint: 'Pasa el cursor sobre un segmento para ver su nombre y cantidad.',
  fiveReset: 'reiniciado',
  legendIn: 'entrada',
  legendOut: 'salida',
  legendCacheWrite: 'escritura de caché',
  legendCacheRead: 'lectura de caché',
  filledBy: 'Qué llenó la ventana',
  noEntries: 'No hay registros en esta ventana',
  byProject: 'Por proyecto',
  byModel: 'Por modelo',
  summary: (view, turns, tokens, cost) =>
    `${view === '5h' ? 'Últimas 5 horas' : 'Últimos 7 días'}: ${turns === 1 ? '1 turno' : `${turns} turnos`} · ${tokens} tokens · ${cost}`,
  turns: n => (n === 1 ? '1 turno' : `${n} turnos`),
  localOnly: 'Solo sesiones de Claude Code en este equipo, registradas desde la instalación.',
  resets: 'Reinicios',
  inTime: (duration, clock) => `en ${duration} · ${clock}`,
  atClock: hhmm => `a las ${hhmm}`,
  ttl: text => `TTL ${text}`,
  ttl5m: '5 minutos',
  ttl1h: '1 hora',
  unknown: 'desconocido',
  desktopOnlyPane: 'El panel de wavy-usage solo se dibuja en el escritorio',
  nudge: pct => `contexto ${pct}% · /clear si es una tarea nueva, /compact para seguir`,
  cmdDescription: 'Anillos de uso: sin argumento abre/cierra el panel; on/off; ttl 5m/1h fija la duración de la caché (wavy-usage)',
  turnedOn: 'wavy-usage activado',
  turnedOff: 'wavy-usage desactivado. Vuelve a activarlo con /wavy-usage on',
  paneOpened: 'Panel abierto',
  paneClosed: 'Panel cerrado',
  ttlSet: text => `TTL de la caché: ${text}`,
  ttlUnknown: arg => `wavy-usage: "${arg}" no reconocido. Uso: /wavy-usage ttl 5m | ttl 1h`,
  argUnknown: arg => `wavy-usage: "${arg}" no reconocido. Uso: /wavy-usage ${USAGE}`,
  barAlt: (n, inp, out, write, readTokens) =>
    `Turno ${n}: ${inp} de entrada, ${out} de salida, ${write} escritos en caché, ${readTokens} leídos de caché`,
  elapsedAlt: label => `Parte transcurrida de la ventana de ${label}`,
  usedAlt: label => `Parte usada del límite de ${label}`,
  paceAtReset: pct => `a este ritmo: ${pct}% al reiniciar`,
  paceFull: (clock, early) => `a este ritmo: lleno hacia ${clock}, ${early} antes del reinicio`,
  noCost: 'sin costo',
  effort: l => `Esfuerzo: ${l}`,
}

export const STRINGS: Record<Lang, Strings> = { en, tr, fr, de, ja, ko, 'pt-BR': ptBR, es }

// Claude Code's language setting is free text; English names, native names and language codes all map.
const NAMES: Record<string, Lang> = {
  en: 'en', english: 'en',
  tr: 'tr', turkish: 'tr', türkçe: 'tr', turkce: 'tr',
  fr: 'fr', french: 'fr', français: 'fr', francais: 'fr',
  de: 'de', german: 'de', deutsch: 'de',
  ja: 'ja', japanese: 'ja', 日本語: 'ja',
  ko: 'ko', korean: 'ko', 한국어: 'ko',
  pt: 'pt-BR', 'pt-br': 'pt-BR', portuguese: 'pt-BR', português: 'pt-BR', portugues: 'pt-BR', 'brazilian portuguese': 'pt-BR',
  es: 'es', spanish: 'es', español: 'es', espanol: 'es',
}

export const langFromText = (text: string | undefined): Lang | undefined => {
  if (!text) return undefined
  const s = text.trim().toLowerCase()
  return NAMES[s] ?? NAMES[s.split(/[-_]/)[0] ?? '']
}

// Explicit choice (userConfig) > Claude Code's language setting > system locale > English.
export const resolveLang = (pref: unknown, claudeLanguage: unknown, locale: string | undefined): Lang => {
  if (typeof pref === 'string' && pref !== 'auto' && (LANGS as readonly string[]).includes(pref)) return pref as Lang
  return langFromText(typeof claudeLanguage === 'string' ? claudeLanguage : undefined) ?? langFromText(locale) ?? 'en'
}
