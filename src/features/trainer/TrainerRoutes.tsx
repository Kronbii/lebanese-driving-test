import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { TrainerShell } from "./TrainerShell";
import { HomePage } from "./HomePage";
import { ExamPage, StartExamRoute } from "./ExamPage";
import { ResultsPage } from "./ResultsPage";
import { PracticePage } from "./PracticePage";
import { NotebookPage } from "./NotebookPage";
import { QuestionPage } from "./QuestionPage";
import { SignsPage } from "./signs/SignsPage";
import { FlashcardsPage } from "./signs/FlashcardsPage";
import { ReversePage } from "./signs/ReversePage";
import { DrillPage } from "./signs/DrillPage";
import { ProgressPage } from "./ProgressPage";
import { SettingsPage } from "./SettingsPage";
import { ProfilesPage } from "./ProfilesPage";
import { JoinPage } from "./JoinPage";
import { RestorePage } from "./RestorePage";

const PrintPage = lazy(() => import("../print/PrintPage"));
const ProjectorPage = lazy(() => import("../projector/ProjectorPage"));

/**
 * Student trainer pages. Mounted at "/" (public) and "/s/:slug/learn/" (school).
 * Build links with useSchool().link("path") so they work under both.
 */
export function TrainerRoutes() {
  return (
    <Routes>
      <Route path="print/:kind" element={<PrintPage />} />
      <Route path="projector" element={<ProjectorPage />} />
      <Route element={<TrainerShell />}>
        <Route index element={<HomePage />} />
        <Route path="exam/:mode" element={<StartExamRoute />} />
        <Route path="play" element={<ExamPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="notebook" element={<NotebookPage />} />
        <Route path="question/:id" element={<QuestionPage />} />
        <Route path="signs" element={<SignsPage />} />
        <Route path="signs/flashcards" element={<FlashcardsPage />} />
        <Route path="signs/reverse" element={<ReversePage />} />
        <Route path="signs/drill" element={<DrillPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profiles" element={<ProfilesPage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="restore" element={<RestorePage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
    </Routes>
  );
}
