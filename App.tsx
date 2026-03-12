import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/types/navigation';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PlantDetailScreen } from './src/screens/PlantDetailScreen';
import { AddPlantScreen } from './src/screens/AddPlantScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { viraTheme } from './src/theme/vira';
import { usePlantStore } from './src/store/usePlantStore';

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
  const initialRouteName = usePlantStore.getState().hasOnboarded ? 'Home' : 'Onboarding';

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerStyle: {
              backgroundColor: viraTheme.colors.butterMoon,
            },
            headerTitleStyle: {
              ...viraTheme.typography.heading2,
              color: viraTheme.colors.hemlock,
            },
            headerTintColor: viraTheme.colors.hemlock,
          }}
        >
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{title: 'My Plants'}}
          />
          <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
          <Stack.Screen name="AddPlant" component={AddPlantScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;

