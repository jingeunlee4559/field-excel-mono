import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { uploadApi, reviewApi, excelApi, templateApi } from "../../api";

import DashboardHero from "../../components/dashboard/dashboardHome/DashboardHero";
import DashboardStatCard from "../../components/dashboard/dashboardHome/DashboardStatCard";
import DashboardQuickActions from "../../components/dashboard/dashboardHome/DashboardQuickActions";
import DashboardProcessChart from "../../components/dashboard/dashboardHome/DashboardProcessChart";
import DashboardList from "../../components/dashboard/dashboardHome/DashboardList";

import {
  getMainListConfigByRole,
  getPageConfigByRole,
  getQuickActionsByRole,
  getStatsByRole,
  getSubListConfigByRole,
  safeList,
} from "../../components/dashboard/dashboardHome/dashboardHome.constants.js";

const EMPTY_DASHBOARD_DATA = {
  myBatches: [],
  reviewItems: [],
  supplementItems: [],
  generatedDocuments: [],
  templates: [],
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD_DATA);

  const roleCode = user?.roleCode || "SUBMITTER";
  const isManagementRole = ["MANAGER", "SYSTEM_ADMIN"].includes(roleCode);
  const isAdminRole = roleCode === "SYSTEM_ADMIN";

  const pageConfig = useMemo(() => getPageConfigByRole(roleCode), [roleCode]);

  const stats = useMemo(() => {
    return getStatsByRole({ roleCode, dashboardData });
  }, [roleCode, dashboardData]);

  const quickActions = useMemo(() => getQuickActionsByRole(roleCode), [roleCode]);

  const mainListConfig = useMemo(() => {
    return getMainListConfigByRole({ roleCode, dashboardData });
  }, [roleCode, dashboardData]);

  const subListConfig = useMemo(() => {
    return getSubListConfigByRole({ roleCode, dashboardData });
  }, [roleCode, dashboardData]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const nextData = { ...EMPTY_DASHBOARD_DATA };

      const myBatchesResult = await uploadApi
        .getMyBatches({ page: 1, size: 5 })
        .catch(() => ({ items: [] }));
      nextData.myBatches = safeList(myBatchesResult);

      // 관리팀/시스템 관리자만 검토·보완·생성문서 API를 조회한다.
      // 제출자 화면에서 이 API들을 호출하면 정상적으로 403이 발생하므로 호출 자체를 막는다.
      if (isManagementRole) {
        const [reviewItemsResult, supplementItemsResult, generatedDocumentsResult] =
          await Promise.all([
            reviewApi.getRequiredReviews({ page: 1, size: 5 }).catch(() => ({ items: [] })),
            reviewApi.getSupplementRequiredList({ page: 1, size: 5 }).catch(() => ({ items: [] })),
            excelApi.getGeneratedDocuments({ page: 1, size: 5 }).catch(() => ({ items: [] })),
          ]);

        nextData.reviewItems = safeList(reviewItemsResult);
        nextData.supplementItems = safeList(supplementItemsResult);
        nextData.generatedDocuments = safeList(generatedDocumentsResult);
      }

      // 템플릿 목록은 업로드 화면의 템플릿명 선택에도 필요하다.
      // 백엔드 GET 권한을 로그인 사용자로 완화했기 때문에 여기서는 모든 역할이 조회 가능하다.
      if (isAdminRole || isManagementRole || roleCode === "SUBMITTER") {
        const templatesResult = await templateApi
          .getTemplates({ status: "ACTIVE", page: 1, size: 5 })
          .catch(() => ({ items: [] }));
        nextData.templates = safeList(templatesResult);
      }

      setDashboardData(nextData);
    } catch (error) {
      console.error("대시보드 조회 실패:", error);
      setDashboardData(EMPTY_DASHBOARD_DATA);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [roleCode]);

  return (
    <div className="space-y-6">
      <DashboardHero roleCode={roleCode} pageConfig={pageConfig} onNavigate={navigate} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <DashboardStatCard key={item.label} item={item} loading={loading} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <DashboardProcessChart />
        <DashboardQuickActions actions={quickActions} onNavigate={navigate} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardList
          title={mainListConfig.title}
          linkText={mainListConfig.linkText}
          path={mainListConfig.path}
          items={mainListConfig.items}
          emptyText={mainListConfig.emptyText}
          loading={loading}
          onNavigate={navigate}
        />

        <DashboardList
          title={subListConfig.title}
          badge={subListConfig.badge}
          path={subListConfig.path}
          items={subListConfig.items}
          emptyText={subListConfig.emptyText}
          loading={loading}
          emphasized
          onNavigate={navigate}
        />
      </section>
    </div>
  );
};

export default DashboardHomePage;
