import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import InvoicesShell from './pages/invoices/InvoicesShell';
import InvoiceList from './pages/invoices/InvoiceList';
import InvoiceDetail from './pages/invoices/InvoiceDetail';
import InvoiceForm from './pages/invoices/InvoiceForm';
import CustomerList from './pages/customers/CustomerList';
import CustomerDetail from './pages/customers/CustomerDetail';
import CustomerForm from './pages/customers/CustomerForm';
import SupplierList from './pages/suppliers/SupplierList';
import SupplierDetail from './pages/suppliers/SupplierDetail';
import SupplierForm from './pages/suppliers/SupplierForm';
import Expenses from './pages/Expenses';
import ExpenseDetail from './pages/expenses/ExpenseDetail';
import ExpenseFormPage from './pages/expenses/ExpenseFormPage';
import DimensionsContent from './pages/Dimensions';
import Accounting from './pages/Accounting';
import VAT from './pages/VAT';
import Users from './pages/Users';
import Superuser from './pages/Superuser';
import Settings from './pages/Settings';
import SettingsLayout from './pages/SettingsLayout';
import DimensionAdmin from './pages/DimensionAdmin';
import Backup from './pages/Backup';
import AnnualReport from './pages/AnnualReport';
import Inbox from './pages/Inbox';
import AssetList from './pages/assets/AssetList';
import Subscriptions from './pages/Subscriptions';
import SubscriptionDetail from './pages/subscriptions/SubscriptionDetail';
import SubscriptionForm from './pages/subscriptions/SubscriptionForm';
import { Loader2 } from 'lucide-react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <Loader2 className="animate-spin text-brand-500" size={32} />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function SuperuserRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <Loader2 className="animate-spin text-brand-500" size={32} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return user.isSuperuser ? <>{children}</> : <Navigate to="/" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <Loader2 className="animate-spin text-brand-500" size={32} />
    </div>
  );
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="inbox" element={<Inbox />} />

        <Route path="invoices" element={<InvoicesShell />}>
          <Route index element={<InvoiceList />} />
          <Route path="new" element={<InvoiceForm />} />
          <Route path=":id/edit" element={<InvoiceForm />} />
          <Route path=":id" element={<InvoiceDetail />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="subscriptions/new" element={<SubscriptionForm />} />
          <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
          <Route path="subscriptions/:id/edit" element={<SubscriptionForm />} />
        </Route>

        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="customers/:id/edit" element={<CustomerForm />} />

        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/new" element={<SupplierForm />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="suppliers/:id/edit" element={<SupplierForm />} />

        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<ExpenseFormPage />} />
        <Route path="expenses/:id" element={<ExpenseDetail />} />
        <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
        <Route path="assets" element={<AssetList />} />
        <Route path="dimensions" element={<DimensionsContent />} />
        <Route path="accounting" element={<Accounting />} />
        <Route path="annual-report" element={<AnnualReport />} />
        <Route path="vat" element={<VAT />} />

        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="company" replace />} />
          <Route path="company" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="dimensions" element={<DimensionAdmin />} />
          <Route path="backup" element={<Backup />} />
          <Route path="superuser" element={<SuperuserRoute><Superuser /></SuperuserRoute>} />
        </Route>
      </Route>

      <Route path="subscriptions/*" element={<Navigate to="/invoices/subscriptions" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
