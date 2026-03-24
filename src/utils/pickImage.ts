import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

type ImageSource = 'camera' | 'library';

export const pickImage = async (
  source: ImageSource,
): Promise<string | null> => {
  const options = {
    mediaType: 'photo' as const,
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8 as const,
  };

  const launcher = source === 'camera' ? launchCamera : launchImageLibrary;

  try {
    const response = await launcher(options);

    if (response.didCancel) {
      return null;
    }

    if (response.errorCode) {
      console.warn(`Image picker error: ${response.errorCode} - ${response.errorMessage}`);
      return null;
    }

    return response.assets?.[0]?.uri ?? null;
  } catch (error) {
    console.warn('Image picker failed:', error);
    return null;
  }
};
