# 업무 공지 메모앱 개발 지시서

## 0. 프로젝트 목적

이 프로젝트는 호텔 프런트 업무 중 계속 쌓이는 회사 공지사항, 전달사항, 주의사항, 고객 응대 문구 등을 개인적으로 정리하고 빠르게 검색하기 위한 **개인 업무 보조용 로컬 메모앱**이다.

현재 사용하는 사내용 SNS는 검색 기능과 시인성이 부족하여, 필요한 정보를 근무 중 빠르게 찾기 어렵다. 이 앱은 회사 시스템을 대체하는 것이 아니라, 사용자가 업무 중 기억해야 할 내용을 개인적으로 정리하고 재검색하기 위한 도구다.

초기 목표는 사내 배포가 아니다. 일본의 보수적인 기업문화와 보안 문제를 고려하여, 우선은 사용자의 개인 단말에서만 사용하는 로컬 저장 앱으로 개발한다.

---

## 1. 핵심 컨셉

### 앱의 한 줄 정의

> 태그 중심의 개인 업무 공지 메모앱

### 핵심 원칙

- 입력은 빠르게 한다.
- 카테고리 선택으로 사용자를 귀찮게 하지 않는다.
- 카테고리 대신 태그를 중심으로 정리한다.
- 검색을 가장 중요한 기능으로 둔다.
- 오래된 정보는 자동으로 의심할 수 있게 한다.
- 회사 개인정보와 고객 개인정보는 저장하지 않는 것을 원칙으로 한다.
- 초기 버전은 서버 없이 브라우저 로컬 저장소에 저장한다.


### UI 언어 원칙

- 앱의 실제 화면, 메뉴, 버튼, 태그명, 상태명, 중요도명은 **일본어**로 개발한다.
- 개발 지시서 설명은 한국어로 유지해도 되지만, 사용자가 앱에서 보는 문구는 일본어를 기본값으로 한다.
- 코드 내부 enum 값은 영어로 유지해도 되지만, 화면 표시 라벨은 일본어 매핑을 사용한다.
- 업무 특성상 일본어 원문 공지를 그대로 붙여 넣고 검색할 수 있어야 한다.
- 한국어/영어 키워드도 태그 추천 사전에 보조 키워드로 포함한다.

---

## 2. 개발 우선순위

### 1차 MVP 목표

아래 기능을 먼저 구현한다.

1. 새 메모 작성
2. 메모 수정
3. 메모 삭제
4. 제목 입력
5. 본문 입력
6. 기본 태그 선택
7. 자유 태그 추가
8. 자동 태그 추천
9. 태그 검색
10. 제목/본문 통합 검색
11. 중요도 설정
12. 상태 설정
13. 유효기간 설정
14. 검토 필요 목록
15. 만료된 메모 목록
16. 모바일 화면 대응
17. 브라우저 로컬 저장

### 1차 MVP에서 제외할 기능

아래 기능은 초기 버전에 넣지 않는다.

- 로그인
- 회원 관리
- 클라우드 동기화
- PocketBase 연동
- 사내망 배포
- 파일 첨부
- 이미지 첨부
- AI 요약
- AI 자동 분류
- 캘린더 연동
- 알림 푸시
- 공유 기능
- 복잡한 권한 관리

---

## 3. 기술 방향

### 초기 버전

- 형태: 모바일 우선 웹앱
- 저장 방식: 브라우저 로컬 저장
- 권장 저장소: IndexedDB
- 서버: 없음
- 로그인: 없음
- 설치 방식: 나중에 PWA로 확장 가능하게 설계

### 추천 기술 스택

Codex가 판단하여 적절한 스택을 선택해도 되지만, 다음 구성을 우선 고려한다.

- Vite
- React
- TypeScript
- IndexedDB
- idb 또는 Dexie.js
- CSS Modules 또는 Tailwind CSS

단, 프로젝트가 너무 복잡해질 경우 순수 React + TypeScript + 기본 CSS로 시작해도 된다.

---

## 4. 데이터 구조

### Note 모델

