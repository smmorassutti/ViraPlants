export type RootStackParamList = {
    Onboarding: undefined;
    Login: undefined;
    SignUp: undefined;
    Home: undefined;
    PlantDetail: { plantId: string };
    AddPlant: { defaultLocation?: string } | undefined;
    Settings: undefined;
  };
