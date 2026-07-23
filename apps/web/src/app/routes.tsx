import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";

import { LoginPage } from "../pages/auth/LoginPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";

import { RepositoryOverviewPage } from "../pages/repositories/RepositoryOverviewPage";
import { RepositoryTrendsPage } from "../pages/repositories/RepositoryTrendsPage";
import { RepositoryFindingsPage } from "../pages/repositories/RepositoryFindingsPage";
import { RepositoryPullRequestsPage } from "../pages/repositories/RepositoryPullRequestsPage";
import { RepositoryQualityGatePage } from "../pages/repositories/RepositoryQualityGatePage";
import { RepositoryMembersPage } from "../pages/repositories/RepositoryMembersPage";

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

            AppLayout contains:
            - Sidebar
            - Topbar
            - Outlet

            All routes inside this Route
            automatically receive the layout.
        ========================== */}

        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />

          {/* =========================
              REPOSITORY ROUTES

              repoId example:
              /repositories/123
          ========================== */}

          <Route
            path="/repositories/:repoId"
            element={<RepositoryOverviewPage />}
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