```ts
export type NoteImportance = 'low' | 'normal' | 'high';
export type NoteStatus = 'active' | 'needs_check' | 'expired' | 'archived';

export interface NoteTask {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
}

export interface WorkNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  autoTags: string[];
  manualTags: string[];
  importance: NoteImportance;
  status: NoteStatus;
  validUntil?: string;
  reviewDate?: string;
  tasks: NoteTask[];
  createdAt: string;
  updatedAt: string;
}
```

### 필드 설명

| 필드 | 설명 |
|---|---|
| id | 메모 고유 ID |
| title | 메모 제목 |
| body | 메모 본문 |
| tags | 최종 태그 목록. autoTags와 manualTags를 합친 값 |
| autoTags | 본문 기반 자동 추천 태그 |
| manualTags | 사용자가 직접 추가한 태그 |
| importance | 중요도. low / normal / high |
| status | 상태. active / needs_check / expired / archived |
| validUntil | 문서 유효기간 |
| reviewDate | 검토 예정일 |
| tasks | 메모에 연결된 간단한 체크리스트 |
| createdAt | 생성일 |
| updatedAt | 수정일 |


---

## 5. UI 표시 라벨 일본어 기준

코드 내부 값은 영어 enum을 사용하되, 화면에는 아래 일본어 라벨을 표시한다.

### 주요 메뉴 라벨

```ts
export const UI_LABELS = {
  appTitle: '業務メモ',
  home: 'ホーム',
  search: '検索',
  newNote: '新規メモ',
  editNote: 'メモ編集',
  noteDetail: 'メモ詳細',
  importantNotes: '重要メモ',
  needsReview: '確認が必要',
  expiredNotes: '期限切れメモ',
  recentNotes: '最近更新したメモ',
  searchPlaceholder: 'キーワード・タグで検索',
  title: 'タイトル',
  body: '本文',
  suggestedTags: 'おすすめタグ',
  defaultTags: '基本タグ',
  customTags: '自由タグ',
  addTag: 'タグを追加',
  importance: '重要度',
  status: '状態',
  validUntil: '有効期限',
  reviewDate: '確認日',
  checklist: 'チェックリスト',
  save: '保存',
  delete: '削除',
  cancel: 'キャンセル'
};
```

### 중요도 표시 라벨

```ts
export const IMPORTANCE_LABELS = {
  low: '低',
  normal: '通常',
  high: '高'
};
```

### 상태 표시 라벨

```ts
export const STATUS_LABELS = {
  active: '有効',
  needs_check: '確認必要',
  expired: '期限切れ',
  archived: '保管'
};
```

## 6. 태그 설계

이 앱은 카테고리를 만들지 않는다. 대신 카테고리처럼 사용할 수 있는 기본 태그 세트를 제공한다.

### 기본 업무 태그

```ts
export const DEFAULT_WORK_TAGS = [
  'チェックイン',
  'チェックアウト',
  '予約',
  '料金・返金',
  '客室変更',
  '長期滞在',
  '駐車場',
  'バス・交通',
  '荷物・ロッカー',
  '電話対応',
  'クレーム',
  '清掃・点検',
  '夜勤',
  'システム・機械',
  'その他のお知らせ'
];
```

### 상황 태그

```ts
export const DEFAULT_CONTEXT_TAGS = [
  '重要',
  '緊急',
  '確認必要',
  'マネージャー確認',
  'よくある質問',
  '注意',
  '一時的なお知らせ',
  '常時ルール',
  'お客様案内',
  'スタッフ用',
  'フロント内部',
  '英語必要',
  '案内文'
];
```

### 태그 사용 원칙

- 하나의 메모에 여러 태그를 붙일 수 있어야 한다.
- 태그는 카테고리 역할을 대체한다.
- 사용자는 기본 태그를 클릭해서 빠르게 선택할 수 있어야 한다.
- 기본 태그 외에 자유 태그를 추가할 수 있어야 한다.
- 자주 쓰는 태그는 입력 화면 상단에 우선 표시할 수 있으면 좋다.

---

## 7. 자동 태그 추천 기능

