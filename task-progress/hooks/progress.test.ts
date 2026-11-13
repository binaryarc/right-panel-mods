import { expect, test } from 'claude-code/testing'

import {
  addFailure,
  bar,
  cleanSummary,
  clearedFile,
  errorLine,
  firstLine,
  fmtElapsed,
  fmtSec,
  oneLine,
  parseNotification,
  percentOf,
  progressDir,
  progressFile,
  fileNotice,
  ranInBackground,
  remainingSec,
  requestLabel,
  showFile,
  summaryPrompt,
  staleFiles,
  TTL_MS,
  trimJobs,
  dirOf,
  diffKey,
  diffSummaryPrompt,
  keepSummaries,
  normPath,
  parseNumstatZ,
  parseStatusZ,
  relTo,
  statusLabel,
  fmtLeft,
  totalRemaining,
  trackTasks,
  trackKey,
  STALE_MS,
} from './register'
import { changeKind, pickLang, STRINGS } from './i18n'

test('진행률 기본값: done 100, next 0', () => {
  expect(percentOf({ name: 'a', status: 'done' })).toBe(100)
  expect(percentOf({ name: 'b', status: 'next' })).toBe(0)
  expect(percentOf({ name: 'c', status: 'running', percent: 140 })).toBe(100)
})

// 파일 하나를 시각 mtime 에 읽은 것처럼 기록을 갱신한다
const step = (tasks: Parameters<typeof trackTasks>[1], prev = {}, mtime = 0, reqStart: number | null = null) =>
  trackTasks(prev, tasks, mtime, reqStart)
const keyOf = (name: string) => trackKey('T', name)

test('남은 시간: running 의 etaSec 는 고정하지 않고 줄여 간다', () => {
  const t = { name: 'a', status: 'running' as const, etaSec: 90 }
  const tr = step({ title: 'T', tasks: [t] }, {}, 1_000)[keyOf('a')]
  expect(remainingSec(t, tr, 1_000)).toBe(90)
  expect(remainingSec(t, tr, 31_000)).toBe(60)
  expect(remainingSec(t, tr, 200_000)).toBe(0)
  expect(remainingSec({ name: 'd', status: 'done' }, undefined, 0)).toBe(0)
  expect(remainingSec({ name: 'n', status: 'next', etaSec: 120 }, undefined, 0)).toBe(120)
  expect(remainingSec({ name: 'n', status: 'next' }, undefined, 0)).toBe(null)
})

test('남은 시간: Claude 가 어림한 옛 startedAt 은 요청 시작 시각으로 묶는다', () => {
  // 실제 파일에서 본 값: 요청보다 며칠 앞선 시각에 percent 10
  const t = { name: 'a', status: 'running' as const, percent: 10, startedAt: 1_794_000_000_000 }
  const reqStart = 1_794_528_000_000
  const mtime = reqStart + 60_000
  const tr = step({ title: 'T', tasks: [t] }, {}, mtime, reqStart)[keyOf('a')]
  expect(tr?.startAt).toBe(reqStart)
  // 60초에 10% → 남은 540초. 며칠치 경과로 계산하면 수십 시간이 나온다
  expect(remainingSec(t, tr, mtime)).toBe(540)
})

test('남은 시간: percent 가 낡아도 불어나지 않고, 새 percent 가 오면 다시 잡는다', () => {
  const p1 = { title: 'T', tasks: [{ name: 'a', status: 'running' as const, percent: 0 }] }
  const t1 = step(p1, {}, 0, 0)
  expect(remainingSec(p1.tasks[0]!, t1[keyOf('a')], 0)).toBe(null)
  const p2 = { title: 'T', tasks: [{ name: 'a', status: 'running' as const, percent: 25 }] }
  const t2 = step(p2, t1, 60_000, 0)
  expect(remainingSec(p2.tasks[0]!, t2[keyOf('a')], 60_000)).toBe(180)
  // 같은 파일을 다시 읽어도 예상은 그대로이고 시간이 흐른 만큼 줄어든다
  const t3 = step(p2, t2, 60_000, 0)
  expect(remainingSec(p2.tasks[0]!, t3[keyOf('a')], 600_000)).toBe(0)
  const p4 = { title: 'T', tasks: [{ name: 'a', status: 'running' as const, percent: 50 }] }
  const t4 = step(p4, t3, 120_000, 0)
  expect(remainingSec(p4.tasks[0]!, t4[keyOf('a')], 120_000)).toBe(120)
})

