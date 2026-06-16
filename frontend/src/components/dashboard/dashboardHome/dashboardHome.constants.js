import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFileText,
  FiGrid,
  FiRefreshCw,
  FiSettings,
  FiUploadCloud,
} from "react-icons/fi";

export const ROLE_LABEL = {
  SYSTEM_ADMIN: "시스템 관리자",
  MANAGER: "관리팀 사용자",
  SUBMITTER: "증빙 제출자",
};

export const STATUS_LABEL = {
  UPLOADED: "업로드 완료",
  PROCESSING: "처리 중",
  AI_EXTRACTED: "AI 추출 완료",
  NEED_REVIEW: "검토 필요",
  NEED_SUPPLEMENT: "보완 요청",
  COMPLETED: "완료",
  GENERATED: "생성 완료",
  FAILED: "실패",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  ARCHIVED: "보관",
};

export const STATUS_CLASS = {
  UPLOADED: "bg-blue-50 text-blue-600",
  PROCESSING: "bg-slate-100 text-slate-600",
  AI_EXTRACTED: "bg-indigo-50 text-indigo-600",
  NEED_REVIEW: "bg-orange-50 text-orange-600",
  NEED_SUPPLEMENT: "bg-red-50 text-red-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  GENERATED: "bg-emerald-50 text-emerald-600",
  FAILED: "bg-red-50 text-red-600",
  ACTIVE: "bg-emerald-50 text-emerald-600",
  INACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export const CHART_DATA = [
  { day: "6/1", upload: 6, review: 2, generated: 4 },
  { day: "6/2", upload: 9, review: 3, generated: 6 },
  { day: "6/3", upload: 7, review: 4, generated: 5 },
  { day: "6/4", upload: 11, review: 2, generated: 8 },
  { day: "6/5", upload: 8, review: 3, generated: 7 },
];

export const getPageConfigByRole = (roleCode) => {
  if (roleCode === "SYSTEM_ADMIN") {
    return {
      title: "시스템 관리 대시보드",
      description: "템플릿, 매핑, 검증 규칙과 처리 이력을 관리하세요.",
      primaryAction: {
        label: "템플릿 관리",
        path: "/templates",
        icon: FiFileText,
      },
      secondaryAction: {
        label: "매핑 관리",
        path: "/mappings",
        icon: FiSettings,
      },
    };
  }

  if (roleCode === "MANAGER") {
    return {
      title: "관리팀 대시보드",
      description:
        "검토가 필요한 증빙과 생성된 경비청구서 엑셀을 확인하세요.",
      primaryAction: {
        label: "검토 필요 항목",
        path: "/reviews",
        icon: FiAlertCircle,
      },
      secondaryAction: {
        label: "생성 문서 확인",
        path: "/generated",
        icon: FiDownload,
      },
    };
  }

  return {
    title: "증빙 제출 대시보드",
    description:
      "내가 제출한 증빙자료의 처리 상태와 보완 요청을 확인하세요.",
    primaryAction: {
      label: "증빙 업로드",
      path: "/upload",
      icon: FiUploadCloud,
    },
    secondaryAction: {
      label: "보완 요청 확인",
      path: "/supplements",
      icon: FiAlertCircle,
    },
  };
};

export const getStatsByRole = ({ roleCode, dashboardData }) => {
  const {
    myBatches,
    reviewItems,
    supplementItems,
    generatedDocuments,
    templates,
  } = dashboardData;

  if (roleCode === "SYSTEM_ADMIN") {
    return [
      {
        label: "등록 템플릿",
        value: templates.length,
        icon: FiFileText,
        color: "text-blue-600",
      },
      {
        label: "활성 템플릿",
        value: templates.filter((item) => item.status === "ACTIVE").length,
        icon: FiSettings,
        color: "text-indigo-600",
      },
      {
        label: "검토 발생",
        value: reviewItems.length,
        icon: FiAlertCircle,
        color: "text-orange-600",
      },
      {
        label: "생성 문서",
        value: generatedDocuments.length,
        icon: FiDownload,
        color: "text-emerald-600",
      },
    ];
  }

  if (roleCode === "MANAGER") {
    return [
      {
        label: "오늘 접수",
        value: myBatches.length,
        icon: FiUploadCloud,
        color: "text-blue-600",
      },
      {
        label: "검토 필요",
        value: reviewItems.length,
        icon: FiAlertCircle,
        color: "text-orange-600",
      },
      {
        label: "보완 요청",
        value: supplementItems.length,
        icon: FiClock,
        color: "text-red-600",
      },
      {
        label: "생성 완료",
        value: generatedDocuments.length,
        icon: FiCheckCircle,
        color: "text-emerald-600",
      },
    ];
  }

  return [
    {
      label: "내 제출 자료",
      value: myBatches.length,
      icon: FiUploadCloud,
      color: "text-blue-600",
    },
    {
      label: "처리 중",
      value: myBatches.filter((item) =>
        ["UPLOADED", "PROCESSING", "AI_EXTRACTED"].includes(item.status)
      ).length,
      icon: FiRefreshCw,
      color: "text-indigo-600",
    },
    {
      label: "보완 요청",
      value: supplementItems.length,
      icon: FiAlertCircle,
      color: "text-red-600",
    },
    {
      label: "완료",
      value: myBatches.filter((item) =>
        ["COMPLETED", "GENERATED"].includes(item.status)
      ).length,
      icon: FiCheckCircle,
      color: "text-emerald-600",
    },
  ];
};

export const getQuickActionsByRole = (roleCode) => {
  if (roleCode === "SYSTEM_ADMIN") {
    return [
      {
        label: "템플릿 관리",
        description: "엑셀 양식 등록",
        path: "/templates",
        icon: FiFileText,
      },
      {
        label: "매핑 관리",
        description: "필드와 셀 위치 연결",
        path: "/mappings",
        icon: FiSettings,
      },
      {
        label: "작업 이력",
        description: "수정 및 다운로드 이력",
        path: "/audit",
        icon: FiClock,
      },
    ];
  }

  if (roleCode === "MANAGER") {
    return [
      {
        label: "검토 필요 항목",
        description: "오류·누락 항목 확인",
        path: "/reviews",
        icon: FiAlertCircle,
      },
      {
        label: "생성 문서",
        description: "엑셀 다운로드",
        path: "/generated",
        icon: FiDownload,
      },
      {
        label: "증빙 업로드",
        description: "대리 업로드",
        path: "/upload",
        icon: FiUploadCloud,
      },
    ];
  }

  return [
    {
      label: "증빙 업로드",
      description: "영수증·PDF·이미지 제출",
      path: "/upload",
      icon: FiUploadCloud,
    },
    {
      label: "내 업로드",
      description: "제출 자료 상태 확인",
      path: "/my-uploads",
      icon: FiGrid,
    },
    {
      label: "보완 요청",
      description: "보완 자료 재업로드",
      path: "/supplements",
      icon: FiAlertCircle,
    },
  ];
};

export const getMainListConfigByRole = ({ roleCode, dashboardData }) => {
  if (roleCode === "SYSTEM_ADMIN") {
    return {
      title: "최근 템플릿",
      linkText: "템플릿 관리",
      path: "/templates",
      items: dashboardData.templates,
      emptyText: "등록된 템플릿이 없습니다.",
    };
  }

  if (roleCode === "MANAGER") {
    return {
      title: "검토 필요 자료",
      linkText: "전체 보기",
      path: "/reviews",
      items: dashboardData.reviewItems,
      emptyText: "검토가 필요한 자료가 없습니다.",
    };
  }

  return {
    title: "내 최근 제출 자료",
    linkText: "전체 보기",
    path: "/my-uploads",
    items: dashboardData.myBatches,
    emptyText: "최근 제출한 자료가 없습니다.",
  };
};

export const getSubListConfigByRole = ({ roleCode, dashboardData }) => {
  if (roleCode === "SYSTEM_ADMIN") {
    return {
      title: "반복 확인 필요 항목",
      badge: `${dashboardData.reviewItems.length}건`,
      path: "/reviews",
      items: dashboardData.reviewItems,
      emptyText: "반복 오류 항목이 없습니다.",
    };
  }

  if (roleCode === "MANAGER") {
    return {
      title: "생성 완료 문서",
      badge: `${dashboardData.generatedDocuments.length}건`,
      path: "/generated",
      items: dashboardData.generatedDocuments,
      emptyText: "생성 완료된 문서가 없습니다.",
    };
  }

  return {
    title: "보완 요청 자료",
    badge: `${dashboardData.supplementItems.length}건`,
    path: "/supplements",
    items: dashboardData.supplementItems,
    emptyText: "보완 요청된 자료가 없습니다.",
  };
};

export const safeList = (result) => {
  if (!result) return [];

  if (Array.isArray(result)) return result;

  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.batches)) return result.batches;
  if (Array.isArray(result.documents)) return result.documents;
  if (Array.isArray(result.generatedDocuments)) return result.generatedDocuments;
  if (Array.isArray(result.templates)) return result.templates;

  if (result.data && Array.isArray(result.data.items)) {
    return result.data.items;
  }

  if (result.data && Array.isArray(result.data.rows)) {
    return result.data.rows;
  }

  if (result.data && Array.isArray(result.data.batches)) {
    return result.data.batches;
  }

  if (result.data && Array.isArray(result.data.documents)) {
    return result.data.documents;
  }

  if (result.data && Array.isArray(result.data.generatedDocuments)) {
    return result.data.generatedDocuments;
  }

  if (result.data && Array.isArray(result.data.templates)) {
    return result.data.templates;
  }

  return [];
};