import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Chat from "./pages/Chat";
import Channels from "./pages/Channels";
import Skills from "./pages/Skills";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import InstallWizard from "./pages/InstallWizard";

function App() {
  const [showWizard, setShowWizard] = useState(true);

  const handleSetupComplete = () => {
    setShowWizard(false);
  };

  if (showWizard) {
    return <InstallWizard onComplete={handleSetupComplete} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<Chat />} />
        <Route path="channels" element={<Channels />} />
        <Route path="skills" element={<Skills />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
