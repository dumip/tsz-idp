import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ActivatePage, ProfilePage, ProfileCallbackPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Device activation for VR */}
        <Route path="/activate" element={<ActivatePage />} />
        
        {/* Profile management */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/callback" element={<ProfileCallbackPage />} />
        
        {/* Default redirect to activate */}
        <Route path="/" element={<Navigate to="/activate" replace />} />
        <Route path="*" element={<Navigate to="/activate" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
