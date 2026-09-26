import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PreferencesProvider, useTheme, usePreferences } from './contexts/PreferencesContext';
import { registerForPush, unregisterFromPush } from './lib/pushNotifications';
import TabNavigator from './navigation/TabNavigator';
import LoginScreen from './screens/LoginScreen';

function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoaded, notificationsEnabled } = usePreferences();
  const { colors, isDark } = useTheme();

  // registered only when signed in with notifications on
  const wantsPush = isAuthenticated && isLoaded && notificationsEnabled;
  useEffect(() => {
    void (wantsPush ? registerForPush() : unregisterFromPush());
  }, [wantsPush]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* wait for prefs so dark mode doesn't flash light */}
      {isLoading || !isLoaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isAuthenticated ? (
        <TabNavigator />
      ) : (
        <LoginScreen />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
