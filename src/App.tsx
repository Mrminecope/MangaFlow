import React, { useState, useEffect } from 'react';
import { LibraryScreen } from './ui/LibraryScreen';
import { ReaderScreen } from './ui/ReaderScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { CalibrationScreen } from './ui/CalibrationScreen';

type Screen =
  | { route: 'library' }
  | { route: 'reader'; id: string }
  | { route: 'settings' }
  | { route: 'calibration' };

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>({ route: 'library' });
  const [historyStack, setHistoryStack] = useState<Screen[]>([{ route: 'library' }]);

  // Browser popstate handler
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.route) {
        setCurrentScreen(e.state as Screen);
      } else {
        setCurrentScreen({ route: 'library' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (screen: Screen) => {
    setHistoryStack((prev) => [...prev, screen]);
    setCurrentScreen(screen);
    window.history.pushState(screen, '');
  };

  const goBack = () => {
    if (historyStack.length > 1) {
      const nextStack = [...historyStack];
      nextStack.pop();
      const prevScreen = nextStack[nextStack.length - 1];
      setHistoryStack(nextStack);
      setCurrentScreen(prevScreen);
    } else {
      setCurrentScreen({ route: 'library' });
    }
  };

  switch (currentScreen.route) {
    case 'reader':
      return (
        <ReaderScreen
          mangaId={currentScreen.id}
          onBack={goBack}
          onSettings={() => navigate({ route: 'settings' })}
        />
      );

    case 'settings':
      return (
        <SettingsScreen
          onBack={goBack}
          onCalibrate={() => navigate({ route: 'calibration' })}
        />
      );

    case 'calibration':
      return <CalibrationScreen onBack={goBack} />;

    case 'library':
    default:
      return (
        <LibraryScreen
          onOpen={(id) => navigate({ route: 'reader', id })}
          onSettings={() => navigate({ route: 'settings' })}
        />
      );
  }
};

export default App;