test('남은 시간: next 때 적힌 etaSec 를 running 이 됐을 때 첫 예상으로 쓴다', () => {
  const t1 = step({ title: 'T', tasks: [{ name: 'a', status: 'next', etaSec: 300 }] }, {}, 0)
  const run = { name: 'a', status: 'running' as const }
  const t2 = step({ title: 'T', tasks: [run] }, t1, 10_000, 0)
  expect(remainingSec(run, t2[keyOf('a')], 70_000)).toBe(240)
})

test('남은 시간 합계: 모르는 단계가 있으면 아는 것만 더해 이상으로 표시', () => {
  expect(totalRemaining([60, null, 120])).toEqual({ sec: 180, partial: true })
  expect(totalRemaining([null])).toEqual({ sec: null, partial: false })
  expect(totalRemaining([30, 30])).toEqual({ sec: 60, partial: false })
  expect(fmtLeft(180, STRINGS.ko, true)).toBe('약 3분 이상')
  expect(fmtLeft(180, STRINGS.en, true)).toBe('~3 min+')
  expect(fmtLeft(0, STRINGS.ko)).toBe('곧 완료')
  expect(fmtLeft(0, STRINGS.en)).toBe('almost done')
})

test('표시 형식', () => {
  expect(fmtSec(null)).toBe('계산 중')
  expect(fmtSec(45)).toBe('45초')
  expect(fmtSec(300)).toBe('약 5분')
  expect(fmtSec(null, STRINGS.en)).toBe('calculating')
  expect(fmtSec(45, STRINGS.en)).toBe('45s')
  expect(fmtSec(3_900, STRINGS.en)).toBe('~1 h 5 min')
  expect(bar(50, 10)).toBe('█████░░░░░')
  expect(fmtElapsed(65_000)).toBe('1:05')
  expect(fmtElapsed(3_725_000)).toBe('1:02:05')
  expect(oneLine('\n  첫 줄입니다\n둘째 줄', 80)).toBe('첫 줄입니다')
  expect(oneLine('가나다라마바사', 5)).toBe('가나다라…')
  expect(firstLine(`\n  ${'가'.repeat(200)}\n둘째 줄`)).toBe('가'.repeat(200))
})

test('완료 알림에서 tool_use_id 와 상태를 뽑는다', () => {
  const text =
    '<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>toolu_A</tool-use-id>\n<status>completed</status>\n</task-notification>' +
    '<task-notification><tool-use-id>toolu_B</tool-use-id><status>failed</status></task-notification>'
  expect(parseNotification(text)).toEqual([
    { toolUseId: 'toolu_A', status: 'completed' },
    { toolUseId: 'toolu_B', status: 'failed' },
  ])
  expect(parseNotification('일반 요청')).toEqual([])
})

test('끝난 작업은 최근 5개만, 진행 중은 모두 남긴다', () => {
  const done = Array.from({ length: 7 }, (_, i) => ({
    id: `d${i}`, kind: 'agent' as const, label: `d${i}`, startedAt: 0, endedAt: 1, result: 'completed',
  }))
  const run = { id: 'r', kind: 'shell' as const, label: 'r', startedAt: 0, endedAt: null, result: null }
  const out = trimJobs([...done, run])
  expect(out.length).toBe(6)
  expect(out[0]?.id).toBe('d2')
  expect(out[5]?.id).toBe('r')
})

test('진행 상황 파일은 지금 요청 중에 고쳐졌거나 진행 중 단계가 최근에 고쳐졌을 때만 보인다', () => {
  const allDone = { tasks: [{ name: 'a', status: 'done' as const }] }
  const running = { tasks: [{ name: 'b', status: 'running' as const }] }
  const req = { text: 'x', startedAt: 1000, endedAt: null }
  expect(showFile(allDone, 500, req, 2000)).toBe(false)
  expect(showFile(allDone, 1500, req, 2000)).toBe(true)
  expect(showFile(running, 500, req, 2000)).toBe(true)
  // 진행 중 단계를 닫지 않고 버려진 파일은 오래되면 숨긴다
  expect(showFile(running, 500, req, 500 + STALE_MS + 1)).toBe(false)
  expect(showFile(null, 1500, req, 2000)).toBe(false)
})

test('진행 폴더: USERPROFILE 우선, 역슬래시는 슬래시로, 없으면 HOME', () => {
  expect(progressDir('C:\\Users\\kim', '/ignored')).toBe('C:/Users/kim/.claude/task-progress')
  expect(progressDir(undefined, '/home/lee/')).toBe('/home/lee/.claude/task-progress')
})

