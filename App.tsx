import React, {useEffect} from 'react';
import {StatusBar, ActivityIndicator, View, StyleSheet} from 'react-native';
import {NavigationContainer, DefaultTheme, Theme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from './src/types/navigation';
import {OnboardingScreen} from './src/screens/OnboardingScreen';
import {LoginScreen} from './src/screens/LoginScreen';
import {SignUpScreen} from './src/screens/SignUpScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {PlantDetailScreen} from './src/screens/PlantDetailScreen';
import {AddPlantScreen} from './src/screens/AddPlantScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {viraTheme} from './src/theme/vira';
import {usePlantStore} from './src/store/usePlantStore';
import {useAuthStore} from './src/store/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSession, onAuthStateChange, configureGoogleSignIn} from './src/services/auth';
import {requestPermission} from './src/services/notificationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: viraTheme.colors.butterMoon,
    primary: viraTheme.colors.hemlock,
    text: viraTheme.colors.lagoon,
    border: viraTheme.colors.hemlock,
    notification: viraTheme.colors.vermillion,
    card: viraTheme.colors.butterMoon,
  },
};

const App = () => {
  const hasOnboarded = usePlantStore(s => s.hasOnboarded);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const setSession = useAuthStore(s => s.setSession);
  const setLoading = useAuthStore(s => s.setLoading);

  const loadPlants = usePlantStore(s => s.loadPlants);
  const setHasOnboarded = usePlantStore(s => s.setHasOnboarded);

  useEffect(() => {
    configureGoogleSignIn();

    // Hydrate hasOnboarded from AsyncStorage before auth check to prevent
    // flashing the onboarding screen on relaunch
    AsyncStorage.getItem('hasOnboarded').then(value => {
      if (value === 'true') setHasOnboarded(true);
    }).catch(() => {});

    // Check for existing session on launch
    getSession().then(session => {
      setSession(session);
      setLoading(false);
      if (session) loadPlants();
    }).catch(() => {
      setLoading(false);
    });

    // Listen for auth state changes
    const setPlants = usePlantStore.getState().setPlants;
    const subscription = onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadPlants();
      } else {
        // Clear plant data on sign-out to prevent data leaking between users
        setPlants([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, setLoading, loadPlants, setHasOnboarded]);

  // Request notification permission once after onboarding + auth
  useEffect(() => {
    if (hasOnboarded && isAuthenticated) {
      requestPermission().catch(() => {});
    }
  }, [hasOnboarded, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={viraTheme.colors.hemlock} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: viraTheme.colors.butterMoon,
            },
            headerTitleStyle: {
              ...viraTheme.typography.heading2,
              color: viraTheme.colors.hemlock,
            },
            headerTintColor: viraTheme.colors.hemlock,
          }}>
          {!hasOnboarded ? (
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{headerShown: false}}
            />
          ) : null}
          {!isAuthenticated ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="SignUp"
                component={SignUpScreen}
                options={{headerShown: false}}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{title: 'My Plants'}}
              />
              <Stack.Screen
                name="PlantDetail"
                component={PlantDetailScreen}
                options={{
                  headerTransparent: true,
                  headerTitle: '',
                  headerTintColor: viraTheme.colors.white,
                }}
              />
              <Stack.Screen name="AddPlant" component={AddPlantScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: viraTheme.colors.background,
  },
});

export default App;