초기 버전에서는 AI를 사용하지 않는다. 키워드 사전 기반으로 자동 태그를 추천한다.

### 태그 추천 규칙 예시

```ts
export const TAG_RULES: Record<string, string[]> = {
  '駐車場': ['駐車', '駐車場', '駐車タワー', 'parking', 'parking lot', 'コインパーキング', '주차', '주차타워', 'height limit'],
  '荷物・ロッカー': ['荷物', '手荷物', 'ロッカー', 'locker', 'luggage', '預かり', '짐', '수하물', '락커'],
  '長期滞在': ['長期', '連泊', '15日', 'long stay', '장기', '연박'],
  '料金・返金': ['返金', '取消', 'キャンセル', 'refund', 'cancel', '料金', '決済', 'booking.com', 'Agoda', '환불', '취소'],
  'バス・交通': ['バス', 'シャトル', '空港', '時刻表', 'bus', 'Tokoname', '버스', '셔틀'],
  '客室変更': ['客室変更', '部屋変更', 'ルームチェンジ', 'room change', '객실변경', '방 변경'],
  'クレーム': ['騒音', '苦情', 'クレーム', 'complaint', 'うるさい', '소음', '불만', '항의'],
  '電話対応': ['電話', '通話', 'transfer', 'connect', 'call', '전화', '통화'],
  '英語必要': ['英語', 'English', '英文', '英語で', '영어', 'how to say'],
  '案内文': ['案内', '説明', 'お客様へ', 'guest', 'customer', '안내', '설명']
};
```

### 자동 태그 추천 동작

- 사용자가 제목 또는 본문을 입력한다.
- 앱은 TAG_RULES의 키워드를 검사한다.
- 매칭되는 키워드가 있으면 해당 태그를 추천한다.
- 추천 태그는 자동으로 저장하지 말고, 사용자가 확인하거나 제거할 수 있게 한다.
- 저장 시 최종 태그 목록은 autoTags와 manualTags를 합쳐서 tags에 저장한다.

---

## 8. 화면 구성

### 8.1 ホーム画面

홈 화면은 검색과 검토 목록 중심으로 만든다.

필수 요소:

- 빠른 검색창
- 새 메모 작성 버튼
- 중요 메모 목록
- 검토 필요 메모 목록
- 만료된 메모 목록
- 최근 수정 메모 목록

예시:

```text
[キーワード・タグで検索]

[+ 新規メモ]

重要メモ
- 駐車タワー高さ制限の案内
- 長期滞在の客室変更ルール

確認が必要
- バス時刻表の案内
- 返金案内文

最近更新したメモ
- 夜間チェックイン注意事項
- コインパーキング案内
```

### 8.2 検索画面

검색은 이 앱의 핵심이다.

필수 요소:

- 검색어 입력
- 태그 필터
- 상태 필터
- 중요도 필터
- 유효기간 필터
- 검색 결과 목록

검색 대상:

- title
- body
- tags

검색 예시:

```text
駐車場
#駐車場
#駐車場 高さ
#料金・返金 Agoda
#長期滞在 15日
#クレーム 騒音
```

검색 결과 카드에 표시할 정보:

- 제목
- 본문 일부
- 태그
- 중요도
- 상태
- 유효기간
- 수정일

### 8.3 メモ作成/編集画面

필수 입력 요소:

- 제목
- 본문
- 기본 태그 선택
- 자유 태그 입력
- 자동 추천 태그
- 중요도
- 상태
- 유효기간
- 검토일
- 체크리스트

화면 예시:

```text
タイトル
[                              ]

本文
[                              ]
[                              ]

おすすめタグ
[駐車場] [お客様案内] [注意]

基本タグ
[チェックイン] [予約] [駐車場] [荷物・ロッカー] [クレーム]

自由タグ
[ + タグを追加 ]

重要度
[低] [通常] [高]

状態
[有効] [確認必要] [期限切れ] [保管]

有効期限
[ YYYY-MM-DD ]

確認日
[ YYYY-MM-DD ]

チェックリスト
[ ] 英語案内文を追加する
[ ] マネージャーに確認する
```

---

