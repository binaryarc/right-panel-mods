export type TaskStatus = 'done' | 'running' | 'next'

/** 진행 상황 파일(task-progress.json)의 한 단계. Claude 가 적는다 */
export type Task = {
  name: string
  status: TaskStatus
  /** 0~100. 없으면 done=100, next=0, running=0 으로 본다 */
  percent?: number
  /** 시작 시각(epoch ms). running 이고 etaSec 가 없으면 이 값과 percent 로 남은 시간을 계산한다 */
  startedAt?: number
  /** 예상 남은 시간(초). 주어지면 계산값보다 우선한다 */
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
  /** 수정, 새 파일, 삭제, 이름 변경 */
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
    }
  }
}