test('세션별 파일: 세션 ID 마다 다른 경로', () => {
  const d = 'C:/Users/kim/.claude/task-progress'
  expect(progressFile(d, 'aaa')).toBe('C:/Users/kim/.claude/task-progress/aaa.json')
  expect(progressFile(d, 'aaa')).not.toBe(progressFile(d, 'bbb'))
})

test('메시지 안내문에 이 세션의 파일 경로와 쓰는 법이 언어별로 들어간다', () => {
  const path = 'C:/Users/kim/.claude/task-progress/abc.json'
  const ko = fileNotice(path, 'ko')
  expect(ko.includes(path)).toBe(true)
  expect(ko.includes('startedAt 은 넣지 않아도 된다')).toBe(true)
  const en = fileNotice(path, 'en')
  expect(en.includes(path)).toBe(true)
  expect(en.includes('You do not need startedAt')).toBe(true)
})

test('언어 고르기: 옵션, Claude Code language 설정, LANG, Windows 지역 설정 순', () => {
  expect(pickLang('en', '한국어', 'ko_KR.UTF-8', 'ko-KR')).toBe('en')
  expect(pickLang('auto', 'korean', undefined, 'en-US')).toBe('ko')
  expect(pickLang('auto', 'English', 'ko_KR.UTF-8', undefined)).toBe('en')
  expect(pickLang('auto', undefined, 'ko_KR.UTF-8', 'en-US')).toBe('ko')
  expect(pickLang('auto', undefined, 'C.UTF-8', 'ko-KR')).toBe('ko')
  expect(pickLang('auto', undefined, undefined, 'en-US')).toBe('en')
  expect(pickLang(undefined, undefined, undefined, undefined)).toBe('en')
})

test('백그라운드 판단: 에이전트는 agent.spawn 기록, 셸은 run_in_background', () => {
  const spawned = new Set(['bg-agent'])
  // 에이전트 호출 인자에는 run_in_background 가 없다. 호출이 돌아와도 완료로 찍으면 안 된다
  expect(ranInBackground(true, {}, spawned, 'bg-agent')).toBe(true)
  expect(ranInBackground(true, {}, spawned, 'fg-agent')).toBe(false)
  expect(ranInBackground(false, { run_in_background: true }, spawned, 'sh-1')).toBe(true)
  expect(ranInBackground(false, {}, spawned, 'sh-2')).toBe(false)
})

