import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import CreateOrderPage from "./pages/CreateOrderPage";
import EmployeesPage from "./pages/EmployeesPage";
import LoginPage from "./pages/LoginPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import OrderPayloadDetailsPage from "./pages/OrderPayloadDetailsPage";
import OrdersPage from "./pages/OrdersPage";
import OrdersStatsPage from "./pages/OrdersStatsPage";
import ProductsPage from "./pages/ProductsPage";
import { hasValidStoredToken } from "./utils/auth";

function RequireAuth({ children }) {
  if (!hasValidStoredToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function GuestOnly({ children }) {
  if (hasValidStoredToken()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/create" element={<CreateOrderPage />} />
        <Route path="/orders/stats" element={<OrdersStatsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route
          path="/orders/payload-details"
          element={<OrderPayloadDetailsPage />}
        />
        <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
