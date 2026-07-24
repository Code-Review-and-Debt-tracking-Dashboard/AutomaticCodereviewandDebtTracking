import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";

import { LoginPage } from "../pages/auth/LoginPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";

import { RepositoriesPage } from "../pages/repositories/RepositoriesPage";
import { RepositoryOverviewPage } from "../pages/repositories/RepositoryOverviewPage";
import { RepositoryTrendsPage } from "../pages/repositories/RepositoryTrendsPage";
import { RepositoryFindingsPage } from "../pages/repositories/RepositoryFindingsPage";
import { RepositoryPullRequestsPage } from "../pages/repositories/RepositoryPullRequestsPage";
import { RepositoryQualityGatePage } from "../pages/repositories/RepositoryQualityGatePage";
import { RepositoryMembersPage } from "../pages/repositories/RepositoryMembersPage";
import { RepositoryFilesPage } from "../pages/repositories/RepositoryFilesPage";
import { RepositoryAnalyzePage } from "../pages/repositories/RepositoryAnalyzePage";

import { GlobalPullRequestsPage } from "../pages/global/GlobalPullRequestsPage";
import { GlobalFindingsPage } from "../pages/global/GlobalFindingsPage";
import { GlobalAnalyticsPage } from "../pages/global/GlobalAnalyticsPage";
import { GlobalNotificationsPage } from "../pages/global/GlobalNotificationsPage";
import { GlobalMembersPage } from "../pages/global/GlobalMembersPage";
import { AiCopilotPage } from "../pages/global/AiCopilotPage";
import { SettingsPage } from "../pages/global/SettingsPage";
import { ProfilePage } from "../pages/global/ProfilePage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* =========================
            PROTECTED APPLICATION ROUTES
        ========================== */}

        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />

          {/* Repositories List */}
          <Route
            path="/repositories"
            element={<RepositoriesPage />}
          />

          {/* Global Pages */}
          <Route
            path="/pull-requests"
            element={<GlobalPullRequestsPage />}
          />

          <Route
            path="/findings"
            element={<GlobalFindingsPage />}
          />

          <Route
            path="/analytics"
            element={<GlobalAnalyticsPage />}
          />

          <Route
            path="/notifications"
            element={<GlobalNotificationsPage />}
          />

          <Route
            path="/members"
            element={<GlobalMembersPage />}
          />

          <Route
            path="/ai-copilot"
            element={<AiCopilotPage />}
          />

          <Route
            path="/settings"
            element={<SettingsPage />}
          />

          <Route
            path="/profile"
            element={<ProfilePage />}
          />

          {/* =========================
              REPOSITORY SPECIFIC ROUTES
          ========================== */}

          <Route
            path="/repositories/:repoId"
            element={<RepositoryOverviewPage />}
          />

          <Route
            path="/repositories/:repoId/files"
            element={<RepositoryFilesPage />}
          />

          <Route
            path="/repositories/:repoId/analyze"
            element={<RepositoryAnalyzePage />}
          />

          <Route
            path="/repositories/:repoId/trends"
            element={<RepositoryTrendsPage />}
          />

          <Route
            path="/repositories/:repoId/findings"
            element={<RepositoryFindingsPage />}
          />

          <Route
            path="/repositories/:repoId/pull-requests"
            element={<RepositoryPullRequestsPage />}
          />

          <Route
            path="/repositories/:repoId/quality-gate"
            element={<RepositoryQualityGatePage />}
          />

          <Route
            path="/repositories/:repoId/members"
            element={<RepositoryMembersPage />}
          />

        </Route>

        {/* =========================
            FALLBACK ROUTE
        ========================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}