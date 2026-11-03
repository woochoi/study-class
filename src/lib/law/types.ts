// 국가법령정보센터 OPEN API 응답을 변환한 순수 데이터 타입. (서버/클라이언트 의존 없음)

export type DocKind = 'law' | 'decree' | 'notice'

export type ParsedChapter = {
  /** 예: '제4장의2' */
  label: string
  /** 예: '가명정보의 처리에 관한 특례' */
  title: string
  sortOrder: number
}

export type ParsedArticle = {
  /** 조 키. 예: '24', '24의2' */
  key: string
  title: string
  body: string
  chapterLabel: string | null
  sortOrder: number
}

export type ParsedDocument = {
  kind: DocKind
  title: string
  promulgationNo: string
  /** 'YYYY-MM-DD' */
  promulgatedOn: string | null
  /** 'YYYY-MM-DD' */
  effectiveOn: string
  isUpcoming: boolean
  chapters: ParsedChapter[]
  articles: ParsedArticle[]
}

export type ParsedLink = {
  fromKind: DocKind
  fromKey: string
  toKind: DocKind
  toKey: string
  note: string | null
}
