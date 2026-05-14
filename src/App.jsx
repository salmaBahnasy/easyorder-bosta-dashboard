import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/home/HomePage";
import CreateOrderPage from "./pages/orders/CreateOrderPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import LoginPage from "./pages/login/LoginPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import OrderPayloadDetailsPage from "./pages/orders/OrderPayloadDetailsPage";
import OrdersPage from "./pages/orders/OrdersPage";
import OrdersStatsPage from "./pages/OrdersStatsPage";
import CreateProductPage from "./pages/products/CreateProductPage";
import EditProductPage from "./pages/products/EditProductPage";
import ProductsPage from "./pages/products/ProductsPage";
import {
  appHref,
  getAppBasePath,
  getSelectedSystem,
  hasValidStoredToken,
  isStoredUserAdmin,
} from "./utils/auth";

function RequireAuth({ children }) {
  if (!hasValidStoredToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/** URL segment must match `selectedSystem` in localStorage. */
function SystemShell({ expectedSystem }) {
  const stored = getSelectedSystem();
  if (stored !== expectedSystem) {
    return <Navigate to={`${getAppBasePath()}/dashboard`} replace />;
  }
  return <Outlet />;
}

function RequireAdmin({ children }) {
  if (!isStoredUserAdmin()) {
    return <Navigate to={`${getAppBasePath()}/dashboard`} replace />;
  }
  return children;
}

function GuestOnly({ children }) {
  if (hasValidStoredToken()) {
    return <Navigate to={appHref("dashboard")} replace />;
  }
  return children;
}

function RootRedirect() {
  if (!hasValidStoredToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={appHref("dashboard")} replace />;
}

function NotFoundRedirect() {
  const location = useLocation();
  if (!hasValidStoredToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Navigate to={appHref("dashboard")} replace />;
}

function mainLayoutTree() {
  return (
    <Route element={<MainLayout />}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<HomePage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="orders/create" element={<CreateOrderPage />} />
      <Route path="orders/stats" element={<OrdersStatsPage />} />
      <Route
        path="employees"
        element={
          <RequireAdmin>
            <EmployeesPage />
          </RequireAdmin>
        }
      />
      <Route path="products" element={<ProductsPage />} />
      <Route path="products/create" element={<CreateProductPage />} />
      <Route path="products/:productId/edit" element={<EditProductPage />} />
      <Route path="orders/payload-details" element={<OrderPayloadDetailsPage />} />
      <Route path="orders/:orderId" element={<OrderDetailsPage />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Route>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="easyorder"
        element={
          <RequireAuth>
            <SystemShell expectedSystem="easyorder" />
          </RequireAuth>
        }
      >
        {mainLayoutTree()}
      </Route>
      <Route
        path="salla"
        element={
          <RequireAuth>
            <SystemShell expectedSystem="salla" />
          </RequireAuth>
        }
      >
        {mainLayoutTree()}
      </Route>
      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}

export default App;
