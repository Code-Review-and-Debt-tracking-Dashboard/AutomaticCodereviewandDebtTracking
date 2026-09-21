import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RepoSummaryScreen from '../screens/RepoSummaryScreen';
import { colors } from '../theme';

export type HomeStackParamList = {
  RepoList: undefined;
  RepoSummary: { repoId: string; repoName: string };
};

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
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
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.success,
          tabBarInactiveTintColor: colors.textMuted,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tab.Screen name="Home" component={HomeStackScreen} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
