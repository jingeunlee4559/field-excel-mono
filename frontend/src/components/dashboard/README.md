# dashboard components 구조

이 폴더는 dashboard 계열 페이지의 UI 조각을 모아둔 영역입니다.

## 원칙

- `pages/**/Page.jsx`는 라우팅 진입점과 상태/API 흐름을 담당합니다.
- `components/dashboard/**`는 화면 섹션, 카드, 테이블, 필터, 미리보기 등 UI 조각을 담당합니다.
- `Container.jsx`, `index.js` 재-export 중심 구조는 사용하지 않습니다.
- `DashboardHomePage.jsx`처럼 페이지에서 필요한 컴포넌트를 직접 import해 조립합니다.
- 반복되는 상단 제목 영역은 `common/DashboardPageHeader.jsx`를 사용합니다.

## 주요 폴더

```txt
components/dashboard/
  common/
    DashboardPageHeader.jsx
  UploadPage/
  ReviewListPage/
  BatchReviewConfirmPage/
  ManagerReportPage/
  MappingPage/
  dashboardHome/
```

## 적용 페이지

- `pages/submitter/UploadPage.jsx`
- `pages/management/ReviewListPage.jsx`
- `pages/management/BatchReviewConfirmPage.jsx`
- `pages/management/ManagerReportPage.jsx`
- `pages/admin/MappingPage.jsx`
