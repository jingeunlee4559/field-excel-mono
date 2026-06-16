import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";

import DashboardHomePage from "../pages/common/DashboardHomePage";
import ProfilePage from "../pages/common/ProfilePage";
import SettingsPage from "../pages/common/SettingsPage";
import ForbiddenPage from "../pages/common/ForbiddenPage";

import UploadPage from "../pages/submitter/UploadPage";
import MyUploadsPage from "../pages/submitter/MyUploadsPage";
import SupplementsPage from "../pages/submitter/SupplementsPage";

import ReviewListPage from "../pages/management/ReviewListPage";
import BatchReviewConfirmPage from "../pages/management/BatchReviewConfirmPage";
import GeneratedDocumentsPage from "../pages/management/GeneratedDocumentsPage";
import ManagerReportPage from "../pages/management/ManagerReportPage";

import TemplatePage from "../pages/admin/TemplatePage";
import MappingPage from "../pages/admin/MappingPage";
import AuditPage from "../pages/admin/AuditPage";
import CorrectionDictionaryPage from "../pages/admin/CorrectionDictionaryPage";

const Approuter = () => {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboardhome" element={<DashboardHomePage />} />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          <Route element={<RoleRoute allowedRoles={["SUBMITTER", "MANAGER", "SYSTEM_ADMIN"]} />}>
            <Route path="/upload" element={<UploadPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={["SUBMITTER"]} />}>
            <Route path="/my-uploads" element={<MyUploadsPage />} />
            <Route path="/supplements" element={<SupplementsPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={["MANAGER", "SYSTEM_ADMIN"]} />}>
            <Route path="/reviews" element={<ReviewListPage />} />
            <Route path="/reviews/batches/:batchId" element={<BatchReviewConfirmPage />} />
            <Route path="/reviews/files/:sourceFileId" element={<Navigate to="/reviews" replace />} />
            <Route path="/reviews/:sourceFileId" element={<Navigate to="/reviews" replace />} />
            <Route path="/generated" element={<GeneratedDocumentsPage />} />
            <Route path="/manager-reports" element={<ManagerReportPage />} />
            <Route path="/corrections" element={<CorrectionDictionaryPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={["SYSTEM_ADMIN"]} />}>
            <Route path="/templates" element={<TemplatePage />} />
            <Route path="/mappings" element={<MappingPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboardhome" replace />} />
    </Routes>
  );
};

export default Approuter;