test('7일 지난 다른 세션 파일만 지울 대상이다', () => {
  const now = 100 * 24 * 60 * 60 * 1000
  const files = [
    { name: 'old.json', mtimeMs: now - TTL_MS - 1 },
    { name: 'fresh.json', mtimeMs: now - TTL_MS + 1 },
    { name: 'me.json', mtimeMs: now - TTL_MS * 3 },
    { name: 'note.txt', mtimeMs: 0 },
  ]
  expect(staleFiles(files, now, 'me')).toEqual(['old.json'])
  expect(TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
})

test('/clear 로 끝난 세션만 그 파일을 지운다', () => {
  expect(clearedFile('clear', 'abc')).toBe('abc.json')
  expect(clearedFile('prompt_input_exit', 'abc')).toBe(null)
  expect(clearedFile('resume', 'abc')).toBe(null)
})

test('요청 해석 질문: 원문은 request 태그 안에, 길면 자른다', () => {
  const p = summaryPrompt('오른쪽 패널 이름 바꿔줘')
  expect(p.includes('<request>\n오른쪽 패널 이름 바꿔줘\n</request>')).toBe(true)
  expect(summaryPrompt('가'.repeat(5000)).includes('가'.repeat(2001))).toBe(false)
  expect(summaryPrompt('rename the pane', 'en').includes('one English sentence')).toBe(true)
})

test('해석 답 정리: 첫 줄만, 따옴표 제거, 비면 null', () => {
  expect(cleanSummary('"플러그인 이름 변경하기"\n부연')).toBe('플러그인 이름 변경하기')
  expect(cleanSummary('  \n ')).toBe(null)
})

test('창 문구: 해석 문장, 해석 중, 실패 시 원문', () => {
  const base = { text: '원문', startedAt: 0, endedAt: null }
  expect(requestLabel({ ...base, summary: '해석 문장' })).toBe('해석 문장')
  expect(requestLabel({ ...base })).toBe('요청 해석 중…')
  expect(requestLabel({ ...base }, STRINGS.en)).toBe('Reading the request…')
  expect(requestLabel({ ...base, summary: null })).toBe('원문')
})

test('오류 한 줄: Exit code 줄은 건너뛰고 원인 줄을 쓴다', () => {
  expect(errorLine('Exit code 1\n\ngrep: x: No such file')).toBe('grep: x: No such file')
  expect(errorLine('Exit code 2')).toBe('Exit code 2')
  expect(errorLine('')).toBe('')
})

test('실패한 명령: 같은 명령은 횟수를 올리고 최근 5개만 남긴다', () => {
  const f = (command: string, at: number) => ({ command, label: command, lastAt: at, error: 'e' })
  let list = addFailure([], f('a', 1))
  list = addFailure(list, f('b', 2))
  list = addFailure(list, f('a', 3))
  expect(list.map(x => `${x.command}${x.count}`)).toEqual(['b1', 'a2'])
  for (const c of ['c', 'd', 'e', 'g']) list = addFailure(list, f(c, 4))
  expect(list.map(x => x.command)).toEqual(['a', 'c', 'd', 'e', 'g'])
})

test('경로: 역슬래시를 슬래시로, 폴더, 저장소 기준 상대경로(대소문자 무시)', () => {
  expect(normPath('C:\\a\\b\\c.ts')).toBe('C:/a/b/c.ts')
  expect(dirOf('C:\\a\\b\\c.ts')).toBe('C:/a/b')
  expect(relTo('C:/repo', 'c:/Repo/src/x.ts')).toBe('src/x.ts')
  expect(relTo('C:/repo', 'C:/repo2/x.ts')).toBe(null)
})

test('git status -z: 상태 두 글자, 이름 변경은 원래 경로를 건너뛴다', () => {
  const m = parseStatusZ(' M a.ts\0?? 새 파일.md\0R  new.ts\0old.ts\0D  gone.ts\0')
  expect(m.get('a.ts')).toBe(' M')
  expect(m.get('새 파일.md')).toBe('??')
  expect(m.get('new.ts')).toBe('R ')
  expect(m.has('old.ts')).toBe(false)
  expect(statusLabel('??')).toBe('new')
  expect(statusLabel('A ')).toBe('new')
  expect(statusLabel(' D')).toBe('deleted')
  expect(statusLabel('R ')).toBe('renamed')
  expect(statusLabel('MM')).toBe('modified')
  // 0.7.0 이 상태에 남긴 한국어 값도 같은 코드로 읽는다
  expect(changeKind('새 파일')).toBe('new')
  expect(changeKind('이름 변경')).toBe('renamed')
  expect(STRINGS.en.change[changeKind(statusLabel('??'))]).toBe('new')
})

test('git diff --numstat -z: 추가, 삭제 줄 수. 바이너리는 0', () => {
  const m = parseNumstatZ('12\t3\ta.ts\0-\t-\timg.png\0')
  expect(m.get('a.ts')).toEqual({ added: 12, removed: 3 })
  expect(m.get('img.png')).toEqual({ added: 0, removed: 0 })
})

test('diff 지문은 내용이 바뀌면 달라지고, 요약 질문은 diff 를 태그로 감싼다', () => {
  expect(diffKey('+a')).toBe(diffKey('+a'))
  expect(diffKey('+a')).not.toBe(diffKey('+b'))
  const p = diffSummaryPrompt('a.ts', '+x')
  expect(p.includes('<diff>\n+x\n</diff>')).toBe(true)
  expect(diffSummaryPrompt('a.ts', 'x'.repeat(9000)).includes('x'.repeat(4001))).toBe(false)
  expect(diffSummaryPrompt('a.ts', '+x', 'en').includes('one English sentence')).toBe(true)
})

test('git 을 다시 읽어도 그 사이 들어온 요약은 덮어쓰지 않는다', () => {
  const base = { path: 'C:/r/a.ts', name: 'a.ts', status: '수정', added: 1, removed: 0 }
  const cur = [{ ...base, summary: '함수 추가', summaryKey: 'k1' }]
  const fresh = [{ ...base, added: 3 }, { ...base, path: 'C:/r/b.ts', name: 'b.ts' }]
  const out = keepSummaries(fresh, cur)
  expect(out[0]?.summary).toBe('함수 추가')
  expect(out[0]?.added).toBe(3)
  expect(out[1]?.summary).toBe(undefined)
})
