export type TaskStatus = 'done' | 'running' | 'next'

/** 진행 상황 파일(task-progress.json)의 한 단계. Claude 가 적는다 */
export type Task = {
  name: string
  status: TaskStatus
  /** 0~100. 없으면 done=100, next=0, running=0 으로 본다 */
  percent?: number
  /** 시작 시각(epoch ms). 선택. 어림한 값이 많아 지금 요청 시작과 모드가 처음 본 시각 사이로 묶어서만 쓴다 */
  startedAt?: number
  /** 예상 소요 시간(초). next 는 그 단계 전체, running 은 남은 시간. 창이 줄여 가며 보여준다 */
  etaSec?: number
  /** 한 줄 부연 */
  note?: string
}

export type Progress = {
  title?: string
  tasks: Task[]
}

/** 사용자가 보낸 현재 요청. 이벤트로 자동 기록한다 */
export type Request = {
  /** 사용자가 보낸 원문 첫 줄. 해석에 실패했을 때만 보인다 */
  text: string
  /** 모델이 요청을 해석해 한 줄로 적은 것. undefined 는 해석 중, null 은 해석 실패 */
  summary?: string | null
  startedAt: number
  endedAt: number | null
}

/** 서브에이전트, 백그라운드 명령. 도구 호출과 완료 알림으로 자동 기록한다 */
export type Job = {
  id: string
  kind: 'agent' | 'shell'
  label: string
  startedAt: number
  endedAt: number | null
  /** 완료 알림의 status (completed, failed, killed) */
  result: string | null
}

/** 이번 요청에서 실패한 셸 명령. 같은 명령은 한 줄로 묶어 횟수를 센다 */
export type Failure = {
  /** 실행한 명령 원문. 같은 명령인지 가르는 기준 */
  command: string
  /** 창에 보일 이름. 도구 호출의 description, 없으면 명령 첫 줄 */
  label: string
  count: number
  lastAt: number
  /** 마지막 실패의 오류 한 줄 */
  error: string
}

/** 이 세션에서 고쳤고 아직 커밋하지 않은 파일. git 상태로 채운다 */
export type Change = {
  /** 파일 절대경로(슬래시). 같은 파일인지 가르는 기준 */
  path: string
  /** 창에 보일 이름. 저장소 루트 기준 상대경로 */
  name: string
  /** new, modified, deleted, renamed. 0.7.0 까지는 한국어 문구(새 파일, 수정 등)를 저장했다 */
  status: string
  added: number
  removed: number
  /** 바뀐 내용을 모델이 한 줄로 적은 것. undefined 는 아직 없음, null 은 실패 */
  summary?: string | null
  /** summary 를 만든 diff 의 지문. 바뀌면 다시 요약한다 */
  summaryKey?: string
  /** 요약에 실패한 이유. 창에 그대로 보인다 */
  summaryError?: string
}

/** 단계별 남은 시간 기록. 모드가 파일을 읽을 때마다 갱신한다. 키는 제목과 단계 이름 */
export type TaskTrack = {
  /** next 였을 때 적힌 etaSec. running 이 됐을 때 첫 예상으로 쓴다 */
  plan: number | null
  /** 모드가 정한 시작 시각(epoch ms). running 이 아니면 null */
  startAt: number | null
  /** 마지막으로 본 percent */
  pct: number
  /** 마지막으로 본 etaSec */
  eta: number | null
  /** estAt 시점의 예상 남은 초. null 은 아직 모름 */
  est: number | null
  /** est 를 잡은 시각(파일 수정 시각, epoch ms) */
  estAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'task-progress': {
      data: Progress | null
      /** 진행 상황 파일의 수정 시각(epoch ms) */
      fileTime: number
      now: number
      error: string | null
      request: Request | null
      jobs: Job[]
      failures: Failure[]
      /** 이 세션에서 Write, Edit, NotebookEdit 로 고친 파일 절대경로(역슬래시는 슬래시로 바꿔 둔다) */
      touched: string[]
      changes: Change[]
      track: Record<string, TaskTrack>
      /** 창, 안내문, 요약에 쓰는 언어 */
      lang: 'ko' | 'en'
    }
  }
}
