// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import AssetForm from "./components/AssetForm";
import Assets from "./components/Assets";
import Scan from "./components/Scan";
import Home from "./components/Home";
import Protected from "./middle/Protected";
import RoleGate from "./middle/RoleGate";
import Profile from "./components/Profile";
import BulkAddAssets from "./components/BulkAddAssets";
import BulkInventory from "./components/BulkInventory";



function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected + role-gated */}
        <Route
          path="/"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Home />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        <Route
          path="/home"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Home />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        <Route
          path="/assets"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty"]}>
                  <Assets />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        <Route
          path="/assets/new"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin"]}>
                  <AssetForm />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        <Route
          path="/bulkasset"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin"]}>
                  <BulkAddAssets />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        <Route
          path="/bulk-inventory"
          element={
              <Protected>
                <ProtectedLayout>
                  <RoleGate allow={["Super_Admin", "Admin","Faculty"]}>
                    <BulkInventory />
                  </RoleGate>
                </ProtectedLayout>
              </Protected>
            }
          />

        

        <Route
          path="/scan"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Verifier"]}>
                  <Scan />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProtectedLayout>
                <RoleGate allow={["Super_Admin", "Admin", "Faculty", "Verifier"]}>
                  <Profile />
                </RoleGate>
              </ProtectedLayout>
            </Protected>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}




// // src/App.jsx
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import Login from "./components/Login";
// import Navbar from "./components/Navbar";
// import AssetForm from "./components/AssetForm";
// import Assets from "./components/Assets";
// import Scan from "./components/Scan";
// import Home from "./components/Home";
// import Protected from "./middle/Protected"; // note the path you specified

// function ProtectedLayout({ children }) {
//   return (
//     <div className="min-h-screen bg-gray-50">
//       <Navbar />
//       <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         {/* Public route */}
//         <Route path="/login" element={<Login />} />

//         {/* Protected routes */}
//         <Route
//           path="/"
//           element={
//             <Protected>
//               <ProtectedLayout>
//                 <Home />
//               </ProtectedLayout>
//             </Protected>
//           }
//         />
//         <Route
//           path="/home"
//           element={
//             <Protected>
//               <ProtectedLayout>
//                 <Home />
//               </ProtectedLayout>
//             </Protected>
//           }
//         />
//         <Route
//           path="/assets"
//           element={
//             <Protected>
//               <ProtectedLayout>
//                 <Assets />
//               </ProtectedLayout>
//             </Protected>
//           }
//         />
//         <Route
//           path="/assets/new"
//           element={
//             <Protected>
//               <ProtectedLayout>
//                 <AssetForm />
//               </ProtectedLayout>
//             </Protected>
//           }
//         />
//         <Route
//           path="/scan"
//           element={
//             <Protected>
//               <ProtectedLayout>
//                 <Scan />
//               </ProtectedLayout>
//             </Protected>
//           }
//         />

//         {/* Fallback: unauthenticated users go to /login */}
//         <Route path="*" element={<Navigate to="/login" replace />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }





// // src/App.jsx
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import Login from "./components/Login"
// import Navbar from "./components/Navbar";
// import AssetForm from "./components/AssetForm";
// import Assets from "./components/Assets";
// import Scan from "./components/Scan";
// import Home from "./components/Home";

// function Layout({ children }) {
//   return (
//     <div className="min-h-screen bg-gray-50">
//       <Navbar />
//       <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Layout>
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/home" element={<Home />} />
//           <Route path="/assets" element={<Assets />} />
//           <Route path="/assets/new" element={<AssetForm />} />
//           <Route path="/scan" element={<Scan />} />
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </Layout>
//     </BrowserRouter>
//   );
// }

// // src/App.jsx
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import Login from "./components/Login"
// import Navbar from "./components/Navbar";
// import AssetForm from "./components/AssetForm";
// import Assets from "./components/Assets";
// import Scan from "./components/Scan";
// import Home from "./components/Home";

// function Layout({ children }) {
//   return (
//     <div className="min-h-screen bg-gray-50">
//       <Navbar />
//       <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Layout>
//         <Routes>
//           <Route path="/" element={<Login />} />
//           <Route path="/home" element={<Home />} />
//           <Route path="/assets" element={<Assets />} />
//           <Route path="/assets/new" element={<AssetForm />} />
//           <Route path="/scan" element={<Scan />} />
//           <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//       </Layout>
//     </BrowserRouter>
//   );
// }