## 9. 유효기간 / 검토 기능

### 목적

회사 공지나 전달사항은 시간이 지나면 틀린 정보가 될 수 있다. 따라서 메모에 유효기간과 검토일을 붙여 오래된 정보를 다시 확인할 수 있게 한다.

### 상태 값

```ts
active       // 유효
needs_check  // 확인 필요
expired      // 만료
archived     // 보관
```

### 자동 판단 규칙

- validUntil이 오늘보다 과거이면 만료 후보로 표시한다.
- reviewDate가 오늘보다 과거이면 검토 필요 목록에 표시한다.
- 사용자가 직접 상태를 변경할 수 있어야 한다.
- 자동으로 데이터를 삭제하지 않는다.

### 홈 화면 표시

- 오늘 검토할 메모
- 검토일이 지난 메모
- 유효기간이 만료된 메모
- 중요하지만 오래 수정되지 않은 메모

---

## 10. 체크리스트 / 투두 기능

이 앱의 투두 기능은 독립적인 할 일 앱이 아니다. 메모에 연결된 간단한 체크리스트 기능으로 구현한다.

예시:

```text
메모: 장기투숙 객실변경 안내
チェックリスト:
[ ] 영어 응대문구 추가
[ ] 일본어 원문 확인
[ ] 매니저에게 최신 규정 확인
```

필수 기능:

- 메모 안에서 할 일 추가
- 완료 체크
- 삭제
- 선택적으로 dueDate 지정

---

## 11. 개인정보 / 보안 원칙

이 앱은 개인 업무 보조용이다. 회사 내부 정보와 고객 개인정보를 무분별하게 저장하지 않도록 설계한다.

### 저장하지 말아야 할 정보

- 고객 이름
- 전화번호
- 이메일 주소
- 예약번호
- 여권번호
- 결제정보
- 객실번호와 고객을 연결할 수 있는 정보
- 회사 기밀자료 원문 전체
- 사내용 SNS의 민감한 대화 전문

### 권장 안내 문구

앱 첫 화면 또는 설정 화면에 다음 안내를 표시한다.

```text
このアプリは個人の業務メモ用です。
お客様の個人情報、予約番号、電話番号、決済情報などの機密情報を保存しないでください。
会社のセキュリティ規定に違反しない範囲で使用してください。
```

---

## 12. UI / UX 원칙

- 모바일 우선으로 만든다.
- 근무 중 빠르게 검색할 수 있어야 한다.
- 글자가 작으면 안 된다.
- 검색 결과는 카드 형태로 표시한다.
- 태그는 버튼 형태로 표시한다.
- 중요한 메모는 시각적으로 눈에 띄어야 한다.
- 입력 화면은 길어도 되지만, 필수 입력은 제목/본문 정도로 최소화한다.
- 태그 선택은 선택 사항이어야 한다.
- 저장 버튼은 항상 찾기 쉬운 위치에 둔다.

---

## 13. 폴더 구조 예시

```text
src/
  app/
    App.tsx
  components/
    NoteCard.tsx
    TagButton.tsx
    SearchBar.tsx
    NoteEditor.tsx
    TaskList.tsx
  data/
    defaultTags.ts
    tagRules.ts
  db/
    db.ts
    noteRepository.ts
  hooks/
    useNotes.ts
    useSearchNotes.ts
    useTagSuggestions.ts
  pages/
    HomePage.tsx
    SearchPage.tsx
    NoteEditPage.tsx
    NoteDetailPage.tsx
  types/
    note.ts
  utils/
    dateUtils.ts
    tagUtils.ts
    searchUtils.ts
```

---

## 14. 검색 로직 기본 방향

초기 버전에서는 서버 검색 엔진을 쓰지 않는다.

검색 대상:

- 제목
- 본문
- 태그

검색 방식:

- 대소문자 구분 없이 검색
- 일본어, 한국어, 영어 키워드 그대로 포함 검색
- `#태그명` 형식이 들어오면 태그 검색으로 처리
- 일반 단어는 제목/본문/태그 전체 검색

예시 로직:

