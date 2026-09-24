import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PreferencesProvider, useTheme, usePreferences } from './contexts/PreferencesContext';
import TabNavigator from './navigation/TabNavigator';
import LoginScreen from './screens/LoginScreen';

function Root() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoaded } = usePreferences();
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Wait for stored preferences too, so a dark-mode user never sees a light flash. */}
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
