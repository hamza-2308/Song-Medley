import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
   <div className="min-h-screen bg-gray-950 text-white px-5 py-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <p className="text-gray-400 text-sm">MEDLEY PRO</p>
          <h1 className="text-2xl font-bold">
            Hi, {user.UserName || "Guest"} ✨
          </h1>
        </div>
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold">
          {user.UserName ? user.UserName[0].toUpperCase() : "G"}
        </div>
      </div>

      {/* Quick Action */}
      <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">
        QUICK ACTION
      </p>
      <div
        onClick={() => navigate("/create-medley")}
        className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-5 mb-8 flex justify-between items-center cursor-pointer hover:opacity-90"
      >
        <div>
          <h2 className="text-xl font-bold mb-1">Create New Medley</h2>
          <p className="text-purple-200 text-sm">Start your masterpiece</p>
        </div>
        <div className="text-3xl">🎧</div>
      </div>

      {/* Your Collection */}
      <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">
        YOUR COLLECTION
      </p>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div
          onClick={() => navigate("/library")}
          className="bg-green-700 rounded-2xl p-5 cursor-pointer hover:opacity-90"
        >
          <div className="text-3xl mb-2">📚</div>
          <h3 className="font-bold text-lg">Library</h3>
          <p className="text-green-200 text-sm">Saved work</p>
        </div>
        <div
          onClick={() => navigate("/favourites")}
          className="bg-red-600 rounded-2xl p-5 cursor-pointer hover:opacity-90"
        >
          <div className="text-3xl mb-2">❤️</div>
          <h3 className="font-bold text-lg">Favourites</h3>
          <p className="text-red-200 text-sm">Top picks</p>
        </div>
      </div>

      {/* Configuration */}
      <p className="text-gray-400 text-xs font-semibold mb-3 tracking-widest">
        CONFIGURATION
      </p>
      <div
        onClick={() => navigate("/settings")}
        className="bg-orange-500 rounded-2xl p-5 flex justify-between items-center cursor-pointer hover:opacity-90"
      >
        <div>
          <h3 className="font-bold text-lg">Settings</h3>
          <p className="text-orange-100 text-sm">App preferences</p>
        </div>
        <div className="text-3xl">⚙️</div>
      </div>

      {/* Footer Quote */}
      <p className="text-gray-600 text-xs text-center mt-10 italic">
        "Where words fail, music speaks."
      </p>

    </div>
  );
};

export default Home;