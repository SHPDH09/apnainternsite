import { Navigate, Route, Routes } from "react-router-dom";
import { WaCrmShell } from "@/wa-crm/layout/WaCrmShell";
import { DashboardPage } from "@/wa-crm/pages/DashboardPage";
import { InboxPage } from "@/wa-crm/pages/InboxPage";
import {
  AiKnowledgePage,
  AiPage,
  AnalyticsPage,
  AutomationPage,
  CampaignCreatePage,
  CampaignsPage,
  CompliancePage,
  ContactsPage,
  LeadsPage,
  SettingsPage,
  TeamPage,
  TemplatesPage,
  WhatsAppSettingsPage,
} from "@/wa-crm/pages/WaCrmFeaturePages";

export default function WaCrmApp() {
  return (
    <Routes>
      <Route path="/" element={<WaCrmShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/:conversationId" element={<InboxPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/create" element={<CampaignCreatePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="ai" element={<AiPage />} />
        <Route path="ai/knowledge" element={<AiKnowledgePage />} />
        <Route path="automation" element={<AutomationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="whatsapp" element={<WhatsAppSettingsPage />} />
        <Route path="compliance" element={<CompliancePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin/wa-crm" replace />} />
      </Route>
    </Routes>
  );
}
