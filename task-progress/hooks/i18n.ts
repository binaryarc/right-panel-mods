// 창 문구, 안내문, 모델 질문을 언어별로 모아 둔다. 언어는 ko, en 두 가지다
export type Lang = 'ko' | 'en'

// 언어 고르기. 순서: 모드 옵션(auto 가 아니면) → Claude Code settings 의 language → 환경변수 LC_ALL, LC_MESSAGES, LANG → Windows 지역 설정 → en
export function pickLang(
  option: string | undefined,
  setting: unknown,
  envLocale: string | undefined,
  culture: string | undefined,
): Lang {
  if (option === 'ko' || option === 'en') return option
  if (typeof setting === 'string' && setting.trim() !== '') return /^(ko|kor|korean)\b|한국/i.test(setting.trim()) ? 'ko' : 'en'
  if (envLocale && !/^(C|POSIX)(\.|$)/.test(envLocale)) return /^ko/i.test(envLocale) ? 'ko' : 'en'
  if (culture) return /^ko/i.test(culture.trim()) ? 'ko' : 'en'
  return 'en'
}

export type ChangeKind = 'new' | 'deleted' | 'renamed' | 'modified'

// 0.7.0 까지는 한국어 문구를 상태에 그대로 저장했다. 다시 불러온 세션의 옛 값을 코드로 바꾼다
export function changeKind(status: string): ChangeKind {
  switch (status) {
    case 'new':
    case '새 파일':
      return 'new'
    case 'deleted':
    case '삭제':
      return 'deleted'
    case 'renamed':
    case '이름 변경':
      return 'renamed'
    default:
      return 'modified'
  }
}

export type Strings = {
  title: string
  commandDesc: string
  commandReply: string
  overall: string
  timeLeft: string
  left: string
  nextSteps: string
  currentRequest: string
  none: string
  noneYet: string
  interpreting: string
  running: (elapsed: string) => string
  finished: (elapsed: string) => string
  uncommitted: (n: number) => string
  change: Record<ChangeKind, string>
  summaryFailed: (reason: string) => string
  summaryAfterRequest: string
  summarizing: string
  failed: (n: number) => string
  times: (n: number) => string
  background: string
  agent: string
  command: string
  calculating: string
  almostDone: string
  seconds: (n: number) => string
  minutes: (n: number) => string
  hours: (h: number, m: number) => string
  atLeast: (text: string) => string
}

export const STRINGS: Record<Lang, Strings> = {
  ko: {
    title: '작업 진행',
    commandDesc: '작업 진행 창 열기',
    commandReply: '작업 진행 창을 열었습니다.',
    overall: '전체',
    timeLeft: '남은 시간',
    left: '남은',
    nextSteps: '다음 작업',
    currentRequest: '현재 요청',
    none: '없음',
    noneYet: '아직 없음',
    interpreting: '요청 해석 중…',
    running: e => `진행 ${e}`,
    finished: e => `완료 (${e})`,
    uncommitted: n => `미커밋 파일 ${n}개`,
    change: { new: '새 파일', deleted: '삭제', renamed: '이름 변경', modified: '수정' },
    summaryFailed: r => `요약 실패: ${r}`,
    summaryAfterRequest: '요청이 끝나면 요약',
    summarizing: '요약 중…',
    failed: n => `실패한 명령 ${n}회`,
    times: n => `${n}회`,
    background: '백그라운드 작업',
    agent: '에이전트',
    command: '명령',
    calculating: '계산 중',
    almostDone: '곧 완료',
    seconds: n => `${n}초`,
    minutes: m => `약 ${m}분`,
    hours: (h, m) => `약 ${h}시간 ${m}분`,
    atLeast: t => `${t} 이상`,
  },
  en: {
    title: 'Task progress',
    commandDesc: 'Open the task progress pane',
    commandReply: 'Opened the task progress pane.',
    overall: 'Overall',
    timeLeft: 'Time left',
    left: 'left',
    nextSteps: 'Next steps',
    currentRequest: 'Current request',
    none: 'None',
    noneYet: 'None yet',
    interpreting: 'Reading the request…',
    running: e => `Running ${e}`,
    finished: e => `Done (${e})`,
    uncommitted: n => `Uncommitted files: ${n}`,
    change: { new: 'new', deleted: 'deleted', renamed: 'renamed', modified: 'modified' },
    summaryFailed: r => `Summary failed: ${r}`,
    summaryAfterRequest: 'Summarized when the request ends',
    summarizing: 'Summarizing…',
    failed: n => `Failed commands: ${n}`,
    times: n => `${n}x`,
    background: 'Background jobs',
    agent: 'agent',
    command: 'cmd',
    calculating: 'calculating',
    almostDone: 'almost done',
    seconds: n => `${n}s`,
    minutes: m => `~${m} min`,
    hours: (h, m) => `~${h} h ${m} min`,
    atLeast: t => `${t}+`,
  },
}

