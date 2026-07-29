import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../service/ipConfig";

/**
 * RequestMedleyModal
 * ============================
 * Client is modal se ShopKeeper ko custom medley request bhej sakta hai
 *
 * Props:
 * - isOpen (bool)
 * - onClose (function)
 * - shopKeeper (object) — { UserId, UserName }
 * - currentUser (object) — logged in client
 * - onSuccess (function) — success callback
 */
const RequestMedleyModal = ({ isOpen, onClose, shopKeeper, currentUser, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [occasion, setOccasion] = useState("");
  const [preferredLength, setPreferredLength] = useState("Medium");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setMessage("");
      setOccasion("");
      setPreferredLength("Medium");
      setCategory("");
      setError("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  const OCCASIONS = ["Wedding", "Birthday", "Party", "Engagement", "Anniversary", "Corporate Event", "Other"];
  const LENGTHS = [
    { value: "Short", label: "Short (2-3 min)" },
    { value: "Medium", label: "Medium (3-5 min)" },
    { value: "Long", label: "Long (5+ min)" },
  ];
  const CATEGORIES = ["Bollywood", "Punjabi", "Sufi", "Classical", "Pop", "Romantic", "Party", "Mixed"];

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (title.trim().length < 5) { setError("Title should be at least 5 characters"); return; }
    if (!currentUser?.UserId) { setError("You must be logged in"); return; }
    if (!shopKeeper?.UserId) { setError("Invalid ShopKeeper"); return; }

    setSubmitting(true); setError(""); setSuccessMsg("");

    try {
      const res = await axios.post(API.medleyRequests.add, {
        RequesterUserId: currentUser.UserId,
        ShopKeeperUserId: shopKeeper.UserId,
        RequestTitle: title.trim(),
        RequestMessage: message.trim(),
        Occasion: occasion,
        PreferredLength: preferredLength,
        Category: category,
      });

      if (res.data.success) {
        setSuccessMsg("🎉 Request sent successfully!");
        if (onSuccess) onSuccess(res.data);
        setTimeout(() => { onClose(); }, 1500);
      } else {
        setError(res.data.message || "Failed to send request");
      }
    } catch (err) {
      setError(err.response?.data?.Message || err.response?.data?.message || err.message || "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4 backdrop-blur-sm">
      <div className="bg-gray-900 border-2 border-purple-600 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto text-white shadow-2xl">

        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h2 className="text-xl font-bold">🎵 Request a Medley</h2>
              <p className="text-gray-400 text-sm mt-1">
                To: <span className="text-purple-400 font-semibold">{shopKeeper?.UserName || `ShopKeeper #${shopKeeper?.UserId}`}</span>
              </p>
            </div>
            <button onClick={onClose} disabled={submitting}
                    className="text-gray-400 hover:text-white text-lg">✕</button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-1">Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wedding medley chahiye"
            maxLength={200}
            disabled={submitting}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <p className="text-gray-500 text-xs text-right mt-1">{title.length}/200</p>
        </div>

        {/* Occasion */}
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-1">Occasion</label>
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            disabled={submitting}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
          >
            <option value="">Select occasion (optional)</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-1">Genre / Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
          >
            <option value="">Select genre (optional)</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Preferred Length */}
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-2">Preferred Length</label>
          <div className="flex gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l.value}
                onClick={() => setPreferredLength(l.value)}
                disabled={submitting}
                type="button"
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                  preferredLength === l.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="block text-gray-400 text-xs mb-1">Details / Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what kind of medley you want... favorite songs, mood, tempo, etc."
            rows={5}
            maxLength={1000}
            disabled={submitting}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <p className="text-gray-500 text-xs text-right mt-1">{message.length}/1000</p>
        </div>

        {error && <p className="text-red-400 text-sm mb-3 bg-red-950 border border-red-700 rounded-lg p-2">{error}</p>}
        {successMsg && <p className="text-green-400 text-sm mb-3 bg-green-950 border border-green-700 rounded-lg p-2">{successMsg}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Sending...</span>
              </>
            ) : (
              "🚀 Send Request"
            )}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestMedleyModal;