import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API, buildFileUrl } from "../service/ipConfig";
import ClipReTrimModal from "../modal/ClipReTrimModal";
import RequestMedleyModal from "../modal/RequestMedleyModal";
import ConfirmModal from "../pages/Confirmmodal";
import { getFavouriteMedleyIds, toggleFavouriteMedley } from "../service/favouritesStorage";

const MyLibrary = () => {
  const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");
  const currentUser = getCurrentUser();
  const isShopKeeper =
    (currentUser.role || currentUser.Role || "").toLowerCase() === "shopkeeper";

  // Anyone logged in can request a medley — clients AND shopkeepers.
  // A shopkeeper can request from another shopkeeper; only self is excluded.
  const canRequestMedley = !!currentUser.UserId;
  const canRequestFrom = (userId) =>
    !!currentUser.UserId && userId != null && userId !== currentUser.UserId;

  // ==========================
  // Search / Filter state
  // ==========================
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | mine | shared | suggested | received | top | favourites

  const FILTERS = [
    { key: "all", label: "All", icon: "🗂️" },
    { key: "mine", label: "My Medleys", icon: "🎧" },
    { key: "shared", label: "Shared With Me", icon: "🤝" },
    { key: "suggested", label: "My Suggested", icon: "🎨" },
    { key: "received", label: "Client Responses", icon: "📥" },
    { key: "top", label: "Top Rated", icon: "🏆" },
    { key: "favourites", label: "Favourites", icon: "❤️" },
  ];

  const matchesSearch = (...fields) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return fields
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  };

  const sectionVisible = (key) => activeFilter === "all" || activeFilter === key;

  // ==========================
  // My Medleys state
  // ==========================
  const [myMedleys, setMyMedleys] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [playingMedleyId, setPlayingMedleyId] = useState(null);
  const [audioBustToken, setAudioBustToken] = useState(Date.now());

  // ==========================
  // Favourites state
  // ==========================
  const [favouriteIds, setFavouriteIds] = useState(getFavouriteMedleyIds());

  const isFav = (medleyId) => favouriteIds.includes(medleyId);

  const handleToggleFavourite = (medleyId) => {
    const updated = toggleFavouriteMedley(medleyId);
    setFavouriteIds(updated);
  };

  // ==========================
  // CONFIRM MODAL state
  // ==========================
  const CONFIRM_DEFAULTS = {
    isOpen: false,
    title: "Are you sure?",
    message: "This action cannot be undone.",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger",
    icon: null,
    onConfirm: null,
  };
  const [confirmState, setConfirmState] = useState(CONFIRM_DEFAULTS);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirm = (cfg) => {
    setConfirmLoading(false);
    setConfirmState({ ...CONFIRM_DEFAULTS, ...cfg, isOpen: true });
  };
  const closeConfirm = () => {
    setConfirmLoading(false);
    setConfirmState(CONFIRM_DEFAULTS);
  };

  // ==========================
  // REQUEST MEDLEY state
  // ==========================
  const [requestShopKeeper, setRequestShopKeeper] = useState(null); // { UserId, UserName }
  const [allUsersMap, setAllUsersMap] = useState({}); // userId -> user object
  const [shopKeeperList, setShopKeeperList] = useState([]);
  const [showShopKeeperPicker, setShowShopKeeperPicker] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState("");

  // Edit modal
  const [editMedley, setEditMedley] = useState(null);
  const [editForm, setEditForm] = useState({ MedleyName: "", ComposerName: "", ThemeId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Share modal
  const [shareMedleyId, setShareMedleyId] = useState(null);
  const [shareMedleyObj, setShareMedleyObj] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccessMsg, setShareSuccessMsg] = useState("");
  const [shareProgressMsg, setShareProgressMsg] = useState("");

  // Watermark-on-share
  const [shareWatermarks, setShareWatermarks] = useState([]);
  const [addWatermarkOnShare, setAddWatermarkOnShare] = useState(false);
  const [selectedShareWatermarkId, setSelectedShareWatermarkId] = useState(null);
  const [watermarkRepeatMode, setWatermarkRepeatMode] = useState("first_only");
  const [watermarkRepeatN, setWatermarkRepeatN] = useState(2);
  const [lockFirstWatermark, setLockFirstWatermark] = useState(true);

  // Repeat Clip (Share modal)
  const [shareMedleyClips, setShareMedleyClips] = useState([]);
  const [shareRepeatClipTrimId, setShareRepeatClipTrimId] = useState("");
  const [shareRepeatClipMode, setShareRepeatClipMode] = useState("no_repeat");
  const [shareRepeatClipN, setShareRepeatClipN] = useState(2);

  // Shared With You
  const [sharedList, setSharedList] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [processingSharedId, setProcessingSharedId] = useState(null);
  const [processingKind, setProcessingKind] = useState("");

  // Suggested Sequences
  const [mySuggested, setMySuggested] = useState([]);
  const [loadingMySuggested, setLoadingMySuggested] = useState(false);
  const [openSuggestedId, setOpenSuggestedId] = useState(null);
  const [suggestedDetail, setSuggestedDetail] = useState(null);
  const [loadingSuggestedDetail, setLoadingSuggestedDetail] = useState(false);
  const [savingSuggested, setSavingSuggested] = useState(false);
  const [suggestedMsg, setSuggestedMsg] = useState("");
  const [suggestedError, setSuggestedError] = useState("");
  const suggestedDragRef = useRef(null);
  const [sugRepeatClipTrimId, setSugRepeatClipTrimId] = useState("");
  const [sugRepeatClipMode, setSugRepeatClipMode] = useState("no_repeat");
  const [sugRepeatClipN, setSugRepeatClipN] = useState(2);
  const [retrimTrimClipId, setRetrimTrimClipId] = useState(null);

  // Suggestions Inbox
  const [receivedSuggestions, setReceivedSuggestions] = useState([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [openReceivedId, setOpenReceivedId] = useState(null);
  const [receivedDetail, setReceivedDetail] = useState(null);
  const [loadingReceivedDetail, setLoadingReceivedDetail] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [receivedMsg, setReceivedMsg] = useState("");
  const [receivedError, setReceivedError] = useState("");

  // ==========================
// RECEIVED MEDLEY REQUESTS (ShopKeeper inbox)
// ==========================
const [receivedRequests, setReceivedRequests] = useState([]);
const [loadingReceivedRequests, setLoadingReceivedRequests] = useState(false);
const [pendingRequestCount, setPendingRequestCount] = useState(0);

const [respondingRequest, setRespondingRequest] = useState(null);
const [responseStatus, setResponseStatus] = useState("Accepted");
const [responseText, setResponseText] = useState("");
const [submittingResponse, setSubmittingResponse] = useState(false);

  // ==========================
  // REVIEWS / RATINGS state
  // ==========================
  const [topRated, setTopRated] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);
  // Top Medley Makers state
  const [topMakers, setTopMakers] = useState([]);
  const [loadingTopMakers, setLoadingTopMakers] = useState(false);
  // ratingsMap[medleyId] = { averageRating, reviewCount }
  const [ratingsMap, setRatingsMap] = useState({});
  // Rate modal state
  const [rateMedley, setRateMedley] = useState(null);
  const [rateStars, setRateStars] = useState(0);
  const [rateText, setRateText] = useState("");
  const [existingReviewId, setExistingReviewId] = useState(null);
  const [savingReview, setSavingReview] = useState(false);
  const [rateError, setRateError] = useState("");
  const [rateMsg, setRateMsg] = useState("");
  // Reviews modal state
  const [reviewsForMedley, setReviewsForMedley] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // ==========================
  // Helpers
  // ==========================
  const formatMs = (ms) => {
    if (!ms) return "00:00";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const buildAudioUrl = (path) => {
    if (!path) return "";
    const base = buildFileUrl(path);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}v=${audioBustToken}`;
  };
  const stripGuidPrefix = (fileName) => {
    if (!fileName) return "";
    return fileName.includes("_") ? fileName.substring(fileName.indexOf("_") + 1) : fileName;
  };
  const computeWatermarkPlacement = () => {
    let repeatEvery = 0;
    let lockFirst = true;
    if (watermarkRepeatMode === "first_only") { repeatEvery = 0; lockFirst = true; }
    else if (watermarkRepeatMode === "every_clip") { repeatEvery = 1; lockFirst = lockFirstWatermark; }
    else if (watermarkRepeatMode === "every_n_clips") {
      repeatEvery = Math.max(2, parseInt(watermarkRepeatN, 10) || 2);
      lockFirst = lockFirstWatermark;
    }
    return { repeatEvery, lockFirst };
  };
  const computeRepeatClip = (mode, n, trimId) => {
    let repeatEvery = 0;
    if (mode === "every_clip") repeatEvery = 1;
    else if (mode === "every_n_clips") repeatEvery = Math.max(2, parseInt(n, 10) || 2);
    const finalTrimId = repeatEvery > 0 && trimId ? parseInt(trimId, 10) : null;
    return {
      repeatClipTrimId: finalTrimId,
      repeatClipEvery: finalTrimId ? repeatEvery : 0,
    };
  };
  const suggestionsCountFor = (originalMedleyId) =>
    receivedSuggestions.filter((s) => s.OriginalMedleyId === originalMedleyId).length;

  const renderStars = (rating, size = "text-sm") => {
    const filled = Math.round(rating);
    return (
      <span className={size}>
        {"⭐".repeat(Math.max(0, filled))}
        <span className="text-gray-600">{"☆".repeat(Math.max(0, 5 - filled))}</span>
      </span>
    );
  };

  const userNameFor = (userId) => {
    const u = allUsersMap[userId];
    if (!u) return `User #${userId}`;
    return u.UserName || u.Name || u.Email || `User #${userId}`;
  };

  // ==========================
  // Fetch
  // ==========================
  const fetchMyMedleys = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setLoadingMy(true);
    try {
      const res = await axios.get(API.medleys.all);
      const mine = (res.data || []).filter((m) => m.UserId === user.UserId);
      setMyMedleys(mine);
      mine.forEach((m) => fetchMedleyRatingSummary(m.MedleyId));
    } catch (err) { console.error(err); }
    finally { setLoadingMy(false); }
  };
  const fetchSharedList = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setLoadingShared(true);
    try {
      const res = await axios.get(API.medleyShare.sharedWithUser(user.UserId));
      const list = res.data || [];
      setSharedList(list);
      list.forEach((m) => fetchMedleyRatingSummary(m.MedleyId));
    } catch (err) { console.error(err); }
    finally { setLoadingShared(false); }
  };
  const fetchMySuggested = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setLoadingMySuggested(true);
    try {
      const res = await axios.get(API.suggested.byUser(user.UserId));
      setMySuggested(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingMySuggested(false); }
  };
  const fetchReceivedSuggestions = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setLoadingReceived(true);
    try {
      const res = await axios.get(API.suggested.received(user.UserId));
      setReceivedSuggestions(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingReceived(false); }
  };

  const fetchReceivedRequests = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setLoadingReceivedRequests(true);
    try {
      const res = await axios.get(API.medleyRequests.received(user.UserId));
      if (res.data.success) {
        setReceivedRequests(res.data.requests || []);
        setPendingRequestCount(res.data.pending || 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingReceivedRequests(false); }
  };
  const fetchTopRated = async () => {
    setLoadingTop(true);
    try {
      const res = await axios.get(API.reviews.top(1, 10));
      setTopRated(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingTop(false); }
  };

  const fetchTopMakers = async () => {
    setLoadingTopMakers(true);
    try {
      const res = await axios.get(API.reviews.topMakers(4));
      setTopMakers(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingTopMakers(false); }
  };

  // Users directory — used to resolve names + build the ShopKeeper picker
  const fetchUsersDirectory = async () => {
    const user = getCurrentUser();
    try {
      const res = await axios.get(API.users.all);
      const list = res.data || [];
      const map = {};
      list.forEach((u) => {
        const uid = u.UserId || u.userId;
        if (uid != null) map[uid] = u;
      });
      setAllUsersMap(map);

      const keepers = list.filter((u) => {
        const uid = u.UserId || u.userId;
        if (uid === user.UserId) return false;
        const role = (u.Role || u.role || "").toLowerCase();
        // If the API exposes a role, keep only shopkeepers; otherwise keep everyone.
        return role ? role === "shopkeeper" : true;
      });
      setShopKeeperList(keepers);
    } catch (err) { /* silent — picker just stays empty */ }
  };

  useEffect(() => {
    fetchMyMedleys();
    fetchSharedList();
    fetchMySuggested();
    fetchReceivedSuggestions();
    fetchTopRated();
    fetchTopMakers();
    fetchUsersDirectory();
    fetchReceivedRequests();   // ← NEW, sirf ye ek line add hui hai
}, []);

  const fetchMedleyRatingSummary = async (medleyId) => {
    try {
      const res = await axios.get(API.reviews.byMedley(medleyId));
      if (res.data && res.data.success) {
        setRatingsMap((prev) => ({
          ...prev,
          [medleyId]: {
            averageRating: res.data.averageRating || 0,
            reviewCount: res.data.reviewCount || 0,
          },
        }));
      }
    } catch (err) { /* silent */ }
  };

  useEffect(() => {
    fetchMyMedleys();
    fetchSharedList();
    fetchMySuggested();
    fetchReceivedSuggestions();
    fetchTopRated();
    fetchTopMakers();
    fetchUsersDirectory();
  }, []);

  const togglePlay = (medleyId) => {
    setPlayingMedleyId((prev) => (prev === medleyId ? null : medleyId));
  };

  // ==========================
  // REQUEST MEDLEY handlers
  // ==========================
  const openRequestModal = (shopKeeperUserId, shopKeeperName) => {
    if (!shopKeeperUserId) return;
    if (shopKeeperUserId === currentUser.UserId) return; // can't request from yourself
    setShowShopKeeperPicker(false);
    setRequestSuccessMsg("");
    setRequestShopKeeper({
      UserId: shopKeeperUserId,
      UserName: shopKeeperName || userNameFor(shopKeeperUserId),
    });
  };
  const closeRequestModal = () => setRequestShopKeeper(null);
  const handleRequestSuccess = () => {
    setRequestSuccessMsg("🎉 Your medley request has been sent.");
    setTimeout(() => setRequestSuccessMsg(""), 5000);
  };

  // ==========================
  // Filtered lists (search + filter pill)
  // ==========================
  const filteredMyMedleys = myMedleys.filter((m) =>
    matchesSearch(m.MedleyName, m.ComposerName)
  );
  const filteredSharedList = sharedList.filter((m) =>
    matchesSearch(m.MedleyName)
  );
  const filteredMySuggested = mySuggested.filter((s) =>
    matchesSearch(s.MedleyName, s.OriginalMedleyName)
  );
  const filteredReceivedSuggestions = receivedSuggestions.filter((s) =>
    matchesSearch(s.OriginalMedleyName, s.ClientUserName)
  );
  const filteredTopRated = topRated.filter((m) =>
    matchesSearch(m.MedleyName, m.OwnerUserName)
  );
  const filteredFavourites = [...myMedleys, ...sharedList]
    .filter(
      (m, idx, arr) =>
        favouriteIds.includes(m.MedleyId) &&
        arr.findIndex((x) => x.MedleyId === m.MedleyId) === idx
    )
    .filter((m) => matchesSearch(m.MedleyName));

  // ==========================
  // EDIT / DELETE / SHARE
  // ==========================
  const openEditModal = (medley) => {
    setEditMedley(medley);
    setEditForm({
      MedleyName: medley.MedleyName || "",
      ComposerName: medley.ComposerName || "",
      ThemeId: medley.ThemeId != null ? String(medley.ThemeId) : "",
    });
    setEditError("");
  };
  const closeEditModal = () => { setEditMedley(null); setEditError(""); };

  const handleSaveEdit = async () => {
    if (!editMedley) return;
    if (!editForm.MedleyName.trim()) { setEditError("Medley Name is required"); return; }
    setSavingEdit(true); setEditError("");
    try {
      const themeIdParsed = parseInt(editForm.ThemeId, 10);
      const payload = {
        MedleyId: editMedley.MedleyId,
        MedleyName: editForm.MedleyName.trim(),
        UserId: editMedley.UserId,
        ThemeId: Number.isFinite(themeIdParsed) ? themeIdParsed : null,
        ClipCount: editMedley.ClipCount,
        ComposerName: editForm.ComposerName.trim() || "",
        TotalDurationMs: editMedley.TotalDurationMs,
        IsFinal: editMedley.IsFinal,
        OutputFilePath: editMedley.OutputFilePath || "",
        WatermarkId: editMedley.WatermarkId,
        WatermarkStartTimeMs: editMedley.WatermarkStartTimeMs,
        WatermarkRepeatEvery: editMedley.WatermarkRepeatEvery,
        WatermarkLockFirst: editMedley.WatermarkLockFirst !== false,
        RepeatClipTrimId: editMedley.RepeatClipTrimId,
        RepeatClipEvery: editMedley.RepeatClipEvery,
      };
      const res = await axios.put(API.medleys.update(editMedley.MedleyId), payload);
      if (res.data.success) { closeEditModal(); fetchMyMedleys(); }
      else setEditError(res.data.message || "Update failed");
    } catch (err) {
      setEditError(err.response?.data?.Message || err.response?.data?.message || "Update failed");
    } finally { setSavingEdit(false); }
  };

  const confirmDelete = (medleyId) => setDeletingId(medleyId);
  const cancelDelete = () => setDeletingId(null);
  const handleDelete = async (medleyId) => {
    setDeleting(true);
    try {
      const user = getCurrentUser();
      const res = await axios.delete(API.medleys.delete(medleyId), {
        params: { userId: user.UserId || 0 },
      });
      if (res.data.success) {
        setMyMedleys((prev) => prev.filter((m) => m.MedleyId !== medleyId));
        setDeletingId(null);
        if (playingMedleyId === medleyId) setPlayingMedleyId(null);
      } else alert(res.data.message || "Delete failed");
    } catch (err) {
      alert(err.response?.data?.Message || err.response?.data?.message || "Delete failed");
    } finally { setDeleting(false); }
  };

  const openShareModal = async (medley) => {
    setShareMedleyId(medley.MedleyId); setShareMedleyObj(medley);
    setShareError(""); setShareSuccessMsg(""); setShareProgressMsg("");
    setSelectedUserIds([]); setUserDropdownOpen(false);
    setAddWatermarkOnShare(!!medley.WatermarkId);
    setSelectedShareWatermarkId(medley.WatermarkId || null);
    setShareWatermarks([]);
    setShareMedleyClips([]);

    const existingRepeat = medley.WatermarkRepeatEvery;
    if (existingRepeat === 1) setWatermarkRepeatMode("every_clip");
    else if (existingRepeat && existingRepeat >= 2) { setWatermarkRepeatMode("every_n_clips"); setWatermarkRepeatN(existingRepeat); }
    else { setWatermarkRepeatMode("first_only"); setWatermarkRepeatN(2); }
    setLockFirstWatermark(medley.WatermarkLockFirst !== false);

    const existingRcEvery = medley.RepeatClipEvery;
    if (existingRcEvery === 1) setShareRepeatClipMode("every_clip");
    else if (existingRcEvery && existingRcEvery >= 2) { setShareRepeatClipMode("every_n_clips"); setShareRepeatClipN(existingRcEvery); }
    else { setShareRepeatClipMode("no_repeat"); setShareRepeatClipN(2); }
    setShareRepeatClipTrimId(medley.RepeatClipTrimId ? String(medley.RepeatClipTrimId) : "");

    setLoadingUsers(true);
    const user = getCurrentUser();
    try {
      const usersRes = await axios.get(API.users.all);
      const others = (usersRes.data || []).filter((u) => (u.UserId || u.userId) !== user.UserId);
      setAllUsers(others);
    } catch { setShareError("Could not load users list."); }
    finally { setLoadingUsers(false); }

    try {
      const wmRes = await axios.get(API.watermark.byUser(user.UserId));
      const wmList = wmRes.data || [];
      setShareWatermarks(wmList);
      if (wmList.length > 0 && !medley.WatermarkId) setSelectedShareWatermarkId(wmList[0].WatermarkId);
    } catch { setShareWatermarks([]); }

    try {
      const clipsRes = await axios.get(API.medleyClips.byMedley(medley.MedleyId));
      const sorted = (clipsRes.data || []).slice().sort((a, b) => (a.SequenceNumber || 0) - (b.SequenceNumber || 0));
      setShareMedleyClips(sorted);
    } catch { setShareMedleyClips([]); }
  };

  const closeShareModal = () => {
    setShareMedleyId(null); setShareMedleyObj(null);
    setShareError(""); setShareSuccessMsg(""); setShareProgressMsg("");
    setSelectedUserIds([]); setUserDropdownOpen(false);
    setAddWatermarkOnShare(false); setSelectedShareWatermarkId(null);
    setShareWatermarks([]); setWatermarkRepeatMode("first_only");
    setWatermarkRepeatN(2); setLockFirstWatermark(true);
    setShareMedleyClips([]);
    setShareRepeatClipMode("no_repeat"); setShareRepeatClipN(2); setShareRepeatClipTrimId("");
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  };

  const handleConfirmShare = async () => {
    if (selectedUserIds.length === 0) { setShareError("Select at least one user to share with"); return; }
    if (!shareMedleyId || !shareMedleyObj) return;
    if (addWatermarkOnShare && !selectedShareWatermarkId) {
      setShareError("Please select a watermark, or uncheck the box"); return;
    }
    const user = getCurrentUser();
    setShareError(""); setShareSuccessMsg(""); setShareProgressMsg(""); setSharing(true);
    try {
      const { repeatClipTrimId, repeatClipEvery } = computeRepeatClip(shareRepeatClipMode, shareRepeatClipN, shareRepeatClipTrimId);
      const wmSettings = addWatermarkOnShare ? computeWatermarkPlacement() : { repeatEvery: 0, lockFirst: true };

      setShareProgressMsg("Saving settings...");
      const updatePayload = {
        MedleyId: shareMedleyObj.MedleyId, MedleyName: shareMedleyObj.MedleyName,
        UserId: shareMedleyObj.UserId, ThemeId: shareMedleyObj.ThemeId,
        ClipCount: shareMedleyObj.ClipCount, ComposerName: shareMedleyObj.ComposerName || "",
        TotalDurationMs: shareMedleyObj.TotalDurationMs, IsFinal: shareMedleyObj.IsFinal,
        OutputFilePath: shareMedleyObj.OutputFilePath || "",
        WatermarkId: addWatermarkOnShare ? selectedShareWatermarkId : shareMedleyObj.WatermarkId,
        WatermarkStartTimeMs: 0,
        WatermarkRepeatEvery: wmSettings.repeatEvery,
        WatermarkLockFirst: wmSettings.lockFirst,
        RepeatClipTrimId: repeatClipTrimId,
        RepeatClipEvery: repeatClipEvery,
      };
      try { await axios.put(API.medleys.update(shareMedleyId), updatePayload); }
      catch (updErr) { setShareError("Failed to save settings: " + (updErr.response?.data?.Message || updErr.message)); return; }

      const needsRerender = addWatermarkOnShare || (repeatClipEvery > 0 && repeatClipTrimId);
      if (needsRerender) {
        setShareProgressMsg("Re-rendering mashup...");
        try {
          const mergeRes = await axios.post(API.medleys.merge(shareMedleyId));
          if (mergeRes.data.success && mergeRes.data.outputFilePath) {
            const newPath = mergeRes.data.outputFilePath;
            setMyMedleys((prev) => prev.map((m) => m.MedleyId === shareMedleyId
              ? { ...m, OutputFilePath: newPath,
                  WatermarkId: updatePayload.WatermarkId,
                  WatermarkRepeatEvery: wmSettings.repeatEvery,
                  WatermarkLockFirst: wmSettings.lockFirst,
                  RepeatClipTrimId: repeatClipTrimId,
                  RepeatClipEvery: repeatClipEvery }
              : m));
            setAudioBustToken(Date.now());
          } else { setShareError("Re-render failed: " + (mergeRes.data.message || "Unknown error")); return; }
        } catch (mergeErr) { setShareError("Re-render failed: " + (mergeErr.response?.data?.Message || mergeErr.message)); return; }
      }

      setShareProgressMsg("Sharing with users...");
      const results = { success: 0, failures: [] };
      for (const uid of selectedUserIds) {
        try {
          const response = await axios.post(API.medleyShare.share, {
            MedleyId: shareMedleyId, SharedByUserId: user.UserId, SharedWithUserId: uid,
          });
          if (response.data.success) results.success += 1;
          else results.failures.push({ uid, msg: response.data.message || "Failed" });
        } catch (err) {
          results.failures.push({ uid, msg: err.response?.data?.Message || err.response?.data?.message || err.message || "Failed" });
        }
      }
      setShareProgressMsg("");
      if (results.success > 0 && results.failures.length === 0) {
        setShareSuccessMsg(`Shared with ${results.success} user(s) successfully!`);
        setSelectedUserIds([]);
      } else if (results.success > 0) {
        setShareSuccessMsg(`Shared with ${results.success} user(s).`);
        setShareError(`Failed for ${results.failures.length}: ${results.failures.map(f => `#${f.uid} (${f.msg})`).join(", ")}`);
      } else {
        setShareError(results.failures.map(f => `#${f.uid}: ${f.msg}`).join("; ") || "Failed to share medley");
      }
    } finally { setSharing(false); setShareProgressMsg(""); }
  };

  // ==========================
  // ACCEPT / SUGGEST from Shared With You
  // ==========================
  const doAcceptAsFinal = async (originalMedleyId) => {
    const user = getCurrentUser();
    if (!user.UserId) { closeConfirm(); return; }
    setConfirmLoading(true);
    setProcessingSharedId(originalMedleyId); setProcessingKind("accept");
    try {
      const res = await axios.post(API.suggested.accept(originalMedleyId, user.UserId));
      closeConfirm();
      if (res.data.success) {
        await fetchMySuggested();
        const newId = res.data.suggestedMedleyId;
        if (newId) { setOpenSuggestedId(newId); await openSuggested(newId); }
        alert("✅ Accepted! Your clean version is ready.");
      } else alert(res.data.message || "Failed to accept.");
    } catch (err) {
      closeConfirm();
      alert(err.response?.data?.Message || err.response?.data?.message || err.message || "Failed to accept.");
    } finally { setProcessingSharedId(null); setProcessingKind(""); setConfirmLoading(false); }
  };
  const handleAcceptAsFinal = (originalMedleyId) => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    openConfirm({
      title: "Accept as final?",
      message: "A clean version of this medley will be prepared for you.",
      confirmText: "Yes, accept",
      variant: "success",
      icon: "👍",
      onConfirm: () => doAcceptAsFinal(originalMedleyId),
    });
  };

  const handleMakeMyVersion = async (originalMedleyId) => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    setProcessingSharedId(originalMedleyId); setProcessingKind("suggest");
    try {
      const res = await axios.post(API.suggested.create(originalMedleyId, user.UserId));
      if (res.data.success) {
        await fetchMySuggested();
        setOpenSuggestedId(res.data.suggestedMedleyId);
        await openSuggested(res.data.suggestedMedleyId);
      } else alert(res.data.message || "Failed to create suggested copy.");
    } catch (err) {
      alert(err.response?.data?.Message || err.response?.data?.message || err.message || "Failed to create suggested copy.");
    } finally { setProcessingSharedId(null); setProcessingKind(""); }
  };

  // ==========================
  // Suggested detail
  // ==========================
  const openSuggested = async (suggestedId) => {
    setOpenSuggestedId(suggestedId);
    setSuggestedDetail(null); setSuggestedMsg(""); setSuggestedError("");
    setLoadingSuggestedDetail(true);
    try {
      const res = await axios.get(API.suggested.byId(suggestedId));
      if (res.data.success) {
        setSuggestedDetail(res.data);
        const rcEvery = res.data.medley.RepeatClipEvery;
        const rcTrimId = res.data.medley.RepeatClipTrimId;
        if (rcEvery === 1) setSugRepeatClipMode("every_clip");
        else if (rcEvery && rcEvery >= 2) { setSugRepeatClipMode("every_n_clips"); setSugRepeatClipN(rcEvery); }
        else { setSugRepeatClipMode("no_repeat"); setSugRepeatClipN(2); }
        setSugRepeatClipTrimId(rcTrimId ? String(rcTrimId) : "");
      } else setSuggestedError(res.data.message || "Could not load suggested medley.");
    } catch { setSuggestedError("Failed to load suggested medley."); }
    finally { setLoadingSuggestedDetail(false); }
  };
  const closeSuggested = () => {
    setOpenSuggestedId(null); setSuggestedDetail(null);
    setSuggestedMsg(""); setSuggestedError("");
    setSugRepeatClipMode("no_repeat"); setSugRepeatClipN(2); setSugRepeatClipTrimId("");
  };
  const handleSuggestedDragStart = (i) => { suggestedDragRef.current = i; };
  const handleSuggestedDragOver = (e) => e.preventDefault();
  const handleSuggestedDrop = (dropIndex) => {
    const dragIndex = suggestedDragRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...suggestedDetail.clips];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setSuggestedDetail((prev) => ({ ...prev, clips: updated }));
    suggestedDragRef.current = null;
  };

  const doDeleteSuggestedClip = async (clipId) => {
    setConfirmLoading(true);
    try {
      const res = await axios.delete(API.suggested.deleteClip(clipId));
      closeConfirm();
      if (res.data.success) {
        setSuggestedDetail((prev) => ({
          ...prev, clips: prev.clips.filter((c) => c.SuggestedClipId !== clipId),
        }));
      } else alert(res.data.message || "Delete failed");
    } catch (err) {
      closeConfirm();
      alert(err.response?.data?.Message || err.response?.data?.message || err.message || "Delete failed");
    } finally { setConfirmLoading(false); }
  };
  const handleDeleteSuggestedClip = (clipId) => {
    openConfirm({
      title: "Delete this clip?",
      message: "This clip will be removed from your suggested version.",
      confirmText: "Delete clip",
      variant: "danger",
      icon: "🗑️",
      onConfirm: () => doDeleteSuggestedClip(clipId),
    });
  };

  const handleSaveSuggestedOrder = async () => {
    if (!suggestedDetail) return;
    setSavingSuggested(true); setSuggestedMsg(""); setSuggestedError("");
    try {
      const newClips = suggestedDetail.clips.map((c, i) => ({ ...c, SequenceNumber: i + 1 }));
      const { repeatClipTrimId, repeatClipEvery } = computeRepeatClip(sugRepeatClipMode, sugRepeatClipN, sugRepeatClipTrimId);
      try {
        await axios.put(API.suggested.updateSettings(openSuggestedId), {
          SuggestedMedleyId: openSuggestedId,
          RepeatClipTrimId: repeatClipTrimId,
          RepeatClipEvery: repeatClipEvery,
        });
      } catch (e) { console.warn("Settings update failed:", e); }

      for (let i = 0; i < newClips.length; i++) {
        const clip = newClips[i];
        await axios.put(API.suggested.updateClip(clip.SuggestedClipId), {
          SuggestedClipId: clip.SuggestedClipId,
          SuggestedMedleyId: openSuggestedId,
          TrimClipId: clip.TrimClipId,
          SequenceNumber: i + 1,
        });
      }

      let renderError = null;
      let newOutputPath = null;
      try {
        const mergeRes = await axios.post(API.suggested.merge(openSuggestedId));
        if (mergeRes.data.success) newOutputPath = mergeRes.data.outputFilePath;
        else renderError = mergeRes.data.message || "Merge failed";
      } catch (mergeErr) {
        renderError = mergeErr.response?.data?.Message || mergeErr.response?.data?.message || mergeErr.message;
      }

      setSuggestedDetail((prev) => ({
        ...prev,
        clips: newClips,
        medley: newOutputPath
          ? { ...prev.medley, OutputFilePath: newOutputPath, RepeatClipTrimId: repeatClipTrimId, RepeatClipEvery: repeatClipEvery }
          : { ...prev.medley, RepeatClipTrimId: repeatClipTrimId, RepeatClipEvery: repeatClipEvery },
      }));
      setMySuggested((prev) => prev.map((m) =>
        m.SuggestedMedleyId === openSuggestedId
          ? { ...m, OutputFilePath: newOutputPath || m.OutputFilePath, ClipCount: newClips.length,
              RepeatClipTrimId: repeatClipTrimId, RepeatClipEvery: repeatClipEvery }
          : m
      ));
      setAudioBustToken(Date.now());
      if (renderError) setSuggestedError(`Re-render failed: ${renderError}`);
      else setSuggestedMsg("Saved successfully! Your suggestion has been sent.");
      fetchReceivedSuggestions();
    } catch (err) {
      setSuggestedError(err.response?.data?.Message || err.response?.data?.message || "Failed to save");
    } finally { setSavingSuggested(false); }
  };

  const doDeleteSuggested = async (suggestedId) => {
    setConfirmLoading(true);
    try {
      const res = await axios.delete(API.suggested.delete(suggestedId));
      closeConfirm();
      if (res.data.success) {
        setMySuggested((prev) => prev.filter((m) => m.SuggestedMedleyId !== suggestedId));
        if (openSuggestedId === suggestedId) closeSuggested();
      } else alert(res.data.message || "Delete failed");
    } catch (err) {
      closeConfirm();
      alert(err.response?.data?.Message || err.response?.data?.message || err.message || "Delete failed");
    } finally { setConfirmLoading(false); }
  };
  const handleDeleteSuggested = (suggestedId) => {
    openConfirm({
      title: "Delete suggested version?",
      message: "This suggested version and all of its clips will be deleted.",
      confirmText: "Delete version",
      variant: "danger",
      icon: "🗑️",
      onConfirm: () => doDeleteSuggested(suggestedId),
    });
  };

  // ==========================
  // SHOPKEEPER: received suggestion / finalize
  // ==========================
  const openReceived = async (suggestedId) => {
    setOpenReceivedId(suggestedId);
    setReceivedDetail(null); setReceivedMsg(""); setReceivedError("");
    setLoadingReceivedDetail(true);
    try {
      const res = await axios.get(API.suggested.byId(suggestedId));
      if (res.data.success) setReceivedDetail(res.data);
      else setReceivedError(res.data.message || "Could not load suggestion.");
    } catch { setReceivedError("Failed to load suggestion."); }
    finally { setLoadingReceivedDetail(false); }
  };
  const closeReceived = () => {
    setOpenReceivedId(null); setReceivedDetail(null);
    setReceivedMsg(""); setReceivedError("");
  };

  const doFinalize = async (suggestedId) => {
    setConfirmLoading(true);
    setFinalizing(true); setReceivedMsg(""); setReceivedError("");
    try {
      const res = await axios.post(API.suggested.finalize(suggestedId));
      closeConfirm();
      if (res.data.success) {
        setReceivedMsg("Finalized successfully!");
        setAudioBustToken(Date.now());
        setReceivedSuggestions((prev) => prev.map((s) => s.SuggestedMedleyId === suggestedId
          ? { ...s, IsFinalized: true, FinalOutputFilePath: res.data.outputFilePath, FinalizedAt: new Date().toISOString() }
          : s));
        if (openReceivedId === suggestedId) {
          setReceivedDetail((prev) => prev ? ({
            ...prev,
            medley: { ...prev.medley, IsFinalized: true, FinalOutputFilePath: res.data.outputFilePath }
          }) : prev);
        }
      } else setReceivedError(res.data.message || "Finalize failed");
    } catch (err) {
      closeConfirm();
      setReceivedError(err.response?.data?.Message || err.response?.data?.message || err.message || "Finalize failed");
    } finally { setFinalizing(false); setConfirmLoading(false); }
  };
  const handleFinalize = (suggestedId) => {
    openConfirm({
      title: "Finalize this suggestion?",
      message: "A clean mashup will be rendered without the watermark.",
      confirmText: "Finalize",
      variant: "success",
      icon: "✨",
      onConfirm: () => doFinalize(suggestedId),
    });
};

// ↓↓↓ Ye teeno yahan, TOP-LEVEL pe hone chahiye (component ke andar, function ke bahar)
const openResponseModal = (request, status) => {
  setRespondingRequest(request);
  setResponseStatus(status);
  setResponseText(request.ResponseMessage || "");
};
const closeResponseModal = () => {
  setRespondingRequest(null);
  setResponseText("");
  setSubmittingResponse(false);
};

const handleSubmitResponse = async () => {
  if (!respondingRequest) return;
  setSubmittingResponse(true);
  try {
    const res = await axios.put(API.medleyRequests.respond(respondingRequest.RequestId), {
      Status: responseStatus,
      ResponseMessage: responseText.trim() || null,
    });
    if (res.data.success) {
      setReceivedRequests((prev) => prev.map((r) =>
        r.RequestId === respondingRequest.RequestId
          ? { ...r, Status: responseStatus, ResponseMessage: responseText.trim(), RespondedAt: new Date().toISOString() }
          : r
      ));
      if (respondingRequest.Status === "Pending" && (responseStatus === "Accepted" || responseStatus === "Rejected")) {
        setPendingRequestCount((prev) => Math.max(0, prev - 1));
      }
      closeResponseModal();
    } else {
      alert(res.data.message || "Failed to respond");
    }
  } catch (err) {
    alert(err.response?.data?.Message || err.response?.data?.message || "Failed to respond");
  } finally {
    setSubmittingResponse(false);
  }
};

  

  // ==========================
  // REVIEW: Open rate modal
  // ==========================
  const openRateModal = async (medley) => {
    const user = getCurrentUser();
    setRateMedley(medley);
    setRateStars(0); setRateText(""); setExistingReviewId(null);
    setRateError(""); setRateMsg("");
    try {
      const res = await axios.get(API.reviews.myReview(user.UserId, medley.MedleyId));
      if (res.data.success && res.data.hasReview) {
        setRateStars(res.data.review.Rating);
        setRateText(res.data.review.ReviewText || "");
        setExistingReviewId(res.data.review.ReviewId);
      }
    } catch { /* no existing */ }
  };
  const closeRateModal = () => {
    setRateMedley(null); setRateStars(0); setRateText("");
    setExistingReviewId(null); setRateError(""); setRateMsg("");
  };
  const handleSubmitReview = async () => {
    if (!rateMedley) return;
    if (rateStars < 1 || rateStars > 5) { setRateError("Please pick a star rating (1-5)."); return; }
    const user = getCurrentUser();
    setSavingReview(true); setRateError(""); setRateMsg("");
    try {
      const res = await axios.post(API.reviews.add, {
        MedleyId: rateMedley.MedleyId,
        RatedByUserId: user.UserId,
        Rating: rateStars,
        ReviewText: rateText.trim() || null,
      });
      if (res.data.success) {
        setRateMsg(existingReviewId ? "Review updated!" : "Review posted!");
        await fetchMedleyRatingSummary(rateMedley.MedleyId);
        await fetchTopRated();
        await fetchTopMakers();
        setTimeout(() => closeRateModal(), 800);
      } else {
        setRateError(res.data.message || "Failed to save review.");
      }
    } catch (err) {
      setRateError(err.response?.data?.Message || err.response?.data?.message || err.message || "Failed to save review.");
    } finally { setSavingReview(false); }
  };

  // ==========================
  // REVIEW: Open reviews list modal
  // ==========================
  const openReviewsModal = async (medleyId, medleyName) => {
    setReviewsForMedley({ medleyId, medleyName, reviews: [], averageRating: 0, reviewCount: 0 });
    setLoadingReviews(true);
    try {
      const res = await axios.get(API.reviews.byMedley(medleyId));
      if (res.data.success) {
        setReviewsForMedley({
          medleyId,
          medleyName,
          reviews: res.data.reviews || [],
          averageRating: res.data.averageRating || 0,
          reviewCount: res.data.reviewCount || 0,
        });
      }
    } catch { /* silent */ }
    finally { setLoadingReviews(false); }
  };
  const closeReviewsModal = () => setReviewsForMedley(null);

  const StarPicker = ({ value, onChange, size = "text-3xl" }) => (
    <div className={`flex gap-1 ${size} cursor-pointer select-none`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}
              onClick={() => onChange(n)}
              className={n <= value ? "text-yellow-400" : "text-gray-600 hover:text-yellow-500"}>
          {n <= value ? "★" : "☆"}
        </span>
      ))}
    </div>
  );

  const renderRepeatClipBlock = ({ clips, trimIdValue, setTrimIdValue, mode, setMode, nValue, setNValue }) => (
    <div className="bg-gray-800 rounded-xl p-3 space-y-3">
      <p className="text-sm font-semibold">🔁 Repeat a clip</p>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Choose clip to repeat</label>
        <select value={trimIdValue} onChange={(e) => setTrimIdValue(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-sm">
          <option value="">-- Select a clip --</option>
          {clips.map((c, idx) => (
            <option key={c.MedleyClipId || c.SuggestedClipId || idx} value={c.TrimClipId}>
              Clip {idx + 1} (TrimClip #{c.TrimClipId})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-2">Placement</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={mode === "no_repeat"} onChange={() => setMode("no_repeat")} className="accent-purple-500" />
            <span>No repeat</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={mode === "every_clip"} onChange={() => setMode("every_clip")} className="accent-purple-500" />
            <span>Har clip ke baad</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer flex-wrap">
            <input type="radio" checked={mode === "every_n_clips"} onChange={() => setMode("every_n_clips")} className="accent-purple-500" />
            <span>Har</span>
            <input type="number" min="2" max="20" value={nValue}
                   onChange={(e) => setNValue(Math.max(2, parseInt(e.target.value, 10) || 2))}
                   onFocus={() => setMode("every_n_clips")}
                   className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-center" />
            <span>clips ke baad</span>
          </label>
        </div>
      </div>
      {mode !== "no_repeat" && !trimIdValue && (
        <p className="text-yellow-400 text-xs">⚠️ Please choose a clip above for the repeat to work.</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-10 px-4">
      <h1 className="text-4xl font-bold mb-6">📚 My Library</h1>

      {/* =================================================== */}
      {/* 🎵 REQUEST A CUSTOM MEDLEY (clients + shopkeepers)   */}
      {/* =================================================== */}
      {canRequestMedley && (
        <div className="w-full max-w-2xl mb-6">
          <button
            onClick={() => setShowShopKeeperPicker((prev) => !prev)}
            className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            🎵 Request a Custom Medley
          </button>

          {requestSuccessMsg && (
            <p className="text-green-400 text-sm mt-2 bg-green-950 border border-green-700 rounded-lg p-2 text-center">
              {requestSuccessMsg}
            </p>
          )}

          {showShopKeeperPicker && (
            <div className="mt-2 bg-gray-900 border border-purple-700 rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-gray-400 text-xs">Choose who should make your medley:</p>
                <button onClick={() => setShowShopKeeperPicker(false)}
                        className="text-gray-500 hover:text-white text-xs">✕</button>
              </div>
              {shopKeeperList.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-3">No medley makers available yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {shopKeeperList.map((u) => {
                    const uid = u.UserId || u.userId;
                    const name = u.UserName || u.Name || u.Email || `User #${uid}`;
                    return (
                      <button
                        key={uid}
                        onClick={() => openRequestModal(uid, name)}
                        className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm transition-colors"
                      >
                        👤 {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================== */}
      {/* 🔍 SEARCH BAR + FILTERS                              */}
      {/* =================================================== */}
      <div className="w-full max-w-2xl mb-8 sticky top-0 z-20 bg-black/90 backdrop-blur-sm pt-2 pb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medleys by name, composer, or owner..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
  {FILTERS.map((f) => (
    <button
      key={f.key}
      onClick={() => setActiveFilter(f.key)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
        activeFilter === f.key
          ? "bg-purple-600 text-white"
          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
      }`}
    >
      <span>{f.icon}</span>
      <span>{f.label}</span>
    </button>
  ))}
</div>
      </div>

      {/* =================================================== */}
      {/* 👑 TOP 4 MEDLEY MAKERS                              */}
      {/* =================================================== */}
      {sectionVisible("top") && !searchQuery.trim() && topMakers.length > 0 && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">👑 Top Medley Makers</h2>
              <p className="text-gray-500 text-xs">Highest-rated creators by average rating</p>
            </div>
            <button onClick={fetchTopMakers} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingTopMakers ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {topMakers.map((maker, idx) => {
                const medals = ["🥇", "🥈", "🥉", "🏅"];
                const borderColors = ["border-yellow-400", "border-gray-400", "border-orange-600", "border-purple-500"];
                return (
                  <div key={maker.UserId}
                       className={`bg-gradient-to-br from-purple-950/50 to-gray-800 border-2 ${borderColors[idx] || "border-gray-600"} rounded-xl p-4 text-center`}>
                    <div className="text-4xl mb-2">{medals[idx] || "⭐"}</div>
                    <p className="font-bold text-sm truncate">{maker.UserName || `User #${maker.UserId}`}</p>
                    <p className="text-yellow-400 font-bold text-lg mt-1">
                      {maker.AverageRating.toFixed(1)} ⭐
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {maker.MedleyCount} medley{maker.MedleyCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {maker.TotalReviews} review{maker.TotalReviews !== 1 ? "s" : ""}
                    </p>
                    {canRequestFrom(maker.UserId) && (
                      <button
                        onClick={() => openRequestModal(maker.UserId, maker.UserName)}
                        className="mt-3 w-full bg-purple-600 hover:bg-purple-700 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        🎵 Request a medley
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================== */}
      {/* 🏆 TOP RATED MEDLEYS                                */}
      {/* =================================================== */}
      {sectionVisible("top") && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">🏆 Top Rated Medleys</h2>
              <p className="text-gray-500 text-xs">Highest-rated mashups by all users</p>
            </div>
            <button onClick={fetchTopRated} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingTop ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : filteredTopRated.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              {searchQuery.trim() ? "No top rated medleys match your search." : "No top rated medleys yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredTopRated.map((m, idx) => (
                <div key={m.MedleyId}
                     className="bg-gradient-to-r from-yellow-950/50 to-gray-800 border border-yellow-700/50 rounded-xl px-4 py-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        <span className="text-yellow-400 mr-2">#{idx + 1}</span>
                        {m.MedleyName}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {renderStars(m.AverageRating)} <span className="text-yellow-400 font-bold">{m.AverageRating.toFixed(1)}</span>
                        {" "}({m.ReviewCount} review{m.ReviewCount !== 1 ? "s" : ""})
                        · by {m.OwnerUserName || `user #${m.OwnerUserId}`}
                      </p>
                    </div>
                    <button
                      onClick={() => openReviewsModal(m.MedleyId, m.MedleyName)}
                      className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0">
                      💬 Reviews
                    </button>
                  </div>
                  {m.OutputFilePath && (
                    <audio key={`top-${m.MedleyId}-${audioBustToken}`}
                           controls src={buildAudioUrl(m.OutputFilePath)}
                           className="w-full mt-2 h-8" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY MEDLEYS */}
      {sectionVisible("mine") && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">🎧 My Medleys</h2>
              <p className="text-gray-500 text-xs">Mashups you created</p>
            </div>
            <button onClick={fetchMyMedleys} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingMy ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
          ) : filteredMyMedleys.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              {searchQuery.trim() ? "No medleys match your search." : "You haven't created any medleys yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredMyMedleys.map((m) => {
                const suggCount = suggestionsCountFor(m.MedleyId);
                const rating = ratingsMap[m.MedleyId];
                return (
                  <div key={m.MedleyId} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg truncate">{m.MedleyName}</p>
                        <p className="text-gray-400 text-xs">
                          {m.ClipCount || 0} clips
                          {m.TotalDurationMs > 0 && ` · ${formatMs(m.TotalDurationMs)}`}
                          {m.WatermarkId && (
                            <span className="text-purple-400">
                              {" "}· 🔖 watermarked
                              {m.WatermarkRepeatEvery === 1 ? " (every clip)"
                                : m.WatermarkRepeatEvery > 1 ? ` (every ${m.WatermarkRepeatEvery} clips)` : ""}
                            </span>
                          )}
                          {m.RepeatClipTrimId && m.RepeatClipEvery > 0 && (
                            <span className="text-pink-400">
                              {" "}· 🔁 clip #{m.RepeatClipTrimId} repeats
                              {m.RepeatClipEvery === 1 ? " (every clip)" : ` (every ${m.RepeatClipEvery} clips)`}
                            </span>
                          )}
                        </p>
                        {rating && rating.reviewCount > 0 && (
                          <p className="text-xs mt-1 cursor-pointer hover:underline"
                             onClick={() => openReviewsModal(m.MedleyId, m.MedleyName)}>
                            {renderStars(rating.averageRating)}{" "}
                            <span className="text-yellow-400 font-bold">{rating.averageRating.toFixed(1)}</span>
                            <span className="text-gray-400"> ({rating.reviewCount} review{rating.reviewCount !== 1 ? "s" : ""})</span>
                          </p>
                        )}
                        {suggCount > 0 && (
                          <p className="mt-1 inline-block bg-yellow-600/30 border border-yellow-500 text-yellow-300 text-xs px-2 py-1 rounded">
                            📋 {suggCount} response{suggCount > 1 ? "s" : ""} received
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {m.OutputFilePath && (
                          <button onClick={() => togglePlay(m.MedleyId)} className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-xs font-semibold">
                            {playingMedleyId === m.MedleyId ? "⏸" : "▶"}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleFavourite(m.MedleyId)}
                          className="text-lg px-1"
                          title={isFav(m.MedleyId) ? "Remove from favourites" : "Add to favourites"}
                        >
                          {isFav(m.MedleyId) ? "❤️" : "🤍"}
                        </button>
                        <button onClick={() => openShareModal(m)} className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold">↗</button>
                        <button onClick={() => openReviewsModal(m.MedleyId, m.MedleyName)}
                                className="bg-yellow-700 hover:bg-yellow-800 px-3 py-2 rounded-lg text-xs font-semibold">💬</button>
                        <button onClick={() => openEditModal(m)} className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-xs font-semibold">✏️</button>
                        <button onClick={() => confirmDelete(m.MedleyId)} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-xs font-semibold">🗑</button>
                      </div>
                    </div>

                    {playingMedleyId === m.MedleyId && m.OutputFilePath && (
                      <audio key={`${m.MedleyId}-${m.OutputFilePath}-${audioBustToken}`}
                             className="w-full mt-3" controls autoPlay
                             src={buildAudioUrl(m.OutputFilePath)}
                             onEnded={() => setPlayingMedleyId(null)} />
                    )}

                    {deletingId === m.MedleyId && (
                      <div className="mt-3 bg-red-950 border border-red-700 rounded-lg p-3">
                        <p className="text-red-300 text-sm mb-2">Delete "{m.MedleyName}"?</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleDelete(m.MedleyId)} disabled={deleting}
                                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                            {deleting ? "Deleting..." : "Yes, delete"}
                          </button>
                          <button onClick={cancelDelete} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-xs font-semibold">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================== */}
      {/* ❤️ FAVOURITES                                       */}
      {/* =================================================== */}
      {sectionVisible("favourites") && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">❤️ Favourites</h2>
              <p className="text-gray-500 text-xs">Medleys you've liked</p>
            </div>
          </div>

          {filteredFavourites.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              {searchQuery.trim() ? "No favourites match your search." : "No favourite medleys yet — tap 🤍 on any medley."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredFavourites.map((m) => (
                <div key={m.MedleyId} className="bg-gray-800 rounded-xl px-4 py-3">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{m.MedleyName}</p>
                      <p className="text-gray-400 text-xs">{m.ClipCount || 0} clips</p>
                    </div>
                    <button
                      onClick={() => handleToggleFavourite(m.MedleyId)}
                      className="text-red-400 hover:text-red-300 text-xl flex-shrink-0"
                      title="Remove from favourites"
                    >
                      ❤️
                    </button>
                  </div>
                  {m.OutputFilePath && (
                    <audio controls src={buildAudioUrl(m.OutputFilePath)} className="w-full mt-2 h-8" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CLIENT RESPONSES */}
      {sectionVisible("received") && receivedSuggestions.length > 0 && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">📥 Client Responses</h2>
              <p className="text-gray-500 text-xs">Accepts & suggestions on your medleys</p>
            </div>
            <button onClick={fetchReceivedSuggestions} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingReceived ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : filteredReceivedSuggestions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              {searchQuery.trim() ? "No client responses match your search." : "No client responses yet."}
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {filteredReceivedSuggestions.map((s) => (
                <div key={s.SuggestedMedleyId}
                     onClick={() => openReceived(s.SuggestedMedleyId)}
                     className={`bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-700 ${
                       openReceivedId === s.SuggestedMedleyId ? "border border-yellow-500" : ""
                     }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {s.OriginalMedleyName}
                      {s.AcceptedAsIs
                        ? <span className="ml-2 text-green-400 text-xs">👍 accepted as-is</span>
                        : s.IsFinalized
                          ? <span className="ml-2 text-green-400 text-xs">✨ finalized</span>
                          : <span className="ml-2 text-yellow-400 text-xs">🎨 changes suggested</span>}
                    </p>
                    <p className="text-gray-400 text-xs">
                      👤 {s.ClientUserName || `User #${s.ClientUserId}`} · {s.ClipCount || 0} clips
                    </p>
                  </div>
                  <span className="text-yellow-400 text-xs ml-2">Review ›</span>
                </div>
              ))}
            </div>
          )}

          {openReceivedId && (
            <div className="bg-gray-900 border border-yellow-700 rounded-xl p-4">
              {loadingReceivedDetail ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : !receivedDetail || !receivedDetail.success ? (
                <p className="text-red-400 text-sm">{receivedError || "Could not load"}</p>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold">{receivedDetail.medley.OriginalMedleyName}</h3>
                      <p className="text-gray-400 text-xs">
                        {receivedDetail.medley.AcceptedAsIs
                          ? "👍 Client accepted your medley as-is"
                          : `Suggested by user #${receivedDetail.medley.UserId} · ${receivedDetail.clips.length} clips`}
                      </p>
                      {receivedDetail.medley.RepeatClipTrimId && receivedDetail.medley.RepeatClipEvery > 0 && (
                        <p className="text-pink-400 text-xs mt-1">
                          🔁 Client wants TrimClip #{receivedDetail.medley.RepeatClipTrimId} to repeat
                          {receivedDetail.medley.RepeatClipEvery === 1 ? " after every clip" : ` every ${receivedDetail.medley.RepeatClipEvery} clips`}
                        </p>
                      )}
                    </div>
                    <button onClick={closeReceived} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>

                  {(receivedDetail.medley.FinalOutputFilePath || receivedDetail.medley.OutputFilePath) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {receivedDetail.medley.FinalOutputFilePath ? "✨ Final clean version:" : "🎧 Client's version:"}
                      </p>
                      <audio
                        key={`rec-${receivedDetail.medley.SuggestedMedleyId}-${receivedDetail.medley.FinalOutputFilePath || receivedDetail.medley.OutputFilePath}-${audioBustToken}`}
                        controls
                        src={buildAudioUrl(receivedDetail.medley.FinalOutputFilePath || receivedDetail.medley.OutputFilePath)}
                        className="w-full" />
                    </div>
                  )}

                  {!receivedDetail.medley.AcceptedAsIs && (
                    <>
                      <p className="text-gray-500 text-xs mb-2">Client's clip order:</p>
                      <div className="space-y-2 mb-3">
                        {receivedDetail.clips.map((clip, idx) => (
                          <div key={clip.SuggestedClipId} className="rounded-xl px-4 py-2 flex items-center gap-3 bg-gray-800">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-yellow-400">
                              {idx + 1}
                            </div>
                            <div className="flex-1"><p className="text-sm font-semibold">TrimClip #{clip.TrimClipId}</p></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {receivedDetail.medley.AcceptedAsIs ? (
                    <p className="text-center text-green-400 text-sm py-2 bg-green-950 rounded-lg border border-green-700">
                      👍 Client dabaya "Accept as final" — clean version already delivered.
                    </p>
                  ) : !receivedDetail.medley.IsFinalized ? (
                    <button onClick={() => handleFinalize(receivedDetail.medley.SuggestedMedleyId)} disabled={finalizing}
                            className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                      {finalizing ? "Finalizing..." : "✨ Is Final — render without watermark"}
                    </button>
                  ) : (
                    <p className="text-center text-green-400 text-sm py-2">
                      ✨ Finalized on {new Date(receivedDetail.medley.FinalizedAt).toLocaleString()}
                    </p>
                  )}

                  {receivedMsg && <p className="text-green-400 text-sm mt-2">✅ {receivedMsg}</p>}
                  {receivedError && <p className="text-red-400 text-sm mt-2">{receivedError}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* MEDLEY REQUESTS RECEIVED */}
{receivedRequests.length > 0 && (
  <div className="w-full max-w-2xl mb-10">
    <div className="flex justify-between items-center mb-3">
      <div>
        <h2 className="text-2xl font-bold">
          📨 Medley Requests
          {pendingRequestCount > 0 && (
            <span className="ml-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full align-middle">
              {pendingRequestCount} new
            </span>
          )}
        </h2>
        <p className="text-gray-500 text-xs">Custom medley requests sent to you</p>
      </div>
      <button onClick={fetchReceivedRequests} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
    </div>

    {loadingReceivedRequests ? (
      <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
    ) : (
      <div className="space-y-2">
        {receivedRequests.map((r) => (
          <div key={r.RequestId} className="bg-gray-800 rounded-xl px-4 py-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{r.RequestTitle}</p>
                <p className="text-gray-400 text-xs">
                  👤 {r.RequesterUserName || `User #${r.RequesterUserId}`}
                  {r.Occasion && ` · 🎉 ${r.Occasion}`}
                  {r.PreferredLength && ` · ⏱ ${r.PreferredLength}`}
                  {r.Category && ` · 🏷 ${r.Category}`}
                </p>
                {r.RequestMessage && (
                  <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{r.RequestMessage}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(r.CreatedAt).toLocaleString()}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                r.Status === "Pending" ? "bg-yellow-600/30 border border-yellow-500 text-yellow-300"
                : r.Status === "Accepted" ? "bg-blue-600/30 border border-blue-500 text-blue-300"
                : r.Status === "Completed" ? "bg-green-600/30 border border-green-500 text-green-300"
                : "bg-red-600/30 border border-red-500 text-red-300"
              }`}>
                {r.Status}
              </span>
            </div>

            {r.ResponseMessage && (
              <p className="text-purple-300 text-xs mt-2 bg-gray-900 rounded-lg p-2">
                Your reply: {r.ResponseMessage}
              </p>
            )}

            {r.Status === "Pending" && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => openResponseModal(r, "Accepted")}
                        className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg text-xs font-semibold">
                  ✅ Accept
                </button>
                <button onClick={() => openResponseModal(r, "Rejected")}
                        className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded-lg text-xs font-semibold">
                  ❌ Reject
                </button>
              </div>
            )}
            {r.Status === "Accepted" && (
              <button onClick={() => openResponseModal(r, "Completed")}
                      className="w-full mt-3 bg-purple-600 hover:bg-purple-700 py-2 rounded-lg text-xs font-semibold">
                🎉 Mark as Completed
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}

      {/* SHARED WITH YOU */}
      {sectionVisible("shared") && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">🤝 Shared With You</h2>
              <p className="text-gray-500 text-xs">Rate, accept or suggest changes</p>
            </div>
            <button onClick={fetchSharedList} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingShared ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
          ) : filteredSharedList.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              {searchQuery.trim() ? "No shared medleys match your search." : "No medleys have been shared with you yet."}
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {filteredSharedList.map((m) => {
                const alreadyHasCopy = mySuggested.some((s) => s.OriginalMedleyId === m.MedleyId);
                const isProcessingThis = processingSharedId === m.MedleyId;
                const rating = ratingsMap[m.MedleyId];
                return (
                  <div key={m.MedleyId} className="bg-gray-800 rounded-xl px-4 py-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{m.MedleyName}</p>
                        <p className="text-gray-400 text-xs">
                          {m.ClipCount} clips · shared by user #{m.SharedByUserId}
                        </p>
                        {rating && rating.reviewCount > 0 && (
                          <p className="text-xs mt-1 cursor-pointer hover:underline"
                             onClick={() => openReviewsModal(m.MedleyId, m.MedleyName)}>
                            {renderStars(rating.averageRating)}{" "}
                            <span className="text-yellow-400 font-bold">{rating.averageRating.toFixed(1)}</span>
                            <span className="text-gray-400"> ({rating.reviewCount})</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleFavourite(m.MedleyId)}
                          className="text-lg px-1"
                          title={isFav(m.MedleyId) ? "Remove from favourites" : "Add to favourites"}
                        >
                          {isFav(m.MedleyId) ? "❤️" : "🤍"}
                        </button>
                        {m.OutputFilePath && (
                          <audio key={`shr-${m.MedleyId}-${m.OutputFilePath}-${audioBustToken}`}
                                 controls src={buildAudioUrl(m.OutputFilePath)}
                                 className="h-8 max-w-[180px]" />
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                      {alreadyHasCopy ? (
                        <p className="text-center text-green-400 text-xs bg-green-950 rounded-lg py-2 border border-green-800">
                          ✓ You already have a copy — see "My Suggested Sequences" below
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleAcceptAsFinal(m.MedleyId)} disabled={isProcessingThis}
                                  className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                            {isProcessingThis && processingKind === "accept" ? "Accepting..." : "👍 Accept as final (no changes)"}
                          </button>
                          <button onClick={() => handleMakeMyVersion(m.MedleyId)} disabled={isProcessingThis}
                                  className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                            {isProcessingThis && processingKind === "suggest" ? "Creating..." : "🎨 Suggest changes (reorder/delete)"}
                          </button>
                        </div>
                      )}
                      <button onClick={() => openRateModal(m)}
                              className="w-full bg-yellow-600 hover:bg-yellow-700 py-2 rounded-lg text-xs font-semibold">
                        ⭐ Rate & Review this medley
                      </button>
                      {canRequestFrom(m.SharedByUserId) && (
                        <button onClick={() => openRequestModal(m.SharedByUserId)}
                                className="w-full bg-purple-700 hover:bg-purple-800 py-2 rounded-lg text-xs font-semibold">
                          🎵 Request a custom medley from this maker
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MY SUGGESTED SEQUENCES */}
      {sectionVisible("suggested") && mySuggested.length > 0 && (
        <div className="w-full max-w-2xl mb-10">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-2xl font-bold">🎨 My Suggested Sequences</h2>
              <p className="text-gray-500 text-xs">Your copies of shared medleys</p>
            </div>
            <button onClick={fetchMySuggested} className="text-gray-400 hover:text-white text-sm">⟳ Refresh</button>
          </div>

          {loadingMySuggested ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
          ) : filteredMySuggested.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              {searchQuery.trim() ? "No suggested sequences match your search." : "No suggested sequences yet."}
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {filteredMySuggested.map((s) => (
                <div key={s.SuggestedMedleyId}
                     className={`bg-gray-800 rounded-xl px-4 py-3 ${openSuggestedId === s.SuggestedMedleyId ? "border border-purple-500" : ""}`}>
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openSuggested(s.SuggestedMedleyId)}>
                      <p className="font-semibold text-sm truncate">
                        {s.MedleyName}
                        {s.AcceptedAsIs
                          ? <span className="ml-2 text-green-400 text-xs">👍 accepted as final</span>
                          : s.IsFinalized
                            ? <span className="ml-2 text-green-400 text-xs">✨ finalized by sender</span>
                            : null}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {s.ClipCount || 0} clips
                        {s.UpdatedAt && ` · edited ${new Date(s.UpdatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openSuggested(s.SuggestedMedleyId); }}
                              className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-xs font-semibold">Open</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteSuggested(s.SuggestedMedleyId); }}
                              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-xs font-semibold">🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {openSuggestedId && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              {loadingSuggestedDetail ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : !suggestedDetail || !suggestedDetail.success ? (
                <p className="text-red-400 text-sm">{suggestedError || "Could not load."}</p>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold">{suggestedDetail.medley.MedleyName}</h3>
                      <p className="text-gray-400 text-xs">
                        {suggestedDetail.medley.AcceptedAsIs
                          ? "👍 Accepted as-is — final clean version below"
                          : `Copy of "${suggestedDetail.medley.OriginalMedleyName}"`}
                      </p>
                    </div>
                    <button onClick={closeSuggested} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>

                  {suggestedDetail.medley.FinalOutputFilePath && (
                    <div className="mb-3 bg-green-950 border border-green-700 rounded-lg p-3">
                      <p className="text-green-300 text-xs mb-1">✨ Final version (no watermark):</p>
                      <audio
                        key={`fin-${suggestedDetail.medley.SuggestedMedleyId}-${suggestedDetail.medley.FinalOutputFilePath}-${audioBustToken}`}
                        controls src={buildAudioUrl(suggestedDetail.medley.FinalOutputFilePath)}
                        className="w-full" />
                    </div>
                  )}

                  {suggestedDetail.medley.OutputFilePath && !suggestedDetail.medley.FinalOutputFilePath && (
                    <audio
                      key={`sug-${suggestedDetail.medley.SuggestedMedleyId}-${suggestedDetail.medley.OutputFilePath}-${audioBustToken}`}
                      controls src={buildAudioUrl(suggestedDetail.medley.OutputFilePath)}
                      className="w-full mb-3" />
                  )}

                  {!suggestedDetail.medley.AcceptedAsIs && (
                    <>
                      <div className="mb-4">
                        {renderRepeatClipBlock({
                          clips: suggestedDetail.clips,
                          trimIdValue: sugRepeatClipTrimId, setTrimIdValue: setSugRepeatClipTrimId,
                          mode: sugRepeatClipMode, setMode: setSugRepeatClipMode,
                          nValue: sugRepeatClipN, setNValue: setSugRepeatClipN,
                        })}
                      </div>

                      <p className="text-gray-500 text-xs mb-2">Drag clips to reorder · click ✂️ to re-trim · click 🗑 to remove</p>
                      <div className="space-y-2 mb-3">
                        {suggestedDetail.clips.map((clip, idx) => (
                          <div key={clip.SuggestedClipId}
                               draggable
                               onDragStart={() => handleSuggestedDragStart(idx)}
                               onDragOver={handleSuggestedDragOver}
                               onDrop={() => handleSuggestedDrop(idx)}
                               className="rounded-xl px-4 py-3 flex items-center gap-3 bg-gray-800 cursor-move">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">
                              {idx + 1}
                            </div>
                            <div className="flex-1"><p className="text-sm font-semibold">TrimClip #{clip.TrimClipId}</p></div>
                            <span className="text-gray-500 text-lg">⠿</span>
                            <button onClick={() => setRetrimTrimClipId(clip.TrimClipId)}
                                    className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs">✂️</button>
                            <button onClick={() => handleDeleteSuggestedClip(clip.SuggestedClipId)}
                                    className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs">🗑</button>
                          </div>
                        ))}
                      </div>

                      <button onClick={handleSaveSuggestedOrder}
                              disabled={savingSuggested || suggestedDetail.clips.length === 0}
                              className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                        {savingSuggested ? "Saving..." : "💾 Save & send to sender"}
                      </button>
                    </>
                  )}

                  {suggestedMsg && <p className="text-green-400 text-sm mt-2">✅ {suggestedMsg}</p>}
                  {suggestedError && <p className="text-red-400 text-sm mt-2">{suggestedError}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHARE MODAL */}
      {shareMedleyId && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto text-white">
            <h2 className="text-xl font-bold mb-1">↗ Share Medley</h2>
            <p className="text-gray-400 text-sm mb-4">Select users to share this medley with:</p>

            {loadingUsers ? (
              <p className="text-gray-400 text-sm text-center py-6">Loading users...</p>
            ) : allUsers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No other users found.</p>
            ) : (
              <div className="relative mb-4">
                <button type="button" onClick={() => setUserDropdownOpen(prev => !prev)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-left text-sm flex justify-between items-center">
                  <span>{selectedUserIds.length === 0 ? "Select users..." : `${selectedUserIds.length} user(s) selected`}</span>
                  <span className="text-gray-400">{userDropdownOpen ? "▲" : "▼"}</span>
                </button>
                {userDropdownOpen && (
                  <div className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                    {allUsers.map((u) => {
                      const uid = u.UserId || u.userId;
                      const name = u.UserName || u.Name || u.Email || `User #${uid}`;
                      const checked = selectedUserIds.includes(uid);
                      return (
                        <label key={uid} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-700 ${checked ? "bg-purple-900" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleUserSelection(uid)} className="accent-purple-500" />
                          <span className="text-sm">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {(isShopKeeper || shareWatermarks.length > 0) && (
              <div className="mb-4 bg-gray-800 rounded-xl p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={addWatermarkOnShare}
                         onChange={e => setAddWatermarkOnShare(e.target.checked)}
                         disabled={shareWatermarks.length === 0}
                         className="accent-purple-500 w-4 h-4" />
                  <span className="text-sm">🔖 Add watermark to this medley before sharing</span>
                </label>

                {shareWatermarks.length === 0 ? (
                  <p className="text-gray-500 text-xs mt-2 ml-6">No watermarks. Go to Settings → Watermark.</p>
                ) : (
                  addWatermarkOnShare && (
                    <div className="mt-3 ml-6 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Choose watermark</label>
                        <select value={selectedShareWatermarkId || ""}
                                onChange={e => setSelectedShareWatermarkId(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-sm">
                          {shareWatermarks.map((w) => {
                            const fn = w.FilePath ? w.FilePath.split("/").pop() : "";
                            return (
                              <option key={w.WatermarkId} value={w.WatermarkId}>
                                {stripGuidPrefix(fn) || `Watermark #${w.WatermarkId}`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Watermark placement</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="wmRepeatMode" checked={watermarkRepeatMode === "first_only"}
                                   onChange={() => setWatermarkRepeatMode("first_only")} className="accent-purple-500" />
                            <span>Sirf pehle</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="radio" name="wmRepeatMode" checked={watermarkRepeatMode === "every_clip"}
                                   onChange={() => setWatermarkRepeatMode("every_clip")} className="accent-purple-500" />
                            <span>Har clip ke baad</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer flex-wrap">
                            <input type="radio" name="wmRepeatMode" checked={watermarkRepeatMode === "every_n_clips"}
                                   onChange={() => setWatermarkRepeatMode("every_n_clips")} className="accent-purple-500" />
                            <span>Har</span>
                            <input type="number" min="2" max="20" value={watermarkRepeatN}
                                   onChange={e => setWatermarkRepeatN(Math.max(2, parseInt(e.target.value, 10) || 2))}
                                   onFocus={() => setWatermarkRepeatMode("every_n_clips")}
                                   className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-center" />
                            <span>clips ke baad</span>
                          </label>
                        </div>
                      </div>
                      {watermarkRepeatMode !== "first_only" && (
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-900 rounded-lg px-3 py-2">
                          <input type="checkbox" checked={lockFirstWatermark}
                                 onChange={e => setLockFirstWatermark(e.target.checked)}
                                 className="accent-purple-500 w-4 h-4" />
                          <span className="text-sm">🔒 Pehle bhi watermark rakho</span>
                        </label>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mb-4">
              {shareMedleyClips.length === 0 ? (
                <p className="text-gray-500 text-xs">Loading clips for repeat option...</p>
              ) : (
                renderRepeatClipBlock({
                  clips: shareMedleyClips,
                  trimIdValue: shareRepeatClipTrimId, setTrimIdValue: setShareRepeatClipTrimId,
                  mode: shareRepeatClipMode, setMode: setShareRepeatClipMode,
                  nValue: shareRepeatClipN, setNValue: setShareRepeatClipN,
                })
              )}
            </div>

            {shareProgressMsg && <p className="text-purple-300 text-sm mb-3">⏳ {shareProgressMsg}</p>}
            {shareError && <p className="text-red-400 text-sm mb-3">{shareError}</p>}
            {shareSuccessMsg && <p className="text-green-400 text-sm mb-3">✅ {shareSuccessMsg}</p>}

            <div className="flex gap-3">
              <button onClick={handleConfirmShare}
                      disabled={sharing || loadingUsers || selectedUserIds.length === 0}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50">
                {sharing ? "Sharing..." : `Share${selectedUserIds.length ? ` with ${selectedUserIds.length}` : ""}`}
              </button>
              <button onClick={closeShareModal} disabled={sharing}
                      className="flex-1 bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold disabled:opacity-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editMedley && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md text-white">
            <h2 className="text-xl font-bold mb-4">✏️ Edit Medley</h2>
            <label className="block text-gray-400 text-xs mb-1">Medley Name</label>
            <input type="text" value={editForm.MedleyName}
                   onChange={e => setEditForm({ ...editForm, MedleyName: e.target.value })}
                   className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-3 text-sm" />
            <label className="block text-gray-400 text-xs mb-1">Composer Name</label>
            <input type="text" value={editForm.ComposerName}
                   onChange={e => setEditForm({ ...editForm, ComposerName: e.target.value })}
                   className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-3 text-sm" />
            <label className="block text-gray-400 text-xs mb-1">Theme Id (optional)</label>
            <input type="text" value={editForm.ThemeId}
                   onChange={e => setEditForm({ ...editForm, ThemeId: e.target.value })}
                   className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-4 text-sm" />
            {editError && <p className="text-red-400 text-sm mb-3">{editError}</p>}
            <div className="flex gap-3">
              <button onClick={handleSaveEdit} disabled={savingEdit}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50">
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={closeEditModal}
                      className="flex-1 bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* RATE MODAL */}
      {rateMedley && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md text-white">
            <h2 className="text-xl font-bold mb-1">⭐ Rate this Medley</h2>
            <p className="text-gray-400 text-sm mb-4 truncate">"{rateMedley.MedleyName}"</p>

            <div className="mb-4 flex justify-center">
              <StarPicker value={rateStars} onChange={setRateStars} />
            </div>
            {rateStars > 0 && (
              <p className="text-center text-yellow-400 text-sm mb-3">
                {["", "Terrible", "Not great", "Okay", "Good", "Excellent!"][rateStars]}
              </p>
            )}

            <label className="block text-gray-400 text-xs mb-1">Your review (optional)</label>
            <textarea value={rateText} onChange={e => setRateText(e.target.value)}
                      placeholder="Share your thoughts about this mashup..."
                      rows={4}
                      maxLength={1000}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-3 text-sm resize-none" />
            <p className="text-gray-500 text-xs text-right mb-3">{rateText.length}/1000</p>

            {existingReviewId && (
              <p className="text-blue-300 text-xs mb-3">
                💡 You've already reviewed this — submitting will update your review.
              </p>
            )}

            {rateError && <p className="text-red-400 text-sm mb-3">{rateError}</p>}
            {rateMsg && <p className="text-green-400 text-sm mb-3">✅ {rateMsg}</p>}

            <div className="flex gap-3">
              <button onClick={handleSubmitReview} disabled={savingReview || rateStars === 0}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-3 rounded-xl font-semibold disabled:opacity-50">
                {savingReview ? "Saving..." : existingReviewId ? "Update Review" : "Post Review"}
              </button>
              <button onClick={closeRateModal} disabled={savingReview}
                      className="flex-1 bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEWS LIST MODAL */}
      {reviewsForMedley && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto text-white">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-xl font-bold">💬 Reviews</h2>
                <p className="text-gray-400 text-sm truncate">"{reviewsForMedley.medleyName}"</p>
              </div>
              <button onClick={closeReviewsModal} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            {loadingReviews ? (
              <p className="text-gray-400 text-sm text-center py-6">Loading reviews...</p>
            ) : reviewsForMedley.reviewCount === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No reviews yet. Be the first!</p>
            ) : (
              <>
                <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-xl p-4 mb-4 text-center">
                  <p className="text-3xl font-bold text-yellow-400">{reviewsForMedley.averageRating.toFixed(1)}</p>
                  {renderStars(reviewsForMedley.averageRating, "text-xl")}
                  <p className="text-gray-400 text-xs mt-1">
                    Based on {reviewsForMedley.reviewCount} review{reviewsForMedley.reviewCount !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="space-y-3">
                  {reviewsForMedley.reviews.map((r) => (
                    <div key={r.ReviewId} className="bg-gray-800 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-semibold text-sm">{r.UserName || `User #${r.RatedByUserId}`}</p>
                        <span className="text-yellow-400">{renderStars(r.Rating)}</span>
                      </div>
                      {r.ReviewText && (
                        <p className="text-gray-300 text-sm mt-2 whitespace-pre-wrap">{r.ReviewText}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-2">
                        {new Date(r.CreatedAt).toLocaleDateString()}
                        {r.UpdatedAt && r.UpdatedAt !== r.CreatedAt && " · edited"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {retrimTrimClipId && (
        <ClipReTrimModal
          trimClipId={retrimTrimClipId}
          onClose={() => setRetrimTrimClipId(null)}
          onSaved={() => {
            setRetrimTrimClipId(null);
            setAudioBustToken(Date.now());
          }}
        />
      )}

      {/* Response Modal (ShopKeeper responding to a request) */}
{respondingRequest && (
  <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
    <div className="bg-gray-900 border-2 border-purple-600 p-6 rounded-2xl w-full max-w-md text-white">
      <h2 className="text-xl font-bold mb-1">
        {responseStatus === "Accepted" && "✅ Accept Request"}
        {responseStatus === "Rejected" && "❌ Reject Request"}
        {responseStatus === "Completed" && "🎉 Mark as Completed"}
      </h2>
      <p className="text-gray-400 text-sm mb-4">"{respondingRequest.RequestTitle}"</p>
      <label className="block text-gray-400 text-xs mb-1">Your Reply (optional)</label>
      <textarea
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        placeholder="Add a message for the client..."
        rows={4}
        maxLength={1000}
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 mb-3 text-sm resize-none"
      />
      <div className="flex gap-3">
        <button
          onClick={handleSubmitResponse}
          disabled={submittingResponse}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 ${
            responseStatus === "Rejected" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {submittingResponse ? "Sending..." : `Confirm ${responseStatus}`}
        </button>
        <button
          onClick={closeResponseModal}
          disabled={submittingResponse}
          className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}




      {/* =================================================== */}
      {/* 🎵 REQUEST MEDLEY MODAL                             */}
      {/* =================================================== */}
      <RequestMedleyModal
        isOpen={!!requestShopKeeper}
        onClose={closeRequestModal}
        shopKeeper={requestShopKeeper}
        currentUser={currentUser}
        onSuccess={handleRequestSuccess}
      />

      {/* =================================================== */}
      {/* ⚠️ GLOBAL CONFIRM MODAL                             */}
      {/* =================================================== */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={() => confirmState.onConfirm && confirmState.onConfirm()}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        icon={confirmState.icon}
        isLoading={confirmLoading}
      />
    </div>
  );
};

export default MyLibrary;