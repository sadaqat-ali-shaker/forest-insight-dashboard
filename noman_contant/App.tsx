import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CsvDataProvider } from "@/context/CsvDataContext";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import SegmentationPage from "./pages/SegmentationPage";
import FeaturesPage from "./pages/FeaturesPage";
import BiomassPage from "./pages/BiomassPage";
import PredictionPage from "./pages/PredictionPage";
import InventoryPage from "./pages/InventoryPage";
import SectorGrowthPage from "./pages/SectorGrowthPage";
import OverviewPage from "./pages/OverviewPage";
import SpeciesAnalysisPage from "./pages/SpeciesAnalysisPage";
import SpatialMapPage from "./pages/SpatialMapPage";
import HealthRiskPage from "./pages/HealthRiskPage";
import ForestChangePage from "./pages/ForestChangePage";
import SeasonalGrowthPage from "./pages/SeasonalGrowthPage";
import DataManagerPage from "./pages/DataManagerPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CsvDataProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              {/* Pipeline */}
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/segmentation" element={<SegmentationPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/biomass" element={<BiomassPage />} />
              <Route path="/prediction" element={<PredictionPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              {/* Statistical Analysis */}
              <Route path="/analysis/overview" element={<OverviewPage />} />
              <Route path="/analysis/species" element={<SpeciesAnalysisPage />} />
              <Route path="/analysis/spatial-map" element={<SpatialMapPage />} />
              <Route path="/analysis/health-risk" element={<HealthRiskPage />} />
              <Route path="/analysis/forest-change" element={<ForestChangePage />} />
              <Route path="/analysis/seasonal-growth" element={<SeasonalGrowthPage />} />
              <Route path="/analysis/data-manager" element={<DataManagerPage />} />
              <Route path="/sector-growth" element={<SectorGrowthPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CsvDataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
