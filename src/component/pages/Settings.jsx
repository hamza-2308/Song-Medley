import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, buildFileUrl } from "../service/ipConfig";

const Settings = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const isShopKeeper =
    (user.role || user.Role || "").toLowerCase() === "shopkeeper";

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Watermark modal state
  const [showWmModal, setShowWmModal] = useState(false);
  const [watermarks, setWatermarks] = useState([]);
  const [loadingWm, setLoadingWm] = useState(false);
  const [wmFile, setWmFile] = useState(null);
  const [uploadingWm, setUploadingWm] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [replacingWmId, setReplacingWmId] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState("");
  const [deletingWmId, setDeletingWmId] = useState(null);

  // Deleted Medleys modal state
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedMedleys, setDeletedMedleys] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [deletedBusyId, setDeletedBusyId] = useState(null);
  const [deletedError, setDeletedError] = useState("");
  const [confirmPermanentId, setConfirmPermanentId] = useState(null);

  // ==========================
  // NEW — Delete Summary state
  // Kitna kya delete hua ye dikhane ke liye
  // ==========================
  const [deleteSummary, setDeleteSummary] = useState(null);

  const fetchWatermarks = async () => {
    if (!user.UserId) return;
    setLoadingWm(true);
    try {
      const res = await axios.get(API.watermark.byUser(user.UserId));
      setWatermarks(res.data || []);
    } catch (err) {
      console.error("Failed to load watermarks:", err);
    } finally {
      setLoadingWm(false);
    }
  };

  const openWmModal = () => {
    setShowWmModal(true);
    setWmFile(null);
    setUploadError("");
    setUploadSuccess("");
    setReplacingWmId(null);
    setReplaceFile(null);
    setReplaceError("");
    fetchWatermarks();
  };

  const closeWmModal = () => {
    setShowWmModal(false);
    setWmFile(null);
    setUploadError("");
    setUploadSuccess("");
    setReplacingWmId(null);
    setReplaceFile(null);
    setReplaceError("");
  };

  const handleUploadWatermark = async () => {
    if (!wmFile) { setUploadError("Please select a file first"); return; }
    if (!user.UserId) { setUploadError("You must be logged in to upload a watermark"); return; }

    setUploadingWm(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", wmFile);
      formData.append("UserId", user.UserId);

      const res = await axios.post(API.watermark.add, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setUploadSuccess("Watermark uploaded successfully!");
        setWmFile(null);
        const fileInput = document.getElementById("watermark-upload-input");
        if (fileInput) fileInput.value = "";
        fetchWatermarks();
      } else {
        setUploadError(res.data.message || "Upload failed");
      }
    } catch (err) {
      setUploadError(err.response?.data?.Message || err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setUploadingWm(false);
    }
  };

  const startReplace = (watermarkId) => {
    setReplacingWmId(watermarkId);
    setReplaceFile(null);
    setReplaceError("");
  };

  const cancelReplace = () => {
    setReplacingWmId(null);
    setReplaceFile(null);
    setReplaceError("");
  };

  const handleReplaceWatermark = async () => {
    if (!replaceFile) { setReplaceError("Please pick a new file first"); return; }
    if (!replacingWmId || !user.UserId) return;

    setReplacing(true);
    setReplaceError("");

    try {
      await axios.delete(API.watermark.delete(replacingWmId));
      const formData = new FormData();
      formData.append("file", replaceFile);
      formData.append("UserId", user.UserId);
      const res = await axios.post(API.watermark.add, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setReplacingWmId(null);
        setReplaceFile(null);
        fetchWatermarks();
      } else {
        setReplaceError(res.data.message || "Update failed");
      }
    } catch (err) {
      setReplaceError(err.response?.data?.Message || err.response?.data?.message || "Update failed. Please try again.");
    } finally {
      setReplacing(false);
    }
  };

  const handleDeleteWatermark = async (watermarkId) => {
    if (!window.confirm("Are you sure you want to delete this watermark?")) return;

    setDeletingWmId(watermarkId);
    try {
      const res = await axios.delete(API.watermark.delete(watermarkId));
      if (res.data.success) {
        setWatermarks((prev) => prev.filter((w) => w.WatermarkId !== watermarkId));
      } else {
        alert(res.data.message || "Delete failed");
      }
    } catch (err) {
      alert(err.response?.data?.Message || err.response?.data?.message || "Delete failed");
    } finally {
      setDeletingWmId(null);
    }
  };

  // ==========================================================
  // DELETED MEDLEYS (recycle bin) — Restore / Permanent Delete
  // ==========================================================
  const fetchDeletedMedleys = async () => {
    if (!user.UserId) return;
    setLoadingDeleted(true);
    setDeletedError("");
    try {
      const res = await axios.get(API.medleys.recentlyDeleted(user.UserId));
      if (res.data.success) {
        setDeletedMedleys(res.data.medleys || []);
      } else {
        setDeletedError(res.data.message || "Could not load deleted medleys");
      }
    } catch (err) {
      setDeletedError("Could not load deleted medleys");
    } finally {
      setLoadingDeleted(false);
    }
  };

  const openDeletedModal = () => {
    setShowDeletedModal(true);
    setConfirmPermanentId(null);
    fetchDeletedMedleys();
  };

  const closeDeletedModal = () => {
    setShowDeletedModal(false);
    setConfirmPermanentId(null);
    setDeletedError("");
  };

  const handleRestoreMedley = async (medleyId) => {
    setDeletedBusyId(medleyId);
    setDeletedError("");
    try {
      const res = await axios.put(API.medleys.restore(medleyId));
      if (res.data.success) {
        setDeletedMedleys((prev) => prev.filter((m) => m.MedleyId !== medleyId));
      } else {
        setDeletedError(res.data.message || "Restore failed");
      }
    } catch (err) {
      setDeletedError(err.response?.data?.Message || err.response?.data?.message || "Restore failed");
    } finally {
      setDeletedBusyId(null);
    }
  };

  const askPermanentDelete = (medleyId) => setConfirmPermanentId(medleyId);
  const cancelPermanentDelete = () => setConfirmPermanentId(null);

  // ==========================
  // UPDATED — Permanent delete now shows summary modal
  // ==========================
  const handlePermanentDeleteMedley = async (medleyId) => {
    setDeletedBusyId(medleyId);
    setDeletedError("");
    try {
      const res = await axios.delete(API.medleys.permanentDelete(medleyId));
      if (res.data.success) {
        setDeletedMedleys((prev) => prev.filter((m) => m.MedleyId !== medleyId));
        setConfirmPermanentId(null);
        // NEW — Show summary modal with counts
        if (res.data.counts) {
          setDeleteSummary(res.data.counts);
        }
      } else {
        setDeletedError(res.data.message || "Permanent delete failed");
      }
    } catch (err) {
      setDeletedError(err.response?.data?.Message || err.response?.data?.message || "Permanent delete failed");
    } finally {
      setDeletedBusyId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("All fields are required"); return;
    }
    if (newPassword !== confirmPassword) { setPasswordError("New passwords do not match"); return; }
    if (newPassword.length < 4) { setPasswordError("Password must be at least 4 characters"); return; }
    if (user.Password && oldPassword !== user.Password) { setPasswordError("Current password is incorrect"); return; }
    if (!user.UserId) { setPasswordError("You must be logged in to change your password"); return; }

    setLoading(true);
    try {
      try {
        const response = await axios.post(API.auth.changePassword, {
          UserId: user.UserId,
          OldPassword: oldPassword,
          NewPassword: newPassword,
        });
        if (response.data?.success) {
          onPasswordChangedLocally(newPassword);
          return;
        }
      } catch {
        // fall through
      }

      const response = await axios.put(API.users.update(user.UserId), {
        UserName: user.UserName,
        Email: user.Email,
        Password: newPassword,
      });

      if (response.data?.success) {
        onPasswordChangedLocally(newPassword);
      } else {
        setPasswordError(response.data?.message || "Failed to change password");
      }
    } catch (err) {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onPasswordChangedLocally = (newPass) => {
    const updated = { ...user, Password: newPass };
    localStorage.setItem("user", JSON.stringify(updated));
    setPasswordSuccess("Password changed successfully!");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setShowChangePassword(false), 1500);
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-5 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/home")} className="text-gray-400 hover:text-white text-xl">←</button>
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-gray-800 rounded-2xl p-5 mb-4">
        <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">PROFILE</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {user.UserName ? user.UserName[0].toUpperCase() : "U"}
          </div>
          <div>
            <p className="font-bold text-lg">{user.UserName || "Unknown"}</p>
            <p className="text-gray-400 text-sm">{user.Email || "No email"}</p>
            <p className="text-purple-400 text-xs mt-1">
              {isShopKeeper ? "🎛 ShopKeeper" : "🎧 Client"}
            </p>
          </div>
        </div>
      </div>

      {/* WATERMARK */}
      {isShopKeeper && (
        <div className="bg-gray-800 rounded-2xl mb-4 overflow-hidden">
          <button onClick={openWmModal}
                  className="w-full flex justify-between items-center p-5 hover:bg-gray-700 transition">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔖</span>
              <div className="text-left">
                <p className="font-semibold">Watermark</p>
                <p className="text-gray-400 text-xs">Upload or update your audio watermark</p>
              </div>
            </div>
            <span className="text-gray-400 text-xl">›</span>
          </button>
        </div>
      )}

      {/* DELETED MEDLEYS */}
      <div className="bg-gray-800 rounded-2xl mb-4 overflow-hidden">
        <button onClick={openDeletedModal}
                className="w-full flex justify-between items-center p-5 hover:bg-gray-700 transition">
          <div className="flex items-center gap-3">
            <span className="text-xl">🗑</span>
            <div className="text-left">
              <p className="font-semibold">Deleted Medleys</p>
              <p className="text-gray-400 text-xs">Restore or permanently delete medleys you removed from My Library</p>
            </div>
          </div>
          <span className="text-gray-400 text-xl">›</span>
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-gray-800 rounded-2xl mb-4 overflow-hidden">
        <button onClick={() => setShowChangePassword(!showChangePassword)}
                className="w-full flex justify-between items-center p-5 hover:bg-gray-700 transition">
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
              <input type="password" placeholder="Current Password" value={oldPassword}
                     onChange={(e) => setOldPassword(e.target.value)}
                     className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm" />
              <input type="password" placeholder="New Password" value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm" />
              <input type="password" placeholder="Confirm New Password" value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                     className="w-full bg-gray-900 border border-gray-600 p-3 rounded-xl text-white text-sm" />

              {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
              {passwordSuccess && <p className="text-green-400 text-sm">{passwordSuccess}</p>}

              <button onClick={handleChangePassword} disabled={loading}
                      className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="bg-gray-800 rounded-2xl p-5 mb-4">
        <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">APP INFO</p>
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
      <button onClick={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600 py-4 rounded-2xl font-bold text-lg mt-4">
        🚪 Logout
      </button>

      {/* WATERMARK MODAL */}
      {showWmModal && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-white">

            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-bold">🔖 My Watermarks</h2>
              <button onClick={closeWmModal} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-5">Upload a watermark or update an existing one</p>

            <div className="mb-5">
              <h3 className="text-gray-400 text-xs font-semibold tracking-widest mb-2">YOUR WATERMARKS</h3>

              {loadingWm ? (
                <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
              ) : watermarks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4 bg-gray-800 rounded-xl">
                  No watermarks yet. Upload one below.
                </p>
              ) : (
                <div className="space-y-2">
                  {watermarks.map((w) => {
                    const fileName = w.FilePath ? w.FilePath.split("/").pop() : "";
                    const displayName = fileName.includes("_")
                      ? fileName.substring(fileName.indexOf("_") + 1) : fileName;
                    const isReplacingThis = replacingWmId === w.WatermarkId;

                    return (
                      <div key={w.WatermarkId} className="bg-gray-800 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🔖</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" title={displayName}>
                              {displayName || `Watermark #${w.WatermarkId}`}
                            </p>
                            <p className="text-gray-500 text-xs">ID: {w.WatermarkId}</p>
                          </div>
                        </div>

                        {w.FilePath && (
                          <audio controls src={buildFileUrl(w.FilePath)} className="w-full h-9 mb-2" />
                        )}

                        {isReplacingThis ? (
                          <div className="bg-gray-900 rounded-lg p-3 mt-2">
                            <p className="text-xs text-gray-400 mb-2">Select the new watermark file:</p>
                            <input type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg"
                                   onChange={(e) => setReplaceFile(e.target.files[0])}
                                   className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-xs mb-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer" />

                            {replaceFile && (
                              <p className="text-xs text-gray-400 mb-2 truncate" title={replaceFile.name}>
                                📁 {replaceFile.name} · {(replaceFile.size / 1024).toFixed(1)} KB
                              </p>
                            )}

                            {replaceError && <p className="text-red-400 text-xs mb-2">{replaceError}</p>}

                            <div className="flex gap-2">
                              <button onClick={handleReplaceWatermark} disabled={replacing || !replaceFile}
                                      className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                                {replacing ? "Updating..." : "Confirm Update"}
                              </button>
                              <button onClick={cancelReplace} disabled={replacing}
                                      className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => startReplace(w.WatermarkId)}
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded-lg text-xs font-semibold">
                              ✏️ Update
                            </button>
                            <button onClick={() => handleDeleteWatermark(w.WatermarkId)}
                                    disabled={deletingWmId === w.WatermarkId}
                                    className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                              {deletingWmId === w.WatermarkId ? "Deleting..." : "🗑 Delete"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-gray-400 text-xs font-semibold tracking-widest mb-2">UPLOAD NEW WATERMARK</h3>

              <input id="watermark-upload-input" type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg"
                     onChange={(e) => setWmFile(e.target.files[0])}
                     className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-3 text-sm mb-3 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer" />

              {wmFile && (
                <div className="bg-gray-800 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-400">Selected:</p>
                  <p className="text-sm font-semibold truncate" title={wmFile.name}>📁 {wmFile.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(wmFile.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              {uploadError && <p className="text-red-400 text-sm mb-2">{uploadError}</p>}
              {uploadSuccess && <p className="text-green-400 text-sm mb-2">✅ {uploadSuccess}</p>}

              <button onClick={handleUploadWatermark} disabled={uploadingWm || !wmFile}
                      className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50">
                {uploadingWm ? "Uploading..." : "Upload Watermark"}
              </button>
            </div>

            <button onClick={closeWmModal} disabled={uploadingWm || replacing}
                    className="w-full mt-3 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold disabled:opacity-50">
              Close
            </button>
          </div>
        </div>
      )}

      {/* DELETED MEDLEYS MODAL */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-white">

            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-bold">🗑 Deleted Medleys</h2>
              <button onClick={closeDeletedModal} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              Medleys stay here until you restore them or delete them permanently.
            </p>

            {deletedError && <p className="text-red-400 text-sm mb-3">{deletedError}</p>}

            {loadingDeleted ? (
              <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
            ) : deletedMedleys.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6 bg-gray-800 rounded-xl">
                Recycle bin is empty. 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {deletedMedleys.map((m) => {
                  const isBusy = deletedBusyId === m.MedleyId;
                  const isConfirmingPermanent = confirmPermanentId === m.MedleyId;

                  return (
                    <div key={m.MedleyId} className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base truncate">{m.MedleyName}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            {m.ClipCount || 0} clips
                            {m.DeletedByUserName && (
                              <span className="text-pink-400"> · deleted by {m.DeletedByUserName}</span>
                            )}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">🕒 {formatDate(m.DeletedAt)}</p>
                        </div>
                      </div>

                      {m.OutputFilePath && (
                        <audio controls src={buildFileUrl(m.OutputFilePath)} className="w-full mt-3 h-8" />
                      )}

                      {isConfirmingPermanent ? (
                        <div className="mt-3 bg-red-950 border border-red-700 rounded-lg p-3">
                          <p className="text-red-300 text-sm mb-2">
                            Permanently delete "{m.MedleyName}"? This cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => handlePermanentDeleteMedley(m.MedleyId)} disabled={isBusy}
                                    className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                              {isBusy ? "Deleting..." : "Yes, delete forever"}
                            </button>
                            <button onClick={cancelPermanentDelete} disabled={isBusy}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleRestoreMedley(m.MedleyId)} disabled={isBusy}
                                  className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                            {isBusy ? "..." : "↩ Restore"}
                          </button>
                          <button onClick={() => askPermanentDelete(m.MedleyId)} disabled={isBusy}
                                  className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                            Permanent Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={closeDeletedModal}
                    className="w-full mt-5 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================================================ */}
      {/* 🆕 DELETE SUMMARY MODAL — kitna kya delete hua   */}
      {/* ================================================ */}
      {deleteSummary && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[60] px-4 backdrop-blur-sm">
          <div className="bg-gray-900 border-2 border-green-600 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">

            {/* Header with success icon */}
            <div className="text-center mb-4">
              <div className="text-6xl mb-2">✅</div>
              <h2 className="text-2xl font-bold text-green-400">Deletion Complete!</h2>
              {deleteSummary.medleyName && (
                <p className="text-gray-400 text-sm mt-1 truncate">
                  "{deleteSummary.medleyName}"
                </p>
              )}
            </div>

            {/* Stats Grid */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-gray-400 text-xs font-semibold tracking-widest mb-2">
                📊 DELETION SUMMARY
              </p>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">🎧 Medleys Deleted</span>
                <span className="text-2xl font-bold text-purple-400">{deleteSummary.medleys}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">🎵 Medley Clips Deleted</span>
                <span className="text-2xl font-bold text-pink-400">{deleteSummary.clips}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">🤝 Shares Deleted</span>
                <span className="text-2xl font-bold text-blue-400">{deleteSummary.shares}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">⭐ Reviews Deleted</span>
                <span className="text-2xl font-bold text-yellow-400">{deleteSummary.reviews}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">🎨 Suggested Versions</span>
                <span className="text-2xl font-bold text-orange-400">{deleteSummary.suggestedMedleys}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">🎼 Suggested Clips</span>
                <span className="text-2xl font-bold text-cyan-400">{deleteSummary.suggestedClips}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                <span className="text-sm">📁 MP3 Files Deleted</span>
                <span className="text-2xl font-bold text-green-400">{deleteSummary.physicalFiles}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold">📦 Total DB Rows Affected</span>
                <span className="text-3xl font-bold text-red-400">{deleteSummary.totalDbRows}</span>
              </div>
            </div>

            {/* Close button */}
            <button onClick={() => setDeleteSummary(null)}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 py-3 rounded-xl font-semibold text-sm transition-colors">
              ✓ Great, Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;