// Claude 에게 이 세션이 쓸 파일 경로와 쓰는 법을 알리는 안내문. 사용자 메시지마다 덧붙인다
export function fileNotice(path: string, lang: Lang): string {
  if (lang === 'en') {
    return [
      `Task progress pane file: this session's progress file is ${path}. Do not read or write other sessions' files.`,
      'Write this file for work with 2 or more steps or that takes over 5 minutes. Skip it for short answers and single-step work.',
      'Format: {"title": "...", "tasks": [{"name": "...", "status": "done|running|next", "percent": 0-100, "etaSec": seconds, "note": "..."}]}. Only name and status are required.',
      'Write all steps when the work starts, and rewrite the whole file each time a step starts or ends. When the last step ends, mark every step done.',
      'Give each step an etaSec: your estimate of the seconds that step will take (for a running step, the seconds still left). The pane counts it down. For a running step, also update percent and note as it moves; the pane re-estimates from each new percent. You do not need startedAt; the pane records when it first sees a step running.',
      'Do not mention updating this file in your replies.',
    ].join(' ')
  }
  return [
    `작업 진행 창 파일: 이 세션의 진행 상황 파일 경로는 ${path} 이다. 다른 세션의 파일을 읽거나 쓰지 않는다.`,
    '단계가 2개 이상이거나 5분 넘게 걸릴 작업이면 이 파일을 쓴다. 짧은 질문 답변, 한 단계로 끝나는 작업에는 쓰지 않는다.',
    '형식: {"title": "...", "tasks": [{"name": "...", "status": "done|running|next", "percent": 0~100, "etaSec": 초, "note": "..."}]}. name, status 만 필수다.',
    '작업 시작 때 전체 단계를 적고, 단계가 시작되거나 끝날 때마다 파일을 통째로 다시 쓴다. 마지막 단계가 끝나면 모두 done 으로 바꾼다.',
    '단계마다 etaSec 에 그 단계가 걸릴 예상 초를 넣는다(running 단계는 남은 초). 창이 그 값을 줄여 가며 보여준다. running 단계는 도는 중에도 percent, note 를 고쳐 쓴다. 창은 새 percent 가 올 때마다 남은 시간을 다시 잡는다. startedAt 은 넣지 않아도 된다. 창이 단계가 running 이 된 것을 처음 본 시각을 기록한다.',
    '답변에서 이 파일 갱신을 따로 언급하지 않는다.',
  ].join(' ')
}

// 사용자 요청을 해석해 한 줄로 적게 하는 질문. 요청 원문은 태그로 감싸 지시와 분리한다
export function summaryPrompt(text: string, lang: Lang, max: number): string {
  const body = `<request>\n${text.slice(0, max)}\n</request>`
  if (lang === 'en') {
    return [
      'The <request> below is what a user sent to a coding assistant. Work out what the user actually wants and write it as one English sentence.',
      'Do not copy the original; fix typos and abbreviations so the task is clear. About 8 words, starting with a verb, like "Fix the login timeout".',
      'Reply with that sentence only. No quotes, no preface, no explanation.',
      body,
    ].join('\n')
  }
  return [
    '아래 <request> 는 사용자가 코딩 도우미에게 보낸 요청이다. 사용자가 실제로 무엇을 원하는지 해석해 한국어 한 문장으로 적어라.',
    '원문을 그대로 옮기지 말고, 오타와 줄임말을 바로잡아 할 일이 드러나게 쓴다. 40자 안팎, "~하기" 나 "~ 확인" 처럼 명사형으로 끝낸다.',
    '답은 그 문장 하나만 쓴다. 따옴표, 머리말, 설명을 붙이지 않는다.',
    body,
  ].join('\n')
}

// 바뀐 내용을 한 줄로 적게 하는 질문. diff 원문은 태그로 감싸 지시와 분리한다
export function diffSummaryPrompt(name: string, diff: string, lang: Lang, max: number): string {
  const body = `<diff>\n${diff.slice(0, max)}\n</diff>`
  if (lang === 'en') {
    return [
      `The <diff> below is the uncommitted change to the file ${name}. Write what was changed as one English sentence.`,
      'About 6 words, like "Add retry to upload". Reply with that sentence only. No quotes, no preface.',
      body,
    ].join('\n')
  }
  return [
    `아래 <diff> 는 파일 ${name} 의 아직 커밋하지 않은 변경이다. 무엇을 바꿨는지 한국어 한 문장으로 적어라.`,
    '30자 안팎, "~ 추가", "~ 수정" 처럼 명사형으로 끝낸다. 답은 그 문장 하나만 쓴다. 따옴표, 머리말을 붙이지 않는다.',
    body,
  ].join('\n')
}
