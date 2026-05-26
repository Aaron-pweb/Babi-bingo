import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './views/Home';
import PlayerRoom from './views/PlayerRoom';
import DisplayView from './views/DisplayView';
import OperatorDash from './views/OperatorDash';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<PlayerRoom />} />
        <Route path="/display/:code" element={<DisplayView />} />
        <Route path="/operator/:code" element={<OperatorDash />} />
      </Routes>
    </BrowserRouter>
  );
}
