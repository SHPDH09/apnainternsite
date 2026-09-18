import { useEffect } from "react";
import type { ReactNode } from "react";
import ReactGA from "react-ga4";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import StudentOtpLogin from "./pages/StudentOtpLogin.tsx";
import Register from "./pages/Register.tsx";
import Contact from "./pages/Contact.tsx";
import VerifyCertificate from "./pages/VerifyCertificate.tsx";
import VerifyIdCard from "./pages/VerifyIdCard.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Admin from "./pages/Admin.tsx";
import EngineeringManagement from "./pages/EngineeringManagement.tsx";
import NonEngineeringManagement from "./pages/NonEngineeringManagement.tsx";
import SuperAdmin from "./pages/SuperAdmin.tsx";
import StaffDashboard from "./pages/StaffDashboard.tsx";
import Benefits from "./pages/Benefits.tsx";
import Courses from "./pages/Courses.tsx";
import CourseDetails from "./pages/CourseDetails.tsx";
import CourseEnroll from "./pages/CourseEnroll.tsx";
import AssignmentTest from "./pages/AssignmentTest.tsx";
import AssignmentResult from "./pages/AssignmentResult.tsx";
import PaymentStatus from "./pages/PaymentStatus.tsx";
import CyberCafeRegister from "./pages/CyberCafeRegister.tsx";
import CyberCafeDashboard from "./pages/CyberCafeDashboard.tsx";
import PartnerRegister from "./pages/PartnerRegister.tsx";
import PartnerApplicationDashboard from "./pages/PartnerApplicationDashboard.tsx";
import CollegeDashboard from "./pages/CollegeDashboard.tsx";
import ReferralPartnerDashboard from "./pages/ReferralPartnerDashboard.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AuthConfirm from "./pages/AuthConfirm.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import { VisitorTracker } from "./components/VisitorTracker";
import { SitePopupsHost } from "./components/NoticePopup";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { StudentDashboardGate } from "./components/StudentDashboardGate";
import { AdminSessionRefresh } from "./components/AdminSessionRefresh";
import { StudentSessionRefresh } from "./components/StudentSessionRefresh";
import { authConfirmPathWithTokens } from "@/lib/authRedirectGuard";

function AuthCallbackRedirect() { const { search, hash } = useLocation(); return <Navigate to={authConfirmPathWithTokens(search, hash)} replace />; }
function Analytics() { const location = useLocation(); useEffect(() => { ReactGA.send({ hitType: "pageview", page: location.pathname }); }, [location]); return null; }
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: false } } });
const Protected = ({ roles, children }: { roles: string[]; children: ReactNode }) => <ProtectedRoute allowedRoles={roles as any}>{children}</ProtectedRoute>;

const App = () => (
  <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Analytics /><AdminSessionRefresh /><StudentSessionRefresh /><VisitorTracker /><SitePopupsHost />
    <Routes>
      <Route path="/" element={<Index />} /><Route path="/login" element={<StudentOtpLogin />} /><Route path="/admin/login" element={<Login />} /><Route path="/cybercafe/login" element={<Login />} /><Route path="/cyber-cafe/login" element={<Navigate to="/cybercafe/login" replace />} />
      <Route path="/register" element={<Register />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/auth/confirm" element={<AuthConfirm />} /><Route path="/auth/callback" element={<AuthCallbackRedirect />} /><Route path="/verify" element={<VerifyCertificate />} /><Route path="/verify-id" element={<VerifyIdCard />} />
      <Route path="/dashboard" element={<Protected roles={["student"]}><StudentDashboardGate><Dashboard /></StudentDashboardGate></Protected>} />
      <Route path="/admin" element={<Protected roles={["admin", "super_admin"]}><Admin /></Protected>} /><Route path="/admin/popups" element={<Protected roles={["admin", "super_admin"]}><Admin /></Protected>} /><Route path="/admin/contact-details" element={<Protected roles={["admin", "super_admin"]}><Admin /></Protected>} /><Route path="/admin/whatsapp-links" element={<Protected roles={["admin", "super_admin"]}><Admin /></Protected>} /><Route path="/admin/engineering-management" element={<Protected roles={["admin", "super_admin"]}><EngineeringManagement /></Protected>} /><Route path="/admin/non-engineering-management" element={<Protected roles={["admin", "super_admin"]}><NonEngineeringManagement /></Protected>} /><Route path="/admin/referrals" element={<Navigate to="/admin?tab=referrals" replace />} />
      <Route path="/super-admin" element={<Protected roles={["super_admin"]}><SuperAdmin /></Protected>} /><Route path="/staff-dashboard" element={<Protected roles={["staff"]}><StaffDashboard /></Protected>} /><Route path="/college/login" element={<Login />} /><Route path="/college/dashboard" element={<Protected roles={["college_admin"]}><CollegeDashboard /></Protected>} /><Route path="/referral/login" element={<Login />} /><Route path="/referral/dashboard" element={<Protected roles={["referral_partner"]}><ReferralPartnerDashboard /></Protected>} />
      <Route path="/benefits" element={<Benefits />} /><Route path="/courses" element={<Courses />} /><Route path="/courses/:slug/enroll" element={<CourseEnroll />} /><Route path="/courses/:slug" element={<CourseDetails />} /><Route path="/terms" element={<Terms />} /><Route path="/privacy" element={<Privacy />} /><Route path="/contact" element={<Contact />} /><Route path="/blog" element={<Blog />} /><Route path="/blog/:slug" element={<BlogPost />} /><Route path="/assignment/:id" element={<AssignmentTest />} /><Route path="/assignment/:id/result" element={<AssignmentResult />} /><Route path="/payment-status" element={<PaymentStatus />} /><Route path="/partner/register" element={<PartnerRegister />} /><Route path="/partner/dashboard" element={<PartnerApplicationDashboard />} /><Route path="/cybercafe" element={<CyberCafeRegister />} /><Route path="/cybercafe/dashboard" element={<Protected roles={["cybercafe"]}><CyberCafeDashboard /></Protected>} /><Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter></TooltipProvider></QueryClientProvider>
);
export default App;
