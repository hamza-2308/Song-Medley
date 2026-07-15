import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BASE_URL = "https://localhost:44307";

const Settings = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/api/auth/changepassword`, {
        UserId: user.UserId,
        OldPassword: oldPassword,
        NewPassword: newPassword
      });

      if (response.data.success) {
        setPasswordSuccess("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setShowChangePassword(false), 1500);
      } else {
        setPasswordError(response.data.message || "Failed to change password");
      }
    } catch (err) {
      console.error(err);
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-5 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/home")}
          className="text-gray-400 hover:text-white text-xl"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-gray-800 rounded-2xl p-5 mb-4">
        <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">
          PROFILE
        </p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {user.UserName ? user.UserName[0].toUpperCase() : "U"}
          </div>
          <div>
            <p className="font-bold text-lg">{user.UserName || "Unknown"}</p>
            <p className="text-gray-400 text-sm">{user.Email || "No email"}</p>
            <p className="text-purple-400 text-xs mt-1">
              {user.Role === "ShopKeeper" ? "🎛 ShopKeeper" : "🎧 Client"}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-gray-800 rounded-2xl mb-4 overflow-hidden">
        <button
          onClick={() => setShowChangePassword(!showChangePassword)}
          className="w-full flex justify-between items-center p-5 hover:bg-gray-700 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div className="text-left">
              <p className="font-semibold">Change Password</p>
              <p className="text-gray-400 text-xs">Update your account password</p>
            </div>
          </div>
          <span className="text-gray-400">{showChangePassword ? "▲" : "▼"}</span>
        </button>

        {showChangePassword && (
          <div className="px-5 pb-5 border-t border-gray-700">
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Current Password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm"
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm"
              />

              {passwordError && (
                <p className="text-red-400 text-sm">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-green-400 text-sm">{passwordSuccess}</p>
              )}

              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="bg-gray-800 rounded-2xl p-5 mb-4">
        <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">
          APP INFO
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎵</span>
              <p className="font-semibold">App Name</p>
            </div>
            <p className="text-gray-400 text-sm">Song Medley Maker</p>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xl">📦</span>
              <p className="font-semibold">Version</p>
            </div>
            <p className="text-gray-400 text-sm">1.0.0</p>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xl">👨‍💻</span>
              <p className="font-semibold">Developer</p>
            </div>
            <p className="text-gray-400 text-sm">BIIT</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-500 hover:bg-red-600 py-4 rounded-2xl font-bold text-lg mt-4"
      >
        🚪 Logout
      </button>

    </div>
  );
};

export default Settings;