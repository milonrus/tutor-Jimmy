'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AuthModal from './AuthModal';
import CorrectionHistory from './CorrectionHistory';

export default function AuthButtons() {
  const { user, isAnonymous, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'signup'>('login');
  const [showHistory, setShowHistory] = useState(false);

  const handleLogin = () => {
    setModalMode('login');
    setShowModal(true);
  };

  const handleSignup = () => {
    setModalMode('signup');
    setShowModal(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleContinueAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Error signing in anonymously:', error);
    }
  };

  // Show authenticated user interface (not anonymous)
  if (user && !isAnonymous) {
    return (
      <>
        <div className="flex items-center gap-4">
          <span className="text-gray-600 text-sm">
            Welcome, {user.email}
          </span>
          <button
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            History
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Log Out
          </button>
        </div>

        <CorrectionHistory
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      </>
    );
  }

  // Show login/signup buttons (logged out or no user)
  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleContinueAsGuest}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Continue as Guest
        </button>
        <button
          onClick={handleLogin}
          className="px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
        >
          Log In
        </button>
        <button
          onClick={handleSignup}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign Up
        </button>
      </div>

      <AuthModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        mode={modalMode}
      />
    </>
  );
}