import Footer from './components/Footer';
import Header from './components/Header';
import LeftUI from './components/LeftUI';
import RightUI from './components/RightUI';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <div className="t_header"><Header /></div>
      <div className="t_leftui"><LeftUI /></div>
      <div className="t_canvas"><canvas /></div>
      <div className="t_rightui"><RightUI /></div>
      <div className="t_footer"><Footer /></div>
    </div>
  );
}

export default App;
