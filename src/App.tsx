import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SpinnerIcon } from './components/icons';
import { useStore } from './store/useStore';
import { useProgressSync } from './hooks/useReadingProgress';

const Library = lazy(() => import('./pages/Library'));
const Reader = lazy(() => import('./pages/Reader'));
const Profile = lazy(() => import('./pages/Profile'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));

function PageFallback() {
  return (
    <div className="flex justify-center py-24 text-muted" role="status" aria-label="Loading">
      <SpinnerIcon size={28} />
    </div>
  );
}

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useProgressSync();

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Library />} />
            <Route path="/book/:slug" element={<Reader />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/saved" element={<Bookmarks />} />
            <Route path="*" element={<Library />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
