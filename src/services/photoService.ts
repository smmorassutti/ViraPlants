import {supabase} from './supabase';

/**
 * Upload a plant photo to Supabase Storage.
 * Path: plant-photos/{userId}/{plantId}/{timestamp}.jpg
 * Returns the public URL of the uploaded photo.
 */
export const uploadPlantPhoto = async (
  userId: string,
  plantId: string,
  localUri: string,
): Promise<string> => {
  const timestamp = Date.now();
  const filePath = `${userId}/${plantId}/${timestamp}.jpg`;

  // Read the local file as an ArrayBuffer (blob() returns empty in React Native)
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const {error} = await supabase.storage
    .from('plant-photos')
    .upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  // Return the public URL via Supabase SDK
  const {data} = supabase.storage
    .from('plant-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Delete a plant photo from Supabase Storage.
 * Extracts the storage path from the public URL.
 */
export const deletePlantPhoto = async (publicUrl: string): Promise<void> => {
  const prefix = '/storage/v1/object/public/plant-photos/';
  const idx = publicUrl.indexOf(prefix);
  if (idx === -1) return;

  const filePath = publicUrl.slice(idx + prefix.length);
  const {error} = await supabase.storage
    .from('plant-photos')
    .remove([filePath]);

  if (error) {
    console.warn('Failed to delete photo from storage:', error);
  }
};
