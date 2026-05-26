import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './views/Home';
import PlayerRoom from './views/PlayerRoom';
import DisplayView from './views/DisplayView';
import OperatorDash from './views/OperatorDash';
import { OperatorGuard, PlayerGuard } from './components/guards/RouteGuards';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* H1: Route guards prevent unauthorized access */}
        <Route path="/room/:code" element={<PlayerGuard><PlayerRoom /></PlayerGuard>} />
        <Route path="/display/:code" element={<DisplayView />} />
        <Route path="/operator/:code" element={<OperatorGuard><OperatorDash /></OperatorGuard>} />
      </Routes>
    </BrowserRouter>
  );
}
