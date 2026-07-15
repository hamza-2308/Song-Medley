import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./component/Auth/login";
import Signup from "./component/Auth/signUp";
import Home from "./component/pages/Home";
import CreateMedley from "./component/pages/CreateMedley";
import MyLibrary from "./component/pages/MyLibrary";
import Settings from "./component/pages/Settings";
import Favourites from "./component/pages/Favourites";
 import SharedMedleys from "./component/pages/SharedMedleys"; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/create-medley" element={<CreateMedley />} />
        <Route path="/library" element={<MyLibrary />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/favourites" element={<Favourites />} />
          <Route path="/shared-medleys" element={<SharedMedleys />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;