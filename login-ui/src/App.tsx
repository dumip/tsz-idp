import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ActivatePage,
  OAuthCallbackPage,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Device activation for VR */}
        <Route path="/activate" element={<ActivatePage />} />
        
        {/* OAuth2 callback */}
        <Route path="/oauth2/callback" element={<OAuthCallbackPage />} />
        
        {/* Default redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
