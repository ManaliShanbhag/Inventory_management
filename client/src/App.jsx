import { useState } from "react";
import EmployeePage from "./pages/EmployeePage";
import ManagerPage from "./pages/ManagerPage";
import LoginPage from "./pages/LoginPage";

import logo from "./assets/armtronix-logo.png";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogout = () => {
    sessionStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={(userData) => {
          sessionStorage.setItem("user", JSON.stringify(userData));
          setUser(userData);
        }}
      />
    );
  }

  return (
    <div>
      <nav className="navbar">
        <div className="nav-brand">
          <img src={logo} alt="Armtronix" className="nav-logo" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontWeight: 500 }}>
            <span style={{ color: "var(--text-secondary)", marginRight: "8px" }}>Logged in as</span>
            {user.name} ({user.role})
          </span>
          <button
            onClick={handleLogout}
            className="btn-danger"
            style={{ padding: "6px 14px" }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding: "32px", maxWidth: "1600px", margin: "0 auto" }}>
        {user.role === "manager" ? (
          <ManagerPage />
        ) : (
          <EmployeePage user={user} />
        )}
      </div>
    </div>
  );
}

export default App;