```ts
function searchNotes(notes: WorkNote[], query: string): WorkNote[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return notes;

  const tokens = normalizedQuery.split(/\s+/);

  return notes.filter((note) => {
    const haystack = [
      note.title,
      note.body,
      ...note.tags
    ].join(' ').toLowerCase();

    return tokens.every((token) => {
      if (token.startsWith('#')) {
        const tag = token.slice(1);
        return note.tags.some((t) => t.toLowerCase() === tag);
      }
      return haystack.includes(token);
    });
  });
}
```

---

## 15. 나중에 확장할 기능

초기 버전 완료 후 검토할 기능:

1. PWA 설치 지원
2. 데이터 내보내기 JSON
3. 데이터 가져오기 JSON
4. 백업 파일 다운로드
5. PC 화면 최적화
6. 좌측 태그 패널 / 중앙 목록 / 우측 상세 3단 레이아웃
7. PocketBase 연동
8. 내부망 전용 버전
9. 사용자 로그인
10. 태그 규칙 편집 화면
11. 자주 검색한 키워드 저장
12. 즐겨찾기 메모
13. 메모 템플릿
14. 영어 응대문구 전용 필드

---

## 16. PocketBase 확장 방향

초기 버전에서는 구현하지 않지만, 나중에 PocketBase로 이전할 수 있도록 데이터 구조를 단순하게 유지한다.

나중에 만들 수 있는 PocketBase 컬렉션:

```text
notes
- title
- body
- tags
- autoTags
- manualTags
- importance
- status
- validUntil
- reviewDate
- created
- updated

tasks
- note
- text
- done
- dueDate

tagRules
- tag
- keywords
- enabled
```

주의:

- 회사 내부망 배포는 회사 허가 후에만 고려한다.
- 초기 버전은 개인 단말 로컬 앱으로만 사용한다.
- 고객 개인정보를 저장하지 않는 설계를 유지한다.

---

## 17. 샘플 메모 데이터

```json
{
  "id": "note_001",
  "title": "駐車タワー高さ制限の案内",
  "body": "駐車タワーは高さ2m、幅1.7mまで利用できます。満車の場合は近くのコインパーキングをご案内します。",
  "tags": ["駐車場", "駐車タワー", "お客様案内", "注意"],
  "autoTags": ["駐車場"],
  "manualTags": ["駐車タワー", "お客様案内", "注意"],
  "importance": "high",
  "status": "active",
  "validUntil": "2026-08-31",
  "reviewDate": "2026-07-31",
  "tasks": [
    {
      "id": "task_001",
      "text": "英語案内文を追加する",
      "done": false
    }
  ],
  "createdAt": "2026-06-28T10:00:00.000Z",
  "updatedAt": "2026-06-28T10:00:00.000Z"
}
```

---

## 18. 완료 기준

1차 MVP 완료 기준:

- 브라우저에서 앱이 실행된다.
- 모바일 화면에서 메모를 작성할 수 있다.
- 작성한 메모가 새로고침 후에도 남아 있다.
- 메모를 수정/삭제할 수 있다.
- 기본 태그를 선택할 수 있다.
- 본문 키워드로 자동 태그가 추천된다.
- 태그와 키워드로 검색할 수 있다.
- 중요도와 상태를 설정할 수 있다.
- 유효기간이 지난 메모를 따로 볼 수 있다.
- 검토일이 지난 메모를 따로 볼 수 있다.
- 고객 개인정보 저장 금지 안내가 표시된다.

---

## 19. 개발 시 주의사항

- 처음부터 복잡한 디자인 시스템을 만들지 않는다.
- 기능을 작게 나누어 구현한다.
- 검색 기능을 가장 먼저 안정화한다.
- 데이터 구조는 나중에 PocketBase로 옮기기 쉽게 단순하게 유지한다.
- 카테고리 기능은 만들지 않는다.
- 태그가 카테고리 역할을 하도록 설계한다.
- 회사 배포나 사내망 운영은 현재 범위가 아니다.
- 현재 목표는 사용자가 실제 근무 중 개인적으로 쓸 수 있는 로컬 앱이다.
