export type RootStackParamList = {
    Onboarding: undefined;
    Home: undefined;
    PlantDetail: { plantId: string };
    AddPlant: { defaultLocation?: string } | undefined;
    Settings: undefined;
  };
