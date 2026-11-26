import DjStudio from './components/DjStudio';

export type ActiveSection = 'POS' | 'SALES' | 'DASHBOARD' | 'INVENTORY' | 'STATIONS' | 'STAFF';

export default function App() {
  return <DjStudio />;
}
