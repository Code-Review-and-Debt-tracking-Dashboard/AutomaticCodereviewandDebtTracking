import { useEffect, useMemo, useState } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import type { NavigatorScreenParams, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OverviewScreen from '../screens/OverviewScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RepoSummaryScreen from '../screens/RepoSummaryScreen';
import { useTheme } from '../contexts/PreferencesContext';
import { onPushTap } from '../lib/pushNotifications';
import { fonts } from '../theme';

export type HomeStackParamList = {
  RepoList: undefined;
  RepoSummary: { repoId: string; repoName: string };
};

export type RootTabParamList = {
  Overview: undefined;
  Repositories: NavigatorScreenParams<HomeStackParamList>;
  Notifications: undefined;
  Profile: undefined;
};

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<keyof RootTabParamList, [IconName, IconName]> = {
  Overview: ['grid', 'grid-outline'],
  Repositories: ['git-branch', 'git-branch-outline'],
  Notifications: ['notifications', 'notifications-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackScreen() {
  const { colors } = useTheme();

  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <HomeStack.Screen name="RepoList" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen
        name="RepoSummary"
        component={RepoSummaryScreen}
        options={({ route }) => ({ title: route.params.repoName })}
      />
    </HomeStack.Navigator>
  );
}

export default function TabNavigator() {
  const { colors, isDark } = useTheme();
  const navigationRef = useNavigationContainerRef<RootTabParamList>();
  const [navReady, setNavReady] = useState(false);

  // Tapping a push opens the inbox. Waits for the container, or a tap that
  // cold-started the app would navigate before there is anything to navigate.
  useEffect(() => {
    if (!navReady) return;
    return onPushTap(() => navigationRef.navigate('Notifications'));
  }, [navReady, navigationRef]);

  // Keeps react-navigation's own surfaces (headers, transitions, the flash
  // behind a screen while it mounts) on the same palette as the screens.
  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.tabBar,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)} theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.3 },
          sceneStyle: { backgroundColor: colors.bg },
          tabBarIcon: ({ color, size, focused }) => {
            const [active, inactive] = TAB_ICONS[route.name];
            return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Overview" component={OverviewScreen} />
        <Tab.Screen name="Repositories" component={HomeStackScreen} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
